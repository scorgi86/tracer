const swcInjectLoaderWebpack = require("../../src/SWCInjectLoaderWebpack.js");

const runLoader = ({ source, options, resourcePath = "C:/tmp/loader-webpack.js", watchMode = false }) =>
    new Promise((resolve, reject) => {
        const cacheableCalls = [];
        const context = {
            resourcePath,
            getOptions: () => options,
            _compiler: { watchMode },
            cacheable: (flag) => {
                cacheableCalls.push(flag);
            },
            async() {
                return (err, result) => {
                    if (err) {
                        reject(err);
                        return;
                    }
                    resolve({ result, cacheableCalls });
                };
            }
        };
        swcInjectLoaderWebpack.call(context, source);
    });

describe("SWCInjectLoaderWebpack option normalization", () => {
    const source = `
class CEditorPage {
  constructor() {}
}
    `.trim();

    afterEach(() => {
        delete globalThis.__WEBPACK_TRACER_TARGET_CALLBACKS__;
    });

    test("disables function targets by default", async () => {
        const { result } = await runLoader({
            source,
            options: {
                targets: (name) => name === "CEditorPage",
                generateCode: {
                    construct: () => "globalThis.__fnTargetsDefaultOff = true;"
                }
            }
        });

        expect(result.includes("__fnTargetsDefaultOff")).toBe(false);
    });

    test("allows function targets only in debug mode with explicit flag", async () => {
        const { result } = await runLoader({
            source,
            options: {
                debug: true,
                allowTargetsCallbackInDebug: true,
                targets: (name) => name === "CEditorPage",
                generateCode: {
                    construct: () => "globalThis.__fnTargetsDebugOn = true;"
                }
            }
        });

        expect(result.includes("__fnTargetsDebugOn")).toBe(true);
    });

    test("disables webpack loader cache in watch mode by default", async () => {
        const { cacheableCalls } = await runLoader({
            source,
            watchMode: true,
            options: {
                targets: ["CEditorPage"],
                generateCode: {
                    construct: () => "globalThis.__watchCacheOff = true;"
                }
            }
        });

        expect(cacheableCalls[0]).toBe(false);
    });

    test("can keep webpack loader cache in watch mode with explicit opt-out", async () => {
        const { cacheableCalls } = await runLoader({
            source,
            watchMode: true,
            options: {
                disableWebpackLoaderCacheInWatch: false,
                targets: ["CEditorPage"],
                generateCode: {
                    construct: () => "globalThis.__watchCacheOn = true;"
                }
            }
        });

        expect(cacheableCalls[0]).toBe(true);
    });
});
