const defaultNoisyCalls = [
  "CEditorPage.onTimerScroll",
  "PaintMessageLoop._animation",
  "baseEditorsApi._autoSave",
];

const toArray = (value, fallback = []) => {
  if (Array.isArray(value)) {
    return value.filter((item) => typeof item === "string" && item.length > 0);
  }
  return [...fallback];
};

export const buildTraceOptions = (options = {}) => ({
  profile: typeof options.profile === "string" ? options.profile : "balanced",
  enableCalls: options.enableCalls !== false,
  enableProperties: options.enableProperties === true,
  suppressNoisy: options.suppressNoisy !== false,
  noisyCalls: toArray(options.noisyCalls, defaultNoisyCalls),
  noisyProperties: toArray(options.noisyProperties, []),
  callFilter: typeof options.callFilter === "function" ? options.callFilter : null,
  propertyFilter: typeof options.propertyFilter === "function" ? options.propertyFilter : null,
  captureContext: options.captureContext === true,
  throwSubscriberErrors: options.throwSubscriberErrors !== false,
  onSubscriberError: typeof options.onSubscriberError === "function"
    ? options.onSubscriberError
    : null,
  instrumentationReport: options.instrumentationReport === true,
  throwOnInstrumentationError: options.throwOnInstrumentationError === true,
  onInstrumentationError: typeof options.onInstrumentationError === "function"
    ? options.onInstrumentationError
    : null,
});

export const traceOptionsSymbol = Symbol("trace-options");
