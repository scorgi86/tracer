const astWriter = require("./astWriter");
const buildInjectionPlan = require("./buildInjectionPlan");
const runTargetedTraversal = require("./targetedTraversal");

module.exports = function runAstTransform({
    ast,
    sourceCode,
    filePath,
    generateCode,
    collectTopLevelTargetCandidates,
    hasTopLevelTargetMatch,
    shouldTraceTarget,
    processClassSafe,
    processFunctionSafe,
    getPrototypeAssignmentInfo,
    getHookStatements,
    findTopLevelIIFE,
    collectModuleSymbolsFromStatements,
    findBeforeEndIndex,
}) {
    const needOnConstructorHook = typeof generateCode.onConstructor === "function";
    const needAfterPrototypeHook = typeof generateCode.onAfterLastPrototypeAssign === "function";
    const needBeforeEndModuleHook = typeof generateCode.onBeforeEndModule === "function";
    const needModuleLevelHooks = needBeforeEndModuleHook;
    const needTargetedHooks = needOnConstructorHook || needAfterPrototypeHook;

    let modified = false;
    let skipTargetedDeepScan = false;

    if (needTargetedHooks) {
        const topLevelCandidates = collectTopLevelTargetCandidates(ast.body);
        const hasTopLevelMatch = hasTopLevelTargetMatch(topLevelCandidates);
        if (!hasTopLevelMatch) {
            skipTargetedDeepScan = true;
            if (!needModuleLevelHooks) {
                return sourceCode;
            }
        }
    }

    let prototypeHookAnchors = new Map();
    if (!skipTargetedDeepScan) {
        const traversalResult = runTargetedTraversal({
            ast,
            shouldTraceTarget,
            needOnConstructorHook,
            needAfterPrototypeHook,
            processClassSafe,
            processFunctionSafe,
            getPrototypeAssignmentInfo,
            getHookStatements,
            generateCode,
        });
        modified = modified || traversalResult.modified;
        prototypeHookAnchors = traversalResult.prototypeHookAnchors;
    }

    const injectionPlan = buildInjectionPlan({
        prototypeHookAnchors,
        needBeforeEndModuleHook: needModuleLevelHooks,
        astBody: ast.body,
        filePath,
        findTopLevelIIFE,
        collectModuleSymbolsFromStatements,
        findBeforeEndIndex,
        getHookStatements,
        generateCode,
    });

    if (astWriter.applyInjectionPlan(injectionPlan)) {
        modified = true;
    }

    return modified ? ast : sourceCode;
};
