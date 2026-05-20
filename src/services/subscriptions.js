export const TRACE_EVENTS = [
  "beforeCallMethod",
  "afterCallMethod",
  "propertyGet",
  "propertySet",
];

export const TRACE_CALL_EVENTS = ["beforeCallMethod", "afterCallMethod"];
export const TRACE_PROPERTY_EVENTS = ["propertyGet", "propertySet"];

const defaultBatchOptions = {
  maxBatchSize: 100,
  flushIntervalMs: 16,
  bufferSize: 2000,
};

const ensureCallback = (callback) => {
  if (!callback) {
    throw new Error("Укажите колбек!");
  }
};

export const createStore = () => [];

export const subscribeEvents = ({ emitter, events, callback }) => {
  events.forEach((eventName) => emitter.subscribe(eventName, callback));
  return { events, callback };
};

export const unsubscribeEvents = ({ emitter, token }) => {
  if (!token) {
    return;
  }
  if (typeof token.dispose === "function") {
    token.dispose();
  }
  token.events.forEach((eventName) => emitter.unSubscribe(eventName, token.callback));
};

const trace = ({ emitter, store, events, callback }) => {
  ensureCallback(callback);
  store.push(subscribeEvents({ emitter, events, callback }));
};

const untrace = ({ emitter, store }) => {
  store.forEach((token) => unsubscribeEvents({ emitter, token }));
  store.length = 0;
};

export const traceAll = ({ emitter, store, callback }) =>
  trace({ emitter, store, events: TRACE_EVENTS, callback });

export const traceCalls = ({ emitter, store, callback }) =>
  trace({ emitter, store, events: TRACE_CALL_EVENTS, callback });

export const traceProperties = ({ emitter, store, callback }) =>
  trace({ emitter, store, events: TRACE_PROPERTY_EVENTS, callback });

const createBatchBuffer = (callback, options = {}) => {
  const config = {
    ...defaultBatchOptions,
    ...(options || {}),
  };

  let queue = [];
  let timer = null;

  const flushNow = () => {
    if (timer) {
      clearTimeout(timer);
      timer = null;
    }
    if (queue.length === 0) {
      return;
    }
    const batch = queue;
    queue = [];
    callback(batch);
  };

  const schedule = () => {
    if (timer) {
      return;
    }
    timer = setTimeout(flushNow, config.flushIntervalMs);
  };

  const push = (event) => {
    if (queue.length >= config.bufferSize) {
      queue.shift();
    }
    queue.push(event);
    if (queue.length >= config.maxBatchSize) {
      flushNow();
      return;
    }
    schedule();
  };

  const dispose = () => {
    flushNow();
  };

  return { push, dispose };
};

const traceBatched = ({ emitter, store, events, callback, options }) => {
  ensureCallback(callback);
  const batchBuffer = createBatchBuffer(callback, options);
  const token = subscribeEvents({
    emitter,
    events,
    callback: (event) => batchBuffer.push(event),
  });
  token.dispose = () => batchBuffer.dispose();
  store.push(token);
};

export const traceAllBatched = ({ emitter, store, callback, options }) =>
  traceBatched({ emitter, store, events: TRACE_EVENTS, callback, options });

export const traceCallsBatched = ({ emitter, store, callback, options }) =>
  traceBatched({ emitter, store, events: TRACE_CALL_EVENTS, callback, options });

export const tracePropertiesBatched = ({ emitter, store, callback, options }) =>
  traceBatched({ emitter, store, events: TRACE_PROPERTY_EVENTS, callback, options });

export const untraceAll = ({ emitter, store }) => untrace({ emitter, store });

export const untraceCalls = ({ emitter, store }) => untrace({ emitter, store });

export const untraceProperties = ({ emitter, store }) => untrace({ emitter, store });
