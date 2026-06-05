module.exports = function createWrappingActionsApplier({
    parseCodeToStatements,
    getTracerFacadeCode,
    isInsertStart,
}) {
    const getObserverSignature = (statement) => {
        const call = statement?.expression;
        if (!call || call.type !== "CallExpression") {
            return null;
        }

        const callee = call.callee;
        const objectName = callee?.object?.type === "Identifier" ? callee.object.value : null;
        const methodName = callee?.property?.type === "Identifier" ? callee.property.value : null;
        if (objectName !== "Tracer" || !methodName) {
            return null;
        }

        if (methodName === "observeProperty") {
            const propertyArg = call.arguments?.[1]?.expression;
            const classArg = call.arguments?.[2]?.expression;
            if (propertyArg?.type !== "StringLiteral" || classArg?.type !== "StringLiteral") {
                return null;
            }
            return `observeProperty:${classArg.value}:${propertyArg.value}`;
        }

        if (methodName === "observePrototype") {
            const classArg = call.arguments?.[1]?.expression;
            if (classArg?.type !== "StringLiteral") {
                return null;
            }
            return `observePrototype:${classArg.value}`;
        }

        return null;
    };

    const collectExistingObserverSignatures = (statements) => {
        const signatures = new Set();
        if (!Array.isArray(statements)) {
            return signatures;
        }

        for (let i = 0; i < statements.length; i += 1) {
            const signature = getObserverSignature(statements[i]);
            if (signature) {
                signatures.add(signature);
            }
        }

        return signatures;
    };

    const insertStatementsIntoBody = (bodyStatements, statements) => {
        if (isInsertStart()) {
            bodyStatements.unshift(...statements);
            return;
        }

        bodyStatements.push(...statements);
    };

    const getInstanceWrapStatements = (action) =>
        parseCodeToStatements(
            `${getTracerFacadeCode()}\nTracer.observeProperty(this, ${JSON.stringify(action.methodName)}, ${JSON.stringify(action.targetName)});`
        );

    const getPrototypeWrapStatements = (action) =>
        parseCodeToStatements(
            `${getTracerFacadeCode()}\nTracer.observePrototype(${action.className}, ${JSON.stringify(action.className)});`
        );

    const applySortedActions = ({
        statements,
        actions,
        buildSignature,
        getInjectedStatements,
    }) => {
        let modified = false;
        const existingSignatures = collectExistingObserverSignatures(statements);

        actions
            .slice()
            .sort((a, b) => b.statementIndex - a.statementIndex)
            .forEach((action) => {
                const signature = buildSignature(action);
                if (existingSignatures.has(signature)) {
                    return;
                }
                const injectedStatements = getInjectedStatements(action);
                if (!injectedStatements.length) {
                    return;
                }

                statements.splice(action.statementIndex + 1, 0, ...injectedStatements);
                existingSignatures.add(signature);
                modified = true;
            });

        return modified;
    };

    const applyInstanceWrapActions = (bodyStatements, actions) =>
        applySortedActions({
            statements: bodyStatements,
            actions,
            buildSignature: (action) => `observeProperty:${action.targetName}:${action.methodName}`,
            getInjectedStatements: getInstanceWrapStatements,
        });

    const applyPrototypeWrapActions = (moduleStatements, actions) => {
        return applySortedActions({
            statements: moduleStatements,
            actions,
            buildSignature: (action) => `observePrototype:${action.className}`,
            getInjectedStatements: getPrototypeWrapStatements,
        });
    };

    const applyConstructorHookStatements = (bodyStatements, statements) => {
        if (!statements.length) {
            return false;
        }

        insertStatementsIntoBody(bodyStatements, statements);
        return true;
    };

    return {
        applyInstanceWrapActions,
        applyPrototypeWrapActions,
        applyConstructorHookStatements,
        collectExistingObserverSignatures,
        insertStatementsIntoBody,
    };
};
