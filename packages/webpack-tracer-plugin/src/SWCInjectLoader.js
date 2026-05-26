// swc-inject-loader-optimized.js
const swc = require('@swc/core');
const path = require('path');
const crypto = require('node:crypto');

module.exports = class SWCInjectLoader {
    constructor(opts = {}) {
        this._options = {
            generateCode: { construct: () => '' },
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
        const targets = typeof opts.targets === 'function'
            ? `fn:${opts.targets.toString()}`
            : Array.from(opts.targets || []).sort();
        const classConfig = Array.from((opts.classConfig || new Map()).entries())
            .sort(([a], [b]) => a.localeCompare(b));
        const flags = {
            trackPrototypes: opts.trackPrototypes !== false,
            trackInheritance: opts.trackInheritance !== false,
            debug: !!opts.debug
        };

        const generateCodeSig = opts.generateCode?.construct
            ? opts.generateCode.construct.toString()
            : '';

        return JSON.stringify({ targets, classConfig, flags, generateCodeSig });
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

    getObserverStatements(name, generateCodeFn) {
        if (this.observerStatementsCache.has(name)) {
            return this.observerStatementsCache.get(name);
        }

        const code = generateCodeFn({ className: name });
        if (!code || code.trim() === '') {
            this.observerStatementsCache.set(name, []);
            return [];
        }

        const stmts = this.parseCodeToStatements(code);
        this.observerStatementsCache.set(name, stmts);
        return stmts;
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
            const observerCode = generateCodeFn({ className });
            if (!observerCode || observerCode.trim() === '') {
                return false;
            }

            const observerStatements = this.getObserverStatements(className, generateCodeFn);
            if (!observerStatements.length) {
                return false;
            }
            const patchInfoStatements = this.getPatchedClassInfoStatements(className);
            
            // Проверяем структуру класса
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
                    const insertStatements = [...observerStatements, ...patchInfoStatements];
                    if (this.isInsertStart()) {
                        constructorNode.body.stmts.unshift(...insertStatements);
                    } else {
                        constructorNode.body.stmts.push(...insertStatements);
                    }
                    return true;
                }
            } else {
                // Создаем новый конструктор
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
            const observerStatements = this.getObserverStatements(functionName, generateCodeFn);
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

    /**
     * Основной метод обработки через AST с visitor pattern
     */
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
            
            let modified = false;
            
            // Рекурсивно обходим AST
            const traverse = (node) => {
                if (!node || typeof node !== 'object') return;
                
                // Обработка ClassDeclaration
                if (node.type === 'ClassDeclaration' && 
                    node.identifier && 
                    this.shouldTraceTarget(node.identifier.value)) {
                    
                    const className = node.identifier.value;
                    if (this.processClassSafe(node, className, generateCode.construct)) {
                        modified = true;
                    }
                }
                
                // Обработка FunctionDeclaration
                else if (node.type === 'FunctionDeclaration' && 
                         node.identifier && 
                         this.shouldTraceTarget(node.identifier.value)) {
                    
                    const functionName = node.identifier.value;
                    if (this.processFunctionSafe(node, functionName, generateCode.construct)) {
                        modified = true;
                    }
                }
                
                // Обработка ClassExpression
                else if (node.type === 'ClassExpression' && 
                         node.identifier && 
                         this.shouldTraceTarget(node.identifier.value)) {
                    
                    const className = node.identifier.value;
                    if (this.processClassSafe(node, className, generateCode.construct)) {
                        modified = true;
                    }
                }
                
                // Обработка FunctionExpression
                else if (node.type === 'FunctionExpression' && 
                         node.identifier && 
                         this.shouldTraceTarget(node.identifier.value)) {
                    
                    const functionName = node.identifier.value;
                    if (this.processFunctionSafe(node, functionName, generateCode.construct)) {
                        modified = true;
                    }
                }
                
                // Рекурсивный обход дочерних узлов
                for (const key in node) {
                    if (node[key] && typeof node[key] === 'object') {
                        if (Array.isArray(node[key])) {
                            node[key].forEach(traverse);
                        } else {
                            traverse(node[key]);
                        }
                    }
                }
            };
            
            traverse(ast);
            
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
            const observerCode = generateCode.construct({ className: target });
            
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

        // Keep webpack magic comments behavior untouched for sensitive imports/requires.
        // Example: require(/* webpackIgnore: true */ 'sockjs')
        if (sourceCode && sourceCode.includes('webpackIgnore')) {
            return sourceCode;
        }
        
        // Проверка входных данных
        const noTargets =
            !targets ||
            (typeof targets !== 'function' && targets.size === 0);

        if (!sourceCode || typeof sourceCode !== 'string' || 
            noTargets || 
            !generateCode?.construct || typeof generateCode.construct !== 'function') {            return sourceCode;
        }

        if (this._targetScanRegex && !this._targetScanRegex.test(sourceCode)) {
            return sourceCode;
        }
        
        // Кэширование результатов
        const cacheKey = this.buildCacheKey(sourceCode, filePath || '');
        if (this.cache.has(cacheKey)) {
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
        this.setCacheEntry(cacheKey, result);
        
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



