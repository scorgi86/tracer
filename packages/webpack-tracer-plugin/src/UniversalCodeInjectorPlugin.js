const fs = require('node:fs');
const InjectPlugin = require('webpack-inject-plugin');
const path = require('node:path');

// webpack-plugin-universal-injector.js
class UniversalCodeInjectorPlugin {
  _options;

  constructor(options) {
    this._options = {...options};
  }
  
  /**
   * @param { import("webpack").Compiler } compiler
   */
  apply(compiler) {

    if (this._options.injectLoaderOpts) {
      compiler.hooks.afterEnvironment.tap('UniversalCodeInjectorPlugin', () => {
        const options = compiler.options;
        const moduleConfig = options.module || (options.module = {});
        const injectLoaderOpts = { ...this._options.injectLoaderOpts };
        const debug = !!injectLoaderOpts.debug;

        if (debug) {
          console.log("[TRACER] plugin enabled");
        }

        if (typeof injectLoaderOpts.targets === 'function') {
          const callbackKey = `targets_${Date.now()}_${Math.random().toString(36).slice(2)}`;
          const root = globalThis;
          const key = '__WEBPACK_TRACER_TARGET_CALLBACKS__';
          if (!root[key]) {
            root[key] = {};
          }
          root[key][callbackKey] = injectLoaderOpts.targets;

          injectLoaderOpts.targetsCallbackEnabled = true;
          injectLoaderOpts.targetsCallbackKey = callbackKey;
          injectLoaderOpts.targetsCallbackSource = injectLoaderOpts.targets.toString();
          injectLoaderOpts.targets = {
            __tracerTargetsCallbackSource: injectLoaderOpts.targetsCallbackSource
          };

          if (debug) {
            console.log("[TRACER] targets callback serialized");
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
          exclude: /node_modules/
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
