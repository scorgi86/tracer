const SWCInjectLoader = require("./SWCInjectLoader");
const pluginPkg = require("../package.json");
const swcPkg = require("@swc/core/package.json");
const normalizeOptions = require("./tracer/normalizeOptions");

const loaderCache = new Map();
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
        opts.generateCode?.onConstructor ? opts.generateCode.onConstructor.toString() : "",
        opts.generateCode?.onAfterLastPrototypeAssign ? opts.generateCode.onAfterLastPrototypeAssign.toString() : "",
        opts.generateCode?.onBeforeEndModule ? opts.generateCode.onBeforeEndModule.toString() : "",
    ].join("::");
    return [pluginVersion, swcVersion, targets, classConfig, flags, hookSigs].join('||');
};

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
