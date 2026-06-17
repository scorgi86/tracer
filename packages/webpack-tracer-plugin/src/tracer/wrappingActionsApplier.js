module.exports = function createWrappingActionsApplier({
    parseCodeToStatements,
    getTracerFacadeCode,
    isInsertStart,
}) {
    const getObserverSignature = (statement) => {
        const assignment = statement?.expression;
        if (assignment?.type === "AssignmentExpression") {
            const left = assignment.left;
            const right = assignment.right;
            const callExpression = right?.type === "BinaryExpression" && right.operator === "||"
                ? right.left
                : right;
            const callCallee = callExpression?.callee;
            const callObjectName = callCallee?.object?.type === "Identifier" ? callCallee.object.value : null;
            const callMethodName = callCallee?.property?.type === "Identifier" ? callCallee.property.value : null;
            const methodArg = callExpression?.arguments?.[1]?.expression;
            const classArg = callExpression?.arguments?.[2]?.expression;
            if (
                left?.type === "MemberExpression" &&
                left.object?.type === "ThisExpression" &&
                callObjectName === "Tracer" &&
                callMethodName === "createProxyFn" &&
                methodArg?.type === "StringLiteral" &&
                classArg?.type === "StringLiteral"
            ) {
                return `instanceProxy:${classArg.value}:${methodArg.value}`;
            }
        }

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

        if (methodName === "observeProperties") {
            const optionsArg = call.arguments?.[1]?.expression;
            if (optionsArg?.type !== "ObjectExpression") {
                return null;
            }

            const getOptionValue = (key) =>
                optionsArg.properties?.find((prop) => prop.key?.value === key || prop.key?.value === key)?.value;
            const nameArg = getOptionValue("name") || getOptionValue("className");
            const propertiesArg = getOptionValue("properties");
            const propertiesSignature = propertiesArg?.type === "StringLiteral"
                ? propertiesArg.value
                : propertiesArg?.type === "ArrayExpression"
                    ? propertiesArg.elements
                        .filter((element) => element?.expression?.type === "StringLiteral")
                        .map((element) => element.expression.value)
                        .join(",")
                    : propertiesArg?.type === "BooleanLiteral" && propertiesArg.value === true
                        ? "*"
                        : null;

            if (nameArg?.type !== "StringLiteral" || !propertiesSignature) {
                return null;
            }

            return `observeProperties:${nameArg.value}:${propertiesSignature}`;
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
            `${getTracerFacadeCode()}\nthis[${JSON.stringify(action.methodName)}] = Tracer.createProxyFn(this[${JSON.stringify(action.methodName)}], ${JSON.stringify(action.methodName)}, ${JSON.stringify(action.targetName)}) || this[${JSON.stringify(action.methodName)}];`
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
            buildSignature: (action) => `instanceProxy:${action.targetName}:${action.methodName}`,
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
