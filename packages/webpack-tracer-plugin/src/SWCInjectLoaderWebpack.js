const SWCInjectLoader = require("./SWCInjectLoader");
const pluginPkg = require("../package.json");
const swcPkg = require("@swc/core/package.json");

const loaderCache = new Map();
const TARGET_CALLBACKS_KEY = "__WEBPACK_TRACER_TARGET_CALLBACKS__";
const TRACER_LOADER_METRICS_KEY = "__WEBPACK_TRACER_LOADER_METRICS__";

const buildLoaderKey = (opts) => {
    const pluginVersion = pluginPkg && pluginPkg.version ? pluginPkg.version : "unknown";
    const swcVersion = swcPkg && swcPkg.version ? swcPkg.version : "unknown";
    const targets = typeof opts.targets === 'function'
        ? `fn:${opts.targetsCallbackKey || "inline"}`
        : Array.from(opts.targets || []).sort().join('|');
    const classConfig = Array.from((opts.classConfig || new Map()).entries())
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([k, v]) => `${k}:${JSON.stringify(v)}`)
        .join('|');
    const flags = [
        opts.trackPrototypes !== false,
        opts.trackInheritance !== false,
        opts.debug ? 1 : 0,
        opts.allowTargetsCallbackInDebug ? 1 : 0,
        opts.targetsCallbackEnabled ? 1 : 0,
        opts.disableProcessCache ? 1 : 0,
        opts.disableProcessCacheInWatch ? 1 : 0,
        opts.disableWebpackLoaderCacheInWatch ? 1 : 0
    ].join('|');
    const hookSigs = [
        opts.generateCode?.construct ? opts.generateCode.construct.toString() : "",
        opts.generateCode?.afterClass ? opts.generateCode.afterClass.toString() : "",
        opts.generateCode?.afterPrototypeMethod ? opts.generateCode.afterPrototypeMethod.toString() : "",
        opts.generateCode?.afterAll ? opts.generateCode.afterAll.toString() : "",
        opts.generateCode?.beforeEndIIFE ? opts.generateCode.beforeEndIIFE.toString() : "",
    ].join("::");
    return [pluginVersion, swcVersion, targets, classConfig, flags, hookSigs].join('||');
};

const normalizeOptions = (options) => ({
    targets: (() => {
        const allowCallback = options.allowTargetsCallbackInDebug === true && options.debug === true;

        if (typeof options.targets === "function" && allowCallback) {
            return options.targets;
        }
        if (typeof options.targets === "function" && !allowCallback) {
            if (options.debug) {
                console.warn(
                    "[TRACER] function targets are disabled by default. Use Set/Array, or enable allowTargetsCallbackInDebug=true in debug mode."
                );
            }
            return new Set();
        }
        if (allowCallback && options.targetsCallbackEnabled && options.targetsCallbackKey) {
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
    })(),
    classConfig: new Map(Object.entries(options.classConfig || {})),
    trackPrototypes: options.trackPrototypes !== false,
    trackInheritance: options.trackInheritance !== false,
    generateCode: options.generateCode,
    insertPosition: options.insertPosition || "end",
    debug: options.debug,
    fallbackOnError: options.fallbackOnError === true,
    allowTargetsCallbackInDebug: options.allowTargetsCallbackInDebug === true,
    targetsCallbackEnabled: options.targetsCallbackEnabled === true,
    targetsCallbackKey: options.targetsCallbackKey || "",
    disableProcessCache: options.disableProcessCache === true,
    disableProcessCacheInWatch: options.disableProcessCacheInWatch !== false,
    disableWebpackLoaderCacheInWatch: options.disableWebpackLoaderCacheInWatch !== false
});

// Webpack loader
module.exports = function(source) {
    const callback = this.async();
    const resourcePath = this.resourcePath;
    const startedAt = Date.now();

    const rawOptions = this.getOptions() || {};
    const watchMode = !!(this._compiler && this._compiler.watchMode);
    if (watchMode && rawOptions.disableWebpackLoaderCacheInWatch !== false) {
        this.cacheable(false);
    } else {
        this.cacheable(true);
    }

    const normalized = normalizeOptions(rawOptions);
    if (watchMode && normalized.disableProcessCacheInWatch) {
        normalized.disableProcessCache = true;
    }
    if (normalized.debug && this.resourcePath && this.resourcePath.includes("word\\Drawing\\HtmlPage.js")) {
        console.log("[TRACER] loader hit", this.resourcePath);
        console.log("[TRACER] targets type", typeof normalized.targets);
        console.log("[TRACER] watch mode", watchMode, "disableProcessCache", normalized.disableProcessCache);
    }
    const key = buildLoaderKey(normalized);
    
    if (!loaderCache.has(key)) {
        loaderCache.set(key, new SWCInjectLoader(normalized));
    }
    
    const loader = loaderCache.get(key);
    
    loader.processCode(source, resourcePath)
        .then(result => {
            const metrics = globalThis[TRACER_LOADER_METRICS_KEY];
            if (metrics) {
                metrics.visitedFiles = (metrics.visitedFiles || 0) + 1;
                metrics.totalMs = (metrics.totalMs || 0) + (Date.now() - startedAt);
                if (result !== source) {
                    metrics.transformedFiles = (metrics.transformedFiles || 0) + 1;
                }
            }
            callback(null, result);
        })
        .catch(error => {
            const metrics = globalThis[TRACER_LOADER_METRICS_KEY];
            if (metrics) {
                metrics.visitedFiles = (metrics.visitedFiles || 0) + 1;
                metrics.totalMs = (metrics.totalMs || 0) + (Date.now() - startedAt);
            }
            if (normalized.fallbackOnError) {
                console.error(`SWC loader error in ${resourcePath}, returning original source:`, error);
                callback(null, source);
                return;
            }
            callback(error);
        });
};
