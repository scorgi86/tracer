const {
    buildClassWrappingPlan,
    buildFunctionWrappingPlan,
    buildWrappingModelForClass,
    buildWrappingModelForFunction,
    collectInstanceMethodPlans,
    collectPrototypeMethodPlans,
} = require("../../src/tracer/buildTargetWrappingPlan.js");
const swc = require("@swc/core");
const fs = require("fs");
const path = require("path");

const readFixture = (name) =>
    fs.readFileSync(path.join(__dirname, "fixtures", name), "utf8").trim();

function parseFirstNode(source) {
    const ast = swc.parseSync(source, {
        syntax: "ecmascript",
        target: "es2020",
    });

    return ast.body[0];
}

function parseStatements(source) {
    const ast = swc.parseSync(source, {
        syntax: "ecmascript",
        target: "es2020",
    });

    return ast.body;
}

describe("target wrapping plan", () => {
    test("builds class wrapping plan with constructor metadata", () => {
        const classNode = parseFirstNode(`
class CEditorPage {
  constructor() {
    this.init = function() { return 1; };
  }
}
        `.trim());

        const plan = buildClassWrappingPlan(classNode, "CEditorPage");

        expect(plan.targetType).toBe("class");
        expect(plan.targetName).toBe("CEditorPage");
        expect(plan.hasOwnConstructor).toBe(true);
        expect(plan.hasSuperClass).toBe(false);
        expect(plan.hookContext.className).toBe("CEditorPage");
        expect(plan.hookContext.hasInstanceMethodsOnThis).toBe(true);
        expect(plan.instanceMethodPlans).toEqual([
            {
                kind: "instance-method",
                methodName: "init",
                statementIndex: 0,
            },
        ]);
    });

    test("builds function wrapping plan with body and hook context", () => {
        const functionNode = parseFirstNode(`
function CEditorPage() {
  this.init = function() { return 1; };
}
        `.trim());

        const plan = buildFunctionWrappingPlan(functionNode, "CEditorPage");

        expect(plan.targetType).toBe("function");
        expect(plan.targetName).toBe("CEditorPage");
        expect(Array.isArray(plan.functionBody)).toBe(true);
        expect(plan.hookContext.className).toBe("CEditorPage");
        expect(plan.hookContext.hasInstanceMethodsOnThis).toBe(true);
        expect(plan.instanceMethodPlans).toEqual([
            {
                kind: "instance-method",
                methodName: "init",
                statementIndex: 0,
            },
        ]);
    });

    test("collects only top-level instance methods assigned on this", () => {
        const functionNode = parseFirstNode(`
function CEditorPage() {
  this.init = function() { return 1; };
  if (true) {
    this.nested = function() { return 2; };
  }
  this["finish"] = () => 3;
}
        `.trim());

        const plans = collectInstanceMethodPlans(functionNode.body);

        expect(plans).toEqual([
            {
                kind: "instance-method",
                methodName: "init",
                statementIndex: 0,
            },
            {
                kind: "instance-method",
                methodName: "finish",
                statementIndex: 2,
            },
        ]);
    });

    test("collects prototype method plans from Format-style fixture", () => {
        const statements = parseStatements(readFixture("format-prototype-flow.js"));

        expect(collectPrototypeMethodPlans(statements, "CBaseObject")).toEqual([
            {
                kind: "prototype-method",
                className: "CBaseObject",
                methodName: "isGlobalSkipAddId",
                statementIndex: 2,
            },
        ]);

        expect(collectPrototypeMethodPlans(statements, "CT_Hyperlink")).toEqual([
            {
                kind: "prototype-method",
                className: "CT_Hyperlink",
                methodName: "Write_ToBinary",
                statementIndex: 4,
            },
        ]);
    });

    test("collects object-style prototype assignment as prototype method plan", () => {
        const statements = parseStatements(`
function CGraphics() {}
CGraphics.prototype = {
  init: function() { return 1; },
  EndDraw: function() { return 2; }
};
        `.trim());

        expect(collectPrototypeMethodPlans(statements, "CGraphics")).toEqual([
            {
                kind: "prototype-method",
                className: "CGraphics",
                methodName: "EndDraw",
                statementIndex: 1,
            },
        ]);
    });

    test("builds unified wrapping model for class", () => {
        const statements = parseStatements(`
class CEditorPage {
  constructor() {
    this.init = function() { return 1; };
  }
}
CEditorPage.prototype.finish = function() { return 2; };
        `.trim());

        const model = buildWrappingModelForClass(statements[0], "CEditorPage", statements);

        expect(model.kind).toBe("target-wrapping");
        expect(model.targetType).toBe("class");
        expect(model.instanceMethodPlans).toEqual([
            {
                kind: "instance-method",
                methodName: "init",
                statementIndex: 0,
            },
        ]);
        expect(model.prototypeMethodPlans).toEqual([
            {
                kind: "prototype-method",
                className: "CEditorPage",
                methodName: "finish",
                statementIndex: 1,
            },
        ]);
    });

    test("builds unified wrapping model for function", () => {
        const statements = parseStatements(`
function CEditorPage() {
  this.init = function() { return 1; };
}
CEditorPage.prototype.finish = function() { return 2; };
        `.trim());

        const model = buildWrappingModelForFunction(statements[0], "CEditorPage", statements);

        expect(model.kind).toBe("target-wrapping");
        expect(model.targetType).toBe("function");
        expect(model.instanceMethodPlans).toEqual([
            {
                kind: "instance-method",
                methodName: "init",
                statementIndex: 0,
            },
        ]);
        expect(model.prototypeMethodPlans).toEqual([
            {
                kind: "prototype-method",
                className: "CEditorPage",
                methodName: "finish",
                statementIndex: 1,
            },
        ]);
    });
});
