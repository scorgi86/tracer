const { buildPrototypeHookContext } = require("./hookContexts");

module.exports = function runTargetedTraversal({
    ast,
    shouldTraceTarget,
    needOnConstructorHook,
    needAfterPrototypeHook,
    processClassSafe,
    processFunctionSafe,
    getPrototypeAssignmentInfo,
    getHookStatements,
    generateCode,
}) {
    let modified = false;
    const prototypeHookAnchors = new Map();
    const rootStatements = Array.isArray(ast?.body) ? ast.body : [];

    const ensurePrototypeContainerMap = (container) => {
        if (!prototypeHookAnchors.has(container)) {
            prototypeHookAnchors.set(container, new Map());
        }
        return prototypeHookAnchors.get(container);
    };

    const visitNode = (node, statementContainer) => {
        if (!node || typeof node !== "object") {
            return;
        }

        const moduleStatements = Array.isArray(statementContainer) ? statementContainer : rootStatements;

        if (
            node.type === "ClassDeclaration" &&
            node.identifier &&
            shouldTraceTarget(node.identifier.value) &&
            needOnConstructorHook
        ) {
            const className = node.identifier.value;
            if (processClassSafe(node, className, generateCode.onConstructor, moduleStatements)) {
                modified = true;
            }
        } else if (
            node.type === "FunctionDeclaration" &&
            node.identifier &&
            shouldTraceTarget(node.identifier.value) &&
            needOnConstructorHook
        ) {
            const functionName = node.identifier.value;
            if (processFunctionSafe(node, functionName, generateCode.onConstructor, moduleStatements)) {
                modified = true;
            }
        } else if (
            node.type === "ClassExpression" &&
            node.identifier &&
            shouldTraceTarget(node.identifier.value) &&
            needOnConstructorHook
        ) {
            const className = node.identifier.value;
            if (processClassSafe(node, className, generateCode.onConstructor, moduleStatements)) {
                modified = true;
            }
        } else if (
            node.type === "FunctionExpression" &&
            node.identifier &&
            shouldTraceTarget(node.identifier.value) &&
            needOnConstructorHook
        ) {
            const functionName = node.identifier.value;
            if (processFunctionSafe(node, functionName, generateCode.onConstructor, moduleStatements)) {
                modified = true;
            }
        }
    };

    const walkNode = (node) => {
        if (!node || typeof node !== "object") {
            return;
        }
        for (const key in node) {
            if (!Object.prototype.hasOwnProperty.call(node, key)) {
                continue;
            }
            const child = node[key];
            if (!child || typeof child !== "object") {
                continue;
            }
            if (Array.isArray(child)) {
                walkArray(child);
            } else {
                walkNode(child);
            }
        }
    };

    const walkArray = (arr) => {
        if (!Array.isArray(arr)) {
            return;
        }

        for (let i = 0; i < arr.length; i += 1) {
            const node = arr[i];
            if (!node || typeof node !== "object") {
                continue;
            }

            visitNode(node, arr);

            if (needAfterPrototypeHook) {
                const protoInfo = getPrototypeAssignmentInfo(node);
                if (protoInfo && shouldTraceTarget(protoInfo.className)) {
                    const byClass = ensurePrototypeContainerMap(arr);
                    byClass.set(protoInfo.className, {
                        index: i,
                        methodName: protoInfo.methodName,
                        getStatements: () =>
                            getHookStatements(
                                `onAfterLastPrototypeAssign:${protoInfo.className}:${protoInfo.methodName}`,
                                generateCode.onAfterLastPrototypeAssign,
                                buildPrototypeHookContext({
                                    className: protoInfo.className,
                                    methodName: protoInfo.methodName,
                                })
                            ),
                    });
                }
            }

            for (const key in node) {
                if (!Object.prototype.hasOwnProperty.call(node, key)) {
                    continue;
                }
                const child = node[key];
                if (!child || typeof child !== "object") {
                    continue;
                }
                if (Array.isArray(child)) {
                    walkArray(child);
                } else {
                    walkNode(child);
                }
            }
        }
    };

    if (needOnConstructorHook || needAfterPrototypeHook) {
        walkNode(ast);
    }

    return {
        modified,
        prototypeHookAnchors,
    };
};
