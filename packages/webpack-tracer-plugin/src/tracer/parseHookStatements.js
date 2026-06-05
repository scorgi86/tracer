const swc = require("@swc/core");

module.exports = function parseHookStatements(codeStr, { debug = false } = {}) {
    if (!codeStr || typeof codeStr !== "string" || codeStr.trim() === "") {
        return [];
    }

    try {
        const wrappedCode = `(() => { ${codeStr} })`;

        const parsed = swc.parseSync(wrappedCode, {
            syntax: "ecmascript",
            target: "es2020",
            comments: true,
        });

        if (!parsed?.body?.[0]) {
            return [];
        }

        const firstNode = parsed.body[0];
        if (
            firstNode.type !== "ExpressionStatement" ||
            !firstNode.expression?.expression ||
            firstNode.expression.expression.type !== "ArrowFunctionExpression" ||
            !firstNode.expression.expression.body ||
            firstNode.expression.expression.body.type !== "BlockStatement"
        ) {
            return [];
        }

        const statements = firstNode.expression.expression.body.stmts;
        return Array.isArray(statements) ? statements : [];
    } catch (error) {
        if (debug) {
            console.error("Error parsing code:", codeStr.substring(0, 100), error.message);
        }
        return [];
    }
};
