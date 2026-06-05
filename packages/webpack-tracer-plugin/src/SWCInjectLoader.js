// swc-inject-loader-optimized.js
const swc = require('@swc/core');
const path = require('path');
const crypto = require('node:crypto');
const pluginPkg = require("../package.json");
const swcPkg = require("@swc/core/package.json");

module.exports = class SWCInjectLoader {
    constructor(opts = {}) {
        this._options = {
            generateCode: { onConstructor: () => '' },
            targets: new Set(),
            classConfig: new Map(),
            maxCacheEntries: 500,
            insertPosition: 'end',
            ...opts
        };
        
        this.cache = new Map();
        this.debug = opts.debug || false;
        this._optionsHash = this.buildOptionsHash(this._options);
        this.observerStatementsCache = new Map();
        this._targetScanRegex = this.buildTargetScanRegex(this._options.targets);
    }

    buildOptionsHash(opts) {
        const pluginVersion = pluginPkg && pluginPkg.version ? pluginPkg.version : "unknown";
        const swcVersion = swcPkg && swcPkg.version ? swcPkg.version : "unknown";
        const targets = typeof opts.targets === 'function'
            ? `fn:${opts.targetsCallbackKey || opts.targets.toString()}`
            : Array.from(opts.targets || []).sort();
        const classConfig = Array.from((opts.classConfig || new Map()).entries())
            .sort(([a], [b]) => a.localeCompare(b));
        const flags = {
            trackPrototypes: opts.trackPrototypes !== false,
            trackInheritance: opts.trackInheritance !== false,
            debug: !!opts.debug,
            allowTargetsCallbackInDebug: opts.allowTargetsCallbackInDebug === true,
            targetsCallbackEnabled: opts.targetsCallbackEnabled === true,
            disableProcessCache: opts.disableProcessCache === true,
        };

        const generateCodeSig = opts.generateCode?.onConstructor
            ? opts.generateCode.onConstructor.toString()
            : '';
        const generateAfterLastPrototypeAssignSig = opts.generateCode?.onAfterLastPrototypeAssign
            ? opts.generateCode.onAfterLastPrototypeAssign.toString()
            : '';
        const generateBeforeEndModuleSig = opts.generateCode?.onBeforeEndModule
            ? opts.generateCode.onBeforeEndModule.toString()
            : '';

        return JSON.stringify({
            pluginVersion,
            swcVersion,
            targets,
            classConfig,
            flags,
            generateCodeSig,
            generateAfterLastPrototypeAssignSig,
            generateBeforeEndModuleSig,
            fileSignatureHooks: [
                "onConstructor",
                "onAfterLastPrototypeAssign",
                "onBeforeEndModule",
            ].filter((hookName) => typeof opts.generateCode?.[hookName] === "function"),
        });
    }

    buildCacheKey(sourceCode, filePath) {
        return crypto
            .createHash('sha1')
            .update(filePath || '')
            .update(sourceCode || '')
            .update(this._optionsHash)
            .digest('hex');
    }

    buildTargetScanRegex(targets) {
        if (!targets || typeof targets === 'function' || targets.size === 0) return null;
        const hasComplexTargetNames = Array.from(targets).some((target) => /[.\[\]'"]/.test(target));
        if (hasComplexTargetNames) {
            return null;
        }
        const escaped = Array.from(targets).map(t => t.replace(/[.*+?^${}()|[\\]\\]/g, '\\$&'));
        return escaped.length ? new RegExp(`\\b(${escaped.join('|')})\\b`) : null;
    }

    shouldTraceTarget(targetName) {
        const { targets } = this._options;

        if (!targets) {
            return false;
        }

        if (typeof targets === 'function') {
            const result = !!targets(targetName);
            if (this.debug && targetName === 'CEditorPage') {
                console.log("[TRACER] shouldTraceTarget CEditorPage =", result);
            }
            return result;
        }

        const result = targets.has(targetName);
        if (this.debug && targetName === 'CEditorPage') {
            console.log("[TRACER] shouldTraceTarget CEditorPage =", result);
        }
        return result;
    }

    setCacheEntry(key, value) {
        this.cache.set(key, value);
        const max = this._options.maxCacheEntries || 500;
        if (this.cache.size > max) {
            const firstKey = this.cache.keys().next().value;
            this.cache.delete(firstKey);
        }
    }

    isInsertStart() {
        return this._options.insertPosition === 'start';
    }

    getObserverStatements(name, generateCodeFn, extraArgs = {}) {
        const hasInstanceMethodsOnThis = extraArgs.hasInstanceMethodsOnThis === true ? 1 : 0;
        const cacheKey = `onConstructor:${name}:${hasInstanceMethodsOnThis}`;
        if (this.observerStatementsCache.has(cacheKey)) {
            return this.observerStatementsCache.get(cacheKey);
        }

        const code = generateCodeFn({ className: name, ...extraArgs });
        if (this.isUnsafeTracerCode(code)) {
            this.observerStatementsCache.set(cacheKey, []);
            if (this.debug) {
                console.warn("[TRACER] skip unsafe generated onConstructor code:", code);
            }
            return [];
        }
        if (!code || code.trim() === '') {
            this.observerStatementsCache.set(cacheKey, []);
            return [];
        }

        const stmts = this.parseCodeToStatements(`${this.getTracerFacadeCode()}\n${code}`);
        this.observerStatementsCache.set(cacheKey, stmts);
        return stmts;
    }

    getHookStatements(cacheKey, generateCodeFn, args) {
        if (typeof generateCodeFn !== 'function') {
            return [];
        }

        if (this.observerStatementsCache.has(cacheKey)) {
            return this.observerStatementsCache.get(cacheKey);
        }

        const code = generateCodeFn(args || {});
        if (this.isUnsafeTracerCode(code)) {
            this.observerStatementsCache.set(cacheKey, []);
            if (this.debug) {
                console.warn("[TRACER] skip unsafe generated hook code:", code);
            }
            return [];
        }
        if (!code || code.trim() === '') {
            this.observerStatementsCache.set(cacheKey, []);
            return [];
        }

        const stmts = this.parseCodeToStatements(`${this.getTracerFacadeCode()}\n${code}`);
        this.observerStatementsCache.set(cacheKey, stmts);
        return stmts;
    }

    getTracerFacadeCode() {
        return `
(() => {
  const g = typeof globalThis !== "undefined"
    ? globalThis
    : (typeof window !== "undefined" ? window : undefined);
  if (!g) return;

  if (g.Tracer && g.Tracer.__isTracerFacade !== true) {
    return;
  }

  const pendingKey = "__WEBPACK_TRACER_PENDING_CALLS__";
  g[pendingKey] = Array.isArray(g[pendingKey]) ? g[pendingKey] : [];

  if (g.Tracer && g.Tracer.__isTracerFacade === true) {
    return;
  }

  const facade = new Proxy({ __isTracerFacade: true }, {
    get(target, prop) {
      if (prop === "__isTracerFacade") return true;
      return function(...args) {
        const runtime = g.__WEBPACK_TRACER_RUNTIME_INSTANCE__;
        const tracer = runtime && runtime.__isTracerFacade !== true ? runtime : null;
        if (tracer && typeof tracer[prop] === "function") {
          return tracer[prop](...args);
        }
        g[pendingKey].push([prop, args]);
        return undefined;
      };
    },
  });

  g.Tracer = facade;
  if (typeof window !== "undefined") {
    window.Tracer = facade;
  }
})();
        `.trim();
    }

    isUnsafeTracerCode(code) {
        if (!code || typeof code !== "string") {
            return false;
        }
        return /(?:window\.)?Tracer\.(?:observePrototype|observe|observeConstructor)\(\s*(?:undefined\b|null\b|["']undefined["'])/.test(code);
    }

    hasThisFunctionAssignment(node) {
        if (!node || typeof node !== "object") {
            return false;
        }

        const isFunctionLike = (valueNode) =>
            valueNode &&
            (valueNode.type === "FunctionExpression" || valueNode.type === "ArrowFunctionExpression");

        const statements = Array.isArray(node?.stmts)
            ? node.stmts
            : Array.isArray(node?.body?.stmts)
                ? node.body.stmts
                : null;

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
            if (left?.type === "MemberExpression" && left.object?.type === "ThisExpression" && isFunctionLike(right)) {
                return true;
            }
        }

        return false;
    }

    buildPatchedClassInfoCode(className) {
        const safeClassName = String(className).replace(/\\/g, '\\\\').replace(/'/g, "\\'");
        return `
            (() => {
                const g = typeof globalThis !== 'undefined'
                    ? globalThis
                    : (typeof window !== 'undefined' ? window : undefined);
                if (!g) return;
                const key = '__WEBPACK_TRACER_PATCHED_CLASSES__';
                const list = Array.isArray(g[key]) ? g[key] : (g[key] = []);
                if (!list.includes('${safeClassName}')) {
                    list.push('${safeClassName}');
                }
            })();
        `.trim();
    }

    getPatchedClassInfoStatements(className) {
        return this.parseCodeToStatements(this.buildPatchedClassInfoCode(className));
    }

    /**
     * Безопасный парсинг кода в statements
     */
    parseCodeToStatements(codeStr) {
        if (!codeStr || typeof codeStr !== 'string' || codeStr.trim() === '') {
            return [];
        }
        
        try {
            // Оборачиваем код в блок для корректного парсинга
            const wrappedCode = `(() => { ${codeStr} })`;
            
            const parsed = swc.parseSync(wrappedCode, {
                syntax: 'ecmascript',
                target: 'es2020',
                comments: true
            });
            
            // Безопасный доступ к вложенным свойствам
            if (!parsed?.body?.[0]) {
                return [];
            }
            
            const firstNode = parsed.body[0];
            
            // Проверяем структуру AST
            if (firstNode.type !== 'ExpressionStatement' ||
                !firstNode.expression?.expression ||
                firstNode.expression.expression.type !== 'ArrowFunctionExpression' ||
                !firstNode.expression.expression.body ||
                firstNode.expression.expression.body.type !== 'BlockStatement') {
                return [];
            }
            
            const statements = firstNode.expression.expression.body.stmts;
            return Array.isArray(statements) ? statements : [];
            
        } catch (error) {
            if (this.debug) {
                console.error('Error parsing code:', codeStr.substring(0, 100), error.message);
            }
            return [];
        }
    }

    /**
     * Создает AST конструктора с наблюдателями
     */
    createConstructorWithObservers(className, observerCode, hasSuper = false) {
        try {
            // Создаем шаблон конструктора
            const templateCode = `class ${className} {
                constructor() {
                    ${hasSuper ? 'super();' : ''}
                    ${observerCode}
                }
            }`;
            
            const ast = swc.parseSync(templateCode, {
                syntax: 'ecmascript',
                target: 'es2022',
                comments: false
            });
            
            // Безопасное извлечение конструктора
            const classDecl = ast?.body?.[0];
            if (!classDecl || classDecl.type !== 'ClassDeclaration') {
                throw new Error('Failed to parse class template');
            }
            
            const constructor = classDecl.body?.find?.(node => node.type === 'Constructor');
            if (!constructor) {
                throw new Error('Constructor not found in template');
            }
            
            return constructor;
            
        } catch (error) {
            if (this.debug) {
                console.error('Error creating constructor:', error.message);
            }
            return null;
        }
    }

    /**
     * Обрабатывает класс через безопасную модификацию AST
     */
    processClassSafe(classNode, className, generateCodeFn) {
        try {
            if (!classNode.body || !Array.isArray(classNode.body)) {
                return false;
            }
            
            // Ищем существующий конструктор
            let constructorIndex = -1;
            let constructorNode = null;
            
            for (let i = 0; i < classNode.body.length; i++) {
                const member = classNode.body[i];
                if (member && member.type === 'Constructor') {
                    constructorIndex = i;
                    constructorNode = member;
                    break;
                }
            }
            
            if (constructorNode) {
                // Добавляем в существующий конструктор
                if (constructorNode.body?.stmts && Array.isArray(constructorNode.body.stmts)) {
                    const hasInstanceMethodsOnThis = this.hasThisFunctionAssignment(constructorNode.body);
                    const observerStatements = this.getObserverStatements(className, generateCodeFn, {
                        hasInstanceMethodsOnThis,
                    });
                    if (!observerStatements.length) {
                        return false;
                    }
                    const patchInfoStatements = this.getPatchedClassInfoStatements(className);
                    const insertStatements = [...observerStatements, ...patchInfoStatements];
                    if (this.isInsertStart()) {
                        constructorNode.body.stmts.unshift(...insertStatements);
                    } else {
                        constructorNode.body.stmts.push(...insertStatements);
                    }
                    return true;
                }
            } else {
                // ?????????????? ?????????? ??????????????????????
                const observerCode = generateCodeFn({ className, hasInstanceMethodsOnThis: false });
                if (!observerCode || observerCode.trim() === '') {
                    return false;
                }
                const hasSuper = !!classNode.superClass;
                const newConstructor = this.createConstructorWithObservers(
                    className,
                    `${observerCode}\n${this.buildPatchedClassInfoCode(className)}`,
                    hasSuper
                );
                
                if (newConstructor) {
                    // Добавляем конструктор в начало класса
                    classNode.body.unshift(newConstructor);
                    return true;
                }
            }
            
            return false;
            
        } catch (error) {
            if (this.debug) {
                console.error(`Error processing class ${className}:`, error.message);
            }
            return false;
        }
    }

    /**
     * Обрабатывает функцию через безопасную модификацию AST
     */
    processFunctionSafe(functionNode, functionName, generateCodeFn) {
        try {
            const hasInstanceMethodsOnThis = this.hasThisFunctionAssignment(functionNode.body);
            const observerStatements = this.getObserverStatements(functionName, generateCodeFn, {
                hasInstanceMethodsOnThis,
            });
            if (!observerStatements.length) {
                return false;
            }
            const patchInfoStatements = this.getPatchedClassInfoStatements(functionName);
            
            // Проверяем структуру функции
            if (!functionNode.body || 
                functionNode.body.type !== 'BlockStatement' ||
                !Array.isArray(functionNode.body.stmts)) {
                return false;
            }
            
            const insertStatements = [...observerStatements, ...patchInfoStatements];
            if (this.isInsertStart()) {
                functionNode.body.stmts.unshift(...insertStatements);
            } else {
                functionNode.body.stmts.push(...insertStatements);
            }
            return true;
            
        } catch (error) {
            if (this.debug) {
                console.error(`Error processing function ${functionName}:`, error.message);
            }
            return false;
        }
    }

    getPrototypeAssignmentInfo(node) {
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

        // Case 1: ClassName.prototype.method = ...
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

        // Case 2: ClassName.prototype = { ... }
        if (objectExpr.type === "Identifier") {
            const leftProp = left.property;
            const leftPropName = extractPropertyName(leftProp);
            if (leftPropName !== "prototype") {
                return null;
            }
            className = objectExpr.value;
            methodName = "prototype";
        }

        if (!className) {
            return null;
        }

        // Support `ClassName.prototype = { ... }` style:
        // use the last property key as the "last prototype method/property" anchor.
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
            methodName
        };
    }

    findTopLevelIIFE(astBody) {
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

    findBeforeEndIndex(statements) {
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

    collectModuleSymbolsFromStatements(statements) {
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

            const protoInfo = this.getPrototypeAssignmentInfo(node);
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

    /**
     * Основной метод обработки через AST с visitor pattern
     */

    collectTopLevelTargetCandidatesFromStatements(statements, candidates) {
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

            const protoInfo = this.getPrototypeAssignmentInfo(node);
            if (protoInfo?.className) {
                candidates.add(protoInfo.className);
            }
        }
    }

    collectTopLevelTargetCandidates(astBody) {
        const candidates = new Set();
        this.collectTopLevelTargetCandidatesFromStatements(astBody, candidates);

        const topLevelIIFE = this.findTopLevelIIFE(astBody);
        if (topLevelIIFE?.body) {
            this.collectTopLevelTargetCandidatesFromStatements(topLevelIIFE.body, candidates);
        }

        return candidates;
    }

    hasTopLevelTargetMatch(candidates) {
        if (!candidates || candidates.size === 0) {
            return false;
        }
        for (const candidate of candidates) {
            if (this.shouldTraceTarget(candidate)) {
                return true;
            }
        }
        return false;
    }
    async processWithAST(sourceCode, filePath, targets, generateCode) {
        try {
            const ext = path.extname(filePath);
            const isTypeScript = ext === '.ts' || ext === '.tsx';
            const isJsx = ext === '.jsx' || ext === '.tsx';
            
            // Парсим AST
            const ast = swc.parseSync(sourceCode, {
                syntax: isTypeScript ? 'typescript' : 'ecmascript',
                tsx: isJsx,
                jsx: isJsx,
                decorators: true,
                dynamicImport: true,
                target: 'es2020',
                comments: true
            });
            
            const needOnConstructorHook = typeof generateCode.onConstructor === "function";
            const needAfterPrototypeHook = typeof generateCode.onAfterLastPrototypeAssign === "function";
            const needBeforeEndModuleHook = typeof generateCode.onBeforeEndModule === "function";
            const needModuleLevelHooks = needBeforeEndModuleHook;
            const needModuleSymbols = needModuleLevelHooks;
            const needTargetedHooks = needOnConstructorHook || needAfterPrototypeHook;

            let modified = false;
            const bodyInsertions = [];
            const lastPrototypeMethodByContainer = new Map();
            let skipTargetedDeepScan = false;

            if (needTargetedHooks) {
                const topLevelCandidates = this.collectTopLevelTargetCandidates(ast.body);
                const hasTopLevelMatch = this.hasTopLevelTargetMatch(topLevelCandidates);
                if (!hasTopLevelMatch) {
                    skipTargetedDeepScan = true;
                    if (!needModuleLevelHooks) {
                        return sourceCode;
                    }
                }
            }

            const ensurePrototypeContainerMap = (container) => {
                if (!lastPrototypeMethodByContainer.has(container)) {
                    lastPrototypeMethodByContainer.set(container, new Map());
                }
                return lastPrototypeMethodByContainer.get(container);
            };

            const visitNode = (node) => {
                if (!node || typeof node !== "object") return;

                if (
                    node.type === "ClassDeclaration" &&
                    node.identifier &&
                    this.shouldTraceTarget(node.identifier.value) &&
                    needOnConstructorHook
                ) {
                    const className = node.identifier.value;
                    if (this.processClassSafe(node, className, generateCode.onConstructor)) {
                        modified = true;
                    }
                } else if (
                    node.type === "FunctionDeclaration" &&
                    node.identifier &&
                    this.shouldTraceTarget(node.identifier.value) &&
                    needOnConstructorHook
                ) {
                    const functionName = node.identifier.value;
                    if (this.processFunctionSafe(node, functionName, generateCode.onConstructor)) {
                        modified = true;
                    }
                } else if (
                    node.type === "ClassExpression" &&
                    node.identifier &&
                    this.shouldTraceTarget(node.identifier.value) &&
                    needOnConstructorHook
                ) {
                    const className = node.identifier.value;
                    if (this.processClassSafe(node, className, generateCode.onConstructor)) {
                        modified = true;
                    }
                } else if (
                    node.type === "FunctionExpression" &&
                    node.identifier &&
                    this.shouldTraceTarget(node.identifier.value) &&
                    needOnConstructorHook
                ) {
                    const functionName = node.identifier.value;
                    if (this.processFunctionSafe(node, functionName, generateCode.onConstructor)) {
                        modified = true;
                    }
                }
            };

            const walkNode = (node) => {
                if (!node || typeof node !== "object") return;
                for (const key in node) {
                    if (!Object.prototype.hasOwnProperty.call(node, key)) continue;
                    const child = node[key];
                    if (!child || typeof child !== "object") continue;
                    if (Array.isArray(child)) {
                        walkArray(child);
                    } else {
                        walkNode(child);
                    }
                }
            };

            const walkArray = (arr) => {
                if (!Array.isArray(arr)) return;

                for (let i = 0; i < arr.length; i += 1) {
                    const node = arr[i];
                    if (!node || typeof node !== "object") continue;

                    visitNode(node);

                    if (needAfterPrototypeHook) {
                        const protoInfo = this.getPrototypeAssignmentInfo(node);
                        if (protoInfo && this.shouldTraceTarget(protoInfo.className)) {
                            const byClass = ensurePrototypeContainerMap(arr);
                            byClass.set(protoInfo.className, {
                                index: i,
                                methodName: protoInfo.methodName
                            });
                        }
                    }

                    for (const key in node) {
                        if (!Object.prototype.hasOwnProperty.call(node, key)) continue;
                        const child = node[key];
                        if (!child || typeof child !== "object") continue;
                        if (Array.isArray(child)) {
                            walkArray(child);
                        } else {
                            walkNode(child);
                        }
                    }
                }
            };

            if ((needOnConstructorHook || needAfterPrototypeHook) && !skipTargetedDeepScan) {
                walkNode(ast);
            }

            if (needAfterPrototypeHook && !skipTargetedDeepScan) {
                for (const [container, byClass] of lastPrototypeMethodByContainer.entries()) {
                    for (const [className, info] of byClass.entries()) {
                        const statements = this.getHookStatements(
                            'onAfterLastPrototypeAssign:' + className + ':' + info.methodName,
                            generateCode.onAfterLastPrototypeAssign,
                            { className, methodName: info.methodName }
                        );
                        if (statements.length) {
                            bodyInsertions.push({ container, index: info.index + 1, statements });
                        }
                    }
                }
            }

            if (bodyInsertions.length) {
                const grouped = new Map();
                bodyInsertions.forEach((insertion) => {
                    const key = insertion.container;
                    if (!grouped.has(key)) {
                        grouped.set(key, []);
                    }
                    grouped.get(key).push(insertion);
                });

                for (const [container, insertions] of grouped.entries()) {
                    insertions
                        .sort((a, b) => b.index - a.index)
                        .forEach((insertion) => {
                            container.splice(insertion.index, 0, ...insertion.statements);
                            modified = true;
                        });
                }
            }

            if (needModuleLevelHooks) {
                const topLevelIIFE = this.findTopLevelIIFE(ast.body);

                if (topLevelIIFE) {
                    const moduleSymbols = needModuleSymbols
                        ? this.collectModuleSymbolsFromStatements(topLevelIIFE.body)
                        : null;
                    const moduleContext = {
                        filePath,
                        moduleSymbols,
                    };
                    const insertIndex = this.findBeforeEndIndex(topLevelIIFE.body);
                    const moduleKeySuffix = [
                        filePath || "",
                        (moduleSymbols?.constructors || []).join("|"),
                        (moduleSymbols?.classes || []).join("|"),
                        (moduleSymbols?.functions || []).join("|"),
                    ].join("::");
                    const statements = this.getHookStatements(
                        `onBeforeEndModule:module:${moduleKeySuffix}`,
                        generateCode.onBeforeEndModule,
                        {
                            ...moduleContext,
                            hasIIFE: true,
                        }
                    );
                    if (statements.length) {
                        topLevelIIFE.body.splice(insertIndex, 0, ...statements);
                        modified = true;
                    }
                } else {
                    const moduleSymbols = needModuleSymbols
                        ? this.collectModuleSymbolsFromStatements(ast.body)
                        : null;
                    const moduleContext = {
                        filePath,
                        moduleSymbols,
                    };
                    const moduleKeySuffix = [
                        filePath || "",
                        (moduleSymbols?.constructors || []).join("|"),
                        (moduleSymbols?.classes || []).join("|"),
                        (moduleSymbols?.functions || []).join("|"),
                    ].join("::");
                    const statements = this.getHookStatements(
                        `onBeforeEndModule:module:${moduleKeySuffix}`,
                        generateCode.onBeforeEndModule,
                        {
                            ...moduleContext,
                            hasIIFE: false,
                        }
                    );
                    if (statements.length && Array.isArray(ast.body)) {
                        ast.body.push(...statements);
                        modified = true;
                    }
                }
            }
            if (!modified) {
                return sourceCode;
            }
            
            // Генерируем код напрямую из модифицированного AST
            const output = swc.printSync(ast, {
                minify: false
            });
            
            return output.code;
            
        } catch (error) {
            if (this.debug) {
                console.error('AST processing failed:', error.message);
            }
            return null; // Возвращаем null для fallback
        }
    }

    /**
     * Оптимизированная строковая трансформация
     */
    transformWithString(sourceCode, targets, generateCode) {
        if (!sourceCode || typeof sourceCode !== 'string') {
            return sourceCode;
        }
        
        let result = sourceCode;
        
        for (const target of targets) {
            const observerCode = generateCode.onConstructor({ className: target });
            
            if (!observerCode || observerCode.trim() === '') {
                continue;
            }
            
            const escapedTarget = target.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            
            // 1. Обработка классов с конструктором
            const classWithConstructorPattern = new RegExp(
                `(class\\s+${escapedTarget}\\s*(?:extends\\s+[^{\\s]+)?\\s*{[^}]*?)(constructor\\s*\\([^)]*\\)\\s*{)([^}]*)(})`,
                'gs'
            );
            
            result = result.replace(classWithConstructorPattern, (match, beforeClass, constructorStart, constructorBody, constructorEnd) => {
                if (this.isInsertStart()) {
                    return `${beforeClass}${constructorStart}\n        ${observerCode}\n        ${constructorBody}${constructorEnd}`;
                }
                return `${beforeClass}${constructorStart}${constructorBody}\n        ${observerCode}\n        ${constructorEnd}`;
            });
            
            // 2. Обработка классов без конструктора
            const classWithoutConstructorPattern = new RegExp(
                `(class\\s+${escapedTarget}\\s*(?:extends\\s+[^{\\s]+)?\\s*{)([^}]*)(})`,
                'gs'
            );
            
            result = result.replace(classWithoutConstructorPattern, (match, open, body, close) => {
                // Проверяем, не был ли уже обработан с конструктором
                if (!match.includes('constructor')) {
                    const hasSuper = open.includes('extends');
                    const superCall = hasSuper ? '\n        super();' : '';
                    return `${open}\n    constructor() {${superCall}\n        ${observerCode}\n    }\n${body}${close}`;
                }
                return match;
            });
            
            // 3. Обработка функций
            const functionPattern = new RegExp(
                `(function\\s+${escapedTarget}\\s*\\([^)]*\\)\\s*{)([^}]*)(})`,
                'gs'
            );
            
            result = result.replace(functionPattern, (match, open, body, close) => {
                if (this.isInsertStart()) {
                    return `${open}\n    ${observerCode}\n    ${body}${close}`;
                }
                return `${open}\n    ${body}\n    ${observerCode}\n${close}`;
            });
            
            // 4. Обработка стрелочных функций (если нужно)
            const arrowFunctionPattern = new RegExp(
                `(const|let|var)\\s+${escapedTarget}\\s*=\\s*\\([^)]*\\)\\s*=>\\s*{([^}]*)(})`,
                'gs'
            );
            
            result = result.replace(arrowFunctionPattern, (match, declaration, body, close) => {
                return `${declaration} ${target} = () => {\n    ${observerCode}\n    ${body}${close}`;
            });
        }
        
        return result;
    }

    /**
     * Основной метод обработки кода с fallback стратегией
     */
    async processCode(sourceCode, filePath) {
        const { targets, generateCode } = this._options;
        const useProcessCache = this._options.disableProcessCache !== true;
        const needOnConstructorHook = typeof generateCode?.onConstructor === "function";
        const needAfterPrototypeHook = typeof generateCode?.onAfterLastPrototypeAssign === "function";
        const needBeforeEndModuleHook = typeof generateCode?.onBeforeEndModule === "function";
        const needTargetedHooks = needOnConstructorHook || needAfterPrototypeHook;
        const needModuleLevelHooks = needBeforeEndModuleHook;
        const hasAnyHooks = needTargetedHooks || needModuleLevelHooks;

        // Keep webpack magic comments behavior untouched for sensitive imports/requires.
        // Example: require(/* webpackIgnore: true */ 'sockjs')
        if (sourceCode && sourceCode.includes('webpackIgnore')) {
            return sourceCode;
        }
        
        // Проверка входных данных
        const noTargets =
            !targets ||
            (typeof targets !== 'function' && targets.size === 0);

        if (!sourceCode || typeof sourceCode !== 'string' || !hasAnyHooks) {
            return sourceCode;
        }

        // Targeted hooks require targets; module-level hooks can run without them.
        if (noTargets && needTargetedHooks && !needModuleLevelHooks) {
            return sourceCode;
        }

        // Fast-path skip is only safe when no module-level hooks are requested.
        if (this._targetScanRegex && needTargetedHooks && !needModuleLevelHooks && !this._targetScanRegex.test(sourceCode)) {
            return sourceCode;
        }
        
        // Кэширование результатов
        const cacheKey = useProcessCache ? this.buildCacheKey(sourceCode, filePath || '') : null;
        if (useProcessCache && this.cache.has(cacheKey)) {
            return this.cache.get(cacheKey);
        }
        
        if (this.debug) {
            const targetDebug = typeof targets === 'function' ? '[callback]' : Array.from(targets);
            console.log(`Processing ${filePath} for targets:`, targetDebug);
        }
        
        let result = sourceCode;
        
        // Пытаемся использовать AST трансформацию
        const astResult = await this.processWithAST(sourceCode, filePath, targets, generateCode);
        
        if (astResult !== null) {
            result = astResult;
        } else {
            // Fallback на строковую трансформацию
            if (this.debug) {
                console.log(`Using string transformation for ${filePath}`);
            }
            if (typeof targets === 'function') {
                if (this.debug) {
                    console.warn(`[TRACER] AST failed for callback targets, source returned as-is: ${filePath}`);
                }
                result = sourceCode;
            } else {
                result = this.transformWithString(sourceCode, targets, generateCode);
            }
        }
        
        // Сохраняем в кэш
        if (useProcessCache) {
            this.setCacheEntry(cacheKey, result);
        }

        return result;
    }

    /**
     * Метод для сброса кэша
     */
    clearCache() {
        this.cache.clear();
    }

    /**
     * Метод для обновления опций
     */
    updateOptions(newOpts) {
        this._options = {
            ...this._options,
            ...newOpts
        };
        this._optionsHash = this.buildOptionsHash(this._options);
        this._targetScanRegex = this.buildTargetScanRegex(this._options.targets);
        this.observerStatementsCache.clear();
        this.clearCache(); // Сбрасываем кэш при изменении опций
    }
}




