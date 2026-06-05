const swc = require("@swc/core");
const buildWrappingActions = require("./buildWrappingActions");
const createWrappingActionsApplier = require("./wrappingActionsApplier");
const {
    buildWrappingModelForClass,
    buildWrappingModelForFunction,
} = require("./buildTargetWrappingPlan");

function buildPatchedClassInfoCode(className) {
    const safeClassName = String(className).replace(/\\/g, "\\\\").replace(/'/g, "\\'");
    return `
        (() => {
            const g = typeof globalThis !== 'undefined'
                ? globalThis
                : (typeof window !== 'undefined' ? window : undefined);
            if (!g) return;
            const key = '__WEBPACK_TRACER_PATCHED_CLASSES__';
            const list = Array.isArray(g[key]) ? g[key] : (g[key] = []);
            if (!list.includes('${safeClassName}')) {
                list.push('${safeClassName}');
            }
        })();
    `.trim();
}

function createConstructorWithObservers({ className, observerCode, hasSuper = false, debug = false }) {
    try {
        const templateCode = `class ${className} {
            constructor() {
                ${hasSuper ? "super();" : ""}
                ${observerCode}
            }
        }`;

        const ast = swc.parseSync(templateCode, {
            syntax: "ecmascript",
            target: "es2022",
            comments: false,
        });

        const classDecl = ast?.body?.[0];
        if (!classDecl || classDecl.type !== "ClassDeclaration") {
            throw new Error("Failed to parse class template");
        }

        const constructor = classDecl.body?.find?.((node) => node.type === "Constructor");
        if (!constructor) {
            throw new Error("Constructor not found in template");
        }

        return constructor;
    } catch (error) {
        if (debug) {
            console.error("Error creating constructor:", error.message);
        }
        return null;
    }
}

module.exports = function createNodeInjectors({
    parseCodeToStatements,
    getObserverStatements,
    getTracerFacadeCode,
    isInsertStart,
    debug = false,
}) {
    const getPatchedClassInfoStatements = (className) =>
        parseCodeToStatements(buildPatchedClassInfoCode(className));
    const wrappingActionsApplier = createWrappingActionsApplier({
        parseCodeToStatements,
        getTracerFacadeCode,
        isInsertStart,
    });

    const splitWrappingActions = (wrappingModel) => {
        const actions = buildWrappingActions(wrappingModel);

        return {
            constructorHookAction: actions.find((action) => action.type === "constructor-hook") || null,
            instanceWrapActions: actions.filter((action) => action.type === "instance-wrap"),
            prototypeWrapActions: actions.filter((action) => action.type === "prototype-wrap"),
        };
    };

    const buildConstructorHookStatements = (targetName, generateCodeFn, hookContext) => {
        const observerStatements = getObserverStatements(
            targetName,
            generateCodeFn,
            hookContext
        );
        if (!observerStatements.length) {
            return null;
        }

        return [
            ...observerStatements,
            ...getPatchedClassInfoStatements(targetName),
        ];
    };

    const applyWrappingActions = ({
        bodyStatements,
        moduleStatements,
        instanceWrapActions,
        prototypeWrapActions,
        constructorHookStatements,
    }) => {
        wrappingActionsApplier.applyInstanceWrapActions(bodyStatements, instanceWrapActions);
        wrappingActionsApplier.applyPrototypeWrapActions(moduleStatements, prototypeWrapActions);
        return wrappingActionsApplier.applyConstructorHookStatements(bodyStatements, constructorHookStatements);
    };

    const createConstructorWithHook = (className, constructorHookAction, generateCodeFn) => {
        const observerCode = generateCodeFn(constructorHookAction.hookContext);
        if (!observerCode || observerCode.trim() === "") {
            return null;
        }

        return createConstructorWithObservers({
            className,
            observerCode: `${observerCode}\n${buildPatchedClassInfoCode(className)}`,
            hasSuper: constructorHookAction.hasSuperClass,
            debug,
        });
    };

    function processClassNode(classNode, className, generateCodeFn, moduleStatements) {
        try {
            const wrappingModel = buildWrappingModelForClass(classNode, className, moduleStatements);
            if (!wrappingModel) {
                return false;
            }

            const { constructorHookAction, instanceWrapActions, prototypeWrapActions } =
                splitWrappingActions(wrappingModel);
            if (!constructorHookAction) {
                return false;
            }

            if (
                wrappingModel.constructorNode?.body?.stmts &&
                Array.isArray(wrappingModel.constructorNode.body.stmts)
            ) {
                const constructorHookStatements = buildConstructorHookStatements(
                    className,
                    generateCodeFn,
                    constructorHookAction.hookContext
                );
                if (!constructorHookStatements) {
                    return false;
                }

                return applyWrappingActions({
                    bodyStatements: wrappingModel.constructorNode.body.stmts,
                    moduleStatements,
                    instanceWrapActions,
                    prototypeWrapActions,
                    constructorHookStatements,
                });
            }

            const newConstructor = createConstructorWithHook(
                className,
                constructorHookAction,
                generateCodeFn
            );
            if (!newConstructor) {
                return false;
            }

            classNode.body.unshift(newConstructor);
            return true;
        } catch (error) {
            if (debug) {
                console.error(`Error processing class ${className}:`, error.message);
            }
            return false;
        }
    }

    function processFunctionNode(functionNode, functionName, generateCodeFn, moduleStatements) {
        try {
            const wrappingModel = buildWrappingModelForFunction(functionNode, functionName, moduleStatements);
            const { constructorHookAction, instanceWrapActions, prototypeWrapActions } =
                splitWrappingActions(wrappingModel);
            if (!constructorHookAction) {
                return false;
            }

            const constructorHookStatements = buildConstructorHookStatements(
                functionName,
                generateCodeFn,
                constructorHookAction.hookContext
            );
            if (!constructorHookStatements) {
                return false;
            }

            if (!wrappingModel.functionBody) {
                return false;
            }

            return applyWrappingActions({
                bodyStatements: wrappingModel.functionBody,
                moduleStatements,
                instanceWrapActions,
                prototypeWrapActions,
                constructorHookStatements,
            });
        } catch (error) {
            if (debug) {
                console.error(`Error processing function ${functionName}:`, error.message);
            }
            return false;
        }
    }

    return {
        processClassNode,
        processFunctionNode,
    };
};
