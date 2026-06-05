const fs = require('node:fs');
const InjectPlugin = require('webpack-inject-plugin');
const path = require('node:path');
const crypto = require("node:crypto");
const { ENTRY_ORDER } = require('webpack-inject-plugin');
const TRACER_LOADER_METRICS_KEY = "__WEBPACK_TRACER_LOADER_METRICS__";
const TRACER_BOOTSTRAP_FLAG = "__WEBPACK_TRACER_RUNTIME_BOOTSTRAPPED__";

// webpack-plugin-universal-injector.js
class UniversalCodeInjectorPlugin {
  _options;

  constructor(options) {
    this._options = {...options};
  }

  buildTargetsCallbackKey(source) {
    const digest = crypto.createHash("sha1").update(String(source || "")).digest("hex");
    return `targets_${digest}`;
  }

  resolveTracerRuntimePath() {
    const localDistRuntime = path.resolve(__dirname, "../../tracer/dist/tracer.cjs.js");
    if (fs.existsSync(localDistRuntime)) {
      return localDistRuntime;
    }

    const localSourceRuntime = path.resolve(__dirname, "../../tracer/src/tracer.js");
    if (fs.existsSync(localSourceRuntime)) {
      return localSourceRuntime;
    }

    try {
      const tracerPkgJsonPath = require.resolve("tracer/package.json", { paths: [__dirname] });
      const tracerPkgDir = path.dirname(tracerPkgJsonPath);
      const tracerDistRuntime = path.join(tracerPkgDir, "dist", "tracer.cjs.js");
      if (fs.existsSync(tracerDistRuntime)) {
        return tracerDistRuntime;
      }
      const tracerMainRuntime = path.join(tracerPkgDir, "index.js");
      if (fs.existsSync(tracerMainRuntime)) {
        return tracerMainRuntime;
      }
    } catch (error) {
      // ignore and fallback below
    }

    try {
      return require.resolve("tracer", { paths: [__dirname] });
    } catch (error) {
      return localSourceRuntime;
    }
  }

  createTracerBootstrapCode() {
    const tracerRuntimePath = this.resolveTracerRuntimePath().replace(/\\/g, "\\\\");
    return [
      ';(function bootstrapWebpackTracerRuntime(){',
      '  // __WEBPACK_TRACER_RUNTIME_BOOTSTRAP__',
      '  if (typeof globalThis === "undefined") {',
      '    return;',
      '  }',
      `  if (globalThis.${TRACER_BOOTSTRAP_FLAG} === true) {`,
      '    return;',
      '  }',
      '  try {',
      `    var tracerPkg = require("${tracerRuntimePath}");`,
      '    var tracerCtor = tracerPkg && tracerPkg.Tracer',
      '      ? tracerPkg.Tracer',
      '      : tracerPkg && tracerPkg.default && tracerPkg.default.Tracer',
      '        ? tracerPkg.default.Tracer',
      '        : tracerPkg && tracerPkg.default',
      '          ? tracerPkg.default',
      '          : tracerPkg;',
      '    if (tracerCtor) {',
      '      var pendingKey = "__WEBPACK_TRACER_PENDING_CALLS__";',
      '      var pendingCalls = Array.isArray(globalThis[pendingKey]) ? globalThis[pendingKey] : [];',
      '      globalThis.Tracer = tracerCtor;',
      '      globalThis.__WEBPACK_TRACER_RUNTIME_INSTANCE__ = tracerCtor;',
      '      if (typeof window !== "undefined") {',
      '        window.Tracer = tracerCtor;',
      '      }',
      '      if (pendingCalls.length > 0) {',
      '        for (var i = 0; i < pendingCalls.length; i += 1) {',
      '          var callInfo = pendingCalls[i];',
      '          if (!callInfo || callInfo.length < 2) continue;',
      '          var method = callInfo[0];',
      '          var args = callInfo[1] || [];',
      '          if (typeof tracerCtor[method] === "function") {',
      '            try { tracerCtor[method].apply(tracerCtor, args); } catch (e) {}',
      '          }',
      '        }',
      '        globalThis[pendingKey] = [];',
      '      }',
      `      globalThis.${TRACER_BOOTSTRAP_FLAG} = true;`,
      '    }',
      '  } catch (error) {',
      '    console.warn("[webpack-tracer-plugin] Failed to load tracer runtime from package \\"tracer\\".", error);',
      '  }',
      '})();',
    ].join('\n');
  }
  
  /**
   * @param { import("webpack").Compiler } compiler
   */
  apply(compiler) {
    if (!globalThis[TRACER_LOADER_METRICS_KEY]) {
      globalThis[TRACER_LOADER_METRICS_KEY] = {};
    }

    if (this._options.logWatchTimings !== false) {
      compiler.hooks.watchRun.tap("UniversalCodeInjectorPlugin", () => {
        globalThis[TRACER_LOADER_METRICS_KEY] = {
          startedAt: Date.now(),
          visitedFiles: 0,
          transformedFiles: 0,
          totalMs: 0,
        };
      });

      compiler.hooks.done.tap("UniversalCodeInjectorPlugin", () => {
        const metrics = globalThis[TRACER_LOADER_METRICS_KEY] || {};
        if (!metrics.startedAt) {
          return;
        }

        const rebuildMs = Date.now() - metrics.startedAt;
        console.log(
          `[TRACER][watch] rebuild=${rebuildMs}ms files=${metrics.visitedFiles || 0} transformed=${metrics.transformedFiles || 0} loaderTotal=${Math.round(metrics.totalMs || 0)}ms`
        );
      });
    }

    if (this._options.injectTracerRuntimeFirst !== false) {
      const tracerBootstrapCode = this.createTracerBootstrapCode();
      new InjectPlugin.default(
        () => tracerBootstrapCode,
        {
          entryName: () => true,
          entryOrder: ENTRY_ORDER.First,
        }
      ).apply(compiler);
    }

    if (this._options.injectLoaderOpts) {
      compiler.hooks.afterEnvironment.tap('UniversalCodeInjectorPlugin', () => {
        const options = compiler.options;
        const moduleConfig = options.module || (options.module = {});
        const injectLoaderOpts = { ...this._options.injectLoaderOpts };
        const debug = !!injectLoaderOpts.debug;
        const tracerRuntimePath = this.resolveTracerRuntimePath();
        const tracerRuntimeDir = path.dirname(tracerRuntimePath).toLowerCase();

        if (debug) {
          console.log("[TRACER] plugin enabled");
        }

        if (typeof injectLoaderOpts.targets === 'function') {
          const callbackKey = this.buildTargetsCallbackKey(injectLoaderOpts.targets.toString());
          const root = globalThis;
          const key = '__WEBPACK_TRACER_TARGET_CALLBACKS__';
          if (!root[key]) {
            root[key] = {};
          }
          root[key][callbackKey] = injectLoaderOpts.targets;

          injectLoaderOpts.targetsCallbackEnabled = true;
          injectLoaderOpts.targetsCallbackKey = callbackKey;
          // keep loader options serializable and restore callback from registry by key
          injectLoaderOpts.targets = [];

          if (debug) {
            console.log("[TRACER] targets callback enabled in debug mode");
          }
        }

        if (this._options.enableCacheFilesystem !== false && !options.cache) {
          const cacheDir = this._options.cacheDirectory || path.join(compiler.context || process.cwd(), '.webpack-cache');
          options.cache = {
            type: 'filesystem',
            cacheDirectory: cacheDir,
            buildDependencies: {
              defaultWebpack: ['webpack']
            }
          };
        }

        // Создаем массив правил, если его нет
        if (!moduleConfig.rules) {
          moduleConfig.rules = [];
        }
        
        // Добавляем наш лоадер
        moduleConfig.rules.push({
          test: /\.js$/,
          use: [
            {
              loader: path.resolve(__dirname, 'SWCInjectLoaderWebpack.js'),
              options: injectLoaderOpts
            }
          ],
          exclude: (resourcePath) => {
            if (!resourcePath || typeof resourcePath !== "string") {
              return false;
            }
            const normalized = resourcePath.toLowerCase();
            if (normalized.includes("\\node_modules\\") || normalized.includes("/node_modules/")) {
              return true;
            }
            // Never instrument tracer runtime itself to avoid recursive self-tracing loops.
            if (normalized.startsWith(tracerRuntimeDir)) {
              return true;
            }
            return false;
          }
        });

        if (debug) {
          console.log("[TRACER] add loader rule", {
            test: "/\\.js$/",
            hasTargetsFn: typeof this._options.injectLoaderOpts.targets === "function",
            hasTargetsArray: Array.isArray(this._options.injectLoaderOpts.targets),
            hasTargetsSet: this._options.injectLoaderOpts.targets instanceof Set
          });
        }
      });
    }

    if (this._options.listInjectPluginOptions) {
      this._options.listInjectPluginOptions.forEach((injectPluginOptions) => {
        const { options, files } = injectPluginOptions;

        new InjectPlugin.default(function() {
          const result = files.map(filePath => {
            const code = fs.readFileSync(
                path.join(filePath),
                'utf8'
            );

            return code;
          });

          files.forEach(filePath => {
            this.addDependency(filePath);
          });

          return result.join('\n\r');
        }, options).apply(compiler);
      });
    }
  }
}

module.exports = UniversalCodeInjectorPlugin;
