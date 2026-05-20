const parseFunction = (source, options = {}) => {
  if (typeof source !== "string" || source.trim() === "") {
    return undefined;
  }

  if (typeof options.functionParser === "function") {
    return options.functionParser(source);
  }

  if (options.allowUnsafeEval === true) {
    return new Function(`return (${source});`)();
  }

  return undefined;
};

export const exportSliceScenarios = ({ stateConfig, tracerState, options = {} }) => {
  const includeFunctions = options.includeFunctions !== false;
  const normalizeFn = (fn) => {
    if (!includeFunctions) {
      return undefined;
    }
    return typeof fn === "function" ? fn.toString() : undefined;
  };

  const slices = Array.from(stateConfig.entries()).map(([name, sliceConfig]) => {
    const config = sliceConfig.config || {};
    return {
      name,
      description: config.description,
      initial: Object.prototype.hasOwnProperty.call(config, "initial")
        ? config.initial
        : tracerState.get(name),
      disabled: Boolean(sliceConfig.disabled),
      predicate: normalizeFn(config.predicate),
      beforeCall: normalizeFn(config.beforeCall),
      afterCall: normalizeFn(config.afterCall),
    };
  });

  return {
    version: 1,
    exportedAt: new Date().toISOString(),
    slices,
  };
};

export const importSliceScenarios = ({
  payload,
  options = {},
  stateConfig,
  registerSliceDefinition,
  enableSlice,
  disableSlice,
  untraceBySlice,
  disableSliceListeners,
}) => {
  if (!payload || !Array.isArray(payload.slices)) {
    throw new Error("Некорректный payload сценариев: ожидается объект c массивом slices");
  }

  const overwrite = options.overwrite !== false;
  const activate = options.activate !== false;

  payload.slices.forEach((slice) => {
    const { name } = slice;
    if (!name) {
      return;
    }

    const exists = stateConfig.has(name);
    if (exists && !overwrite) {
      return;
    }

    if (exists && overwrite) {
      untraceBySlice(name);
      disableSliceListeners(name);
      stateConfig.delete(name);
    }

    const predicate = parseFunction(slice.predicate, options) || (() => false);
    const beforeCall = parseFunction(slice.beforeCall, options) || (() => true);
    const afterCall = parseFunction(slice.afterCall, options) || (() => false);

    registerSliceDefinition(name, {
      predicate,
      beforeCall,
      afterCall,
      initial: slice.initial,
      description: slice.description,
    });

    if (activate) {
      enableSlice(name);
    }

    if (slice.disabled) {
      disableSlice(name);
    }
  });
};
