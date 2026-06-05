const TARGET_CALLBACKS_KEY = "__WEBPACK_TRACER_TARGET_CALLBACKS__";

const normalizeClassConfig = (classConfig) => {
    if (classConfig instanceof Map) {
        return new Map(classConfig);
    }
    return new Map(Object.entries(classConfig || {}));
};

const normalizeTargets = (options) => {
    const allowCallback = options.targetsCallbackEnabled === true && !!options.targetsCallbackKey;

    if (typeof options.targets === "function") {
        return options.targets;
    }
    if (allowCallback) {
        const root = globalThis;
        const registry = root[TARGET_CALLBACKS_KEY] || {};
        const fn = registry[options.targetsCallbackKey];
        if (typeof fn === "function") {
            return fn;
        }
    }
    if (options.targets instanceof Set) {
        return options.targets;
    }
    if (Array.isArray(options.targets)) {
        return new Set(options.targets);
    }
    return new Set();
};

function defaultOnConstructor() {
    return "";
}

module.exports = function normalizeOptions(options = {}) {
    return {
        targets: normalizeTargets(options),
        generateCode: options.generateCode || { onConstructor: defaultOnConstructor },
        classConfig: normalizeClassConfig(options.classConfig),
        maxCacheEntries: options.maxCacheEntries || 500,
        trackPrototypes: options.trackPrototypes !== false,
        trackInheritance: options.trackInheritance !== false,
        insertPosition: options.insertPosition || "end",
        debug: options.debug,
        fallbackOnError: options.fallbackOnError === true,
        allowTargetsCallbackInDebug: options.allowTargetsCallbackInDebug === true,
        targetsCallbackEnabled: options.targetsCallbackEnabled === true,
        targetsCallbackKey: options.targetsCallbackKey || "",
        disableProcessCache: options.disableProcessCache === true,
        disableProcessCacheInWatch: options.disableProcessCacheInWatch !== false,
        disableWebpackLoaderCacheInWatch: options.disableWebpackLoaderCacheInWatch !== false,
    };
};

module.exports.TARGET_CALLBACKS_KEY = TARGET_CALLBACKS_KEY;
