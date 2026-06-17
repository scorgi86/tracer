import { isClassLike, traverseAll } from './utils.js';
import { includesByPatterns } from "../patterns.js";
import { isPlainObject } from "../object.js";
import { buildTraceOptions, traceOptionsSymbol } from "../services/config.js";
import { 
    isProxySymbol,
    emitterProp,
    emitter,
    propertyMapSymbol
 } from './constants.js';
 
import { ExecutionContext } from './context.js';

export const getTraceOptions = () => {
    const value = tracerState.get(traceOptionsSymbol);
    if (value) {
        return value;
    }
    const defaults = buildTraceOptions();
    tracerState.set(traceOptionsSymbol, defaults);
    return defaults;
}

export const setTraceOptions = (options = {}) => {
    const current = getTraceOptions();
    const next = buildTraceOptions({
        ...current,
        ...options,
    });
    tracerState.set(traceOptionsSymbol, next);
    return next;
}

/**
 * Проверяет, является ли объект прокси
 * @param {object} obj - Проверяемый объект
 * @returns {boolean} true если объект является прокси
 * @private
 */
const isProxy = (obj) => {
    return obj.__isProxy === true;
}

const isHostObject = (obj) => {
    if (!obj || typeof obj !== 'object') {
        return false;
    }

    if (typeof EventTarget !== 'undefined' && obj instanceof EventTarget) {
        return true;
    }

    if (typeof Node !== 'undefined' && obj instanceof Node) {
        return true;
    }

    if (typeof Window !== 'undefined' && obj instanceof Window) {
        return true;
    }

    if (typeof Document !== 'undefined' && obj instanceof Document) {
        return true;
    }

    if (typeof CSSStyleDeclaration !== 'undefined' && obj instanceof CSSStyleDeclaration) {
        return true;
    }

    const tag = Object.prototype.toString.call(obj);
    return (
        tag === '[object CSSStyleDeclaration]' ||
        tag === '[object Window]' ||
        tag === '[object Document]' ||
        tag === '[object Location]' ||
        tag === '[object Navigator]'
    );
}

const isNativeFunction = (fn) => {
    if (typeof fn !== 'function') {
        return false;
    }
    const source = Function.prototype.toString.call(fn);
    return source.indexOf('[native code]') > -1;
}

const normalizeDepth = (value, fallback = 1) => {
    if (value === Infinity) {
        return Infinity;
    }

    const depth = Number(value);
    if (!Number.isFinite(depth)) {
        return fallback;
    }

    return Math.max(0, Math.floor(depth));
}

/**
 * Глобальное состояние трассировщика для хранения данных слайсов
 * @typedef {Object} TracerState
 * @property {Map} _store - Внутреннее хранилище
 * @property {Function} set - Устанавливает значение в состояние
 * @property {Function} get - Получает значение из состояния
 */

/**
 * Глобальное состояние трассировщика
 * @type {TracerState}
 */
export const tracerState = {
    _store: new Map,
    /**
     * Устанавливает значение для указанного ключа
     * @param {string|symbol} prop - Ключ для хранения
     * @param {*} value - Значение для сохранения
     */
    set: (prop, value) => {
        tracerState._store.set(prop, value);
    },
    /**
     * Получает значение по ключу
     * @param {string|symbol} prop - Ключ для поиска
     * @returns {*} Значение, сохраненное по ключу
     */
    get: (prop) => {
        return tracerState._store.get(prop);
    }
};

let callSeq = 0;
const nextCallId = () => ++callSeq;
const now = () => (
    typeof performance !== "undefined" && typeof performance.now === "function"
        ? performance.now()
        : Date.now()
);

/**
 * Оборачивает конструктор класса для трассировки вызовов методов
 * @param {Function} OriginalConstructor - Исходный конструктор класса
 * @param {string} className - Имя класса для трассировки
 * @returns {Function} Обернутый конструктор, создающий трассируемые экземпляры
 * 
 * @example
 * class User {
 *   constructor(name) {
 *     this.name = name;
 *   }
 *   sayHello() {
 *     return `Hello, ${this.name}`;
 *   }
 * }
 * 
 * const TracedUser = wrapConstructor(User, 'User');
 * const user = new TracedUser('John'); // Экземпляр автоматически трассируется
 * user.sayHello(); // Вызов метода отслеживается
 */
export const wrapConstructor = (OriginalConstructor, className) => {
    const name = OriginalConstructor.name || className;

    const result = function(...args) {
        if (new.target) {
            const instance = new OriginalConstructor(...arguments);
            
            traverse(instance, name || OriginalConstructor.name);

            return instance;
        }

        return OriginalConstructor.apply(this, args);
    };

    result.isProxyConstructor = true;

    return result;
}

/**
 * Создает прокси-функцию для отслеживания вызовов
 * @param {Object} params - Параметры создания прокси
 * @param {string} params.fnKey - Имя функции
 * @param {Function} params.targetFn - Исходная функция
 * @param {string} params.className - Имя класса, которому принадлежит функция
 * @returns {Function} Прокси-функция с возможностью трассировки
 * 
 * @example
 * const add = (a, b) => a + b;
 * const tracedAdd = createProxyFn({
 *   fnKey: 'add',
 *   targetFn: add,
 *   className: 'Math'
 * });
 * 
 * tracedAdd(2, 3); // Генерирует события beforeCallMethod/afterCallMethod
 */
export const createProxyFn = ({fnKey, targetFn, className}) => {
    const proxyFn = function(...args) {
        const finalClassName = className || this?.constructor?.name || 'unknown';
        const traceOptions = getTraceOptions();
        if (traceOptions.enableCalls === false) {
            return targetFn.apply(this, args);
        }

        const fullName = `${finalClassName}.${fnKey}`;
        if (traceOptions.suppressNoisy && includesByPatterns(fullName, traceOptions.noisyCalls)) {
            return targetFn.apply(this, args);
        }
        if (traceOptions.callFilter && !traceOptions.callFilter({
            fnKey,
            className,
            fullName,
        })) {
            return targetFn.apply(this, args);
        }

        const hasBeforeSubscribers = emitter.has('beforeCallMethod');
        const hasAfterSubscribers = emitter.has('afterCallMethod');
        const startedAt = now();
        const data = {
            eventType: 'functionCall',
            fnKey,
            className: finalClassName,
            fullName,
            targetFn,
            thisArg: this,
            args,
            tracerState: tracerState,
            startedAt,
        };

        if (traceOptions.captureContext !== true) {
            if (hasBeforeSubscribers) {
                emitter.notify('beforeCallMethod', {
                    ...data,
                    place: 'before',
                    status: 'started',
                });
            }

            const emitAfter = (status, payload = {}) => {
                if (!hasAfterSubscribers) {
                    return;
                }
                const endedAt = now();
                emitter.notify('afterCallMethod', {
                    ...data,
                    place: 'after',
                    status,
                    endedAt,
                    durationMs: endedAt - startedAt,
                    ...payload,
                });
            };

            try {
                const result = targetFn.apply(this, args);
                if (result && typeof result.then === "function") {
                    return result.then(
                        (value) => {
                            emitAfter('ok', { value });
                            return value;
                        },
                        (error) => {
                            emitAfter('rejected', { error });
                            throw error;
                        },
                    );
                }
                emitAfter('ok', { value: result });
                return result;
            } catch (error) {
                emitAfter('error', { error });
                throw error;
            }
        }

        const parentContext = ExecutionContext.getCurrentContext();
        data.callStack = parentContext;
        data.callId = nextCallId();
        data.parentCallId = parentContext?.val?.callId;

        return ExecutionContext.withContext({
            ...data,
            place: 'before',
            status: 'started',
        }, () => {
            if (hasBeforeSubscribers) {
                emitter.notify('beforeCallMethod', {
                    ...data,
                    place: 'before',
                    status: 'started',
                });
            }

            const emitAfter = (status, payload = {}) => {
                if (!hasAfterSubscribers) {
                    return;
                }
                const endedAt = now();
                emitter.notify('afterCallMethod', {
                    ...data,
                    place: 'after',
                    status,
                    endedAt,
                    durationMs: endedAt - startedAt,
                    ...payload,
                });
            };

            try {
                const result = targetFn.apply(this, args);

                if (result && typeof result.then === "function") {
                    return result.then(
                        (value) => {
                            emitAfter('ok', { value });
                            return value;
                        },
                        (error) => {
                            emitAfter('rejected', { error });
                            throw error;
                        },
                    );
                }

                emitAfter('ok', { value: result });
                return result;
            } catch (error) {
                emitAfter('error', { error });
                throw error;
            }
        });
    };
    if (targetFn && typeof targetFn === "function") {
        const targetDescriptor = Object.getOwnPropertyDescriptor(targetFn, "prototype");
        if (targetDescriptor && "value" in targetDescriptor) {
            try {
                const proxyDescriptor = Object.getOwnPropertyDescriptor(proxyFn, "prototype");
                if (!proxyDescriptor || proxyDescriptor.writable !== false) {
                    proxyFn.prototype = targetDescriptor.value;
                }
            } catch (error) {
                // best-effort compatibility for environments with non-configurable prototypes
            }
        }
    }
    try {
        Object.setPrototypeOf(proxyFn, targetFn);
    } catch (error) {
        // keep proxy function usable even if setting prototype chain is not supported
    }
    proxyFn[isProxySymbol] = true
    proxyFn.original = targetFn;

    return proxyFn;
}

/**
 * Проверяет, является ли функция прокси-функцией
 * @param {Function} fn - Проверяемая функция
 * @returns {boolean} true если функция является прокси
 */
createProxyFn.isProxyFn = (fn) => fn[isProxySymbol] === true;

/**
 * Оборачивает объект в Proxy для отслеживания доступа к его свойствам
 * @param {object} target - Целевой объект для обертки
 * @param {string} parentPropName - Имя родительского свойства
 * @param {string} className - Имя класса для трассировки
 * @returns {Proxy} Прокси-объект, отслеживающий доступ к свойствам
 * 
 * @example
 * const user = { name: 'John', age: 30 };
 * const wrappedUser = wrapProperty(user, 'user', 'User');
 * 
 * console.log(wrappedUser.name); // Генерирует событие propertyGet
 * wrappedUser.age = 31; // Генерирует событие propertySet
 */
export const wrapProperty = (target, parentPropName, className, options = {}) => {
    const opts = typeof options === 'number'
        ? { maxDepth: options }
        : (options || {});
    const maxDepth = normalizeDepth(opts.maxDepth, 1);
    const depth = normalizeDepth(opts.depth, 1);
    const shouldWrap = typeof opts.shouldWrap === 'function'
        ? opts.shouldWrap
        : () => false;
    if (depth > maxDepth || isProxy(target) || isHostObject(target) || !isPlainObject(target)) {
        return target;
    }

    return new Proxy(target, {
        /**
         * Перехватчик чтения свойства
         * @param {object} thisTarget - Целевой объект
         * @param {string|symbol} subProp - Имя свойства
         * @returns {*} Значение свойства
         */
        get(thisTarget, subProp) {

            if (subProp === '__isProxy') {
                return true;
            }
            if (typeof subProp !== 'string') {
                return Reflect.get(thisTarget, subProp);
            }

            const value = Reflect.get(thisTarget, subProp);
            const traceOptions = getTraceOptions();
            const hasPropertyGetSubscribers = emitter.has('propertyGet');
            if (!hasPropertyGetSubscribers && traceOptions.enableProperties !== true) {
                return value;
            }

            const propPath = `${parentPropName}.${subProp}`;
            const fullName = `${className}.${propPath}`;
            const passPropertyFilter = !traceOptions.propertyFilter || traceOptions.propertyFilter({
                phase: 'get',
                propName: propPath,
                className,
                fullName,
            }) === true;
            const shouldNotifyGet = hasPropertyGetSubscribers
                && passPropertyFilter
                && (!traceOptions.suppressNoisy || !includesByPatterns(fullName, traceOptions.noisyProperties));

            if (shouldNotifyGet) {
                emitter.notify('propertyGet', {
                    eventType: 'propertyGet',
                    place: 'before', value, thisArg: target,
                    propName: propPath, className, tracerState,
                    fullName,
                    callStack: ExecutionContext.getCurrentContext()
                });
            }

            if (depth < maxDepth && typeof value === 'object' && value !== null && !isHostObject(value) && isPlainObject(value) && shouldWrap({
                phase: 'get',
                depth,
                maxDepth,
                propName: propPath,
                parentPropName,
                className,
                value,
                thisTarget,
            })) {
                const wrappedValue = wrapProperty(value, propPath, className, {
                    maxDepth,
                    depth: depth + 1,
                    shouldWrap,
                });
                Reflect.set(thisTarget, subProp, wrappedValue);
                return wrappedValue;
            }

            return value;
        },

        /**
         * Перехватчик записи свойства
         * @param {object} thisTarget - Целевой объект
         * @param {string|symbol} subProp - Имя свойства
         * @param {*} newValue - Новое значение
         * @returns {boolean} Результат операции записи
         */
        set(thisTarget, subProp, newValue) {
            if (typeof subProp !== 'string') {
                return Reflect.set(thisTarget, subProp, newValue);
            }
            const traceOptions = getTraceOptions();
            const hasPropertySetSubscribers = emitter.has('propertySet');
            if (!hasPropertySetSubscribers && traceOptions.enableProperties !== true) {
                return Reflect.set(thisTarget, subProp, newValue);
            }

            const propPath = `${parentPropName}.${subProp}`;
            const fullName = `${className}.${propPath}`;
            const passPropertyFilter = !traceOptions.propertyFilter || traceOptions.propertyFilter({
                phase: 'set',
                propName: propPath,
                className,
                fullName,
            }) === true;
            const shouldNotifySet = hasPropertySetSubscribers
                && passPropertyFilter
                && (!traceOptions.suppressNoisy || !includesByPatterns(fullName, traceOptions.noisyProperties));

            if (shouldNotifySet) {
                emitter.notify('propertySet', {
                    eventType: 'propertySet',
                    place: 'before', curValue: thisTarget[subProp], value: newValue, thisArg: target,
                    propName: propPath, className, tracerState,
                    fullName,
                    callStack: ExecutionContext.getCurrentContext()
                });
            }

            if (depth < maxDepth && typeof newValue === 'object' && newValue !== null && !isHostObject(newValue) && isPlainObject(newValue) && shouldWrap({
                phase: 'set',
                depth,
                maxDepth,
                propName: propPath,
                parentPropName,
                className,
                value: newValue,
                thisTarget,
            })) {
                return Reflect.set(thisTarget, subProp, wrapProperty(newValue, propPath, className, {
                    maxDepth,
                    depth: depth + 1,
                    shouldWrap,
                }));
            }

            return Reflect.set(thisTarget, subProp, newValue);
        }
    })
}

/**
 * Оборачивает дескриптор свойства для отслеживания доступа
 * @param {object} target - Целевой объект
 * @param {string} propName - Имя свойства для обертки
 * @param {string} className - Имя класса для трассировки
 * 
 * @example
 * class Config {
 *   constructor() {
 *     this._apiKey = 'secret';
 *   }
 *   
 *   get apiKey() {
 *     return this._apiKey;
 *   }
 *   
 *   set apiKey(value) {
 *     this._apiKey = value;
 *   }
 * }
 * 
 * const config = new Config();
 * wrapProxyPropDescriptor(config, 'apiKey', 'Config');
 * 
 * console.log(config.apiKey); // Генерирует событие propertyGet
 * config.apiKey = 'new-key'; // Генерирует событие propertySet
 */
export const wrapProxyPropDescriptor = (target, propName, className) => {
    const d = Object.getOwnPropertyDescriptor(target, propName);

    if (!d) {
        return false;
    }
    
    if (d.configurable === false) {
        return false;
    }

    const originalGetter = d.get;
    const originalSetter = d.set;
    let internalValue = d.value;

    const patchedDescriptor = {
        ...d,
        /**
         * Обернутый геттер свойства
         * @returns {*} Значение свойства
         */
        get() {
            const traceOptions = getTraceOptions();
            const hasPropertyGetSubscribers = emitter.has('propertyGet');
            if (!hasPropertyGetSubscribers && traceOptions.enableProperties !== true) {
                return originalGetter ? originalGetter.call(this) : internalValue;
            }
            const fullName = `${className}.${propName}`;
            const passPropertyFilter = !traceOptions.propertyFilter || traceOptions.propertyFilter({
                phase: 'get',
                propName,
                className,
                fullName,
            }) === true;
            const shouldNotifyGet = hasPropertyGetSubscribers
                && passPropertyFilter
                && (!traceOptions.suppressNoisy || !includesByPatterns(fullName, traceOptions.noisyProperties));
            if (shouldNotifyGet) {
                emitter.notify('propertyGet', {
                    eventType: 'propertyGet',
                    place: 'before', value: internalValue, thisArg: this,
                    propName, className, tracerState,
                    fullName,
                    callStack: ExecutionContext.getCurrentContext()
                });
            }
            // }

            return originalGetter ? originalGetter.call(this) : internalValue;
        },
    };

    if (d.writable !== false) {
        /**
         * Обернутый сеттер свойства
         * @param {*} newValue - Новое значение свойства
         */
        patchedDescriptor.set = function(newValue) {
            if (originalSetter) {
                originalSetter.call(this, newValue);
            }
            const calcValue = originalGetter ? originalGetter.call(this) : newValue;
            const args = {
                eventType: 'propertySet',
                place: 'before', curValue: internalValue, value: calcValue, thisArg: this,
                propName, className, tracerState,
                fullName: `${className}.${propName}`,
                callStack: ExecutionContext.getCurrentContext()
            };

            const traceOptions = getTraceOptions();
            const hasPropertySetSubscribers = emitter.has('propertySet');
            if (!hasPropertySetSubscribers && traceOptions.enableProperties !== true) {
                if (typeof args.value === 'object' && args.value !== null && !isHostObject(args.value)) {
                    internalValue = wrapProperty(args.value, propName, className);
                } else {
                    internalValue = args.value;
                }
                return;
            }
            const passPropertyFilter = !traceOptions.propertyFilter || traceOptions.propertyFilter({
                phase: 'set',
                propName,
                className,
                fullName: args.fullName,
            }) === true;
            const shouldNotifySet = hasPropertySetSubscribers
                && passPropertyFilter
                && (!traceOptions.suppressNoisy || !includesByPatterns(args.fullName, traceOptions.noisyProperties));
            if (shouldNotifySet) {
                emitter.notify('propertySet', args);
            }

            if (typeof args.value === 'object' && args.value !== null && !isHostObject(args.value)) {
                internalValue = wrapProperty(args.value, propName, className);
            } else {
                internalValue = args.value;
            }
        };
    }
    
    delete patchedDescriptor.value;
    delete patchedDescriptor.writable;

    if (!target[propertyMapSymbol]) {
        target[propertyMapSymbol] = new Map;
    }

    target[propertyMapSymbol].set(propName, true);

    Object.defineProperty(target, propName, patchedDescriptor);
    return true;
}

/**
 * Проверяет, является ли свойство прокси-обернутым
 * @param {object} target - Целевой объект
 * @param {string} propName - Имя свойства
 * @returns {boolean} true если свойство обернуто в прокси
 */
wrapProxyPropDescriptor.isProxy = (target, propName) => {
    return target[propertyMapSymbol]
        ? target[propertyMapSymbol].get(propName)
        : false;
}

/**
 * Рекурсивно обходит объект и оборачивает все его методы в прокси для трассировки
 * @param {object} obj - Объект для трассировки
 * @param {string} className - Имя класса для идентификации
 * 
 * @example
 * const service = {
 *   getUser(id) {
 *     return { id, name: 'John' };
 *   },
 *   updateUser(id, data) {
 *     return { ...data, id };
 *   }
 * };
 * 
 * traverse(service, 'UserService');
 * 
 * service.getUser(1); // Вызов метода отслеживается
 * service.updateUser(1, { name: 'Jane' }); // Вызов метода отслеживается
 */
export function traverse(obj, className = '', options = {}) {
    const report = options.report || {
        targetName: className || "",
        wrappedMethods: [],
        wrappedProperties: [],
        failedMethods: [],
        failedProperties: [],
        skippedMethods: [],
        skippedProperties: [],
    };
    const includeProperties = options.includeProperties === true;
    const onInstrumentationError = typeof options.onInstrumentationError === "function"
        ? options.onInstrumentationError
        : null;
    const throwOnInstrumentationError = options.throwOnInstrumentationError === true;

    const pushFailure = (collectionName, fnKey, error) => {
        const entry = {
            name: fnKey,
            reason: error && error.message ? error.message : String(error),
            error,
        };
        report[collectionName].push(entry);
        if (onInstrumentationError) {
            onInstrumentationError({
                className,
                ...entry,
            });
        }
    };

    if (!obj || typeof obj !== 'object') {
        report.skippedMethods.push({
            name: className || "<target>",
            reason: "invalid-target",
        });
        return report;
    }
    if (isHostObject(obj)) {
        report.skippedMethods.push({
            name: className || "<target>",
            reason: "host-object",
        });
        return report;
    }

    for (const fnKey of Object.getOwnPropertyNames(obj)) {

        if (fnKey === 'constructor') {
            continue;
        }

        let isFunctionTarget = false;
        try {
            const descriptor = Object.getOwnPropertyDescriptor(obj, fnKey);
            if (!descriptor) {
                report.skippedMethods.push({
                    name: fnKey,
                    reason: "no-descriptor",
                });
                continue;
            }
            const isFunction = typeof descriptor.value === 'function';
            isFunctionTarget = isFunction;
            
            if (isFunction) {
                const targetFn = descriptor.value;
                if (isNativeFunction(targetFn)) {
                    report.skippedMethods.push({
                        name: fnKey,
                        reason: "native-function",
                    });
                    continue;
                }

                if (!createProxyFn.isProxyFn(targetFn))  {
                    const proxyFn = createProxyFn({fnKey, targetFn, className});
                    Object.defineProperty(obj, fnKey, { ...descriptor, value: proxyFn });
                    report.wrappedMethods.push(fnKey);
                } else {
                    report.skippedMethods.push({
                        name: fnKey,
                        reason: "already-proxy",
                    });
                }
            }
            else if (includeProperties && !wrapProxyPropDescriptor.isProxy(obj, fnKey)) {
                const wrapped = wrapProxyPropDescriptor(obj, fnKey, className);
                if (wrapped) {
                    report.wrappedProperties.push(fnKey);
                } else {
                    report.skippedProperties.push({
                        name: fnKey,
                        reason: "non-configurable-or-missing-descriptor",
                    });
                }
            }
        } catch (e) {
            if (isFunctionTarget) {
                pushFailure("failedMethods", fnKey, e);
            } else {
                pushFailure("failedProperties", fnKey, e);
            }
            if (throwOnInstrumentationError) {
                throw e;
            }
        }
    }

    return report;
}

/**
 * Привязывает эмиттер событий к функции traverse
 */
traverse[emitterProp] = emitter;

/**
 * Обходит все прототипы классов в объекте и трассирует их методы
 * @param {object} target - Объект, содержащий классы
 * @param {string} targetName - Базовое имя для трассировки
 * 
 * @example
 * const services = {
 *   UserService: class UserService {
 *     getUsers() { return []; }
 *   },
 *   ProductService: class ProductService {
 *     getProducts() { return []; }
 *   }
 * };
 * 
 * traverseAllPrototype(services, 'App');
 * // Все методы UserService и ProductService будут трассироваться
 */
export const traverseAllPrototype = (target, targetName) => {
    const objClassList = Object.keys(target).filter((key) => typeof target[key] === 'function' && isClassLike(key, target[key]));
    
    traverseAll(objClassList, (key) => {
        traverse(target[key].prototype, `${targetName}.${key}.prototype`);
    });
}
