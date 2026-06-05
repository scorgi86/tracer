function buildConstructorHookAction(model) {
    return {
        type: "constructor-hook",
        targetType: model.targetType,
        targetName: model.targetName,
        hasOwnConstructor: model.hasOwnConstructor,
        hasSuperClass: model.hasSuperClass,
        hookContext: model.hookContext,
    };
}

function getActionKey(action) {
    if (!action) {
        return null;
    }

    if (action.type === "constructor-hook") {
        return [
            action.type,
            action.targetType,
            action.targetName,
            action.hasOwnConstructor ? 1 : 0,
            action.hasSuperClass ? 1 : 0,
        ].join(":");
    }

    if (action.type === "instance-wrap") {
        return [
            action.type,
            action.targetType,
            action.targetName,
            action.methodName,
            action.statementIndex,
        ].join(":");
    }

    if (action.type === "prototype-wrap") {
        return [
            action.type,
            action.targetType,
            action.targetName,
            action.className,
            action.methodName,
            action.statementIndex,
        ].join(":");
    }

    return action.type;
}

function dedupeActions(actions) {
    const seen = new Set();

    return actions.filter((action) => {
        const key = getActionKey(action);
        if (!key || seen.has(key)) {
            return false;
        }

        seen.add(key);
        return true;
    });
}

function buildInstanceWrapActions(model) {
    return (model.instanceMethodPlans || []).map((plan) => ({
        type: "instance-wrap",
        targetType: model.targetType,
        targetName: model.targetName,
        methodName: plan.methodName,
        statementIndex: plan.statementIndex,
        plan,
    }));
}

function buildPrototypeWrapActions(model) {
    return (model.prototypeMethodPlans || []).map((plan) => ({
        type: "prototype-wrap",
        targetType: model.targetType,
        targetName: model.targetName,
        className: plan.className,
        methodName: plan.methodName,
        statementIndex: plan.statementIndex,
        plan,
    }));
}

module.exports = function buildWrappingActions(model) {
    if (!model) {
        return [];
    }

    return dedupeActions([
        buildConstructorHookAction(model),
        ...buildInstanceWrapActions(model),
        ...buildPrototypeWrapActions(model),
    ]);
};
