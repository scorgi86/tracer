module.exports = function buildHookStatements({
    cache,
    cacheKey,
    generateCodeFn,
    args,
    parseCodeToStatements,
    isUnsafeTracerCode,
    debug,
    debugLabel,
    getTracerFacadeCode,
}) {
    if (typeof generateCodeFn !== "function") {
        return [];
    }

    if (cache.has(cacheKey)) {
        return cache.get(cacheKey);
    }

    const code = generateCodeFn(args || {});
    if (isUnsafeTracerCode(code)) {
        cache.set(cacheKey, []);
        if (debug) {
            console.warn(`[TRACER] skip unsafe generated ${debugLabel} code:`, code);
        }
        return [];
    }
    if (!code || code.trim() === "") {
        cache.set(cacheKey, []);
        return [];
    }

    const statements = parseCodeToStatements(`${getTracerFacadeCode()}\n${code}`);
    cache.set(cacheKey, statements);
    return statements;
};
