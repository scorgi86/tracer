const SWCInjectLoader = require("../../src/SWCInjectLoader.js");
const fs = require("fs");
const path = require("path");

const readFixture = (name) =>
    fs.readFileSync(path.join(__dirname, "fixtures", name), "utf8").trim();

describe("SWCInjectLoader hooks", () => {
    test("injects onConstructor into HtmlPage-style constructor fixture", async () => {
        const source = readFixture("htmlpage-constructor.js");

        const loader = new SWCInjectLoader({
            targets: new Set(["CEditorPage"]),
            generateCode: {
                onConstructor: ({ className }) =>
                    `globalThis.__onConstructor='${className}';`
            }
        });

        const result = await loader.processCode(source, "C:/tmp/on-constructor-class.js");

        expect(result.includes("__onConstructor")).toBe(true);
        expect(result.includes("__onConstructor = 'CEditorPage'")).toBe(true);
    });

    test("injects onConstructor into function constructor", async () => {
        const source = `
function CEditorPage() {
  this.value = 1;
}
        `.trim();

        const loader = new SWCInjectLoader({
            targets: new Set(["CEditorPage"]),
            generateCode: {
                onConstructor: ({ className, hasInstanceMethodsOnThis }) =>
                    `globalThis.__onFunctionCtor='${className}:${hasInstanceMethodsOnThis}';`
            }
        });

        const result = await loader.processCode(source, "C:/tmp/on-constructor-function.js");

        expect(result.includes("__onFunctionCtor")).toBe(true);
        expect(result.includes("__onFunctionCtor = 'CEditorPage:false'")).toBe(true);
    });

    test("passes normalized constructor hook context with legacy fields preserved", async () => {
        const source = `
function CEditorPage() {
  this.value = 1;
}
        `.trim();

        const loader = new SWCInjectLoader({
            targets: new Set(["CEditorPage"]),
            generateCode: {
                onConstructor: (ctx) =>
                    `globalThis.__constructorCtx='${ctx.hook}:${ctx.target.kind}:${ctx.target.name}:${ctx.className}:${ctx.hasInstanceMethodsOnThis}';`
            }
        });

        const result = await loader.processCode(source, "C:/tmp/on-constructor-context.js");

        expect(result.includes("__constructorCtx = 'onConstructor:constructor:CEditorPage:CEditorPage:false'")).toBe(true);
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
                onAfterLastPrototypeAssign: ({ className, methodName }) =>
                    `globalThis.__afterPrototype='${className}:${methodName}';`
            }
        });

        const result = await loader.processCode(source, "C:/tmp/after-prototype.js");
        const lastMethodPos = result.indexOf("CEditorPage.prototype.second");
        const hookPos = result.indexOf("globalThis.__afterPrototype");
        const afterPos = result.indexOf("const after = 1");

        expect(result.includes("__afterPrototype")).toBe(true);
        expect(result.includes("__afterPrototype = 'CEditorPage:second'")).toBe(true);
        expect(hookPos).toBeGreaterThan(lastMethodPos);
        expect(afterPos).toBeGreaterThan(hookPos);
    });

    test("applies real prototype-wrap for function-style prototype assignments", async () => {
        const source = `
function CEditorPage() {}
CEditorPage.prototype.second = function() { return 2; };
        `.trim();

        const loader = new SWCInjectLoader({
            targets: new Set(["CEditorPage"]),
            generateCode: {
                onConstructor: ({ className }) =>
                    `globalThis.__prototypeWrapFn='${className}';`
            }
        });

        const result = await loader.processCode(source, "C:/tmp/prototype-wrap-function.js");
        const assignPos = result.indexOf("CEditorPage.prototype.second");
        const observePos = result.indexOf('Tracer.observePrototype(CEditorPage, "CEditorPage")');

        expect(observePos).toBeGreaterThan(assignPos);
    });

    test("passes normalized prototype hook context with legacy fields preserved", async () => {
        const source = `
function CEditorPage() {}
CEditorPage.prototype.second = function() { return 2; };
        `.trim();

        const loader = new SWCInjectLoader({
            targets: new Set(["CEditorPage"]),
            generateCode: {
                onAfterLastPrototypeAssign: (ctx) =>
                    `globalThis.__prototypeCtx='${ctx.hook}:${ctx.target.kind}:${ctx.target.name}:${ctx.target.methodName}:${ctx.className}:${ctx.methodName}';`
            }
        });

        const result = await loader.processCode(source, "C:/tmp/after-prototype-context.js");

        expect(result.includes("__prototypeCtx = 'onAfterLastPrototypeAssign:prototype:CEditorPage:second:CEditorPage:second'")).toBe(true);
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
                onAfterLastPrototypeAssign: ({ className, methodName }) =>
                    `globalThis.__afterPrototypeObject='${className}:${methodName}';`
            }
        });

        const result = await loader.processCode(source, "C:/tmp/after-prototype-object.js");
        const prototypeDeclPos = result.indexOf("CGraphics.prototype =");
        const hookPos = result.indexOf("globalThis.__afterPrototypeObject");
        const afterPos = result.indexOf("const after = 1");

        expect(result.includes("__afterPrototypeObject = 'CGraphics:EndDraw'")).toBe(true);
        expect(hookPos).toBeGreaterThan(prototypeDeclPos);
        expect(afterPos).toBeGreaterThan(hookPos);
    });

    test("applies real prototype-wrap for object-style prototype declaration", async () => {
        const source = `
function CGraphics() {}
CGraphics.prototype = {
  init: function() { return 1; },
  EndDraw: function() { return 2; }
};
        `.trim();

        const loader = new SWCInjectLoader({
            targets: new Set(["CGraphics"]),
            generateCode: {
                onConstructor: ({ className }) =>
                    `globalThis.__prototypeWrapObject='${className}';`
            }
        });

        const result = await loader.processCode(source, "C:/tmp/prototype-wrap-object.js");
        const assignPos = result.indexOf("CGraphics.prototype =");
        const observePos = result.indexOf('Tracer.observePrototype(CGraphics, "CGraphics")');

        expect(observePos).toBeGreaterThan(assignPos);
    });

    test("injects code after window-bracket prototype method assignment", async () => {
        const source = `
window["asc_docs_api"].prototype["asc_nativeCalculate"] = function() { return 1; };
const after = 1;
        `.trim();

        const loader = new SWCInjectLoader({
            targets: new Set(["window.asc_docs_api"]),
            generateCode: {
                onAfterLastPrototypeAssign: ({ className, methodName }) =>
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

    test("passes hasInstanceMethodsOnThis flag for HtmlPage-style instance-method fixture", async () => {
        const source = readFixture("htmlpage-instance-method.js");

        const loader = new SWCInjectLoader({
            targets: new Set(["CEditorPage"]),
            generateCode: {
                onConstructor: ({ className, hasInstanceMethodsOnThis }) =>
                    `globalThis.__constructFlag='${className}:${hasInstanceMethodsOnThis}';`
            }
        });

        const result = await loader.processCode(source, "C:/tmp/construct-flag.js");
        expect(result.includes("__constructFlag")).toBe(true);
        expect(result.includes("__constructFlag = 'CEditorPage:true'")).toBe(true);
    });

    test("applies real instance-wrap for function-style instance method assignments", async () => {
        const source = readFixture("htmlpage-instance-method.js");

        const loader = new SWCInjectLoader({
            targets: new Set(["CEditorPage"]),
            generateCode: {
                onConstructor: ({ className }) =>
                    `globalThis.__instanceWrapFn='${className}';`
            }
        });

        const result = await loader.processCode(source, "C:/tmp/instance-wrap-function.js");
        const assignPos = result.indexOf("this.init = function()");
        const observePos = result.indexOf('Tracer.observeProperty(this, "init", "CEditorPage")');

        expect(observePos).toBeGreaterThan(assignPos);
    });

    test("applies real instance-wrap for class-style instance method assignments", async () => {
        const source = readFixture("class-instance-method.js");

        const loader = new SWCInjectLoader({
            targets: new Set(["CEditorPage"]),
            generateCode: {
                onConstructor: ({ className }) =>
                    `globalThis.__instanceWrapClass='${className}';`
            }
        });

        const result = await loader.processCode(source, "C:/tmp/instance-wrap-class.js");
        const assignPos = result.indexOf("this.init = function()");
        const observePos = result.indexOf('Tracer.observeProperty(this, "init", "CEditorPage")');

        expect(observePos).toBeGreaterThan(assignPos);
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
                onConstructor: ({ className, hasInstanceMethodsOnThis }) =>
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
                onConstructor: () => `window.Tracer.observePrototype(undefined);`
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
                onConstructor: () => `window.Tracer.observePrototype(null);`
            }
        });

        const loaderString = new SWCInjectLoader({
            targets: new Set(["CEditorPage"]),
            generateCode: {
                onConstructor: () => `window.Tracer.observePrototype("undefined");`
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
                onConstructor: () => `window.Tracer.observePrototype('undefined');`
            }
        });

        const result = await loader.processCode(source, "C:/tmp/unsafe-single-quoted-string.js");
        expect(result.includes("observePrototype('undefined')")).toBe(false);
    });

    test("supports targets as function on permanent fixture", async () => {
        const source = readFixture("function-targets.js");

        const loader = new SWCInjectLoader({
            targets: (targetName) => /^C[A-Z].*/.test(String(targetName)),
            generateCode: {
                onConstructor: ({ className }) => `globalThis.__fnTargets='${className}';`
            }
        });

        const result = await loader.processCode(source, "C:/tmp/function-targets.js");

        expect(result.includes("__fnTargets = 'CEditorPage'")).toBe(true);
        expect(result.includes("__fnTargets = 'BasePage'")).toBe(false);
    });

    test("covers Format.js-style prototype flow on permanent fixture", async () => {
        const source = readFixture("format-prototype-flow.js");

        const loader = new SWCInjectLoader({
            targets: (targetName) => /^C[A-Z].*/.test(String(targetName)),
            generateCode: {
                onAfterLastPrototypeAssign: ({ className }) =>
                    `window.Tracer.observePrototype(${className}, '${className}');`
            }
        });

        const result = await loader.processCode(source, "C:/tmp/format-style.js");

        expect(result.includes("window.Tracer.observePrototype(CBaseObject, 'CBaseObject');")).toBe(true);
        expect(result.includes("window.Tracer.observePrototype(CT_Hyperlink, 'CT_Hyperlink');")).toBe(true);
    });
});
