// swc-inject-loader-optimized.js
const swc = require('@swc/core');
const path = require('path');
const crypto = require('node:crypto');
const normalizeOptions = require("./tracer/normalizeOptions");
const buildOptionsHash = require("./tracer/buildOptionsHash");
const buildHookStatements = require("./tracer/buildHookStatements");
const parseHookStatements = require("./tracer/parseHookStatements");
const getTracerFacadeCode = require("./tracer/tracerFacadeCode");
const astScanner = require("./tracer/astScanner");
const runAstTransform = require("./tracer/astTransform");
const createNodeInjectors = require("./tracer/createNodeInjectors");
const { buildConstructorHookContext } = require("./tracer/hookContexts");

module.exports = class SWCInjectLoader {
    constructor(opts = {}) {
        this._options = normalizeOptions(opts);
        
        this.cache = new Map();
        this.debug = opts.debug || false;
        this._optionsHash = this.buildOptionsHash(this._options);
        this.observerStatementsCache = new Map();
        this._targetScanRegex = this.buildTargetScanRegex(this._options.targets);
        this.nodeInjectors = this.createNodeInjectors();
    }

    buildOptionsHash(opts) {
        return buildOptionsHash(opts);
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

    getObserverStatements(name, generateCodeFn, hookContext) {
        const hasInstanceMethodsOnThis = hookContext?.hasInstanceMethodsOnThis === true ? 1 : 0;
        const cacheKey = `onConstructor:${name}:${hasInstanceMethodsOnThis}`;
        return buildHookStatements({
            cache: this.observerStatementsCache,
            cacheKey,
            generateCodeFn,
            args: hookContext,
            parseCodeToStatements: this.parseCodeToStatements.bind(this),
            isUnsafeTracerCode: this.isUnsafeTracerCode.bind(this),
            debug: this.debug,
            debugLabel: "onConstructor",
            getTracerFacadeCode,
        });
    }

    getHookStatements(cacheKey, generateCodeFn, args) {
        return buildHookStatements({
            cache: this.observerStatementsCache,
            cacheKey,
            generateCodeFn,
            args,
            parseCodeToStatements: this.parseCodeToStatements.bind(this),
            isUnsafeTracerCode: this.isUnsafeTracerCode.bind(this),
            debug: this.debug,
            debugLabel: "hook",
            getTracerFacadeCode,
        });
    }

    getTracerFacadeCode() {
        return getTracerFacadeCode();
    }

    createNodeInjectors() {
        return createNodeInjectors({
            parseCodeToStatements: this.parseCodeToStatements.bind(this),
            getObserverStatements: this.getObserverStatements.bind(this),
            getTracerFacadeCode: this.getTracerFacadeCode.bind(this),
            isInsertStart: this.isInsertStart.bind(this),
            debug: this.debug,
        });
    }

    isUnsafeTracerCode(code) {
        if (!code || typeof code !== "string") {
            return false;
        }
        return /(?:window\.)?Tracer\.(?:observePrototype|observe|observeConstructor)\(\s*(?:undefined\b|null\b|["']undefined["'])/.test(code);
    }

    parseCodeToStatements(codeStr) {
        return parseHookStatements(codeStr, { debug: this.debug });
    }


    processClassSafe(classNode, className, generateCodeFn, moduleStatements) {
        return this.nodeInjectors.processClassNode(classNode, className, generateCodeFn, moduleStatements);
    }

    processFunctionSafe(functionNode, functionName, generateCodeFn, moduleStatements) {
        return this.nodeInjectors.processFunctionNode(functionNode, functionName, generateCodeFn, moduleStatements);
    }


    getPrototypeAssignmentInfo(node) {
        return astScanner.getPrototypeAssignmentInfo(node);
    }

    findTopLevelIIFE(astBody) {
        return astScanner.findTopLevelIIFE(astBody);
    }

    findBeforeEndIndex(statements) {
        return astScanner.findBeforeEndIndex(statements);
    }

    collectModuleSymbolsFromStatements(statements) {
        return astScanner.collectModuleSymbolsFromStatements(statements);
    }

    /**
     * Основной метод обработки через AST с visitor pattern
     */

    collectTopLevelTargetCandidatesFromStatements(statements, candidates) {
        return astScanner.collectTopLevelTargetCandidatesFromStatements(statements, candidates);
    }

    collectTopLevelTargetCandidates(astBody) {
        return astScanner.collectTopLevelTargetCandidates(astBody);
    }

    hasTopLevelTargetMatch(candidates) {
        return astScanner.hasTopLevelTargetMatch(candidates, this.shouldTraceTarget.bind(this));
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
            
            const transformResult = runAstTransform({
                ast,
                sourceCode,
                filePath,
                generateCode,
                collectTopLevelTargetCandidates: this.collectTopLevelTargetCandidates.bind(this),
                hasTopLevelTargetMatch: this.hasTopLevelTargetMatch.bind(this),
                shouldTraceTarget: this.shouldTraceTarget.bind(this),
                processClassSafe: this.processClassSafe.bind(this),
                processFunctionSafe: this.processFunctionSafe.bind(this),
                getPrototypeAssignmentInfo: this.getPrototypeAssignmentInfo.bind(this),
                getHookStatements: this.getHookStatements.bind(this),
                findTopLevelIIFE: this.findTopLevelIIFE.bind(this),
                collectModuleSymbolsFromStatements: this.collectModuleSymbolsFromStatements.bind(this),
                findBeforeEndIndex: this.findBeforeEndIndex.bind(this),
            });
            if (transformResult === sourceCode) {
                return sourceCode;
            }
            
            // Генерируем код напрямую из модифицированного AST
            const output = swc.printSync(transformResult, {
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
            const observerCode = generateCode.onConstructor(
                buildConstructorHookContext({
                    className: target,
                    hasInstanceMethodsOnThis: false,
                })
            );
            
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
        this._options = normalizeOptions({
            ...this._options,
            ...newOpts
        });
        this.debug = this._options.debug || false;
        this._optionsHash = this.buildOptionsHash(this._options);
        this._targetScanRegex = this.buildTargetScanRegex(this._options.targets);
        this.nodeInjectors = this.createNodeInjectors();
        this.observerStatementsCache.clear();
        this.clearCache(); // Сбрасываем кэш при изменении опций
    }
}








