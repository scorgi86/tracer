const SWCInjectLoader = require("./SWCInjectLoader");

const loaderCache = new Map();
const TARGET_CALLBACKS_KEY = "__WEBPACK_TRACER_TARGET_CALLBACKS__";
const buildTargetsCallback = (source) => {
    if (!source || typeof source !== "string") {
        return null;
    }

    try {
        return new Function(`return (${source});`)();
    } catch (error) {
        console.error("Failed to restore targets callback from source:", error);
        return null;
    }
};

const buildLoaderKey = (opts) => {
    const targets = typeof opts.targets === 'function'
        ? `fn:${opts.targets.toString()}`
        : Array.from(opts.targets || []).sort().join('|');
    const classConfig = Array.from((opts.classConfig || new Map()).entries())
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([k, v]) => `${k}:${JSON.stringify(v)}`)
        .join('|');
    const flags = [
        opts.trackPrototypes !== false,
        opts.trackInheritance !== false,
        opts.debug ? 1 : 0
    ].join('|');
    const genSig = opts.generateCode?.construct
        ? opts.generateCode.construct.toString()
        : '';
    return [targets, classConfig, flags, genSig].join('||');
};

const normalizeOptions = (options) => ({
    targets: (() => {
        if (typeof options.targets === "function") {
            return options.targets;
        }
        if (
            options.targets &&
            typeof options.targets === "object" &&
            typeof options.targets.__tracerTargetsCallbackSource === "string"
        ) {
            const fn = buildTargetsCallback(options.targets.__tracerTargetsCallbackSource);
            if (typeof fn === "function") {
                return fn;
            }
        }
        if (options.targetsCallbackEnabled && options.targetsCallbackKey) {
            const root = globalThis;
            const registry = root[TARGET_CALLBACKS_KEY] || {};
            const fn = registry[options.targetsCallbackKey];
            if (typeof fn === "function") {
                if (options.debug) {
                    console.log("[TRACER] targets restored from global registry");
                }
                return fn;
            }
        }
        if (options.targetsCallbackEnabled && options.targetsCallbackSource) {
            const fn = buildTargetsCallback(options.targetsCallbackSource);
            if (typeof fn === "function") {
                if (options.debug) {
                    console.log("[TRACER] targets restored from callback source");
                }
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
    })(),
    classConfig: new Map(Object.entries(options.classConfig || {})),
    trackPrototypes: options.trackPrototypes !== false,
    trackInheritance: options.trackInheritance !== false,
    generateCode: options.generateCode,
    insertPosition: options.insertPosition || "end",
    debug: options.debug,
    fallbackOnError: options.fallbackOnError === true
});

// Webpack loader
module.exports = function(source) {
    const callback = this.async();
    const resourcePath = this.resourcePath;
    
    this.cacheable(true);
    
    const rawOptions = this.getOptions() || {};
    const normalized = normalizeOptions(rawOptions);
    if (normalized.debug && this.resourcePath && this.resourcePath.includes("word\\Drawing\\HtmlPage.js")) {
        console.log("[TRACER] loader hit", this.resourcePath);
        console.log("[TRACER] targets type", typeof normalized.targets);
    }
    const key = buildLoaderKey(normalized);
    
    if (!loaderCache.has(key)) {
        loaderCache.set(key, new SWCInjectLoader(normalized));
    }
    
    const loader = loaderCache.get(key);
    
    loader.processCode(source, resourcePath)
        .then(result => {
            callback(null, result);
        })
        .catch(error => {
            if (normalized.fallbackOnError) {
                console.error(`SWC loader error in ${resourcePath}, returning original source:`, error);
                callback(null, source);
                return;
            }
            callback(error);
        });
};
