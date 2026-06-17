const UniversalCodeInjectorPlugin = require("../../src/UniversalCodeInjectorPlugin.js");

describe("tracer runtime bootstrap refresh", () => {
    test("development bootstrap refreshes an existing runtime", () => {
        const plugin = new UniversalCodeInjectorPlugin({});
        const bootstrapCode = plugin.createTracerBootstrapCode({
            watchMode: false,
            options: {
                mode: "development",
            },
        });

        expect(bootstrapCode.includes("refreshTracerRuntime = true")).toBe(true);
        expect(bootstrapCode.includes("globalThis.__WEBPACK_TRACER_RUNTIME_BOOTSTRAPPED__ === true && !refreshTracerRuntime")).toBe(true);
    });

    test("watch bootstrap refreshes an existing runtime regardless of mode", () => {
        const plugin = new UniversalCodeInjectorPlugin({});
        const bootstrapCode = plugin.createTracerBootstrapCode({
            watchMode: true,
            options: {
                mode: "production",
            },
        });

        expect(bootstrapCode.includes("refreshTracerRuntime = true")).toBe(true);
    });

    test("production bootstrap remains single-run", () => {
        const plugin = new UniversalCodeInjectorPlugin({});
        const bootstrapCode = plugin.createTracerBootstrapCode({
            watchMode: false,
            options: {
                mode: "production",
            },
        });

        expect(bootstrapCode.includes("refreshTracerRuntime = false")).toBe(true);
        expect(bootstrapCode.includes("globalThis.__WEBPACK_TRACER_RUNTIME_BOOTSTRAPPED__ === true && !refreshTracerRuntime")).toBe(true);
    });
});
