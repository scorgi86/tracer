import { isClassLike, traverseAll } from './utils.js';
import { 
    isProxySymbol,
    emitterProp,
    emitter,
    propertyMapSymbol
 } from './constants.js';
 
import { ExecutionContext } from './context.js';

export const traceOptionsSymbol = Symbol('trace-options');

const defaultNoisyCalls = [
    'CEditorPage.onTimerScroll',
    'PaintMessageLoop._animation',
    'baseEditorsApi._autoSave',
];

const toArray = (value, fallback = []) => {
    if (Array.isArray(value)) {
        return value.filter((item) => typeof item === 'string' && item.length > 0);
    }
    return [...fallback];
}

export const buildTraceOptions = (options = {}) => {
    return {
        profile: typeof options.profile === 'string' ? options.profile : 'balanced',
        enableCalls: options.enableCalls !== false,
        enableProperties: options.enableProperties === true,
        suppressNoisy: options.suppressNoisy !== false,
        noisyCalls: toArray(options.noisyCalls, defaultNoisyCalls),
        noisyProperties: toArray(options.noisyProperties, []),
        callFilter: typeof options.callFilter === 'function' ? options.callFilter : null,
        propertyFilter: typeof options.propertyFilter === 'function' ? options.propertyFilter : null,
        captureContext: options.captureContext === true,
    };
}

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

const includesByPatterns = (value, patterns = []) => {
    if (!value || !patterns?.length) {
        return false;
    }
    for (let i = 0; i < patterns.length; i += 1) {
        if (value.indexOf(patterns[i]) > -1) {
            return true;
        }
    }
    return false;
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

const isPlainObject = (value) => {
    if (!value || typeof value !== 'object') {
        return false;
    }
    const proto = Object.getPrototypeOf(value);
    return proto === Object.prototype || proto === null;
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

    if (OriginalConstructor.isPatched === true) {
        return OriginalConstructor;
    }
    
    OriginalConstructor.isPatched = true;

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
        const traceOptions = getTraceOptions();
        if (traceOptions.enableCalls === false) {
            return targetFn.apply(this, args);
        }

        const fullName = `${className}.${fnKey}`;
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
        if (!hasBeforeSubscribers && !hasAfterSubscribers) {
            return targetFn.apply(this, args);
        }
        const startedAt = Date.now();
        const data = {
            eventType: 'functionCall',
            fnKey,
            className,
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
                const endedAt = Date.now();
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
                const endedAt = Date.now();
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
            if (traceOptions.enableProperties !== true) {
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
            const shouldNotifyGet = traceOptions.enableProperties
                && emitter.has('propertyGet')
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
            if (traceOptions.enableProperties !== true) {
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
            const shouldNotifySet = traceOptions.enableProperties
                && emitter.has('propertySet')
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
        return;
    }
    
    if (d.configurable === false) {
        return;
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
            if (traceOptions.enableProperties !== true) {
                return originalGetter ? originalGetter.call(this) : internalValue;
            }
            const fullName = `${className}.${propName}`;
            const passPropertyFilter = !traceOptions.propertyFilter || traceOptions.propertyFilter({
                phase: 'get',
                propName,
                className,
                fullName,
            }) === true;
            const shouldNotifyGet = traceOptions.enableProperties
                && emitter.has('propertyGet')
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
                place: 'before', currValue: internalValue, value: calcValue, thisArg: this,
                propName, className, tracerState,
                fullName: `${className}.${propName}`,
                callStack: ExecutionContext.getCurrentContext()
            };

            const traceOptions = getTraceOptions();
            if (traceOptions.enableProperties !== true) {
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
            const shouldNotifySet = traceOptions.enableProperties
                && emitter.has('propertySet')
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
export function traverse(obj, className = '') {
    if (!obj || typeof obj !== 'object') {
        return;
    }
    if (isHostObject(obj)) {
        return;
    }

    for (const fnKey of Object.getOwnPropertyNames(obj)) {

        if (fnKey === 'constructor') {
            continue;
        }

        try {
            const descriptor = Object.getOwnPropertyDescriptor(obj, fnKey);
            const isFucntion = typeof descriptor.value === 'function';
            
            if (isFucntion) {
                const targetFn = descriptor.value;
                if (isNativeFunction(targetFn)) {
                    continue;
                }

                if (!createProxyFn.isProxyFn(targetFn))  {
                    const proxyFn = createProxyFn({fnKey, targetFn, className});
                    Object.defineProperty(obj, fnKey, { ...descriptor, value: proxyFn });
                }
            }
            else if (!wrapProxyPropDescriptor.isProxy(obj, fnKey)) {
                wrapProxyPropDescriptor(obj, fnKey, className);
            }
        } catch (e) {
            console.error(e)
        }
    }
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
