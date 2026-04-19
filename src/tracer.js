import { emitter } from "./observers/constants.js";
import { ExecutionContext } from "./observers/context.js";
import {
  createProxyFn,
  tracerState,
  traverse,
  wrapConstructor,
  wrapProperty,
  wrapProxyPropDescriptor,
} from "./observers/proxy.js";
import * as reports from "./reports/index.js";

const stateConfigKey = Symbol("stateConfigKey");

const traceCallback = [];
const traceCallCallback = [];
const tracePropertyCallback = [];

/**
 * Главный класс трассировщика для мониторинга вызовов функций,
 * доступа к свойствам и контекста выполнения.
 * Предоставляет статические методы для обертки функций, классов и объектов
 * с возможностью отслеживания.
 * 
 * @example
 * // Базовое использование - отслеживание вызовов функций
 * const myFunction = (a, b) => a + b;
 * const tracedFunction = Tracer.createProxyFn(myFunction, 'add');
 * tracedFunction(2, 3); // Генерирует события beforeCallMethod/afterCallMethod
 * 
 * @example
 * // Отслеживание класса
 * class Calculator {
 *   add(a, b) { return a + b; }
 *   multiply(a, b) { return a * b; }
 * }
 * 
 * const TracedCalculator = Tracer.observeConstructor(Calculator, 'Calculator');
 * const calc = new TracedCalculator();
 * calc.add(5, 3); // Отслеживается
 * 
 * @example
 * // Создание слайса для фильтрации вызовов
 * Tracer.defineSlice('mathOperations', {
 *   predicate: (args) => args.className === 'Calculator',
 *   beforeCall: () => true,
 *   afterCall: () => false,
 *   initial: false,
 *   description: 'Отслеживание математических операций'
 * });
 * 
 * // Подписка на активность слайса
 * Tracer.traceSlice('mathOperations', (event) => {
 *   console.log('Математическая операция:', event.fullName, event.args);
 * });
 */
export class Tracer {

  /** @type {object} Статическая ссылка на состояние трассировщика */
  static tracerState = tracerState;

  /**
   * Создает обертку над функцией и отслеживает ее вызовы
   * @param {Function} targetFn - Функция для обертки
   * @param {string} eventName - Имя события, которое генерируется при вызове функции
   * @returns {Function} Обернутая функция с возможностью трассировки
   * 
   * @example
   * // Отслеживание обычной функции
   * const sum = (a, b) => a + b;
   * const tracedSum = Tracer.createProxyFn(sum, 'sum');
   * 
   * // Отслеживание асинхронной функции
   * const fetchData = async (url) => {
   *   const response = await fetch(url);
   *   return response.json();
   * };
   * const tracedFetch = Tracer.createProxyFn(fetchData, 'fetchData');
   * 
   * // Подписка на события
   * Tracer.trace((event) => {
   *   if (event.eventType === 'functionCall') {
   *     console.log(`Вызвана функция: ${event.fullName}`);
   *     console.log(`Аргументы:`, event.args);
   *     if (event.place === 'after') {
   *       console.log(`Результат:`, event.value);
   *     }
   *   }
   * });
   * 
   * await tracedFetch('https://api.example.com/data');
   */
  static createProxyFn = (targetFn, eventName) => {
    if (!targetFn || typeof targetFn !== 'function') {
      throw new Error('targetFn должен быть функцией');
    }
    return createProxyFn({
      fnKey: eventName || targetFn.name,
      targetFn,
      className: "commonFn",
    });
  };
  
  
  /**
   * Возвращает функцию-обертку, которая отслеживает создание новых экземпляров класса.
   * Вызовы методов экземпляра передаются в общий поток вызовов.
   * @param {Function} originalConstructor - Конструктор класса для обертки
   * @param {string} className - Имя наблюдаемого класса
   * @returns {Function} Обернутый конструктор, создающий трассируемые экземпляры
   * 
   * @example
   * class UserService {
   *   constructor(apiUrl) {
   *     this.apiUrl = apiUrl;
   *   }
   *   
   *   async getUser(id) {
   *     const response = await fetch(`${this.apiUrl}/users/${id}`);
   *     return response.json();
   *   }
   *   
   *   updateUser(id, data) {
   *     return fetch(`${this.apiUrl}/users/${id}`, {
   *       method: 'PUT',
   *       body: JSON.stringify(data)
   *     });
   *   }
   * }
   * 
   * // Оборачиваем класс
   * const TracedUserService = Tracer.observeConstructor(UserService, 'UserService');
   * 
   * // Создаем экземпляр - автоматически трассируется
   * const service = new TracedUserService('https://api.example.com');
   * 
   * // Все вызовы методов будут отслеживаться
   * Tracer.trace((event) => {
   *   if (event.className === 'UserService') {
   *     console.log(`[UserService] ${event.place === 'before' ? '→' : '←'} ${event.fnKey}`);
   *   }
   * });
   * 
   * await service.getUser(123);
   */
  static observeConstructor(originalConstructor, className) {
    if (!originalConstructor || typeof originalConstructor !== 'function') {
      throw new Error('originalConstructor должен быть функцией-конструктором');
    }
    const finalClassName = className || originalConstructor.name;
    if (!finalClassName) {
      throw new Error('Не удалось определить имя класса');
    }
    return wrapConstructor(originalConstructor, finalClassName);
  }

  /**
   * Оборачивает get/set методы свойства объекта в наблюдатель.
   * Обращение к свойству запускает события propertySet/propertyGet
   * @param {object} target - Целевой объект, содержащий свойство
   * @param {string} propName - Имя свойства для наблюдения
   * @param {string} [className] - Имя класса для идентификации (по умолчанию target.constructor.name)
   * @returns {typeof Tracer} Класс Tracer для цепочки вызовов
   * 
   * @example
   * class Config {
   *   constructor() {
   *     this._apiKey = 'secret-key';
   *     this.timeout = 5000;
   *   }
   *   
   *   get apiKey() {
   *     return this._apiKey;
   *   }
   *   
   *   set apiKey(value) {
   *     if (!value) throw new Error('API key required');
   *     this._apiKey = value;
   *   }
   * }
   * 
   * const config = new Config();
   * 
   * // Отслеживаем конкретное свойство
   * Tracer.observeProperty(config, 'apiKey', 'Config');
   * Tracer.observeProperty(config, 'timeout', 'Config');
   * 
   * // Подписываемся на события доступа к свойствам
   * Tracer.trace((event) => {
   *   if (event.eventType === 'propertyGet') {
   *     console.log(`Чтение свойства: ${event.propName}`);
   *   }
   *   if (event.eventType === 'propertySet') {
   *     console.log(`Запись свойства: ${event.propName} = ${event.value}`);
   *   }
   * });
   * 
   * console.log(config.apiKey); // Вызовет propertyGet
   * config.timeout = 10000;     // Вызовет propertySet
   */
  static observeProperty(target, propName, className) {
    wrapProxyPropDescriptor(
      target,
      propName,
      className || target.constructor.name,
    );

    return Tracer;
  }

  /**
   * Оборачивает target в Proxy и отслеживает обращения к его свойству target[propName].
   * Чтение/Запись генерируют события propertyGet/propertySet
   * @param {object} target - Целевой объект, для которого нужно проксировать обращения к свойству
   * @param {string} propName - Имя свойства
   * @param {string} className - Имя класса для идентификации
   * @returns {Proxy} Прокси-объект, отслеживающий доступ к свойству
   * 
   * @example
   * const user = {
   *   name: 'John',
   *   age: 30,
   *   address: {
   *     city: 'Moscow',
   *     street: 'Tverskaya'
   *   }
   * };
   * 
   * // Оборачиваем свойство address в прокси
   * const wrappedAddress = Tracer.wrapValueWithProxy(user.address, 'address', 'User');
   * user.address = wrappedAddress;
   * 
   * // Теперь доступ к вложенным свойствам отслеживается
   * Tracer.trace((event) => {
   *   if (event.propName?.startsWith('address.')) {
   *     console.log(`Доступ к адресу: ${event.propName} = ${event.value}`);
   *   }
   * });
   * 
   * console.log(user.address.city); // Отслеживается
   * user.address.street = 'New Street'; // Отслеживается
   */
  static wrapValueWithProxy(target, propName, className) {
    return wrapProperty(target, propName, className);
  }

  /**
   * Наблюдает за всеми свойствами объекта, исключая функции.
   * Каждое свойство будет генерировать события propertyGet/propertySet при доступе.
   * @param {object} target - Целевой объект для наблюдения за всеми свойствами
   * @param {string} className - Имя класса для идентификации
   * @returns {typeof Tracer} Класс Tracer для цепочки вызовов
   * 
   * @example
   * const settings = {
   *   theme: 'dark',
   *   language: 'ru',
   *   notifications: true,
   *   updateConfig() { /* метод не будет обернут *\/ }
   * };
   * 
   * // Отслеживаем все свойства объекта
   * Tracer.observePropertyAll(settings, 'Settings');
   * 
   * let changes = [];
   * Tracer.trace((event) => {
   *   if (event.eventType === 'propertySet') {
   *     changes.push({
   *       property: event.propName,
   *       value: event.value,
   *       time: new Date()
   *     });
   *   }
   * });
   * 
   * settings.theme = 'light'; // Записывается в changes
   * settings.language = 'en'; // Записывается в changes
   * 
   * console.log('Изменения настроек:', changes);
   */
  static observePropertyAll(target, className) {
    Object.keys(target)
      .filter((key) => typeof target[key] !== "function")
      .forEach((propName) => {
        Tracer.observeProperty(target, propName, className);
      });

    return Tracer;
  }

  /**
   * Рекурсивно обходит и наблюдает за всеми свойствами и методами целевого объекта
   * @param {object} target - Целевой объект для трассировки
   * @param {string} targetName - Имя целевого объекта
   * @returns {typeof Tracer} Класс Tracer для цепочки вызовов
   * 
   * @example
   * const complexObject = {
   *   data: {
   *     user: {
   *       name: 'Alice',
   *       getFullName() {
   *         return this.name;
   *       }
   *     },
   *     settings: {
   *       theme: 'dark'
   *     }
   *   },
   *   process() {
   *     return this.data.user.getFullName();
   *   }
   * };
   * 
   * // Рекурсивно оборачиваем все методы и свойства
   * Tracer.observe(complexObject, 'ComplexObject');
   * 
   * // Все вызовы методов на любом уровне будут отслеживаться
   * Tracer.trace((event) => {
   *   if (event.eventType === 'functionCall') {
   *     console.log(`Вызов: ${event.fullName}`);
   *   }
   * });
   * 
   * complexObject.process(); // Отслеживается
   * complexObject.data.user.getFullName(); // Отслеживается
   */
  static observe(target, targetName) {
    traverse(target, targetName || target.name);

    return Tracer;
  }

  /**
   * Наблюдает за прототипом класса, отслеживая все методы и свойства
   * @param {Function} target - Класс или конструктор
   * @param {string} className - Имя класса
   * @returns {typeof Tracer} Класс Tracer для цепочки вызовов
   * @throws {Error} Если у класса отсутствует прототип
   * 
   * @example
   * class Database {
   *   constructor(connection) {
   *     this.connection = connection;
   *   }
   *   
   *   async query(sql) {
   *     return this.connection.execute(sql);
   *   }
   *   
   *   async transaction(callback) {
   *     await this.connection.begin();
   *     try {
   *       const result = await callback();
   *       await this.connection.commit();
   *       return result;
   *     } catch (error) {
   *       await this.connection.rollback();
   *       throw error;
   *     }
   *   }
   * }
   * 
   * // Отслеживаем все методы прототипа
   * Tracer.observePrototype(Database, 'Database');
   * 
   * const db = new Database(mysqlConnection);
   * 
   * // Создаем слайс для отслеживания транзакций
   * Tracer.defineSlice('transaction', {
   *   predicate: (args) => args.fnKey === 'transaction',
   *   beforeCall: () => true,
   *   afterCall: () => false,
   *   description: 'Отслеживание транзакций базы данных'
   * });
   * 
   * Tracer.traceSlice('transaction', (event) => {
   *   console.log(`Транзакция ${event.place === 'before' ? 'начата' : 'завершена'}`);
   *   if (event.place === 'after') {
   *     console.log('Результат:', event.value);
   *   }
   * });
   * 
   * await db.transaction(async () => {
   *   await db.query('UPDATE users SET status = "active"');
   * });
   */
  static observePrototype(target, className) {
    if (!target.prototype) {
      throw new Error(`Не найден прототип класса ${className}`);
    }
    traverse(target.prototype, `${target.name}`);

    return Tracer;
  }

  /**
   * Наблюдает за списком объектов
   * @param {Array} targetList - Массив объектов для наблюдения
   * @returns {typeof Tracer} Класс Tracer для цепочки вызовов
   * 
   * @example
   * const services = {
   *   auth: new AuthService(),
   *   user: new UserService(),
   *   payment: new PaymentService()
   * };
   * 
   * // Отслеживаем все сервисы
   * Tracer.observeAll(services);
   * 
   * // Логируем все вызовы сервисов
   * Tracer.trace((event) => {
   *   if (event.className?.includes('Service')) {
   *     console.log(`[${event.className}] ${event.fnKey} вызван с аргументами:`, event.args);
   *   }
   * });
   * 
   * services.auth.login('user', 'pass');
   * services.user.getProfile(123);
   */
  static observeAll(targetList) {
    const targetValues = Array.isArray(targetList)
      ? targetList
      : Object.values(targetList || {});

    targetValues.forEach((target) => {
      if (target) {
        Tracer.observe(target);
      }
    });

    return Tracer;
  }

  /**
   * Наблюдает за прототипами всех классов в списке
   * @param {Array} targetList - Массив классов для наблюдения
   * @returns {typeof Tracer} Класс Tracer для цепочки вызовов
   * 
   * @example
   * const models = {
   *   User: class User { /* ... *\/ },
   *   Product: class Product { /* ... *\/ },
   *   Order: class Order { /* ... *\/ }
   * };
   * 
   * // Отслеживаем все методы моделей
   * Tracer.observePrototypeAll(models);
   * 
   * // Создаем слайс для всех операций с моделями
   * Tracer.defineSlice('modelOperations', {
   *   predicate: (args) => ['User', 'Product', 'Order'].includes(args.className),
   *   beforeCall: () => true,
   *   afterCall: () => false
   * });
   * 
   * Tracer.traceSlice('modelOperations', (event) => {
   *   console.log(`${event.className}.${event.fnKey} - ${event.place === 'before' ? 'start' : 'end'}`);
   * });
   * 
   * const user = new models.User();
   * user.save(); // Отслеживается
   */
  static observePrototypeAll(targetList) {
    const targetValues = Array.isArray(targetList)
      ? targetList
      : Object.values(targetList || {});

    targetValues.forEach((target) => {
      if (typeof target === "function") {
        Tracer.observePrototype(target);
      }
    });

    return Tracer;
  }

  /**
   * Наблюдает за всеми экспортированными классами из модуля
   * @param {object} exportTarget - Объект экспорта модуля
   * @returns {typeof Tracer} Класс Tracer для цепочки вызовов
   * 
   * @example
   * // module.js
   * export class UserService { /* ... *\/ }
   * export class ProductService { /* ... *\/ }
   * export function helper() { /* ... *\/ }
   * 
   * // main.js
   * import * as services from './module.js';
   * 
   * // Автоматически отслеживаем все экспортированные классы
   * Tracer.observeFromExportAll(services);
   * 
   * // Все методы UserService и ProductService будут отслеживаться
   * const userService = new services.UserService();
   * userService.createUser({ name: 'John' }); // Отслеживается
   */
  static observeFromExportAll(exportTarget) {
    const classList = Object.keys(exportTarget).filter((key) =>
      exportTarget[key]
        ? Object.keys(Object.getOwnPropertyDescriptors(exportTarget[key]))
            .length > 0
        : false,
    );

    classList.forEach((className) => {
      Tracer.observe(exportTarget[className]);
    });

    return Tracer;
  }

  /**
   * Наблюдает за прототипами всех экспортированных классов из модуля
   * @param {object} exportTarget - Объект экспорта модуля
   * @returns {Map} Карта наблюдаемых классов
   * 
   * @example
   * import * as models from './models/index.js';
   * 
   * const observedModels = Tracer.observePrototypeFromExportAll(models);
   * 
   * console.log('Наблюдаемые модели:', Array.from(observedModels.keys()));
   * 
   * // Все методы моделей теперь отслеживаются
   * const user = new models.User();
   * await user.validate(); // Отслеживается
   */
  static observePrototypeFromExportAll(exportTarget) {
    let map = new Map();

    const classList = Object.keys(exportTarget).filter((key) => {
      const proto = exportTarget[key]?.prototype;

      return proto
        ? Object.keys(Object.getOwnPropertyDescriptors(proto)).length > 0
        : false;
    });

    classList.forEach((className) => {
      map.set(className, true);
      Tracer.observePrototype(exportTarget[className]);
    });

    return map;
  }

  static registerSlice(streamSliceName, config) {
    const stateConfig = Tracer[stateConfigKey];

    if (stateConfig.has(streamSliceName)) {
      throw new Error(
        `Имя слайса трассеровки "${streamSliceName}" было определено ранее!`,
      );
    }

    if (typeof config === 'function') {
      config = {
        predicate: config,
        beforeCall: () => true,
        afterCall: () => false
      };
    }

    const state = Tracer.tracerState;
    const { beforeCall, afterCall } = config;

    const sliceConfig = {
      config,
      beforeCallCallback: (args) => {
        if (config.predicate(args)) {
          const beforeCallStateValue = beforeCall(args);
          state.set(streamSliceName, beforeCallStateValue);
        }
      },
      afterCallCallback: (args) => {
        if (config.predicate(args)) {
          const afterCallStateValue = afterCall(args);
          state.set(streamSliceName, afterCallStateValue);
          return afterCallStateValue;
        }
      },
    };
    
    if (!config || typeof config !== 'object') {
      throw new Error(`Аргумент сonfig должен быть объектов`);
    }

    if (Object.prototype.hasOwnProperty.call(config, 'initial')) {
      Tracer.tracerState.set(streamSliceName, config.initial);
    }
    
    stateConfig.set(streamSliceName, sliceConfig);
    
    console.log(`Зарегистрирован TraceStreamSlice - ${streamSliceName}`);
    console.log(`${streamSliceName} - ${config.description || 'Описание не определено!'}`);
  }

  /**
   * Создает контекст выполнения, который начинается по условию config.predicate
   * config.beforeCall() === true => начать контекст
   * config.afterCall() === false => завершить контекст
   * @param {string} streamSliceName - Имя слайса в потоке вызовов функций
   * @param {object|Function} config - Настройки слайса или функция-предикат
   * @param {Function} [config.predicate] - Функция-предикат для определения начала/конца слайса
   * @param {Function} [config.beforeCall] - Вызывается перед вызовом функции
   * @param {Function} [config.afterCall] - Вызывается после вызова функции
   * @param {*} [config.initial] - Начальное значение состояния слайса
   * @param {string} [config.description] - Описание слайса
   * @returns {typeof Tracer} Класс Tracer для цепочки вызовов
   * @throws {Error} Если слайс с таким именем уже определен
   * 
   * @example
   * // Пример 1: Отслеживание API запросов
   * Tracer.defineSlice('apiRequests', {
   *   predicate: (args) => args.className === 'ApiClient' && args.fnKey === 'request',
   *   beforeCall: () => true,
   *   afterCall: () => false,
   *   initial: false,
   *   description: 'Отслеживание всех API запросов'
   * });
   * 
   * Tracer.traceSlice('apiRequests', (event) => {
   *   if (event.place === 'before') {
   *     console.log(`📡 Запрос к API: ${event.args[0].url}`);
   *   } else {
   *     console.log(`✅ Ответ получен, статус: ${event.value.status}`);
   *   }
   * });
   * 
   * // Пример 2: Отслеживание времени выполнения
   * Tracer.defineSlice('performance', (args) => args.fnKey === 'heavyOperation');
   * 
   * const timings = new Map();
   * Tracer.traceSlice('performance', (event) => {
   *   if (event.place === 'before') {
   *     timings.set(event.fullName, Date.now());
   *   } else {
   *     const duration = Date.now() - timings.get(event.fullName);
   *     console.log(`⏱️ ${event.fullName} выполнился за ${duration}ms`);
   *   }
   * });
   * 
   * // Пример 3: Условная трассировка на основе аргументов
   * Tracer.defineSlice('errorTracking', {
   *   predicate: (args) => args.args?.[0]?.status >= 400,
   *   beforeCall: () => true,
   *   afterCall: () => false,
   *   description: 'Отслеживание ошибок API'
   * });
   * 
   * Tracer.traceSlice('errorTracking', (event) => {
   *   console.error(`❌ Ошибка в ${event.fullName}:`, event.args[0]);
   * });
   */
  static defineSlice(streamSliceName, config) {
    Tracer.registerSlice(streamSliceName, config);

    Tracer.observeSlice(streamSliceName);

    return Tracer;
  }

  /**
   * Выполняет отписку всех обработчиков слайса
   * @param {string} streamSliceName - Имя слайса
   * @returns {typeof Tracer} Класс Tracer для цепочки вызовов
   * 
   * @example
   * // Останавливаем отслеживание API запросов
   * Tracer.stopObserveSlice('apiRequests');
   * 
   * // Теперь события для этого слайса не генерируются
   */
  static stopObserveSlice(streamSliceName) {
    const stateConfig = Tracer[stateConfigKey];
    const sliceConfig = stateConfig.get(streamSliceName);

    emitter.unSubscribe("beforeCallMethod", sliceConfig.beforeCallCallback);
    emitter.unSubscribe("afterCallMethod", sliceConfig.afterCallCallback);

    return Tracer;
  }

  /**
   * Метод начинает наблюдение за потоком вызовов для указанного слайса
   * @param {string} streamSliceName - Имя слайса
   * @returns {typeof Tracer} Класс Tracer для цепочки вызовов
   * 
   * @example
   * // Возобновляем отслеживание после остановки
   * Tracer.observeSlice('apiRequests');
   */
  static observeSlice(streamSliceName) {
    const stateConfig = Tracer[stateConfigKey];
    const sliceConfig = stateConfig.get(streamSliceName);

    emitter.subscribe("beforeCallMethod", sliceConfig.beforeCallCallback);
    emitter.subscribe("afterCallMethod", sliceConfig.afterCallCallback);
    
    return Tracer;
  }

  /**
   * Метод подписывается на события beforeCallMethod/afterCallMethod,
   * если в момент срабатывания события tracerState[streamSliceName] === true => выполнит callback(eventArgs)
   * @param {string} sliceName - Имя слайса
   * @param {Function} callback - Функция обратного вызова, вызываемая при активном слайсе
   * @returns {typeof Tracer} Класс Tracer для цепочки вызовов
   * @throws {Error} Если не указаны имя слайса или колбек, или слайс не определен
   * 
   * @example
   * // Отслеживаем только вызовы при активном слайсе
   * Tracer.traceSlice('performance', (event) => {
   *   console.log(`[PERF] ${event.fullName} - ${event.place}`);
   * });
   * 
   * // Несколько колбеков для одного слайса
   * Tracer.traceSlice('apiRequests', logToConsole);
   * Tracer.traceSlice('apiRequests', sendToAnalytics);
   * Tracer.traceSlice('apiRequests', updateMetrics);
   */
  static traceSlice(sliceName, callback) {

    if (!sliceName || !callback) {
      throw new Error("Укажите имя контекста и колбек!");
    }

    const sliceConfig = Tracer[stateConfigKey].get(sliceName);

    if (!sliceConfig) {
      throw new Error(`Не определен слайс ${sliceName}`);
    }

    const wrappedCallback = (args) => {
      if (args.tracerState.get(sliceName)) {
        callback(args);
      }
    };

    if (!sliceConfig.callbacks) {
      sliceConfig.callbacks = new Map;
    }

    sliceConfig.callbacks.set(callback, wrappedCallback);

    emitter.subscribe("beforeCallMethod", wrappedCallback);
    emitter.subscribe("afterCallMethod", wrappedCallback);
    emitter.subscribe("propertyGet", wrappedCallback);
    emitter.subscribe("propertySet", wrappedCallback);

    return Tracer;
  }

  /**
   * Выполняет трассировку слайса один раз, после чего автоматически отписывается
   * @param {string} sliceName - Имя слайса
   * @param {Function} callback - Функция обратного вызова
   * @returns {typeof Tracer} Класс Tracer для цепочки вызовов
   * 
   * @example
   * // Выполнить только при первом запросе
   * Tracer.traceSliceOnce('firstRequest', (event) => {
   *   console.log('Первый API запрос:', event.args[0].url);
   * });
   * 
   * // Автоматически отпишется после первого срабатывания
   */
  static traceSliceOnce(sliceName, callback) {
    const wrappedCallback = (...args) => {
      callback(...args);
      Tracer.stopTraceSlice(sliceName, wrappedCallback);
    }

    Tracer.traceSlice(sliceName, wrappedCallback);
  }

  /**
   * Выполняет трассировку последовательности слайсов
   * @param {string[]} sliceSeq - Массив имен слайсов
   * @param {Function} callback - Функция обратного вызова, вызываемая когда все слайсы активны
   * @returns {typeof Tracer} Класс Tracer для цепочки вызовов
   * 
   * @example
   * // Отслеживаем только когда активны оба слайса
   * Tracer.traceSliceSeq(['auth', 'payment'], (event) => {
   *   console.log('Авторизованный платеж:', event.fullName);
   * });
   * 
   * // Сложная логика с несколькими условиями
   * Tracer.traceSliceSeq(['debug', 'performance', 'database'], (event) => {
   *   // Выполнится только когда все три слайса активны
   *   console.log('Полная отладка:', event);
   * });
   */
  static traceSliceSeq(sliceSeq, callback) {
    Tracer.trace((args) => {
      const isTraceSeq = sliceSeq.every(
        (name) => args.tracerState.get(name) === true,
      );

      if (isTraceSeq) {
        callback(args);
      }
    });

    return Tracer;
  }

  /**
   * Метод выполняет отписку всех обработчиков слайса sliceName
   * @param {string} sliceName - Имя слайса
   * @param {Function} [callback] - Функция обработчик, будет отписана если указана
   * @returns {typeof Tracer} Класс Tracer для цепочки вызовов
   * 
   * @example
   * // Отписать конкретный колбек
   * const myCallback = (event) => console.log(event);
   * Tracer.traceSlice('apiRequests', myCallback);
   * // ... позже
   * Tracer.stopTraceSlice('apiRequests', myCallback);
   * 
   * // Отписать все колбеки слайса
   * Tracer.stopTraceSlice('apiRequests');
   */
  static stopTraceSlice(sliceName, callback) {

    const sliceConfig = Tracer[stateConfigKey].get(sliceName);
    
    if (sliceConfig.callbacks) {

      if (callback) {
        
        const cb = sliceConfig.callbacks.get(callback);

        emitter.unSubscribe("beforeCallMethod", cb);
        emitter.unSubscribe("afterCallMethod", cb);
        emitter.unSubscribe("propertyGet", cb);
        emitter.unSubscribe("propertySet", cb);

        sliceConfig.callbacks.delete(callback);
      } else {

        sliceConfig.callbacks.forEach((cb) => {
          emitter.unSubscribe("beforeCallMethod", cb);
          emitter.unSubscribe("afterCallMethod", cb);
          emitter.unSubscribe("propertyGet", cb);
          emitter.unSubscribe("propertySet", cb);
        });

        sliceConfig.callbacks = new Map;
      }
    }

    return Tracer;
  }

  /**
   * Метод принимает одно из событий и колбек.
   * Колбек вызывается при срабатывании события, если условие возвращает true,
   * срабатывает точка останова debugger
   * @param {string} eventName - Имя события (beforeCallMethod/afterCallMethod/propertyGet/propertySet)
   * @param {Function} conditionCallback - Функция, возвращающая boolean для активации отладки
   * @returns {typeof Tracer} Класс Tracer для цепочки вызовов
   * @throws {Error} Если не указаны имя события или колбек
   * 
   * @example
   * // Остановка на всех вызовах с ошибками
   * Tracer.debugOn('afterCallMethod', (event) => {
   *   return event.value instanceof Error || event.value?.status >= 400;
   * });
   * 
   * // Остановка при чтении конкретного свойства
   * Tracer.debugOn('propertyGet', (event) => {
   *   return event.propName === 'password';
   * });
   * 
   * // Остановка при вызове определенной функции
   * Tracer.debugOn('beforeCallMethod', (event) => {
   *   return event.fullName === 'Database.deleteUser';
   * });
   */
  static debugOn(eventName, conditionCallback) {

    if (!eventName || !conditionCallback) {
      throw new Error("Укажите имя события и колбек!");
    }

    const cb = (args) => {
      if (conditionCallback(args)) {
        // eslint-disable-next-line no-debugger
        debugger;
      }
    };

    emitter.subscribe(eventName, cb);

    return Tracer;
  }

  /**
   * Останавливает исполнение кода один раз, если conditionCallback() === true
   * @param {string} eventName - Имя события
   * @param {Function} conditionCallback - Функция, возвращающая boolean для активации отладки
   * @returns {typeof Tracer} Класс Tracer для цепочки вызовов
   * @throws {Error} Если не указаны имя события или колбек
   * 
   * @example
   * // Остановиться только на первом вызове с ошибкой
   * Tracer.debugOnceOn('afterCallMethod', (event) => {
   *   return event.value instanceof Error;
   * });
   * 
   * // Остановиться при первом чтении чувствительных данных
   * Tracer.debugOnceOn('propertyGet', (event) => {
   *   return event.propName.includes('secret');
   * });
   */
  static debugOnceOn(eventName, conditionCallback) {

    if (!eventName || !conditionCallback) {
      throw new Error("Укажите имя события и колбек!");
    }

    const cb = (args) => {
      if (conditionCallback(args)) {
        emitter.unSubscribe(eventName, cb);
        // eslint-disable-next-line no-debugger
        debugger;
      }
    };
    emitter.subscribe(eventName, cb);

    return Tracer;
  }

  /**
   * Выполняет подписку на поток вызовов функций и чтения/записи свойств
   * @param {Function} callback - Функция обратного вызова, получающая события
   * @returns {typeof Tracer} Класс Tracer для цепочки вызовов
   * @throws {Error} Если не указан колбек
   * 
   * @example
   * // Логирование всех событий
   * Tracer.trace((event) => {
   *   console.log({
   *     type: event.eventType,
   *     time: new Date().toISOString(),
   *     data: event
   *   });
   * });
   * 
   * // Сбор метрик
   * const metrics = {
   *   functionCalls: 0,
   *   propertyAccess: 0
   * };
   * 
   * Tracer.trace((event) => {
   *   if (event.eventType === 'functionCall') {
   *     metrics.functionCalls++;
   *   } else if (event.eventType.includes('property')) {
   *     metrics.propertyAccess++;
   *   }
   * });
   * 
   * // Фильтрация и анализ
   * Tracer.trace((event) => {
   *   if (event.fullName?.includes('database')) {
   *     // Анализируем запросы к БД
   *     analyzeQuery(event);
   *   }
   * });
   */
  static trace(callback) {

    if (!callback) {
      throw new Error("Укажите колбек!");
    }

    traceCallback.push(callback);
    
    emitter.subscribe("beforeCallMethod", callback);
    emitter.subscribe("afterCallMethod", callback);
    emitter.subscribe("propertyGet", callback);
    emitter.subscribe("propertySet", callback);

    return Tracer;
  }

  /**
   * Подписка только на события вызовов функций.
   * @param {Function} callback
   * @returns {typeof Tracer}
   */
  static traceCalls(callback) {
    if (!callback) {
      throw new Error("Укажите колбек!");
    }

    traceCallCallback.push(callback);

    emitter.subscribe("beforeCallMethod", callback);
    emitter.subscribe("afterCallMethod", callback);

    return Tracer;
  }

  /**
   * Подписка только на события чтения/записи свойств.
   * @param {Function} callback
   * @returns {typeof Tracer}
   */
  static traceProperties(callback) {
    if (!callback) {
      throw new Error("Укажите колбек!");
    }

    tracePropertyCallback.push(callback);

    emitter.subscribe("propertyGet", callback);
    emitter.subscribe("propertySet", callback);

    return Tracer;
  }

  /**
   * Очищает все подписки трассировки
   * @returns {typeof Tracer} Класс Tracer для цепочки вызовов
   * 
   * @example
   * // Останавливаем всю трассировку
   * Tracer.traceClear();
   * 
   * // Теперь события не логируются
   */
  static traceClear() {
    traceCallback.forEach((callback) => {
      emitter.unSubscribe("beforeCallMethod", callback);
      emitter.unSubscribe("afterCallMethod", callback);
      emitter.unSubscribe("propertyGet", callback);
      emitter.unSubscribe("propertySet", callback);
    });

    return Tracer;
  }

  /**
   * Очистка подписок на события вызовов функций.
   * @returns {typeof Tracer}
   */
  static traceCallsClear() {
    traceCallCallback.forEach((callback) => {
      emitter.unSubscribe("beforeCallMethod", callback);
      emitter.unSubscribe("afterCallMethod", callback);
    });

    return Tracer;
  }

  /**
   * Очистка подписок на события чтения/записи свойств.
   * @returns {typeof Tracer}
   */
  static tracePropertiesClear() {
    tracePropertyCallback.forEach((callback) => {
      emitter.unSubscribe("propertyGet", callback);
      emitter.unSubscribe("propertySet", callback);
    });

    return Tracer;
  }

  /**
   * Функция выполняет логирование, если слайс активен
   * @param {string} sliceName - Имя слайса
   * @param {*} firstValue - Первое значение для логирования
   * @param {...*} values - Дополнительные значения для логирования
   * @returns {typeof Tracer} Класс Tracer для цепочки вызовов
   * 
   * @example
   * // Логируем только когда активен слайс debug
   * Tracer.logSlice('debug', 'User data:', user, 'State:', state);
   * 
   * // Условное логирование в коде
   * function processOrder(order) {
   *   Tracer.logSlice('orders', 'Processing order:', order.id);
   *   // ... логика
   *   Tracer.logSlice('orders', 'Order processed:', order.id);
   * }
   */
  static logSlice(sliceName, ...values) {
    if (Tracer.tracerState.get(sliceName)) {
      console.log([sliceName, ...values.map(JSON.stringify)].join('\n\r\t'));
    }

    return Tracer;
  }

  /**
   * Выполняет функцию если слайс активен
   * @param {string} sliceName - Имя слайса
   * @param {Function} fn - Функция для выполнения
   * @returns {typeof Tracer} Класс Tracer для цепочки вызовов
   * 
   * @example
   * // Выполняем код только при активной отладке
   * Tracer.invokeOnSlice('debug', () => {
   *   console.log('Подробная информация:', detailedData);
   *   sendToDebugger(currentState);
   * });
   * 
   * // Условное выполнение метрик
   * Tracer.invokeOnSlice('performance', () => {
   *   recordMetric('operation', duration);
   * });
   */
  static invokeOnSlice(sliceName, fn) {
    if (Tracer.tracerState.get(sliceName)) {
      fn();
    }

    return Tracer;
  }

  /**
   * Возвращает текущий контекст исполнения
   * @returns {import('./observers/context.js').ExecutionContext} Текущий контекст выполнения
   * 
   * @example
   * // Получаем стек вызовов в любой момент
   * const context = Tracer.getCurrentContext();
   * console.log('Текущий стек вызовов:', context.getCallStack());
   * 
   * // Используем для отладки
   * function debugCurrentContext() {
   *   const ctx = Tracer.getCurrentContext();
   *   console.log('Вызвано из:', ctx?.currentCall?.fullName);
   * }
   */
  static getCurrentContext() {
    return ExecutionContext.getCurrentContext();
  }

  static defineSliceFromCall(sliceName, target, targetFnName, predicate) {
    
    Tracer.registerSlice(sliceName, predicate);
    
    const originalFn = target[targetFnName];
      
      target[targetFnName] = function() {

        if (predicate(arguments)) {
          tracerState.set(sliceName, true);

          const finalizeSlice = () => tracerState.set(sliceName, false);

          try {
            const result = originalFn.apply(this, arguments);

            if (result && typeof result.finally === "function") {
              return result.finally(finalizeSlice);
            }

            finalizeSlice();
            return result;
          } catch (error) {
            finalizeSlice();
            throw error;
          }
        }

        return originalFn.apply(this, arguments);
      }

      return Tracer;
  }

  /**
   * Принимает функцию и возвращает новую функцию, которая создает слайс.
   * Слайс фиксирует вызовы функции-аргумента
   * @param {string} sliceName - Имя слайса
   * @param {Function} fn - Целевая функция для фиксации вызова слайса
   * @returns {Function} Обернутая функция, активирующая слайс во время выполнения
   * 
   * @example
   * // Создаем функцию, которая будет активна только во время выполнения
   * const tracedDbQuery = Tracer.defineSliceFromFn('database', async (sql) => {
   *   return await db.query(sql);
   * });
   * 
   * // Во время выполнения tracedDbQuery слайс 'database' будет активен
   * const result = await tracedDbQuery('SELECT * FROM users');
   * 
   * // Можно комбинировать с другими слайсами
   * Tracer.traceSlice('database', (event) => {
   *   console.log('Запрос к БД:', event.args[0]);
   * });
   */
  static defineSliceFromFn = (sliceName, fn) => {
    
    Tracer.registerSlice(sliceName, () => {});

    const result = function(...args) {
      Tracer.tracerState.set(sliceName, true);

      const finalizeSlice = () => Tracer.tracerState.set(sliceName, false);

      try {
        const result = fn.apply(this, args);

        if (result && typeof result.finally === "function") {
          return result.finally(finalizeSlice);
        }

        finalizeSlice();
        return result;
      } catch (error) {
        finalizeSlice();
        throw error;
      }
    }

    result.original = fn;

    return result;
  }

  /**
   * Определяет слайс, который активируется при вызове указанной функции
   * @param {string} sliceName - Имя слайса
   * @param {string} fnName - Полное имя функции для отслеживания
   * @returns {typeof Tracer} Класс Tracer для цепочки вызовов
   * 
   * @example
   * // Активируем слайс только при вызове конкретного метода
   * Tracer.defineSliceOnCall('userCreation', 'UserService.create');
   * 
   * Tracer.traceSlice('userCreation', (event) => {
   *   console.log('Создание пользователя:', event.args[0]);
   * });
   * 
   * // Множественные слайсы для разных методов
   * Tracer.defineSliceOnCall('userUpdate', 'UserService.update');
   * Tracer.defineSliceOnCall('userDelete', 'UserService.delete');
   */
  static defineSliceOnCall(sliceName, fnName) {
    if (!sliceName || !fnName) {
      throw new Error('sliceName и fnName обязательны');
    }
    Tracer.defineSlice(sliceName, (args) => {
      return args.fullName === fnName;
    });
    return Tracer;
  }

  /**
   * Получить список всех активных слайсов
   * @returns {Array} Массив имен слайсов
   */
  static getActiveSlices() {
    return Array.from(Tracer[stateConfigKey].keys()).filter(
      (sliceName) => Tracer.tracerState.get(sliceName) === true,
    );
  }

  /**
   * Временно отключить слайс
   * @param {string} sliceName - Имя слайса
   * @returns {typeof Tracer}
   */
  static disableSlice(sliceName) {
    const config = Tracer[stateConfigKey].get(sliceName);
    if (config && !config.disabled) {
      config.disabled = true;
      Tracer.stopObserveSlice(sliceName);
    }
    return Tracer;
  }

  /**
   * Вернет список зарегистрированных слайсов
   * @returns {Array} Массив имен слайсов
   */
  static getRegistredSlices() {
    return Array.from(Tracer[stateConfigKey].keys());
  }

  /**
   * Экспортирует зарегистрированные сценарии (слайсы) в переносимый объект.
   * @param {object} [options]
   * @param {boolean} [options.includeFunctions=true] - Сохранять predicate/beforeCall/afterCall как строки функций
   * @returns {object} Переносимая модель сценариев
   */
  static exportScenarios(options = {}) {
    const includeFunctions = options.includeFunctions !== false;
    const stateConfig = Tracer[stateConfigKey];

    const slices = Array.from(stateConfig.entries()).map(([name, sliceConfig]) => {
      const config = sliceConfig.config || {};
      const normalizeFn = (fn) => {
        if (!includeFunctions) {
          return undefined;
        }
        return typeof fn === "function" ? fn.toString() : undefined;
      };

      return {
        name,
        description: config.description,
        initial: Object.prototype.hasOwnProperty.call(config, "initial")
          ? config.initial
          : Tracer.tracerState.get(name),
        disabled: Boolean(sliceConfig.disabled),
        predicate: normalizeFn(config.predicate),
        beforeCall: normalizeFn(config.beforeCall),
        afterCall: normalizeFn(config.afterCall),
      };
    });

    return {
      version: 1,
      exportedAt: new Date().toISOString(),
      slices,
    };
  }

  /**
   * Импортирует переносимую модель сценариев.
   * @param {object} payload - Объект, полученный из exportScenarios
   * @param {object} [options]
   * @param {boolean} [options.overwrite=true] - Перезаписать существующие слайсы с тем же именем
   * @param {boolean} [options.activate=true] - Подписать импортированные слайсы на события
   * @param {(source: string) => Function} [options.functionParser] - Кастомный парсер функций из строки
   * @returns {typeof Tracer}
   */
  static importScenarios(payload, options = {}) {
    if (!payload || !Array.isArray(payload.slices)) {
      throw new Error("Некорректный payload сценариев: ожидается объект c массивом slices");
    }

    const overwrite = options.overwrite !== false;
    const activate = options.activate !== false;

    const parseFunction = (source) => {
      if (typeof source !== "string" || source.trim() === "") {
        return undefined;
      }
      if (typeof options.functionParser === "function") {
        return options.functionParser(source);
      }
      return new Function(`return (${source});`)();
    };

    payload.slices.forEach((slice) => {
      const { name } = slice;
      if (!name) {
        return;
      }

      const exists = Tracer[stateConfigKey].has(name);
      if (exists && !overwrite) {
        return;
      }

      if (exists && overwrite) {
        Tracer.stopTraceSlice(name);
        Tracer.stopObserveSlice(name);
        Tracer[stateConfigKey].delete(name);
      }

      const predicate = parseFunction(slice.predicate) || (() => false);
      const beforeCall = parseFunction(slice.beforeCall) || (() => true);
      const afterCall = parseFunction(slice.afterCall) || (() => false);

      Tracer.registerSlice(name, {
        predicate,
        beforeCall,
        afterCall,
        initial: slice.initial,
        description: slice.description,
      });

      if (activate) {
        Tracer.observeSlice(name);
      }

      if (slice.disabled) {
        Tracer.disableSlice(name);
      }
    });

    return Tracer;
  }

  static isX2t() {
    return typeof EventTarget === 'undefiend';
  }

  /** Объект с отчетами трассировки */
  static reports = reports;

  /**
   * Хранит карту конфигураций слайсов
   * @type {Map}
   */
  static [stateConfigKey] = new Map();
}

// Добавить проверку окружения
if (typeof window !== 'undefined') {
  window.Tracer = Tracer;
}

// Добавить поддержку module.exports для Node.js
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { Tracer };
}
