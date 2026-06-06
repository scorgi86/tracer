import { emitter } from "./observers/constants.js";
import { ExecutionContext } from "./observers/context.js";
import { includesByPatterns } from "./patterns.js";
import { isPlainObject } from "./object.js";
import { buildTraceOptions, traceOptionsSymbol } from "./services/config.js";
import {
  createProxyFn,
  getTraceOptions,
  setTraceOptions,
  tracerState,
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
const instrumentationReportKey = Symbol("instrumentation-report");

const traceCallback = subscriptionService.createStore();
const traceCallCallback = subscriptionService.createStore();
const tracePropertyCallback = subscriptionService.createStore();
const traceBatchCallback = subscriptionService.createStore();
const traceCallBatchCallback = subscriptionService.createStore();
const tracePropertyBatchCallback = subscriptionService.createStore();
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

const applySubscriberErrorPolicy = (traceOptions) => {
  emitter.setSubscriberErrorPolicy({
    throwSubscriberErrors: traceOptions.throwSubscriberErrors,
    onSubscriberError: traceOptions.onSubscriberError,
  });
};

const createInstrumentationReport = (targetName = "") => ({
  targetName,
  wrappedMethods: [],
  wrappedProperties: [],
  failedMethods: [],
  failedProperties: [],
  skippedMethods: [],
  skippedProperties: [],
});

const mergeInstrumentationReport = (target, source) => {
  if (!source) {
    return target;
  }
  target.wrappedMethods.push(...(source.wrappedMethods || []));
  target.wrappedProperties.push(...(source.wrappedProperties || []));
  target.failedMethods.push(...(source.failedMethods || []));
  target.failedProperties.push(...(source.failedProperties || []));
  target.skippedMethods.push(...(source.skippedMethods || []));
  target.skippedProperties.push(...(source.skippedProperties || []));
  return target;
};

const buildInstrumentationOptions = () => {
  const traceOptions = getTraceOptions();
  return {
    throwOnInstrumentationError: traceOptions.throwOnInstrumentationError === true,
    onInstrumentationError: traceOptions.onInstrumentationError,
  };
};

/**
 * ������� ����� ������������� ��� ����������� ������� �������,
 * ������� � ��������� � ��������� ����������.
 * ������������� ����������� ������ ��� ������� �������, ������� � ��������
 * � ������������ ������������.
   */
export class Tracer {

  /** @type {object} ����������� ������ �� ��������� ������������� */
  static tracerState = tracerState;

  /**
   * ������������ ���������� ��������� ����������.
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
      throw new Error(`����������� ������� �����������: ${profileName}`);
    }
    const nextOptions = setTraceOptions({
      ...preset,
      ...overrides,
      profile: profileName,
    });
    applySubscriberErrorPolicy(nextOptions);
    return Tracer;
  }

  static configureTracing(options = {}) {
    const current = getTraceOptions();
    const nextOptions = setTraceOptions({
      ...current,
      ...options,
    });
    applySubscriberErrorPolicy(nextOptions);
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
   * ������� ������� ��� �������� � ����������� �� ������
   * @param {Function} targetFn - ������� ��� �������
   * @param {string} eventName - ��� �������, ������� ������������ ��� ������ �������
   * @returns {Function} ��������� ������� � ������������ �����������
   */
  static createProxyFn = (targetFn, eventName) => {
    if (!targetFn || typeof targetFn !== 'function') {
      throw new Error('targetFn ������ ���� ��������');
    }
    return createProxyFn({
      fnKey: eventName || targetFn.name,
      targetFn,
      className: "commonFn",
    });
  };


  /**
   * ���������� �������-�������, ������� ����������� �������� ����� ����������� ������.
   * ������ ������� ���������� ���������� � ����� ����� �������.
   * @param {Function} originalConstructor - ����������� ������ ��� �������
   * @param {string} className - ��� ������������ ������
   * @returns {Function} ��������� �����������, ��������� ������������ ����������
   */
  static observeConstructor(originalConstructor, className) {
    if (!originalConstructor || typeof originalConstructor !== 'function') {
      throw new Error('originalConstructor ������ ���� ��������-�������������');
    }
    const finalClassName = className || originalConstructor.name;
    if (!finalClassName) {
      throw new Error('�� ������� ���������� ��� ������');
    }
    return wrapConstructor(originalConstructor, finalClassName);
  }

  /**
   * ����������� get/set ������ �������� ������� � �����������.
   * ��������� � �������� ��������� ������� propertySet/propertyGet
   * @param {object} target - ������� ������, ���������� ��������
   * @param {string} propName - ��� �������� ��� ����������
   * @param {string} [className] - ��� ������ ��� ������������� (�� ��������� target.constructor.name)
   * @returns {typeof Tracer} ����� Tracer ��� ������� �������
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
   * ����������� target � Proxy � ����������� ��������� � ��� �������� target[propName].
   * � ��������� ������ �� ��������� ���������� ���������� shallow-����� ��� Proxy.
   * Proxy ���������� ���� � ������ ��� plain-object.
   * @param {object} target - ������� ������, ��� �������� ����� ������������ ��������� � ��������
   * @param {string} propName - ��� ��������
   * @param {string|object|number} [classNameOrOptions] - ��� ������ ��� ��������� �������
   * @param {object|number} [options] - ��������� ({ useProxy, shouldUseProxy, maxDepth, shouldWrap }) ��� ����� �������
   * @returns {Proxy} ������-������, ������������� ������ � ��������
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
   * ��������� �� ����� ���������� �������, �������� �������.
   * ������ �������� ����� ������������ ������� propertyGet/propertySet ��� �������.
   * @param {object} target - ������� ������ ��� ���������� �� ����� ����������
   * @param {string} className - ��� ������ ��� �������������
   * @returns {typeof Tracer} ����� Tracer ��� ������� �������
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
   * ���������� ������� � ��������� �� ����� ���������� � �������� �������� �������
   * @param {object} target - ������� ������ ��� �����������
   * @param {string} targetName - ��� �������� �������
   * @returns {typeof Tracer} ����� Tracer ��� ������� �������
   */
  static observe(target, targetName) {
    const finalTargetName = targetName || target?.name || target?.constructor?.name || "Object";
    const report = traverse(target, finalTargetName, buildInstrumentationOptions());
    Tracer.tracerState.set(instrumentationReportKey, report);

    return Tracer;
  }

  /**
   * ��������� �� ���������� ������, ���������� ��� ������ � ��������
   * @param {Function} target - ����� ��� �����������
   * @param {string} className - ��� ������
   * @returns {typeof Tracer} ����� Tracer ��� ������� �������
   * @throws {Error} ���� � ������ ����������� ��������
   */
  static observePrototype(target, className) {
    if (!target.prototype) {
      throw new Error(`�� ������ �������� ������ ${className}`);
    }
    const finalClassName = className || target?.name || "AnonymousClass";
    const report = traverse(target.prototype, `${finalClassName}`, buildInstrumentationOptions());
    Tracer.tracerState.set(instrumentationReportKey, report);

    return Tracer;
  }

  /**
   * ��������� �� ������� ��������
   * @param {Array} targetList - ������ �������� ��� ����������
   * @returns {typeof Tracer} ����� Tracer ��� ������� �������
   */
  static observeAll(targetList) {
    const targetValues = Array.isArray(targetList)
      ? targetList
      : Object.values(targetList || {});
    const summary = createInstrumentationReport("observeAll");
    const instrumentationOptions = buildInstrumentationOptions();

    targetValues.forEach((target) => {
      if (target) {
        const report = traverse(
          target,
          target?.name || target?.constructor?.name || "Object",
          instrumentationOptions,
        );
        mergeInstrumentationReport(summary, report);
      }
    });
    Tracer.tracerState.set(instrumentationReportKey, summary);

    return Tracer;
  }

  /**
   * ��������� �� ����������� ���� ������� � ������
   * @param {Array} targetList - ������ ������� ��� ����������
   * @returns {typeof Tracer} ����� Tracer ��� ������� �������
   */
  static observePrototypeAll(targetList) {
    const targetValues = Array.isArray(targetList)
      ? targetList
      : Object.values(targetList || {});
    const summary = createInstrumentationReport("observePrototypeAll");
    const instrumentationOptions = buildInstrumentationOptions();

    targetValues.forEach((target) => {
      if (typeof target === "function") {
        const report = traverse(
          target.prototype,
          target?.name || "AnonymousClass",
          instrumentationOptions,
        );
        mergeInstrumentationReport(summary, report);
      }
    });
    Tracer.tracerState.set(instrumentationReportKey, summary);

    return Tracer;
  }

  /**
   * ��������� �� ����� ����������������� �������� �� ������
   * @param {object} exportTarget - ������ �������� ������
   * @returns {typeof Tracer} ����� Tracer ��� ������� �������
   */
  static observeFromExports(exportTarget) {
    const classList = Object.keys(exportTarget).filter((key) =>
      exportTarget[key]
        ? Object.keys(Object.getOwnPropertyDescriptors(exportTarget[key]))
            .length > 0
        : false,
    );
    const summary = createInstrumentationReport("observeFromExports");
    const instrumentationOptions = buildInstrumentationOptions();

    classList.forEach((className) => {
      const report = traverse(
        exportTarget[className],
        className,
        instrumentationOptions,
      );
      mergeInstrumentationReport(summary, report);
    });
    Tracer.tracerState.set(instrumentationReportKey, summary);

    return Tracer;
  }

  /**
   * ��������� �� ����������� ���� ���������������� ������� �� ������
   * @param {object} exportTarget - ������ �������� ������
   * @returns {Map} ����� ����������� �������
   */
  static observePrototypesFromExports(exportTarget) {
    let map = new Map();
    const summary = createInstrumentationReport("observePrototypesFromExports");
    const instrumentationOptions = buildInstrumentationOptions();

    const classList = Object.keys(exportTarget).filter((key) => {
      const proto = exportTarget[key]?.prototype;

      return proto
        ? Object.keys(Object.getOwnPropertyDescriptors(proto)).length > 0
        : false;
    });

    classList.forEach((className) => {
      map.set(className, true);
      const report = traverse(
        exportTarget[className].prototype,
        className,
        instrumentationOptions,
      );
      mergeInstrumentationReport(summary, report);
    });
    Tracer.tracerState.set(instrumentationReportKey, summary);

    return map;
  }

  /**
   * ���������� ����� ��������� ������� ��������������.
   * ������ ��� ����������� �������, ����� ����� �������/������� �� ���� ��������.
   * @returns {object|null}
   */
  static getLastInstrumentationReport() {
    return Tracer.tracerState.get(instrumentationReportKey) || null;
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
   * ������� �������� ����������, ������� ���������� �� ������� config.predicate
   * config.beforeCall() === true => ������ ��������
   * config.afterCall() === false => ��������� ��������
   * @param {string} streamSliceName - ��� ������ � ������ ������� �������
   * @param {object|Function} config - ��������� ������ ��� �������-��������
   * @param {Function} [config.predicate] - �������-�������� ��� ����������� ������/����� ������
   * @param {Function} [config.beforeCall] - ���������� ����� ������� �������
   * @param {Function} [config.afterCall] - ���������� ����� ������ �������
   * @param {*} [config.initial] - ��������� �������� ��������� ������
   * @param {string} [config.description] - �������� ������
   * @returns {typeof Tracer} ����� Tracer ��� ������� �������
   * @throws {Error} ���� ����� � ����� ������ ��� ���������
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
   * ��������� ������� ���� ������������ ������
   * @param {string} streamSliceName - ��� ������
   * @returns {typeof Tracer} ����� Tracer ��� ������� �������
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
   * ����� �������� ���������� �� ������� ������� ��� ���������� ������
   * @param {string} streamSliceName - ��� ������
   * @returns {typeof Tracer} ����� Tracer ��� ������� �������
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
   * ����� ������������� �� ������� beforeCallMethod/afterCallMethod,
   * ���� � ������ ������������ ������� tracerState[streamSliceName] === true => �������� callback(eventArgs)
   * @param {string} sliceName - ��� ������
   * @param {Function} callback - ������� ��������� ������, ���������� ��� �������� ������
   * @returns {typeof Tracer} ����� Tracer ��� ������� �������
   * @throws {Error} ���� �� ������� ��� ������ ��� ������, ��� ����� �� ���������
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
   * ��������� ����������� ������ ���� ���, ����� ���� ������������� ������������
   * @param {string} sliceName - ��� ������
   * @param {Function} callback - ������� ��������� ������
   * @returns {typeof Tracer} ����� Tracer ��� ������� �������
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
   * ��������� ����������� ������������������ �������
   * @param {string[]} sliceSeq - ������ ���� �������
   * @param {Function} callback - ������� ��������� ������, ���������� ����� ��� ������ �������
   * @returns {typeof Tracer} ����� Tracer ��� ������� �������
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
   * ����� ��������� ������� ���� ������������ ������ sliceName
   * @param {string} sliceName - ��� ������
   * @param {Function} [callback] - ������� ����������, ����� �������� ���� �������
   * @returns {typeof Tracer} ����� Tracer ��� ������� �������
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
   * ����� ��������� ���� �� ������� � ������.
   * ������ ���������� ��� ������������ �������, ���� ������� ���������� true,
   * ����������� ����� �������� debugger
   * @param {string} eventName - ��� ������� (beforeCallMethod/afterCallMethod/propertyGet/propertySet)
   * @param {Function} conditionCallback - �������, ������������ boolean ��� ��������� �������
   * @returns {typeof Tracer} ����� Tracer ��� ������� �������
   * @throws {Error} ���� �� ������� ��� ������� ��� ������
   */
  static debugOn(eventName, conditionCallback) {

    if (!eventName || !conditionCallback) {
      throw new Error("������� ��� ������� � ������!");
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
   * ������������� ���������� ���� ���� ���, ���� conditionCallback() === true
   * @param {string} eventName - ��� �������
   * @param {Function} conditionCallback - �������, ������������ boolean ��� ��������� �������
   * @returns {typeof Tracer} ����� Tracer ��� ������� �������
   * @throws {Error} ���� �� ������� ��� ������� ��� ������
   */
  static debugOnceOn(eventName, conditionCallback) {

    if (!eventName || !conditionCallback) {
      throw new Error("������� ��� ������� � ������!");
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
   * ��������� �������� �� ����� ������� ������� � ������/������ �������
   * @param {Function} callback - ������� ��������� ������, ���������� �������
   * @returns {typeof Tracer} ����� Tracer ��� ������� �������
   * @throws {Error} ���� �� ������ ������
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
   * ����-�������� �� ��� ������� �����������.
   * @param {Function} callback - �������� ������ �������
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
   * �������� ������ �� ������� ������� �������.
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
   * ����-�������� �� ������� ������� �������.
   * @param {Function} callback - �������� ������ �������
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
   * �������� ������ �� ������� ������/������ �������.
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
   * �������� �� ������� ������/������ ���������� ������� ��� ������� if � callback.
   * @param {string | string[] | Function} propSelector - ��� ��������, ������ ���� ��� ��������(event) => boolean
   * @param {Function} callback
   * @returns {typeof Tracer}
   */
  static traceProperty(propSelector, callback) {
    const matcher = (event) => {
      if (typeof propSelector === "string") {
        return event.propName === propSelector;
      }
      if (Array.isArray(propSelector)) {
        return propSelector.includes(event.propName);
      }
      if (typeof propSelector === "function") {
        return propSelector(event) === true;
      }
      return false;
    };

    return Tracer.traceProperties((event) => {
      if (matcher(event)) {
        callback(event);
      }
    });
  }

  /**
   * ����-�������� �� ������� ������/������ �������.
   * @param {Function} callback - �������� ������ �������
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
   * ������� ��� �������� �����������
   * @returns {typeof Tracer} ����� Tracer ��� ������� �������
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
   * ������� �������� �� ������� ������� �������.
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
   * ������� �������� �� ������� ������/������ �������.
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
   * ������� ��������� ����������� ��� ���������� ������� �� ��������� �������:
   * - string: ������� ��������� �����;
   * - string[]: ������� ��� ��������� ������;
   * - predicate(args): ���������������� �������� ������ true.
   * @param {string | string[] | Function} sliceSelector - �������� ������ ��� ��������
   * @param {...*} values - �������� ��� �����������
   * @returns {typeof Tracer} ����� Tracer ��� ������� �������
   */
  static logSlice(sliceSelector, ...values) {
    const args = {
      tracerState: Tracer.tracerState,
      registeredSlices: Tracer.getRegisteredSlices(),
      enabledSlices: Tracer.getEnabledSlices(),
    };

    const shouldLog = (() => {
      if (typeof sliceSelector === "string") {
        return Tracer.tracerState.get(sliceSelector) === true;
      }
      if (Array.isArray(sliceSelector)) {
        return (
          sliceSelector.length > 0 &&
          sliceSelector.every((sliceName) => Tracer.tracerState.get(sliceName) === true)
        );
      }
      if (typeof sliceSelector === "function") {
        return sliceSelector(args) === true;
      }
      return false;
    })();

    if (shouldLog) {
      const label = Array.isArray(sliceSelector)
        ? `[${sliceSelector.join(", ")}]`
        : typeof sliceSelector === "string"
          ? sliceSelector
          : "[predicate]";
      console.log([label, ...values.map(JSON.stringify)].join("\n\r\t"));
    }

    return Tracer;
  }

  /**
   * ��������� ������� ���� ����� �������
   * @param {string} sliceName - ��� ������
   * @param {Function} fn - ������� ��� ����������
   * @returns {typeof Tracer} ����� Tracer ��� ������� �������
   */
  static invokeOnSlice(sliceName, fn) {
    if (Tracer.tracerState.get(sliceName)) {
      fn();
    }

    return Tracer;
  }

  /**
   * ���������� ������� �������� ����������
   * @returns {import('./observers/context.js').ExecutionContext} ������� �������� ����������
   */
  static getCurrentContext() {
    return ExecutionContext.getCurrentContext();
  }

  static defineSliceByCall(sliceName, target, targetFnName, predicate) {
    
    Tracer.registerSliceDefinition(sliceName, predicate);
    
    const originalFn = target[targetFnName];
      
      target[targetFnName] = function() {
        if (predicate(arguments)) {
          return sliceService.executeInSlice({
            tracerState: Tracer.tracerState,
            sliceName,
            invoke: () => originalFn.apply(this, arguments),
          });
        }
        return originalFn.apply(this, arguments);
      };

      return Tracer;
  }

  /**
   * ��������� ������� � ���������� ����� �������, ������� ������� �����.
   * ����� ��������� ������ �������-���������
   * @param {string} sliceName - ��� ������
   * @param {Function} fn - ������� ������� ��� �������� ������ ������
   * @returns {Function} ��������� �������, ������������ ����� �� ����� ����������
   */
  static defineSliceByFunction = (sliceName, fn) => {
    
    Tracer.registerSliceDefinition(sliceName, () => {});

    const result = function(...args) {
      return sliceService.executeInSlice({
        tracerState: Tracer.tracerState,
        sliceName,
        invoke: () => fn.apply(this, args),
      });
    };

    result.original = fn;

    return result;
  }

  /**
   * ���������� �����, ������� ������������ ��� ������ ��������� �������
   * @param {string} sliceName - ��� ������
   * @param {string} fnName - ������ ��� ������� ��� ������������
   * @returns {typeof Tracer} ����� Tracer ��� ������� �������
   */
  static defineSliceByFunctionName(sliceName, fnName) {
    if (!sliceName || !fnName) {
      throw new Error('sliceName � fnName �����������');
    }
    Tracer.defineSlice(sliceName, (args) => {
      return args.fullName === fnName;
    });
    return Tracer;
  }

  /**
   * �������� ������ ���� �������� �������
   * @returns {Array} ������ ���� �������
   */
  static getEnabledSlices() {
    return sliceService.getEnabledSlices({
      stateConfig: Tracer[stateConfigKey],
      tracerState: Tracer.tracerState,
    });
  }

  /**
   * �������� ��������� �����
   * @param {string} sliceName - ��� ������
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
   * ������ ������ ������������������ �������
   * @returns {Array} ������ ���� �������
   */
  static getRegisteredSlices() {
    return sliceService.getRegisteredSlices({
      stateConfig: Tracer[stateConfigKey],
    });
  }

  /**
   * ������������ ������������������ �������� (������) � ����������� ������.
   * @param {object} [options]
   * @param {boolean} [options.includeFunctions=true] - ��������� predicate/beforeCall/afterCall ��� ������ �������
   * @returns {object} ����������� ������ ���������
   */
  static exportSliceScenarios(options = {}) {
    return scenarioService.exportSliceScenarios({
      stateConfig: Tracer[stateConfigKey],
      tracerState: Tracer.tracerState,
      options,
    });
  }

  /**
   * ����������� ����������� ������ ���������.
   * @param {object} payload - ������, ���������� �� exportSliceScenarios
   * @param {object} [options]
   * @param {boolean} [options.overwrite=true] - ������������ ������������ ������ � ��� �� ������
   * @param {boolean} [options.activate=true] - ��������� ��������������� ������ �� �������
   * @param {(source: string) => Function} [options.functionParser] - ��������� ������ ������� �� ������
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

  /** ������ � �������� ����������� */
  static reports = reports;

  /**
   * ������ ����� ������������ �������
   * @type {Map}
   */
  static [stateConfigKey] = new Map();
}

const initialTraceOptions = buildTraceOptions(TRACE_PROFILES.balanced);
tracerState.set(traceOptionsSymbol, initialTraceOptions);
applySubscriberErrorPolicy(initialTraceOptions);



