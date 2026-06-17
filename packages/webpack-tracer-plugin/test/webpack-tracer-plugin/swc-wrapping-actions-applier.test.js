const createWrappingActionsApplier = require("../../src/tracer/wrappingActionsApplier.js");
const parseHookStatements = require("../../src/tracer/parseHookStatements.js");
const getTracerFacadeCode = require("../../src/tracer/tracerFacadeCode.js");

describe("wrapping actions applier", () => {
    const hasObserverCall = (statements, observerName) =>
        statements.some(
            (statement) => {
                const expression = statement?.expression;
                if (expression?.callee?.property?.value === observerName) {
                    return true;
                }
                const right = expression?.right;
                const callExpression = right?.type === "BinaryExpression" && right.operator === "||"
                    ? right.left
                    : right;
                return callExpression?.callee?.property?.value === observerName;
            }
        );

    test("applies instance wrap after assignment index", () => {
        const bodyStatements = [
            { type: "Mock", label: "assign" },
            { type: "Mock", label: "after" },
        ];

        const applier = createWrappingActionsApplier({
            parseCodeToStatements: (code) => parseHookStatements(code, { debug: false }),
            getTracerFacadeCode,
            isInsertStart: () => true,
        });

        const modified = applier.applyInstanceWrapActions(bodyStatements, [
            {
                type: "instance-wrap",
                targetName: "CEditorPage",
                methodName: "init",
                statementIndex: 0,
            },
        ]);

        expect(modified).toBe(true);
        expect(bodyStatements).toHaveLength(4);
        expect(hasObserverCall(bodyStatements.slice(1, 3), "createProxyFn")).toBe(true);
    });

    test("applies prototype wrap after prototype statement index", () => {
        const moduleStatements = [
            { type: "Mock", label: "proto" },
            { type: "Mock", label: "after" },
        ];

        const applier = createWrappingActionsApplier({
            parseCodeToStatements: (code) => parseHookStatements(code, { debug: false }),
            getTracerFacadeCode,
            isInsertStart: () => true,
        });

        const modified = applier.applyPrototypeWrapActions(moduleStatements, [
            {
                type: "prototype-wrap",
                className: "CEditorPage",
                targetName: "CEditorPage",
                methodName: "finish",
                statementIndex: 0,
            },
        ]);

        expect(modified).toBe(true);
        expect(moduleStatements).toHaveLength(4);
        expect(hasObserverCall(moduleStatements.slice(1, 3), "observePrototype")).toBe(true);
    });

    test("applies constructor hook statements with configured insert position", () => {
        const bodyStatements = [
            { type: "Mock", label: "original" },
        ];

        const applier = createWrappingActionsApplier({
            parseCodeToStatements: (code) => parseHookStatements(code, { debug: false }),
            getTracerFacadeCode,
            isInsertStart: () => false,
        });

        const modified = applier.applyConstructorHookStatements(bodyStatements, [
            { type: "Mock", label: "injected" },
        ]);

        expect(modified).toBe(true);
        expect(bodyStatements[1]).toEqual({ type: "Mock", label: "injected" });
    });

    test("dedupes existing instance observer insertion", () => {
        const applier = createWrappingActionsApplier({
            parseCodeToStatements: (code) => parseHookStatements(code, { debug: false }),
            getTracerFacadeCode,
            isInsertStart: () => true,
        });

        const bodyStatements = parseHookStatements(
            `${getTracerFacadeCode()}\nthis["init"] = Tracer.createProxyFn(this["init"], "init", "CEditorPage") || this["init"];`,
            { debug: false }
        );

        const modified = applier.applyInstanceWrapActions(bodyStatements, [
            {
                type: "instance-wrap",
                targetName: "CEditorPage",
                methodName: "init",
                statementIndex: 0,
            },
        ]);

        expect(modified).toBe(false);
        expect(applier.collectExistingObserverSignatures(bodyStatements).has("instanceProxy:CEditorPage:init")).toBe(true);
    });

    test("dedupes existing prototype observer insertion", () => {
        const applier = createWrappingActionsApplier({
            parseCodeToStatements: (code) => parseHookStatements(code, { debug: false }),
            getTracerFacadeCode,
            isInsertStart: () => true,
        });

        const moduleStatements = parseHookStatements(
            `${getTracerFacadeCode()}\nTracer.observePrototype(CEditorPage, "CEditorPage");`,
            { debug: false }
        );

        const modified = applier.applyPrototypeWrapActions(moduleStatements, [
            {
                type: "prototype-wrap",
                className: "CEditorPage",
                targetName: "CEditorPage",
                methodName: "finish",
                statementIndex: 0,
            },
        ]);

        expect(modified).toBe(false);
        expect(applier.collectExistingObserverSignatures(moduleStatements).has("observePrototype:CEditorPage")).toBe(true);
    });
});
