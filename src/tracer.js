import { emitter } from "./observers/constants.js";
import { ExecutionContext } from "./observers/context.js";
import {
  createProxyFn,
  getTraceOptions,
  setTraceOptions,
  buildTraceOptions,
  tracerState,
  traceOptionsSymbol,
  traverse,
  wrapConstructor,
  wrapProperty,
  wrapProxyPropDescriptor,
} from "./observers/proxy.js";
import * as reports from "./reports/index.js";
import * as subscriptionService from "./services/subscriptions.js";
import * as sliceService from "./services/slices.js";
import * as scenarioService from "./services/scenarios.js";

const stateConfigKey = Symbol("stateConfigKey");

const traceCallback = subscriptionService.createStore();
const traceCallCallback = subscriptionService.createStore();
const tracePropertyCallback = subscriptionService.createStore();
const traceBatchCallback = subscriptionService.createStore();
const traceCallBatchCallback = subscriptionService.createStore();
const tracePropertyBatchCallback = subscriptionService.createStore();
const sliceExecutionDepth = new Map();
const shallowObservedProps = Symbol("shallowObservedProps");
const TRACE_PROFILES = Object.freeze({
  minimal: Object.freeze({
    profile: "minimal",
    enableCalls: true,
    enableProperties: false,
    suppressNoisy: true,
    captureContext: false,
  }),
  balanced: Object.freeze({
    profile: "balanced",
    enableCalls: true,
    enableProperties: false,
    suppressNoisy: true,
    captureContext: false,
  }),
  full: Object.freeze({
    profile: "full",
    enableCalls: true,
    enableProperties: true,
    suppressNoisy: false,
    captureContext: true,
  }),
});

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
};

const isPlainObject = (value) => {
  if (!value || typeof value !== "object") {
    return false;
  }
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
};

const hasOwnFunctionProps = (target) => {
  if (!target || (typeof target !== "object" && typeof target !== "function")) {
    return false;
  }
  return Object.getOwnPropertyNames(target).some((key) => {
    const descriptor = Object.getOwnPropertyDescriptor(target, key);
    return !!descriptor && "value" in descriptor && typeof descriptor.value === "function";
  });
};

const normalizeObserveObjectOptions = (value) => {
  if (typeof value === "number") {
    return { maxDepth: value };
  }
  if (value && typeof value === "object") {
    return value;
  }
  return {};
};

const observePropertyObjectShallow = (target, parentPropName, className) => {
  if (!target || (typeof target !== "object" && typeof target !== "function")) {
    return target;
  }

  const observed = target[shallowObservedProps] || new Set();
  if (!target[shallowObservedProps]) {
    Object.defineProperty(target, shallowObservedProps, {
      value: observed,
      enumerable: false,
      configurable: false,
      writable: false,
    });
  }

  for (const subProp of Object.getOwnPropertyNames(target)) {
    if (observed.has(subProp) || subProp === "__isProxy") {
      continue;
    }

    const descriptor = Object.getOwnPropertyDescriptor(target, subProp);
    if (!descriptor || descriptor.configurable === false) {
      continue;
    }

    if ("value" in descriptor && typeof descriptor.value === "function") {
      continue;
    }

    const propPath = `${parentPropName}.${subProp}`;
    const originalGetter = descriptor.get;
    const originalSetter = descriptor.set;
    let internalValue = descriptor.value;

    const patchedDescriptor = {
      ...descriptor,
      get() {
        const value = originalGetter ? originalGetter.call(this) : internalValue;
        const traceOptions = getTraceOptions();
        const fullName = `${className}.${propPath}`;
        const hasPropertyGetSubscribers = emitter.has("propertyGet");
        if (!hasPropertyGetSubscribers && traceOptions.enableProperties !== true) {
          return value;
        }
        const shouldNotifyGet = hasPropertyGetSubscribers
          && (!traceOptions.suppressNoisy || !includesByPatterns(fullName, traceOptions.noisyProperties));
        if (shouldNotifyGet) {
          emitter.notify("propertyGet", {
            eventType: "propertyGet",
            place: "before",
            value,
            thisArg: this,
            propName: propPath,
            className,
            tracerState,
            fullName,
            callStack: ExecutionContext.getCurrentContext(),
          });
        }
        return value;
      },
      set(newValue) {
        const prevValue = originalGetter ? originalGetter.call(this) : internalValue;
        if (originalSetter) {
          originalSetter.call(this, newValue);
        } else {
          internalValue = newValue;
        }
        const traceOptions = getTraceOptions();
        const fullName = `${className}.${propPath}`;
        const hasPropertySetSubscribers = emitter.has("propertySet");
        if (!hasPropertySetSubscribers && traceOptions.enableProperties !== true) {
          return;
        }
        const shouldNotifySet = hasPropertySetSubscribers
          && (!traceOptions.suppressNoisy || !includesByPatterns(fullName, traceOptions.noisyProperties));
        if (shouldNotifySet) {
          emitter.notify("propertySet", {
            eventType: "propertySet",
            place: "before",
            curValue: prevValue,
            value: newValue,
            thisArg: this,
            propName: propPath,
            className,
            tracerState,
            fullName,
            callStack: ExecutionContext.getCurrentContext(),
          });
        }
      },
    };

    delete patchedDescriptor.value;
    delete patchedDescriptor.writable;

    Object.defineProperty(target, subProp, patchedDescriptor);
    observed.add(subProp);
  }

  return target;
};

const executeInSlice = (sliceName, invoke) => {
  const nextDepth = (sliceExecutionDepth.get(sliceName) || 0) + 1;
  sliceExecutionDepth.set(sliceName, nextDepth);
  tracerState.set(sliceName, true);

  const finalizeSlice = () => tracerState.set(sliceName, false);
  const releaseSlice = () => {
    const depth = (sliceExecutionDepth.get(sliceName) || 1) - 1;
    if (depth <= 0) {
      sliceExecutionDepth.delete(sliceName);
      finalizeSlice();
      return;
    }
    sliceExecutionDepth.set(sliceName, depth);
    tracerState.set(sliceName, true);
  };

  try {
    const result = invoke();
    if (result && typeof result.finally === "function") {
      return result.finally(releaseSlice);
    }
    releaseSlice();
    return result;
  } catch (error) {
    releaseSlice();
    throw error;
  }
};

/**
 * Главный класс трассировщика для мониторинга вызовов функций,
 * доступа к свойствам и контекста выполнения.
 * Предоставляет статические методы для обертки функций, классов и объектов
 * с возможностью отслеживания.
   */
export class Tracer {

  /** @type {object} Статическая ссылка на состояние трассировщика */
  static tracerState = tracerState;

  /**
   * Конфигурация провайдера контекста выполнения.
   * @param {object} options
   * @param {'stack'|'zone'} [options.asyncContext='stack']
   * @returns {typeof Tracer}
   */
  static configure(options = {}) {
    ExecutionContext.configure(options);
    if (options.traceProfile) {
      Tracer.setTraceProfile(options.traceProfile, options.traceOptions || {});
    } else if (options.traceOptions) {
      Tracer.configureTracing(options.traceOptions);
    }
    return Tracer;
  }

  static setTraceProfile(profileName = "balanced", overrides = {}) {
    const preset = TRACE_PROFILES[profileName];
    if (!preset) {
      throw new Error(`Неизвестный профиль трассировки: ${profileName}`);
    }
    setTraceOptions({
      ...preset,
      ...overrides,
      profile: profileName,
    });
    return Tracer;
  }

  static configureTracing(options = {}) {
    const current = getTraceOptions();
    setTraceOptions({
      ...current,
      ...options,
    });
    return Tracer;
  }

  static getTraceConfig() {
    const options = getTraceOptions();
    return {
      ...options,
      noisyCalls: [...options.noisyCalls],
      noisyProperties: [...options.noisyProperties],
    };
  }

  /**
   * Создает обертку над функцией и отслеживает ее вызовы
   * @param {Function} targetFn - Функция для обертки
   * @param {string} eventName - Имя события, которое генерируется при вызове функции
   * @returns {Function} Обернутая функция с возможностью трассировки
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
   * В гибридном режиме по умолчанию использует безопасный shallow-режим без Proxy.
   * Proxy включается явно и только для plain-object.
   * @param {object} target - Целевой объект, для которого нужно проксировать обращения к свойству
   * @param {string} propName - Имя свойства
   * @param {string|object|number} [classNameOrOptions] - Имя класса или настройки глубины
   * @param {object|number} [options] - Настройки ({ useProxy, shouldUseProxy, maxDepth, shouldWrap }) или число глубины
   * @returns {Proxy} Прокси-объект, отслеживающий доступ к свойству
   */
  static observePropertyObject(target, propName, classNameOrOptions, options) {
    let className = classNameOrOptions;
    let resolvedOptions = normalizeObserveObjectOptions(options);

    if (typeof classNameOrOptions === "number" || (typeof classNameOrOptions === "object" && classNameOrOptions !== null)) {
      className = undefined;
      resolvedOptions = normalizeObserveObjectOptions(classNameOrOptions);
    }

    const finalClassName = className || target?.constructor?.name || "Object";
    const canUseProxy = isPlainObject(target) && (
      resolvedOptions.useProxy === true ||
      (typeof resolvedOptions.shouldUseProxy === "function" &&
        resolvedOptions.shouldUseProxy({ target, propName, className: finalClassName }) === true)
    ) && !hasOwnFunctionProps(target);

    if (canUseProxy) {
      return wrapProperty(
        target,
        propName,
        finalClassName,
        resolvedOptions,
      );
    }

    return observePropertyObjectShallow(target, propName, finalClassName);
  }

  /**
   * Наблюдает за всеми свойствами объекта, исключая функции.
   * Каждое свойство будет генерировать события propertyGet/propertySet при доступе.
   * @param {object} target - Целевой объект для наблюдения за всеми свойствами
   * @param {string} className - Имя класса для идентификации
   * @returns {typeof Tracer} Класс Tracer для цепочки вызовов
   */
  static observeAllProperties(target, className) {
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
   */
  static observe(target, targetName) {
    const finalTargetName = targetName || target?.name || target?.constructor?.name || "Object";
    traverse(target, finalTargetName);

    return Tracer;
  }

  /**
   * Наблюдает за прототипом класса, отслеживая все методы и свойства
   * @param {Function} target - Класс или конструктор
   * @param {string} className - Имя класса
   * @returns {typeof Tracer} Класс Tracer для цепочки вызовов
   * @throws {Error} Если у класса отсутствует прототип
   */
  static observePrototype(target, className) {
    if (!target.prototype) {
      throw new Error(`Не найден прототип класса ${className}`);
    }
    const finalClassName = className || target?.name || "AnonymousClass";
    traverse(target.prototype, `${finalClassName}`);

    return Tracer;
  }

  /**
   * Наблюдает за списком объектов
   * @param {Array} targetList - Массив объектов для наблюдения
   * @returns {typeof Tracer} Класс Tracer для цепочки вызовов
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
   */
  static observeFromExports(exportTarget) {
    const classList = Object.keys(exportTarget).filter((key) =>
      exportTarget[key]
        ? Object.keys(Object.getOwnPropertyDescriptors(exportTarget[key]))
            .length > 0
        : false,
    );

    classList.forEach((className) => {
      Tracer.observe(exportTarget[className], className);
    });

    return Tracer;
  }

  /**
   * Наблюдает за прототипами всех экспортированных классов из модуля
   * @param {object} exportTarget - Объект экспорта модуля
   * @returns {Map} Карта наблюдаемых классов
   */
  static observePrototypesFromExports(exportTarget) {
    let map = new Map();

    const classList = Object.keys(exportTarget).filter((key) => {
      const proto = exportTarget[key]?.prototype;

      return proto
        ? Object.keys(Object.getOwnPropertyDescriptors(proto)).length > 0
        : false;
    });

    classList.forEach((className) => {
      map.set(className, true);
      Tracer.observePrototype(exportTarget[className], className);
    });

    return map;
  }

  static registerSliceDefinition(streamSliceName, config) {
    sliceService.registerSliceDefinition({
      stateConfig: Tracer[stateConfigKey],
      tracerState: Tracer.tracerState,
      sliceName: streamSliceName,
      config,
      logger: console,
    });
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
   */
  static defineSlice(streamSliceName, config) {
    sliceService.defineSlice({
      emitter,
      stateConfig: Tracer[stateConfigKey],
      tracerState: Tracer.tracerState,
      sliceName: streamSliceName,
      config,
      logger: console,
    });
    return Tracer;
  }

  /**
   * Выполняет отписку всех обработчиков слайса
   * @param {string} streamSliceName - Имя слайса
   * @returns {typeof Tracer} Класс Tracer для цепочки вызовов
   */
  static disableSliceListeners(streamSliceName) {
    sliceService.disableSliceListeners({
      emitter,
      stateConfig: Tracer[stateConfigKey],
      sliceName: streamSliceName,
    });
    return Tracer;
  }

  /**
   * Метод начинает наблюдение за потоком вызовов для указанного слайса
   * @param {string} streamSliceName - Имя слайса
   * @returns {typeof Tracer} Класс Tracer для цепочки вызовов
   */
  static enableSlice(streamSliceName) {
    sliceService.enableSlice({
      emitter,
      stateConfig: Tracer[stateConfigKey],
      sliceName: streamSliceName,
    });
    return Tracer;
  }

  /**
   * Метод подписывается на события beforeCallMethod/afterCallMethod,
   * если в момент срабатывания события tracerState[streamSliceName] === true => выполнит callback(eventArgs)
   * @param {string} sliceName - Имя слайса
   * @param {Function} callback - Функция обратного вызова, вызываемая при активном слайсе
   * @returns {typeof Tracer} Класс Tracer для цепочки вызовов
   * @throws {Error} Если не указаны имя слайса или колбек, или слайс не определен
   */
  static traceBySlice(sliceName, callback) {
    sliceService.traceBySlice({
      emitter,
      stateConfig: Tracer[stateConfigKey],
      sliceName,
      callback,
    });
    return Tracer;
  }

  /**
   * Выполняет трассировку слайса один раз, после чего автоматически отписывается
   * @param {string} sliceName - Имя слайса
   * @param {Function} callback - Функция обратного вызова
   * @returns {typeof Tracer} Класс Tracer для цепочки вызовов
   */
  static traceBySliceOnce(sliceName, callback) {
    sliceService.traceBySliceOnce({
      emitter,
      stateConfig: Tracer[stateConfigKey],
      sliceName,
      callback,
    });

    return Tracer;
  }

  /**
   * Выполняет трассировку последовательности слайсов
   * @param {string[]} sliceSeq - Массив имен слайсов
   * @param {Function} callback - Функция обратного вызова, вызываемая когда все слайсы активны
   * @returns {typeof Tracer} Класс Tracer для цепочки вызовов
   */
  static traceBySliceSequence(sliceSeq, callback) {
    Tracer.traceAll((args) => {
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
   */
  static untraceBySlice(sliceName, callback) {
    sliceService.untraceBySlice({
      emitter,
      stateConfig: Tracer[stateConfigKey],
      sliceName,
      callback,
    });
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
   */
  static traceAll(callback) {
    subscriptionService.traceAll({
      emitter,
      store: traceCallback,
      callback,
    });
    return Tracer;
  }

  /**
   * Батч-подписка на все события трассировки.
   * @param {Function} callback - Получает массив событий
   * @param {object} [options]
   * @param {number} [options.maxBatchSize=100]
   * @param {number} [options.flushIntervalMs=16]
   * @param {number} [options.bufferSize=2000]
   * @returns {typeof Tracer}
   */
  static traceAllBatched(callback, options = {}) {
    subscriptionService.traceAllBatched({
      emitter,
      store: traceBatchCallback,
      callback,
      options,
    });
    return Tracer;
  }

  /**
   * Подписка только на события вызовов функций.
   * @param {Function} callback
   * @returns {typeof Tracer}
   */
  static traceCalls(callback) {
    subscriptionService.traceCalls({
      emitter,
      store: traceCallCallback,
      callback,
    });
    return Tracer;
  }

  /**
   * Батч-подписка на события вызовов функций.
   * @param {Function} callback - Получает массив событий
   * @param {object} [options]
   * @returns {typeof Tracer}
   */
  static traceCallsBatched(callback, options = {}) {
    subscriptionService.traceCallsBatched({
      emitter,
      store: traceCallBatchCallback,
      callback,
      options,
    });
    return Tracer;
  }

  /**
   * Подписка только на события чтения/записи свойств.
   * @param {Function} callback
   * @returns {typeof Tracer}
   */
  static traceProperties(callback) {
    subscriptionService.traceProperties({
      emitter,
      store: tracePropertyCallback,
      callback,
    });
    return Tracer;
  }

  /**
   * Батч-подписка на события чтения/записи свойств.
   * @param {Function} callback - Получает массив событий
   * @param {object} [options]
   * @returns {typeof Tracer}
   */
  static tracePropertiesBatched(callback, options = {}) {
    subscriptionService.tracePropertiesBatched({
      emitter,
      store: tracePropertyBatchCallback,
      callback,
      options,
    });
    return Tracer;
  }

  /**
   * Очищает все подписки трассировки
   * @returns {typeof Tracer} Класс Tracer для цепочки вызовов
   */
  static untraceAll() {
    subscriptionService.untraceAll({
      emitter,
      store: traceCallback,
    });
    subscriptionService.untraceAll({
      emitter,
      store: traceBatchCallback,
    });
    return Tracer;
  }

  /**
   * Очистка подписок на события вызовов функций.
   * @returns {typeof Tracer}
   */
  static untraceCalls() {
    subscriptionService.untraceCalls({
      emitter,
      store: traceCallCallback,
    });
    subscriptionService.untraceCalls({
      emitter,
      store: traceCallBatchCallback,
    });
    return Tracer;
  }

  /**
   * Очистка подписок на события чтения/записи свойств.
   * @returns {typeof Tracer}
   */
  static untraceProperties() {
    subscriptionService.untraceProperties({
      emitter,
      store: tracePropertyCallback,
    });
    subscriptionService.untraceProperties({
      emitter,
      store: tracePropertyBatchCallback,
    });
    return Tracer;
  }

  /**
   * Функция выполняет логирование, если слайс активен
   * @param {string} sliceName - Имя слайса
   * @param {*} firstValue - Первое значение для логирования
   * @param {...*} values - Дополнительные значения для логирования
   * @returns {typeof Tracer} Класс Tracer для цепочки вызовов
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
   */
  static getCurrentContext() {
    return ExecutionContext.getCurrentContext();
  }

  static defineSliceByCall(sliceName, target, targetFnName, predicate) {
    
    Tracer.registerSliceDefinition(sliceName, predicate);
    
    const originalFn = target[targetFnName];
      
      target[targetFnName] = function() {
        if (predicate(arguments)) {
          return executeInSlice(sliceName, () => originalFn.apply(this, arguments));
        }
        return originalFn.apply(this, arguments);
      };

      return Tracer;
  }

  /**
   * Принимает функцию и возвращает новую функцию, которая создает слайс.
   * Слайс фиксирует вызовы функции-аргумента
   * @param {string} sliceName - Имя слайса
   * @param {Function} fn - Целевая функция для фиксации вызова слайса
   * @returns {Function} Обернутая функция, активирующая слайс во время выполнения
   */
  static defineSliceByFunction = (sliceName, fn) => {
    
    Tracer.registerSliceDefinition(sliceName, () => {});

    const result = function(...args) {
      return executeInSlice(sliceName, () => fn.apply(this, args));
    };

    result.original = fn;

    return result;
  }

  /**
   * Определяет слайс, который активируется при вызове указанной функции
   * @param {string} sliceName - Имя слайса
   * @param {string} fnName - Полное имя функции для отслеживания
   * @returns {typeof Tracer} Класс Tracer для цепочки вызовов
   */
  static defineSliceByFunctionName(sliceName, fnName) {
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
  static getEnabledSlices() {
    return sliceService.getEnabledSlices({
      stateConfig: Tracer[stateConfigKey],
      tracerState: Tracer.tracerState,
    });
  }

  /**
   * Временно отключить слайс
   * @param {string} sliceName - Имя слайса
   * @returns {typeof Tracer}
   */
  static disableSlice(sliceName) {
    sliceService.disableSlice({
      emitter,
      stateConfig: Tracer[stateConfigKey],
      tracerState: Tracer.tracerState,
      sliceName,
    });
    return Tracer;
  }

  /**
   * Вернет список зарегистрированных слайсов
   * @returns {Array} Массив имен слайсов
   */
  static getRegisteredSlices() {
    return sliceService.getRegisteredSlices({
      stateConfig: Tracer[stateConfigKey],
    });
  }

  /**
   * Экспортирует зарегистрированные сценарии (слайсы) в переносимый объект.
   * @param {object} [options]
   * @param {boolean} [options.includeFunctions=true] - Сохранять predicate/beforeCall/afterCall как строки функций
   * @returns {object} Переносимая модель сценариев
   */
  static exportSliceScenarios(options = {}) {
    return scenarioService.exportSliceScenarios({
      stateConfig: Tracer[stateConfigKey],
      tracerState: Tracer.tracerState,
      options,
    });
  }

  /**
   * Импортирует переносимую модель сценариев.
   * @param {object} payload - Объект, полученный из exportSliceScenarios
   * @param {object} [options]
   * @param {boolean} [options.overwrite=true] - Перезаписать существующие слайсы с тем же именем
   * @param {boolean} [options.activate=true] - Подписать импортированные слайсы на события
   * @param {(source: string) => Function} [options.functionParser] - Кастомный парсер функций из строки
   * @returns {typeof Tracer}
   */
  static importSliceScenarios(payload, options = {}) {
    scenarioService.importSliceScenarios({
      payload,
      options,
      stateConfig: Tracer[stateConfigKey],
      registerSliceDefinition: (name, config) => Tracer.registerSliceDefinition(name, config),
      enableSlice: (name) => Tracer.enableSlice(name),
      disableSlice: (name) => Tracer.disableSlice(name),
      untraceBySlice: (name) => Tracer.untraceBySlice(name),
      disableSliceListeners: (name) => Tracer.disableSliceListeners(name),
    });
    return Tracer;
  }

  static isX2tEnvironment() {
    return typeof EventTarget === 'undefined';
  }

  /** Объект с отчетами трассировки */
  static reports = reports;

  /**
   * Хранит карту конфигураций слайсов
   * @type {Map}
   */
  static [stateConfigKey] = new Map();
}

tracerState.set(traceOptionsSymbol, buildTraceOptions(TRACE_PROFILES.balanced));

// Добавить проверку окружения
if (typeof window !== 'undefined') {
  window.Tracer = Tracer;
}

// Добавить поддержку module.exports для Node.js
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { Tracer };
}




