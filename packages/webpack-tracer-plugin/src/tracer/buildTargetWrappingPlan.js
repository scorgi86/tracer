const { buildConstructorHookContext } = require("./hookContexts");
const { getPrototypeAssignmentInfo } = require("./astScanner");

function isFunctionLikeExpression(node) {
    return (
        !!node &&
        (node.type === "FunctionExpression" || node.type === "ArrowFunctionExpression")
    );
}

function getBodyStatements(node) {
    if (Array.isArray(node?.stmts)) {
        return node.stmts;
    }

    if (Array.isArray(node?.body?.stmts)) {
        return node.body.stmts;
    }

    return null;
}

function hasThisFunctionAssignment(node) {
    if (!node || typeof node !== "object") {
        return false;
    }
    const statements = getBodyStatements(node);

    if (!statements) {
        return false;
    }

    for (let i = 0; i < statements.length; i += 1) {
        const stmt = statements[i];
        if (stmt?.type !== "ExpressionStatement" || stmt.expression?.type !== "AssignmentExpression") {
            continue;
        }
        const left = stmt.expression.left;
        const right = stmt.expression.right;
        if (left?.type === "MemberExpression" && left.object?.type === "ThisExpression" && isFunctionLikeExpression(right)) {
            return true;
        }
    }

    return false;
}

function getThisAssignedMethodName(statement) {
    if (statement?.type !== "ExpressionStatement" || statement.expression?.type !== "AssignmentExpression") {
        return null;
    }

    const left = statement.expression.left;
    const right = statement.expression.right;

    if (!isFunctionLikeExpression(right) || left?.type !== "MemberExpression" || left.object?.type !== "ThisExpression") {
        return null;
    }

    if (left.property?.type === "Identifier") {
        return left.property.value;
    }

    if (left.property?.type === "Computed") {
        const expression = left.property.expression;
        if (expression?.type === "StringLiteral") {
            return expression.value;
        }
    }

    return null;
}

function collectInstanceMethodPlans(node) {
    const statements = getBodyStatements(node);

    if (!statements) {
        return [];
    }

    const plans = [];
    for (let i = 0; i < statements.length; i += 1) {
        const methodName = getThisAssignedMethodName(statements[i]);
        if (!methodName) {
            continue;
        }

        plans.push({
            kind: "instance-method",
            methodName,
            statementIndex: i,
        });
    }

    return plans;
}

function collectPrototypeMethodPlans(statements, targetName) {
    if (!Array.isArray(statements)) {
        return [];
    }

    const plans = [];
    for (let i = 0; i < statements.length; i += 1) {
        const protoInfo = getPrototypeAssignmentInfo(statements[i]);
        if (!protoInfo) {
            continue;
        }
        if (targetName && protoInfo.className !== targetName) {
            continue;
        }

        plans.push({
            kind: "prototype-method",
            className: protoInfo.className,
            methodName: protoInfo.methodName,
            statementIndex: i,
        });
    }

    return plans;
}

function findConstructorNode(classNode) {
    if (!classNode?.body || !Array.isArray(classNode.body)) {
        return null;
    }

    for (let i = 0; i < classNode.body.length; i += 1) {
        const member = classNode.body[i];
        if (member?.type === "Constructor") {
            return member;
        }
    }

    return null;
}

function buildClassWrappingPlan(classNode, className) {
    if (!classNode?.body || !Array.isArray(classNode.body)) {
        return null;
    }

    const constructorNode = findConstructorNode(classNode);
    const hasInstanceMethodsOnThis = constructorNode?.body?.stmts
        ? hasThisFunctionAssignment(constructorNode.body)
        : false;

    return {
        kind: "target-wrapping",
        targetType: "class",
        targetName: className,
        hasOwnConstructor: !!constructorNode,
        hasSuperClass: !!classNode.superClass,
        constructorNode,
        functionBody: constructorNode?.body?.stmts || null,
        instanceMethodPlans: collectInstanceMethodPlans(constructorNode?.body),
        prototypeMethodPlans: [],
        hookContext: buildConstructorHookContext({
            className,
            hasInstanceMethodsOnThis,
        }),
    };
}

function buildFunctionWrappingPlan(functionNode, functionName) {
    const hasBlockBody =
        !!functionNode?.body &&
        functionNode.body.type === "BlockStatement" &&
        Array.isArray(functionNode.body.stmts);

    return {
        kind: "target-wrapping",
        targetType: "function",
        targetName: functionName,
        hasOwnConstructor: true,
        hasSuperClass: false,
        functionBody: hasBlockBody ? functionNode.body.stmts : null,
        instanceMethodPlans: collectInstanceMethodPlans(functionNode.body),
        prototypeMethodPlans: [],
        hookContext: buildConstructorHookContext({
            className: functionName,
            hasInstanceMethodsOnThis: hasThisFunctionAssignment(functionNode.body),
        }),
    };
}

function buildWrappingModelForClass(classNode, className, moduleStatements) {
    const plan = buildClassWrappingPlan(classNode, className);
    if (!plan) {
        return null;
    }

    return {
        ...plan,
        prototypeMethodPlans: collectPrototypeMethodPlans(moduleStatements, className),
    };
}

function buildWrappingModelForFunction(functionNode, functionName, moduleStatements) {
    const plan = buildFunctionWrappingPlan(functionNode, functionName);

    return {
        ...plan,
        prototypeMethodPlans: collectPrototypeMethodPlans(moduleStatements, functionName),
    };
}

module.exports = {
    buildClassWrappingPlan,
    buildFunctionWrappingPlan,
    buildWrappingModelForClass,
    buildWrappingModelForFunction,
    collectInstanceMethodPlans,
    collectPrototypeMethodPlans,
};
