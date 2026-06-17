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

const unique = (values) => Array.from(new Set(values));

const toArray = (value) => Array.isArray(value) ? value : [value];

const normalizeEventTypes = (eventTypes) => {
  if (!eventTypes || eventTypes === "all") {
    return {
      events: TRACE_EVENTS,
      semanticTypes: null,
    };
  }

  if (eventTypes === "calls" || eventTypes === "functionCall") {
    return {
      events: TRACE_CALL_EVENTS,
      semanticTypes: ["functionCall"],
    };
  }

  if (eventTypes === "properties") {
    return {
      events: TRACE_PROPERTY_EVENTS,
      semanticTypes: ["propertyGet", "propertySet"],
    };
  }

  const events = [];
  const semanticTypes = [];

  toArray(eventTypes).filter(Boolean).forEach((eventType) => {
    if (eventType === "calls" || eventType === "functionCall") {
      events.push(...TRACE_CALL_EVENTS);
      semanticTypes.push("functionCall");
      return;
    }

    if (eventType === "properties") {
      events.push(...TRACE_PROPERTY_EVENTS);
      semanticTypes.push("propertyGet", "propertySet");
      return;
    }

    if (TRACE_EVENTS.includes(eventType)) {
      events.push(eventType);
      semanticTypes.push(TRACE_CALL_EVENTS.includes(eventType) ? "functionCall" : eventType);
      return;
    }

    if (eventType === "propertyGet" || eventType === "propertySet") {
      events.push(eventType);
      semanticTypes.push(eventType);
    }
  });

  return {
    events: unique(events.length > 0 ? events : TRACE_EVENTS),
    semanticTypes: semanticTypes.length > 0 ? unique(semanticTypes) : null,
  };
};

export const normalizeTraceOptions = (options = {}) => {
  const normalizedOptions = options && typeof options === "object" ? options : {};
  const eventConfig = normalizeEventTypes(normalizedOptions.eventTypes);

  return {
    ...normalizedOptions,
    events: eventConfig.events,
    semanticTypes: eventConfig.semanticTypes,
    once: normalizedOptions.once === true,
    batch: normalizedOptions.batch || false,
  };
};

const matchesValueSelector = (selector, value, event) => {
  if (selector === undefined || selector === null) {
    return true;
  }

  if (typeof selector === "function") {
    return selector(value, event) === true;
  }

  if (selector instanceof RegExp) {
    return selector.test(String(value || ""));
  }

  if (Array.isArray(selector)) {
    return selector.some((item) => matchesValueSelector(item, value, event));
  }

  return value === selector;
};

const matchesPropertySelector = (selector, event) => {
  if (selector === undefined || selector === null) {
    return true;
  }

  if (typeof selector === "function") {
    return selector(event) === true;
  }

  return [event.propName, event.fullName]
    .filter(Boolean)
    .some((value) => matchesValueSelector(selector, value, event));
};

const matchesSliceSelector = (selector, event) => {
  if (selector === undefined || selector === null) {
    return true;
  }

  if (typeof selector === "function") {
    return selector(event) === true;
  }

  if (Array.isArray(selector)) {
    return selector.some((sliceName) => event.tracerState?.get(sliceName) === true);
  }

  return event.tracerState?.get(selector) === true;
};

const matchesSliceSequence = (sequence, event) => {
  if (!sequence) {
    return true;
  }

  return Array.isArray(sequence) && sequence.every((sliceName) => event.tracerState?.get(sliceName) === true);
};

export const matchesTraceOptions = (event, options) => {
  if (options.semanticTypes && !options.semanticTypes.includes(event.eventType)) {
    return false;
  }

  return matchesSliceSelector(options.slice, event) &&
    matchesSliceSequence(options.sliceSequence, event) &&
    matchesValueSelector(options.fullName, event.fullName, event) &&
    matchesValueSelector(options.className, event.className, event) &&
    matchesValueSelector(options.fnKey, event.fnKey, event) &&
    matchesValueSelector(options.place, event.place, event) &&
    matchesPropertySelector(options.property, event);
};

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

export const traceSubscription = ({ emitter, store, callback, options = {} }) => {
  ensureCallback(callback);

  const normalizedOptions = normalizeTraceOptions(options);
  let token = null;
  let batchBuffer = null;

  const unsubscribe = () => {
    unsubscribeEvents({ emitter, token });
    if (store) {
      const index = store.indexOf(token);
      if (index >= 0) {
        store.splice(index, 1);
      }
    }
  };

  const emitEvent = (event) => {
    if (normalizedOptions.batch) {
      batchBuffer.push(event);
      return;
    }

    callback(event);
  };

  const wrappedCallback = (event) => {
    if (!matchesTraceOptions(event, normalizedOptions)) {
      return;
    }

    emitEvent(event);

    if (normalizedOptions.once) {
      unsubscribe();
    }
  };

  if (normalizedOptions.batch) {
    batchBuffer = createBatchBuffer(
      callback,
      normalizedOptions.batch === true ? {} : normalizedOptions.batch,
    );
  }

  token = subscribeEvents({
    emitter,
    events: normalizedOptions.events,
    callback: wrappedCallback,
  });

  token.dispose = () => {
    if (batchBuffer) {
      batchBuffer.dispose();
    }
  };

  if (store) {
    store.push(token);
  }

  return unsubscribe;
};

const untrace = ({ emitter, store }) => {
  store.forEach((token) => unsubscribeEvents({ emitter, token }));
  store.length = 0;
};

export const untraceAll = ({ emitter, store }) => untrace({ emitter, store });

export const untraceCalls = ({ emitter, store }) => untrace({ emitter, store });

export const untraceProperties = ({ emitter, store }) => untrace({ emitter, store });
