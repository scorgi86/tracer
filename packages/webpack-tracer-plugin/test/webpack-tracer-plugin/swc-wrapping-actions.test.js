const buildWrappingActions = require("../../src/tracer/buildWrappingActions.js");
const {
    buildWrappingModelForClass,
    buildWrappingModelForFunction,
} = require("../../src/tracer/buildTargetWrappingPlan.js");
const swc = require("@swc/core");

function parseStatements(source) {
    const ast = swc.parseSync(source, {
        syntax: "ecmascript",
        target: "es2020",
    });

    return ast.body;
}

describe("wrapping actions builder", () => {
    test("builds constructor, instance and prototype actions for class model", () => {
        const statements = parseStatements(`
class CEditorPage {
  constructor() {
    this.init = function() { return 1; };
  }
}
CEditorPage.prototype.finish = function() { return 2; };
        `.trim());

        const model = buildWrappingModelForClass(statements[0], "CEditorPage", statements);
        const actions = buildWrappingActions(model);

        expect(actions).toEqual([
            expect.objectContaining({
                type: "constructor-hook",
                targetType: "class",
                targetName: "CEditorPage",
            }),
            expect.objectContaining({
                type: "instance-wrap",
                targetType: "class",
                targetName: "CEditorPage",
                methodName: "init",
                statementIndex: 0,
            }),
            expect.objectContaining({
                type: "prototype-wrap",
                targetType: "class",
                targetName: "CEditorPage",
                className: "CEditorPage",
                methodName: "finish",
                statementIndex: 1,
            }),
        ]);
    });

    test("builds constructor, instance and prototype actions for function model", () => {
        const statements = parseStatements(`
function CEditorPage() {
  this.init = function() { return 1; };
}
CEditorPage.prototype.finish = function() { return 2; };
        `.trim());

        const model = buildWrappingModelForFunction(statements[0], "CEditorPage", statements);
        const actions = buildWrappingActions(model);

        expect(actions).toEqual([
            expect.objectContaining({
                type: "constructor-hook",
                targetType: "function",
                targetName: "CEditorPage",
            }),
            expect.objectContaining({
                type: "instance-wrap",
                targetType: "function",
                targetName: "CEditorPage",
                methodName: "init",
                statementIndex: 0,
            }),
            expect.objectContaining({
                type: "prototype-wrap",
                targetType: "function",
                targetName: "CEditorPage",
                className: "CEditorPage",
                methodName: "finish",
                statementIndex: 1,
            }),
        ]);
    });

    test("returns only constructor action when model has no methods to wrap", () => {
        const statements = parseStatements(`
function CEditorPage() {}
        `.trim());

        const model = buildWrappingModelForFunction(statements[0], "CEditorPage", statements);
        const actions = buildWrappingActions(model);

        expect(actions).toHaveLength(1);
        expect(actions[0]).toEqual(
            expect.objectContaining({
                type: "constructor-hook",
                targetName: "CEditorPage",
            })
        );
    });

    test("constructor action preserves hook context for injector pipeline", () => {
        const statements = parseStatements(`
function CEditorPage() {
  this.init = function() { return 1; };
}
        `.trim());

        const model = buildWrappingModelForFunction(statements[0], "CEditorPage", statements);
        const actions = buildWrappingActions(model);
        const constructorAction = actions.find((action) => action.type === "constructor-hook");

        expect(constructorAction).toEqual(
            expect.objectContaining({
                type: "constructor-hook",
                targetName: "CEditorPage",
                hookContext: expect.objectContaining({
                    className: "CEditorPage",
                    hook: "onConstructor",
                }),
            })
        );
    });

    test("dedupes duplicate instance and prototype actions", () => {
        const model = {
            targetType: "function",
            targetName: "CEditorPage",
            hasOwnConstructor: true,
            hasSuperClass: false,
            hookContext: {
                hook: "onConstructor",
                className: "CEditorPage",
            },
            instanceMethodPlans: [
                { methodName: "init", statementIndex: 0 },
                { methodName: "init", statementIndex: 0 },
            ],
            prototypeMethodPlans: [
                { className: "CEditorPage", methodName: "finish", statementIndex: 1 },
                { className: "CEditorPage", methodName: "finish", statementIndex: 1 },
            ],
        };

        const actions = buildWrappingActions(model);

        expect(actions.filter((action) => action.type === "constructor-hook")).toHaveLength(1);
        expect(actions.filter((action) => action.type === "instance-wrap")).toHaveLength(1);
        expect(actions.filter((action) => action.type === "prototype-wrap")).toHaveLength(1);
    });
});
