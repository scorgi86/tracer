import {
  TRACE_EVENTS,
  TRACE_CALL_EVENTS,
  subscribeEvents,
  unsubscribeEvents,
} from "./subscriptions.js";

const sliceExecutionDepth = new Map();

const normalizeSliceConfig = (config) => {
  if (typeof config === "function") {
    return {
      predicate: config,
      beforeCall: () => true,
      afterCall: () => false,
    };
  }
  return config;
};

const syncState = (sliceRuntime, tracerState, sliceName) => {
  const active = sliceRuntime.stickyActive || sliceRuntime.callTokens.size > 0;
  tracerState.set(sliceName, active);
};

const getCallToken = (eventArgs) =>
  eventArgs && eventArgs.callId != null ? `call:${eventArgs.callId}` : Symbol("slice-call");

const removeCallToken = (sliceRuntime, eventArgs) => {
  const callToken = getCallToken(eventArgs);
  if (typeof callToken === "string") {
    sliceRuntime.callTokens.delete(callToken);
    return;
  }

  // For anonymous calls (without callId) remove any symbol token.
  for (const token of sliceRuntime.callTokens) {
    if (typeof token === "symbol") {
      sliceRuntime.callTokens.delete(token);
      return;
    }
  }
};

export const registerSliceDefinition = ({
  stateConfig,
  tracerState,
  sliceName,
  config,
  logger = console,
}) => {
  if (stateConfig.has(sliceName)) {
    throw new Error(`Имя слайса трассировки "${sliceName}" уже определено`);
  }

  const normalizedConfig = normalizeSliceConfig(config);
  if (!normalizedConfig || typeof normalizedConfig !== "object") {
    throw new Error("Аргумент config должен быть объектом");
  }

  const sliceRuntime = {
    config: normalizedConfig,
    callbacks: new Map(),
    enabled: false,
    disabled: false,
    callTokens: new Set(),
    callTokensSubs: null,
    stickyActive: Boolean(normalizedConfig.initial),
  };

  const { beforeCall, afterCall } = normalizedConfig;

  sliceRuntime.beforeCallCallback = (args) => {
    if (!normalizedConfig.predicate(args)) {
      return;
    }

    if (beforeCall(args)) {
      sliceRuntime.callTokens.add(getCallToken(args));
      syncState(sliceRuntime, tracerState, sliceName);
    }
  };

  sliceRuntime.afterCallCallback = (args) => {
    if (!normalizedConfig.predicate(args)) {
      return undefined;
    }

    const result = afterCall(args);
    if (result === false) {
      sliceRuntime.stickyActive = false;
      removeCallToken(sliceRuntime, args);
    } else if (result === true) {
      sliceRuntime.stickyActive = true;
      removeCallToken(sliceRuntime, args);
    }

    syncState(sliceRuntime, tracerState, sliceName);
    return result;
  };

  syncState(sliceRuntime, tracerState, sliceName);
  stateConfig.set(sliceName, sliceRuntime);

  logger.log(`Зарегистрирован TraceStreamSlice - ${sliceName}`);
  logger.log(`${sliceName} - ${normalizedConfig.description || "Описание не определено"}`);
};

export const executeInSlice = ({ tracerState, sliceName, invoke }) => {
  const nextDepth = (sliceExecutionDepth.get(sliceName) || 0) + 1;
  sliceExecutionDepth.set(sliceName, nextDepth);
  tracerState.set(sliceName, true);

  const finalizeSlice = () => tracerState.set(sliceName, false);
  const releaseSlice = () => {
    const depth = (sliceExecutionDepth.get(sliceName) || 1) - 1;
    if (depth <= 0) {
      sliceExecutionDepth.delete(sliceName);
      finalizeSlice();
      return;
    }
    sliceExecutionDepth.set(sliceName, depth);
    tracerState.set(sliceName, true);
  };

  try {
    const result = invoke();
    if (result && typeof result.finally === "function") {
      return result.finally(releaseSlice);
    }
    releaseSlice();
    return result;
  } catch (error) {
    releaseSlice();
    throw error;
  }
};

export const disableSliceListeners = ({ emitter, stateConfig, sliceName }) => {
  const sliceRuntime = stateConfig.get(sliceName);
  if (!sliceRuntime || !sliceRuntime.callTokensSubs) {
    return;
  }

  sliceRuntime.callTokensSubs.forEach((token) => unsubscribeEvents({ emitter, token }));
  sliceRuntime.callTokensSubs = null;
  sliceRuntime.enabled = false;
};

export const enableSlice = ({ emitter, stateConfig, sliceName }) => {
  const sliceRuntime = stateConfig.get(sliceName);
  if (!sliceRuntime) {
    throw new Error(`Не определен слайс ${sliceName}`);
  }
  if (sliceRuntime.enabled || sliceRuntime.disabled) {
    return;
  }

  sliceRuntime.callTokensSubs = [
    subscribeEvents({
      emitter,
      events: [TRACE_CALL_EVENTS[0]],
      callback: sliceRuntime.beforeCallCallback,
    }),
    subscribeEvents({
      emitter,
      events: [TRACE_CALL_EVENTS[1]],
      callback: sliceRuntime.afterCallCallback,
    }),
  ];
  sliceRuntime.enabled = true;
};

export const defineSlice = ({ emitter, stateConfig, tracerState, sliceName, config, logger }) => {
  registerSliceDefinition({ stateConfig, tracerState, sliceName, config, logger });
  enableSlice({ emitter, stateConfig, sliceName });
};

export const traceBySlice = ({ emitter, stateConfig, sliceName, callback }) => {
  if (!sliceName || !callback) {
    throw new Error("Укажите имя контекста и колбек");
  }

  const sliceRuntime = stateConfig.get(sliceName);
  if (!sliceRuntime) {
    throw new Error(`Не определен слайс ${sliceName}`);
  }

  const wrappedCallback = (args) => {
    if (args.tracerState.get(sliceName)) {
      callback(args);
    }
  };

  const token = subscribeEvents({
    emitter,
    events: TRACE_EVENTS,
    callback: wrappedCallback,
  });

  sliceRuntime.callbacks.set(callback, token);
};

export const traceBySliceOnce = ({ emitter, stateConfig, sliceName, callback }) => {
  const oneShot = (args) => {
    callback(args);
    untraceBySlice({ emitter, stateConfig, sliceName, callback: oneShot });
  };
  traceBySlice({ emitter, stateConfig, sliceName, callback: oneShot });
};

export const untraceBySlice = ({ emitter, stateConfig, sliceName, callback }) => {
  const sliceRuntime = stateConfig.get(sliceName);
  if (!sliceRuntime?.callbacks) {
    return;
  }

  if (callback) {
    const token = sliceRuntime.callbacks.get(callback);
    unsubscribeEvents({ emitter, token });
    sliceRuntime.callbacks.delete(callback);
    return;
  }

  sliceRuntime.callbacks.forEach((token) => {
    unsubscribeEvents({ emitter, token });
  });
  sliceRuntime.callbacks.clear();
};

export const getEnabledSlices = ({ stateConfig, tracerState }) =>
  Array.from(stateConfig.keys()).filter((sliceName) => tracerState.get(sliceName) === true);

export const disableSlice = ({ emitter, stateConfig, tracerState, sliceName }) => {
  const sliceRuntime = stateConfig.get(sliceName);
  if (sliceRuntime && !sliceRuntime.disabled) {
    sliceRuntime.disabled = true;
    sliceRuntime.stickyActive = false;
    sliceRuntime.callTokens.clear();
    tracerState.set(sliceName, false);
    disableSliceListeners({ emitter, stateConfig, sliceName });
  }
};

export const getRegisteredSlices = ({ stateConfig }) => Array.from(stateConfig.keys());
