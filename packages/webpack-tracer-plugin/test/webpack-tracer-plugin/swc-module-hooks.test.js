const SWCInjectLoader = require("../../src/SWCInjectLoader.js");

describe("SWCInjectLoader module-level hooks", () => {
    test("uses afterAll when file has no IIFE", async () => {
        const source = `
function CEditorPage() {}
CEditorPage.prototype.init = function() { return 1; };
        `.trim();

        const loader = new SWCInjectLoader({
            targets: new Set(["CEditorPage"]),
            generateCode: {
                afterAll: ({ hasIIFE, moduleSymbols }) =>
                    `globalThis.__afterAll='${hasIIFE}:${moduleSymbols.constructors.join("|")}';`
            }
        });

        const result = await loader.processCode(source, "C:/tmp/module-no-iife.js");
        expect(result.includes("__afterAll")).toBe(true);
        expect(result.includes("false:CEditorPage")).toBe(true);
    });

    test("uses beforeEndIIFE when file has top-level IIFE", async () => {
        const source = `
(function() {
  function CEditorPage() {}
  CEditorPage.prototype.init = function() { return 1; };
})();
        `.trim();

        const loader = new SWCInjectLoader({
            targets: new Set(["CEditorPage"]),
            generateCode: {
                beforeEndIIFE: ({ hasIIFE, moduleSymbols }) =>
                    `globalThis.__beforeEndIIFE='${hasIIFE}:${moduleSymbols.constructors.join("|")}';`
            }
        });

        const result = await loader.processCode(source, "C:/tmp/module-iife.js");
        expect(result.includes("__beforeEndIIFE")).toBe(true);
        expect(result.includes("true:CEditorPage")).toBe(true);
    });

    test("beforeEndIIFE collects only top-level symbols of IIFE body", async () => {
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
                beforeEndIIFE: ({ moduleSymbols }) =>
                    `globalThis.__ctors='${(moduleSymbols.constructors || []).join("|")}';`
            }
        });

        const result = await loader.processCode(source, "C:/tmp/module-iife-top-level-only.js");
        expect(result.includes("__ctors")).toBe(true);
        expect(result.includes("CEditorPage")).toBe(true);
        expect(result.includes("CEditorPage|dst")).toBe(false);
    });
});
