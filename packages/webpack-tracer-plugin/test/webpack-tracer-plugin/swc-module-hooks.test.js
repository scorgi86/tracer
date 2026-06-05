const SWCInjectLoader = require("../../src/SWCInjectLoader.js");

describe("SWCInjectLoader module-level hooks", () => {
    test("uses onBeforeEndModule when file has no IIFE", async () => {
        const source = `
function CEditorPage() {}
CEditorPage.prototype.init = function() { return 1; };
        `.trim();

        const loader = new SWCInjectLoader({
            targets: new Set(["CEditorPage"]),
            generateCode: {
                onBeforeEndModule: ({ hasIIFE, moduleSymbols }) =>
                    `globalThis.__beforeEndModule='${hasIIFE}:${moduleSymbols.constructors.join("|")}';`
            }
        });

        const result = await loader.processCode(source, "C:/tmp/module-no-iife.js");
        expect(result.includes("__beforeEndModule")).toBe(true);
        expect(result.includes("__beforeEndModule = 'false:CEditorPage'")).toBe(true);
    });

    test("uses onBeforeEndModule when file has top-level IIFE", async () => {
        const source = `
(function() {
  function CEditorPage() {}
  CEditorPage.prototype.init = function() { return 1; };
})();
        `.trim();

        const loader = new SWCInjectLoader({
            targets: new Set(["CEditorPage"]),
            generateCode: {
                onBeforeEndModule: ({ hasIIFE, moduleSymbols }) =>
                    `globalThis.__beforeEndModuleIife='${hasIIFE}:${moduleSymbols.constructors.join("|")}';`
            }
        });

        const result = await loader.processCode(source, "C:/tmp/module-iife.js");
        expect(result.includes("__beforeEndModuleIife")).toBe(true);
        expect(result.includes("__beforeEndModuleIife = 'true:CEditorPage'")).toBe(true);
    });

    test("onBeforeEndModule collects only top-level symbols of IIFE body", async () => {
        const source = `
(function() {
  function CEditorPage() {}
  function outer() {
    function dst() {}
    return dst;
  }
  CEditorPage.prototype.init = function() { return 1; };
})();
        `.trim();

        const loader = new SWCInjectLoader({
            targets: new Set(["CEditorPage"]),
            generateCode: {
                onBeforeEndModule: ({ moduleSymbols }) =>
                    `globalThis.__ctors='${(moduleSymbols.constructors || []).join("|")}';`
            }
        });

        const result = await loader.processCode(source, "C:/tmp/module-iife-top-level-only.js");
        expect(result.includes("__ctors")).toBe(true);
        expect(result.includes("CEditorPage")).toBe(true);
        expect(result.includes("CEditorPage|dst")).toBe(false);
    });

    test("keeps module-level hooks when top-level target precheck skips deep targeted scan", async () => {
        const source = `
function NotATarget() {
  this.init = function() { return 1; };
}
        `.trim();

        const loader = new SWCInjectLoader({
            targets: new Set(["CEditorPage"]),
            generateCode: {
                onConstructor: ({ className }) => `globalThis.__construct='${className}';`,
                onBeforeEndModule: ({ hasIIFE, moduleSymbols }) =>
                    `globalThis.__beforeEndModuleFallback='${hasIIFE}:${moduleSymbols.constructors.join("|")}';`
            }
        });

        const result = await loader.processCode(source, "C:/tmp/module-precheck-fallback.js");
        expect(result.includes("__construct")).toBe(false);
        expect(result.includes("__beforeEndModuleFallback")).toBe(true);
        expect(result.includes("false:NotATarget")).toBe(true);
    });
});
