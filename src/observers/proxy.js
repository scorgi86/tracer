import { isClassLike, traverseAll } from './utils.js';
import { 
    isProxySymbol,
    emitterProp,
    emitter,
    propertyMapSymbol
 } from './constants.js';
 
import { ExecutionContext } from './context.js';

/**
 * Проверяет, является ли объект прокси
 * @param {object} obj - Проверяемый объект
 * @returns {boolean} true если объект является прокси
 * @private
 */
const isProxy = (obj) => {
    return obj.__isProxy === true;
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

        const data = {
            eventType: 'functionCall',
            place: 'before', fnKey, className, fullName: `${className}.${fnKey}`, targetFn,
            thisArg: this, args, tracerState: tracerState, callStack: ExecutionContext.getCurrentContext()
        };

        ExecutionContext.pushContext(data);

        emitter.notify('beforeCallMethod', data);
        
        try {
            const result = targetFn.apply(this, args);

            emitter.notify('afterCallMethod', {
                ...data,
                value: result,
                place: 'after'
            });

            return result;
        } finally {
            ExecutionContext.popContext();
        }
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
export const wrapProperty = (target, parentPropName, className) => {

    if (isProxy(target)) {
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

            const value = Reflect.get(thisTarget, subProp);

            const propPath = `${parentPropName}.${subProp}`;

            emitter.notify('propertyGet', {
                eventType: 'propertyGet',
                place: 'before', value, thisArg: target,
                propName: propPath, className, tracerState,
                fullName: `${className}.${propPath}`,
                callStack: ExecutionContext.getCurrentContext()
            });

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

            const propPath = `${parentPropName}.${subProp}`;
            emitter.notify('propertySet', {
                eventType: 'propertySet',
                place: 'before', curValue: thisTarget[subProp], value: newValue, thisArg: target,
                propName: propPath, className, tracerState,
                fullName: `${className}.${propPath}`,
                callStack: ExecutionContext.getCurrentContext()
            });

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
            emitter.notify('propertyGet', {
                eventType: 'propertyGet',
                place: 'before', value: internalValue, thisArg: target,
                propName, className, tracerState,
                callStack: ExecutionContext.getCurrentContext()
            });
            // }

            return originalGetter ? originalGetter.call(target) : internalValue;
        },
    };

    if (d.writable !== false) {
        /**
         * Обернутый сеттер свойства
         * @param {*} newValue - Новое значение свойства
         */
        patchedDescriptor.set = (newValue) => {
            const calcValue = originalSetter ? originalSetter.call(target, newValue) : newValue;
            const args = {
                eventType: 'propertySet',
                place: 'before', currValue: internalValue, value: calcValue, thisArg: target,
                propName, className, tracerState,
                callStack: ExecutionContext.getCurrentContext()
            };

            emitter.notify('propertySet', args);

            if (typeof args.value === 'object' && args.value !== null) {
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

    for (const fnKey of Object.getOwnPropertyNames(obj)) {

        if (fnKey === 'constructor') {
            continue;
        }

        try {
            const descriptor = Object.getOwnPropertyDescriptor(obj, fnKey);
            const isFucntion = typeof descriptor.value === 'function';
            
            if (isFucntion) {
                const targetFn = descriptor.value;

                if (!createProxyFn.isProxyFn(targetFn))  {
                    const proxyFn = createProxyFn({fnKey, targetFn, className});
                    Object.defineProperty(obj, fnKey, { ...descriptor, value: proxyFn });
                }
            }
            else if (!wrapProxyPropDescriptor.isProxy(descriptor)) {
                // wrapProxyPropDescriptor(obj, fnKey, className);
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
