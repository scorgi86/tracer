const SWCInjectLoader = require("../../src/SWCInjectLoader.js");

describe("SWCInjectLoader hooks", () => {
    test("injects code right after class declaration", async () => {
        const source = `
class CEditorPage {
  constructor() {}
}
const after = 1;
        `.trim();

        const loader = new SWCInjectLoader({
            targets: new Set(["CEditorPage"]),
            generateCode: {
                afterClass: ({ className }) => `globalThis.__afterClass='${className}';`
            }
        });

        const result = await loader.processCode(source, "C:/tmp/after-class.js");
        const classPos = result.indexOf("class CEditorPage");
        const hookPos = result.indexOf("globalThis.__afterClass");
        const afterPos = result.indexOf("const after = 1");

        expect(hookPos).toBeGreaterThan(classPos);
        expect(afterPos).toBeGreaterThan(hookPos);
    });

    test("injects code after last prototype method assignment", async () => {
        const source = `
function CEditorPage() {}
CEditorPage.prototype.first = function() { return 1; };
CEditorPage.prototype.second = function() { return 2; };
const after = 1;
        `.trim();

        const loader = new SWCInjectLoader({
            targets: new Set(["CEditorPage"]),
            generateCode: {
                afterPrototypeMethod: ({ className, methodName }) =>
                    `globalThis.__afterPrototype='${className}:${methodName}';`
            }
        });

        const result = await loader.processCode(source, "C:/tmp/after-prototype.js");
        const lastMethodPos = result.indexOf("CEditorPage.prototype.second");
        const hookPos = result.indexOf("globalThis.__afterPrototype");
        const afterPos = result.indexOf("const after = 1");

        expect(result.includes("__afterPrototype")).toBe(true);
        expect(result.includes("CEditorPage:second")).toBe(true);
        expect(hookPos).toBeGreaterThan(lastMethodPos);
        expect(afterPos).toBeGreaterThan(hookPos);
    });

    test("injects code after object-style prototype declaration", async () => {
        const source = `
function CGraphics() {}
CGraphics.prototype = {
  init: function() { return 1; },
  EndDraw: function() { return 2; }
};
const after = 1;
        `.trim();

        const loader = new SWCInjectLoader({
            targets: new Set(["CGraphics"]),
            generateCode: {
                afterPrototypeMethod: ({ className, methodName }) =>
                    `globalThis.__afterPrototypeObject='${className}:${methodName}';`
            }
        });

        const result = await loader.processCode(source, "C:/tmp/after-prototype-object.js");
        const prototypeDeclPos = result.indexOf("CGraphics.prototype =");
        const hookPos = result.indexOf("globalThis.__afterPrototypeObject");
        const afterPos = result.indexOf("const after = 1");

        expect(result.includes("CGraphics:EndDraw")).toBe(true);
        expect(hookPos).toBeGreaterThan(prototypeDeclPos);
        expect(afterPos).toBeGreaterThan(hookPos);
    });

    test("injects code after window-bracket prototype method assignment", async () => {
        const source = `
window["asc_docs_api"].prototype["asc_nativeCalculate"] = function() { return 1; };
const after = 1;
        `.trim();

        const loader = new SWCInjectLoader({
            targets: new Set(["window.asc_docs_api"]),
            generateCode: {
                afterPrototypeMethod: ({ className, methodName }) =>
                    `globalThis.__afterWindowProto='${className}:${methodName}';`
            }
        });

        const result = await loader.processCode(source, "C:/tmp/window-proto.js");
        const targetPos = result.indexOf('window["asc_docs_api"].prototype["asc_nativeCalculate"]');
        const hookPos = result.indexOf("globalThis.__afterWindowProto");
        const afterPos = result.indexOf("const after = 1");

        expect(result.includes("window.asc_docs_api:asc_nativeCalculate")).toBe(true);
        expect(hookPos).toBeGreaterThan(targetPos);
        expect(afterPos).toBeGreaterThan(hookPos);
    });

    test("passes hasInstanceMethodsOnThis flag into construct hook", async () => {
        const source = `
function CEditorPage() {
  this.init = function() { return 1; };
}
        `.trim();

        const loader = new SWCInjectLoader({
            targets: new Set(["CEditorPage"]),
            generateCode: {
                construct: ({ className, hasInstanceMethodsOnThis }) =>
                    `globalThis.__constructFlag='${className}:${hasInstanceMethodsOnThis}';`
            }
        });

        const result = await loader.processCode(source, "C:/tmp/construct-flag.js");
        expect(result.includes("__constructFlag")).toBe(true);
        expect(result.includes("CEditorPage:true")).toBe(true);
    });

    test("hasInstanceMethodsOnThis does not scan nested blocks", async () => {
        const source = `
function CEditorPage() {
  if (true) {
    this.init = function() { return 1; };
  }
}
        `.trim();

        const loader = new SWCInjectLoader({
            targets: new Set(["CEditorPage"]),
            generateCode: {
                construct: ({ className, hasInstanceMethodsOnThis }) =>
                    `globalThis.__constructNested='${className}:${hasInstanceMethodsOnThis}';`
            }
        });

        const result = await loader.processCode(source, "C:/tmp/construct-nested-flag.js");
        expect(result.includes("__constructNested")).toBe(true);
        expect(result.includes("CEditorPage:false")).toBe(true);
    });

    test("skips unsafe generated code with observePrototype(undefined)", async () => {
        const source = `
function CEditorPage() {}
        `.trim();

        const loader = new SWCInjectLoader({
            targets: new Set(["CEditorPage"]),
            generateCode: {
                construct: () => `window.Tracer.observePrototype(undefined);`
            }
        });

        const result = await loader.processCode(source, "C:/tmp/unsafe-construct.js");
        expect(result.includes("observePrototype(undefined)")).toBe(false);
    });

    test("skips unsafe generated code with null and string undefined", async () => {
        const source = `
function CEditorPage() {}
        `.trim();

        const loaderNull = new SWCInjectLoader({
            targets: new Set(["CEditorPage"]),
            generateCode: {
                construct: () => `window.Tracer.observePrototype(null);`
            }
        });

        const loaderString = new SWCInjectLoader({
            targets: new Set(["CEditorPage"]),
            generateCode: {
                construct: () => `window.Tracer.observePrototype("undefined");`
            }
        });

        const resultNull = await loaderNull.processCode(source, "C:/tmp/unsafe-null.js");
        const resultString = await loaderString.processCode(source, "C:/tmp/unsafe-string.js");

        expect(resultNull.includes("observePrototype(null)")).toBe(false);
        expect(resultString.includes('observePrototype("undefined")')).toBe(false);
    });

    test("skips unsafe generated code with single-quoted undefined string", async () => {
        const source = `
function CEditorPage() {}
        `.trim();

        const loader = new SWCInjectLoader({
            targets: new Set(["CEditorPage"]),
            generateCode: {
                construct: () => `window.Tracer.observePrototype('undefined');`
            }
        });

        const result = await loader.processCode(source, "C:/tmp/unsafe-single-quoted-string.js");
        expect(result.includes("observePrototype('undefined')")).toBe(false);
    });
});
