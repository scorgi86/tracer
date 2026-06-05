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

    test("allows function targets without debug mode", async () => {
        const { result } = await runLoader({
            source,
            options: {
                targets: (name) => name === "CEditorPage",
                generateCode: {
                    onConstructor: () => "globalThis.__fnTargetsEnabled = true;"
                }
            }
        });

        expect(result.includes("__fnTargetsEnabled")).toBe(true);
    });

    test("does not transform non-matching function targets", async () => {
        const { result } = await runLoader({
            source,
            options: {
                targets: (name) => name === "BasePage",
                generateCode: {
                    onConstructor: () => "globalThis.__fnTargetsMiss = true;"
                }
            }
        });

        expect(result.includes("__fnTargetsMiss")).toBe(false);
    });

    test("disables webpack loader cache in watch mode by default", async () => {
        const { cacheableCalls } = await runLoader({
            source,
            watchMode: true,
            options: {
                targets: ["CEditorPage"],
                generateCode: {
                    onConstructor: () => "globalThis.__watchCacheOff = true;"
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
                    onConstructor: () => "globalThis.__watchCacheOn = true;"
                }
            }
        });

        expect(cacheableCalls[0]).toBe(true);
    });

    test("passes targets callback through callback registry key", async () => {
        const { result } = await runLoader({
            source,
            options: {
                targets: [],
                targetsCallbackEnabled: true,
                targetsCallbackKey: "cb-CEditorPage",
                generateCode: {
                    onConstructor: () => "globalThis.__callbackRegistry = true;"
                }
            }
        });

        expect(result.includes("__callbackRegistry")).toBe(false);

        globalThis.__WEBPACK_TRACER_TARGET_CALLBACKS__ = {
            "cb-CEditorPage": (name) => name === "CEditorPage"
        };

        const secondRun = await runLoader({
            source,
            options: {
                targets: [],
                targetsCallbackEnabled: true,
                targetsCallbackKey: "cb-CEditorPage",
                generateCode: {
                    onConstructor: () => "globalThis.__callbackRegistry = true;"
                }
            }
        });

        expect(secondRun.result.includes("__callbackRegistry")).toBe(true);
    });
});
