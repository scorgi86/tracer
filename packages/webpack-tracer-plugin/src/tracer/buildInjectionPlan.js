const { buildModuleHookContext } = require("./hookContexts");

function buildModuleKeySuffix(filePath, moduleSymbols) {
    return [
        filePath || "",
        (moduleSymbols?.constructors || []).join("|"),
        (moduleSymbols?.classes || []).join("|"),
        (moduleSymbols?.functions || []).join("|"),
    ].join("::");
}

function buildPrototypeHookPlan(prototypeHookAnchors) {
    const plan = [];

    for (const [container, byClass] of prototypeHookAnchors.entries()) {
        for (const [className, info] of byClass.entries()) {
            const statements = info.getStatements();
            if (!statements.length) {
                continue;
            }

            plan.push({
                type: "insert",
                container,
                index: info.index + 1,
                statements,
            });
        }
    }

    return plan;
}

function buildModuleHookPlan({
    astBody,
    filePath,
    findTopLevelIIFE,
    collectModuleSymbolsFromStatements,
    findBeforeEndIndex,
    getHookStatements,
    generateCode,
}) {
    const topLevelIIFE = findTopLevelIIFE(astBody);
    const moduleBody = topLevelIIFE ? topLevelIIFE.body : astBody;
    const moduleSymbols = collectModuleSymbolsFromStatements(moduleBody);
    const moduleContext = buildModuleHookContext({
        filePath,
        moduleSymbols,
        hasIIFE: !!topLevelIIFE,
    });
    const moduleKeySuffix = buildModuleKeySuffix(filePath, moduleSymbols);
    const statements = getHookStatements(
        `onBeforeEndModule:module:${moduleKeySuffix}`,
        generateCode.onBeforeEndModule,
        moduleContext
    );

    if (!statements.length) {
        return [];
    }

    if (topLevelIIFE) {
        return [
            {
                type: "insert",
                container: topLevelIIFE.body,
                index: findBeforeEndIndex(topLevelIIFE.body),
                statements,
            },
        ];
    }

    return [
        {
            type: "insert",
            container: astBody,
            index: Array.isArray(astBody) ? astBody.length : 0,
            statements,
        },
    ];
}

module.exports = function buildInjectionPlan({
    prototypeHookAnchors,
    needBeforeEndModuleHook,
    astBody,
    filePath,
    findTopLevelIIFE,
    collectModuleSymbolsFromStatements,
    findBeforeEndIndex,
    getHookStatements,
    generateCode,
}) {
    const plan = buildPrototypeHookPlan(prototypeHookAnchors);

    if (needBeforeEndModuleHook) {
        plan.push(
            ...buildModuleHookPlan({
                astBody,
                filePath,
                findTopLevelIIFE,
                collectModuleSymbolsFromStatements,
                findBeforeEndIndex,
                getHookStatements,
                generateCode,
            })
        );
    }

    return plan;
};
