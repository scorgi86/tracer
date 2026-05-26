const { parse } = require('@babel/parser');
const traverse = require('@babel/traverse').default;
const generate = require('@babel/generator').default;
const t = require('@babel/types');

/**
 * @typedef { Object } ClassConfig
 * @property { string[] } props
 */

/**
 * @typedef { Object } GenerateCode
 * @property { Function } construct
 */

/**
 * @typedef { Objcet } InjectLoaderOpts
 * @property { GenerateCode } generateCode;
 * @property { Set<string> } targets;
 * @property { Map<string, ClassConfig> } classConfig;
 */

/**
 * @class
 * @param {InjectLoaderOpts}
 */
class InjectLoader {
    
    /**
     * @type { InjectLoaderOpts }
     */
    _options;

    /**
     * 
     * @param { InjectLoaderOpts } opts 
     */
    constructor(opts = {}) {
        this._options = {...opts};
    }

    isInsertStart() {
        return this._options.insertPosition === 'start';
    }

    shouldTraceTarget(targetName) {
        const { targets } = this._options;

        if (!targets) {
            return false;
        }

        if (typeof targets === 'function') {
            return !!targets(targetName);
        }

        if (targets instanceof Set) {
            return targets.has(targetName);
        }

        if (Array.isArray(targets)) {
            return targets.includes(targetName);
        }

        return false;
    }

    /**
     * 
     * @param { string } sourceCode
     * @returns { string }
     */
    processCode(sourceCode) {
        const self = this;
        const ast = parse(sourceCode, {
            sourceType: 'module',
            plugins: ['jsx', 'typescript', 'classProperties']
        });
        const { targets } = this._options;

        if (!targets) {
            throw new Error(`Не заданы классы/функции, для которые нужно отслеживать!`);
        }

        traverse(ast, {
            ClassDeclaration(path) {
                const className = path.node.id.name;
                
                if (self.shouldTraceTarget(className)) {
                    let hasConstructor = false;
                
                    path.traverse({
                        ClassMethod(methodPath) {
                            if (methodPath.node.kind === 'constructor') {
                                hasConstructor = true;

                                if (self.shouldTraceTarget(className)) {
                                    self.injectPropsObserver(className, methodPath.node, true);
                                }
                            }
                        }
                    });
                    
                    // Если конструктора нет, добавляем его
                    if (!hasConstructor) {
                        self.injectPropsObserverWithConstructor(className, path.node);
                    }
                }
            },
            /**
             * @param { babel.NodePath<t.FunctionDeclaration> }
             */
            FunctionDeclaration(path) {
                const className = path.node.id.name;
                
                if (self.shouldTraceTarget(className)) {
                    self.injectPropsObserver(className, path.node, true);
                }
            }
        });

        const newCode = generate(ast).code;

        return newCode;
    }

    /**
     * @param { string } codeStr
     * @returns { babel.types.Statement[] }
     */
    parseCode(codeStr) {
        return parse(codeStr, { sourceType: 'module' }).program.body;
    }

    /**
     * @param { string } className
     * @param { string[] } props
     * @returns { babel.NodePath<t.Node>[] }
     */
    generaceSourceCodeAst(className, generateCode) {
        const propsCodeStr = `
            // injected code with InjectLoader => start
            ${generateCode({ className }).trim()}
            // injected code with InjectLoader => stop
        `.trim();
        return this.parseCode(propsCodeStr);
    }

    generatePatchedClassInfoAst(className) {
        const safeClassName = String(className).replace(/\\/g, '\\\\').replace(/'/g, "\\'");
        const code = `
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

        return this.parseCode(code);
    }

    /**
     * @param { string } className
     * @param { babel.Node } node
     * @returns { void }
     */
    injectPropsObserver(className, node, trackClassPatch = false) {
        const { generateCode } = this._options;
        const { construct } = generateCode;

        if (!construct) {
            return;
        }

        const observers = this.generaceSourceCodeAst(className, construct);

        if (this.isInsertStart()) {
            node.body.body.unshift(...observers);
        } else {
            node.body.body.push(...observers);
        }

        if (trackClassPatch) {
            const patchInfo = this.generatePatchedClassInfoAst(className);
            node.body.body.push(...patchInfo);
        }
    }

    /**
     * @param { string } className
     * @param { babel.Node<t.ClassDeclaration> } node
     * @returns { void }
     */
    injectPropsObserverWithConstructor(className, node) {
        const { generateCode } = this._options;
        const { construct } = generateCode;

        if (!construct) {
            return;
        }

        // const hasSuper = !!node.node.superClass;
        const constructorNode = t.classMethod(
            'constructor',
            t.identifier('constructor'),
            [],
            t.blockStatement([])
        );

        this.injectPropsObserver(className, constructorNode, true);

        node.body.body.unshift(constructorNode);
    }
}

module.exports = InjectLoader;
