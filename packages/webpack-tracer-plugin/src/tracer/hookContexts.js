function buildConstructorHookContext({ className, hasInstanceMethodsOnThis }) {
    const hasInstanceMethods = hasInstanceMethodsOnThis === true;

    return {
        hook: "onConstructor",
        className,
        hasInstanceMethodsOnThis: hasInstanceMethods,
        target: {
            name: className,
            kind: "constructor",
            hasInstanceMethodsOnThis: hasInstanceMethods,
        },
    };
}

function buildPrototypeHookContext({ className, methodName }) {
    return {
        hook: "onAfterLastPrototypeAssign",
        className,
        methodName,
        target: {
            name: className,
            kind: "prototype",
            methodName,
        },
    };
}

function buildModuleHookContext({ filePath, moduleSymbols, hasIIFE }) {
    const resolvedHasIIFE = hasIIFE === true;

    return {
        hook: "onBeforeEndModule",
        filePath,
        moduleSymbols,
        hasIIFE: resolvedHasIIFE,
        module: {
            filePath,
            symbols: moduleSymbols,
            hasIIFE: resolvedHasIIFE,
        },
    };
}

module.exports = {
    buildConstructorHookContext,
    buildPrototypeHookContext,
    buildModuleHookContext,
};
