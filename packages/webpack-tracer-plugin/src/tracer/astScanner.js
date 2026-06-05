function getPrototypeAssignmentInfo(node) {
    if (!node || node.type !== "ExpressionStatement") {
        return null;
    }
    const expression = node.expression;
    if (!expression || expression.type !== "AssignmentExpression") {
        return null;
    }

    const left = expression.left;
    if (!left || left.type !== "MemberExpression") {
        return null;
    }

    const extractPropertyName = (propNode) => {
        if (!propNode) {
            return null;
        }
        if (propNode.type === "Computed") {
            return extractPropertyName(propNode.expression);
        }
        if (propNode.type === "Identifier") {
            return propNode.value;
        }
        if (propNode.type === "StringLiteral") {
            return propNode.value;
        }
        if (propNode.type === "NumericLiteral") {
            return String(propNode.value);
        }
        return null;
    };

    const extractTargetNameFromObject = (objectNode) => {
        if (!objectNode) {
            return null;
        }
        if (objectNode.type === "Identifier") {
            return objectNode.value;
        }
        if (objectNode.type === "ThisExpression") {
            return "this";
        }
        if (objectNode.type === "MemberExpression") {
            const objectName = extractTargetNameFromObject(objectNode.object);
            const propertyName = extractPropertyName(objectNode.property);
            if (!objectName || !propertyName) {
                return null;
            }
            return `${objectName}.${propertyName}`;
        }
        return null;
    };

    let className = null;
    let methodName = null;

    const objectExpr = left.object;
    if (!objectExpr) {
        return null;
    }

    if (objectExpr.type === "MemberExpression") {
        const classIdent = objectExpr.object;
        const protoProp = objectExpr.property;
        if (!protoProp || protoProp.type !== "Identifier" || protoProp.value !== "prototype") {
            return null;
        }
        className = extractTargetNameFromObject(classIdent);
        if (!className) {
            return null;
        }
        methodName = extractPropertyName(left.property);
    }

    if (objectExpr.type === "Identifier") {
        const leftPropName = extractPropertyName(left.property);
        if (leftPropName !== "prototype") {
            return null;
        }
        className = objectExpr.value;
        methodName = "prototype";
    }

    if (!className) {
        return null;
    }

    if (
        methodName === "prototype" &&
        expression.right &&
        expression.right.type === "ObjectExpression" &&
        Array.isArray(expression.right.properties) &&
        expression.right.properties.length > 0
    ) {
        const ownProps = expression.right.properties.filter((prop) => prop && prop.type === "KeyValueProperty");
        const lastProp = ownProps[ownProps.length - 1];
        const objectPrototypeLastKey = extractPropertyName(lastProp?.key);
        methodName = objectPrototypeLastKey || "__prototype_object__";
    }

    if (!methodName) {
        return null;
    }

    return {
        className,
        methodName,
    };
}

function findTopLevelIIFE(astBody) {
    if (!Array.isArray(astBody)) {
        return null;
    }

    for (let i = 0; i < astBody.length; i += 1) {
        const stmt = astBody[i];
        if (!stmt || stmt.type !== "ExpressionStatement") {
            continue;
        }
        const expr = stmt.expression;
        if (!expr || expr.type !== "CallExpression") {
            continue;
        }
        const callee = expr.callee;
        if (!callee) {
            continue;
        }

        if (callee.type === "FunctionExpression" && callee.body?.type === "BlockStatement" && Array.isArray(callee.body.stmts)) {
            return { statementIndex: i, body: callee.body.stmts };
        }
        if (callee.type === "ArrowFunctionExpression" && callee.body?.type === "BlockStatement" && Array.isArray(callee.body.stmts)) {
            return { statementIndex: i, body: callee.body.stmts };
        }
        if (callee.type === "ParenthesisExpression") {
            const nested = callee.expression;
            if (nested?.type === "FunctionExpression" && nested.body?.type === "BlockStatement" && Array.isArray(nested.body.stmts)) {
                return { statementIndex: i, body: nested.body.stmts };
            }
            if (nested?.type === "ArrowFunctionExpression" && nested.body?.type === "BlockStatement" && Array.isArray(nested.body.stmts)) {
                return { statementIndex: i, body: nested.body.stmts };
            }
        }
    }

    return null;
}

function findBeforeEndIndex(statements) {
    if (!Array.isArray(statements) || statements.length === 0) {
        return 0;
    }
    for (let i = statements.length - 1; i >= 0; i -= 1) {
        if (statements[i]?.type === "ReturnStatement") {
            return i;
        }
    }
    return statements.length;
}

function collectModuleSymbolsFromStatements(statements) {
    const classes = new Set();
    const functions = new Set();
    const constructors = new Set();
    const prototypeOwners = new Set();

    if (!Array.isArray(statements)) {
        return {
            classes: [],
            functions: [],
            constructors: [],
            prototypeOwners: [],
        };
    }

    for (let i = 0; i < statements.length; i += 1) {
        const node = statements[i];
        if (!node || typeof node !== "object") {
            continue;
        }

        if (node.type === "ClassDeclaration" && node.identifier?.value) {
            const className = node.identifier.value;
            classes.add(className);
            constructors.add(className);
        }

        if (node.type === "FunctionDeclaration" && node.identifier?.value) {
            const fnName = node.identifier.value;
            functions.add(fnName);
            if (/^[A-Z]/.test(fnName)) {
                constructors.add(fnName);
            }
        }

        const protoInfo = getPrototypeAssignmentInfo(node);
        if (protoInfo) {
            prototypeOwners.add(protoInfo.className);
            constructors.add(protoInfo.className);
        }
    }

    return {
        classes: Array.from(classes).sort(),
        functions: Array.from(functions).sort(),
        constructors: Array.from(constructors).sort(),
        prototypeOwners: Array.from(prototypeOwners).sort(),
    };
}

function collectTopLevelTargetCandidatesFromStatements(statements, candidates) {
    if (!Array.isArray(statements)) {
        return;
    }

    for (let i = 0; i < statements.length; i += 1) {
        const node = statements[i];
        if (!node || typeof node !== "object") {
            continue;
        }

        if (node.type === "ClassDeclaration" && node.identifier?.value) {
            candidates.add(node.identifier.value);
        }

        if (node.type === "FunctionDeclaration" && node.identifier?.value) {
            candidates.add(node.identifier.value);
        }

        if (node.type === "VariableDeclaration" && Array.isArray(node.declarations)) {
            for (let j = 0; j < node.declarations.length; j += 1) {
                const decl = node.declarations[j];
                if (!decl || decl.type !== "VariableDeclarator") {
                    continue;
                }
                const varName = decl.id?.type === "Identifier" ? decl.id.value : null;
                const init = decl.init;
                if (!varName || !init) {
                    continue;
                }
                if (
                    init.type === "ClassExpression" ||
                    init.type === "FunctionExpression" ||
                    init.type === "ArrowFunctionExpression"
                ) {
                    candidates.add(varName);
                }
            }
        }

        const protoInfo = getPrototypeAssignmentInfo(node);
        if (protoInfo?.className) {
            candidates.add(protoInfo.className);
        }
    }
}

function collectTopLevelTargetCandidates(astBody) {
    const candidates = new Set();
    collectTopLevelTargetCandidatesFromStatements(astBody, candidates);

    const topLevelIIFE = findTopLevelIIFE(astBody);
    if (topLevelIIFE?.body) {
        collectTopLevelTargetCandidatesFromStatements(topLevelIIFE.body, candidates);
    }

    return candidates;
}

function hasTopLevelTargetMatch(candidates, shouldTraceTarget) {
    if (!candidates || candidates.size === 0) {
        return false;
    }
    for (const candidate of candidates) {
        if (shouldTraceTarget(candidate)) {
            return true;
        }
    }
    return false;
}

module.exports = {
    getPrototypeAssignmentInfo,
    findTopLevelIIFE,
    findBeforeEndIndex,
    collectModuleSymbolsFromStatements,
    collectTopLevelTargetCandidatesFromStatements,
    collectTopLevelTargetCandidates,
    hasTopLevelTargetMatch,
};
