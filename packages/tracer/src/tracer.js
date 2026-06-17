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
    captureContext: true,
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

const normalizeObservePropertiesOptions = (target, options = {}) => {
  if (typeof options === "string" || Array.isArray(options) || options === true) return { name: target?.constructor?.name || "Object", properties: options };
  const normalized = options && typeof options === "object" ? options : {};
  return { ...normalized, name: normalized.name || normalized.className || target?.constructor?.name || "Object", properties: normalized.properties === undefined ? true : normalized.properties };
};
const getObservePropertiesList = (target, properties) => {
  if (properties === true) return Object.keys(target || {}).filter((key) => typeof target[key] !== "function");
  if (typeof properties === "string") return [properties];
  if (Array.isArray(properties)) return properties.filter((key) => typeof key === "string" && key.length > 0);
  return [];
};


const observeNestedPropertyShallow = (target, parentPropName, className) => {
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

const isSupportedTracePropertySelector = (selector) => {
  if (typeof selector === "string" || typeof selector === "function") {
    return true;
  }

  return Array.isArray(selector) && selector.every((item) => typeof item === "string");
};

/**
 * пїЅпїЅпїЅпїЅпїЅпїЅпїЅ пїЅпїЅпїЅпїЅпїЅ пїЅпїЅпїЅпїЅпїЅпїЅпїЅпїЅпїЅпїЅпїЅпїЅпїЅ пїЅпїЅпїЅ пїЅпїЅпїЅпїЅпїЅпїЅпїЅпїЅпїЅпїЅпїЅ пїЅпїЅпїЅпїЅпїЅпїЅпїЅ пїЅпїЅпїЅпїЅпїЅпїЅпїЅ,
 * пїЅпїЅпїЅпїЅпїЅпїЅпїЅ пїЅ пїЅпїЅпїЅпїЅпїЅпїЅпїЅпїЅпїЅ пїЅ пїЅпїЅпїЅпїЅпїЅпїЅпїЅпїЅпїЅ пїЅпїЅпїЅпїЅпїЅпїЅпїЅпїЅпїЅпїЅ.
 * пїЅпїЅпїЅпїЅпїЅпїЅпїЅпїЅпїЅпїЅпїЅпїЅпїЅ пїЅпїЅпїЅпїЅпїЅпїЅпїЅпїЅпїЅпїЅпїЅ пїЅпїЅпїЅпїЅпїЅпїЅ пїЅпїЅпїЅ пїЅпїЅпїЅпїЅпїЅпїЅпїЅ пїЅпїЅпїЅпїЅпїЅпїЅпїЅ, пїЅпїЅпїЅпїЅпїЅпїЅпїЅ пїЅ пїЅпїЅпїЅпїЅпїЅпїЅпїЅпїЅ
 * пїЅ пїЅпїЅпїЅпїЅпїЅпїЅпїЅпїЅпїЅпїЅпїЅпїЅ пїЅпїЅпїЅпїЅпїЅпїЅпїЅпїЅпїЅпїЅпїЅпїЅ.
   */
export class Tracer {

  /** @type {object} пїЅпїЅпїЅпїЅпїЅпїЅпїЅпїЅпїЅпїЅпїЅ пїЅпїЅпїЅпїЅпїЅпїЅ пїЅпїЅ пїЅпїЅпїЅпїЅпїЅпїЅпїЅпїЅпїЅ пїЅпїЅпїЅпїЅпїЅпїЅпїЅпїЅпїЅпїЅпїЅпїЅпїЅ */
  static tracerState = tracerState;

  /**
   * пїЅпїЅпїЅпїЅпїЅпїЅпїЅпїЅпїЅпїЅпїЅпїЅ пїЅпїЅпїЅпїЅпїЅпїЅпїЅпїЅпїЅпїЅ пїЅпїЅпїЅпїЅпїЅпїЅпїЅпїЅпїЅ пїЅпїЅпїЅпїЅпїЅпїЅпїЅпїЅпїЅпїЅ.
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
      throw new Error(`пїЅпїЅпїЅпїЅпїЅпїЅпїЅпїЅпїЅпїЅпїЅ пїЅпїЅпїЅпїЅпїЅпїЅпїЅ пїЅпїЅпїЅпїЅпїЅпїЅпїЅпїЅпїЅпїЅпїЅ: ${profileName}`);
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
   * пїЅпїЅпїЅпїЅпїЅпїЅпїЅ пїЅпїЅпїЅпїЅпїЅпїЅпїЅ пїЅпїЅпїЅ пїЅпїЅпїЅпїЅпїЅпїЅпїЅпїЅ пїЅ пїЅпїЅпїЅпїЅпїЅпїЅпїЅпїЅпїЅпїЅпїЅ пїЅпїЅ пїЅпїЅпїЅпїЅпїЅпїЅ
   * @param {Function} targetFn - пїЅпїЅпїЅпїЅпїЅпїЅпїЅ пїЅпїЅпїЅ пїЅпїЅпїЅпїЅпїЅпїЅпїЅ
   * @param {string} eventName - пїЅпїЅпїЅ пїЅпїЅпїЅпїЅпїЅпїЅпїЅ, пїЅпїЅпїЅпїЅпїЅпїЅпїЅ пїЅпїЅпїЅпїЅпїЅпїЅпїЅпїЅпїЅпїЅпїЅпїЅ пїЅпїЅпїЅ пїЅпїЅпїЅпїЅпїЅпїЅ пїЅпїЅпїЅпїЅпїЅпїЅпїЅ
   * @returns {Function} пїЅпїЅпїЅпїЅпїЅпїЅпїЅпїЅпїЅ пїЅпїЅпїЅпїЅпїЅпїЅпїЅ пїЅ пїЅпїЅпїЅпїЅпїЅпїЅпїЅпїЅпїЅпїЅпїЅпїЅ пїЅпїЅпїЅпїЅпїЅпїЅпїЅпїЅпїЅпїЅпїЅ
   */
  static createProxyFn = (targetFn, eventName, className) => {
    if (!targetFn || typeof targetFn !== 'function') throw new Error('targetFn ?????? ???? ????????');
    if (createProxyFn.isProxyFn(targetFn)) return targetFn;
    return createProxyFn({ fnKey: eventName || targetFn.name, targetFn, className: className || "commonFn" });
  };


  /**
   * пїЅпїЅпїЅпїЅпїЅпїЅпїЅпїЅпїЅпїЅ пїЅпїЅпїЅпїЅпїЅпїЅпїЅ-пїЅпїЅпїЅпїЅпїЅпїЅпїЅ, пїЅпїЅпїЅпїЅпїЅпїЅпїЅ пїЅпїЅпїЅпїЅпїЅпїЅпїЅпїЅпїЅпїЅпїЅ пїЅпїЅпїЅпїЅпїЅпїЅпїЅпїЅ пїЅпїЅпїЅпїЅпїЅ пїЅпїЅпїЅпїЅпїЅпїЅпїЅпїЅпїЅпїЅпїЅ пїЅпїЅпїЅпїЅпїЅпїЅ.
   * пїЅпїЅпїЅпїЅпїЅпїЅ пїЅпїЅпїЅпїЅпїЅпїЅпїЅ пїЅпїЅпїЅпїЅпїЅпїЅпїЅпїЅпїЅпїЅ пїЅпїЅпїЅпїЅпїЅпїЅпїЅпїЅпїЅпїЅ пїЅ пїЅпїЅпїЅпїЅпїЅ пїЅпїЅпїЅпїЅпїЅ пїЅпїЅпїЅпїЅпїЅпїЅпїЅ.
   * @param {Function} originalConstructor - пїЅпїЅпїЅпїЅпїЅпїЅпїЅпїЅпїЅпїЅпїЅ пїЅпїЅпїЅпїЅпїЅпїЅ пїЅпїЅпїЅ пїЅпїЅпїЅпїЅпїЅпїЅпїЅ
   * @param {string} className - пїЅпїЅпїЅ пїЅпїЅпїЅпїЅпїЅпїЅпїЅпїЅпїЅпїЅпїЅпїЅ пїЅпїЅпїЅпїЅпїЅпїЅ
   * @returns {Function} пїЅпїЅпїЅпїЅпїЅпїЅпїЅпїЅпїЅ пїЅпїЅпїЅпїЅпїЅпїЅпїЅпїЅпїЅпїЅпїЅ, пїЅпїЅпїЅпїЅпїЅпїЅпїЅпїЅпїЅ пїЅпїЅпїЅпїЅпїЅпїЅпїЅпїЅпїЅпїЅпїЅпїЅ пїЅпїЅпїЅпїЅпїЅпїЅпїЅпїЅпїЅпїЅ
   */
  static observeConstructor(originalConstructor, className) {
    if (!originalConstructor || typeof originalConstructor !== 'function') {
      throw new Error('originalConstructor пїЅпїЅпїЅпїЅпїЅпїЅ пїЅпїЅпїЅпїЅ пїЅпїЅпїЅпїЅпїЅпїЅпїЅпїЅ-пїЅпїЅпїЅпїЅпїЅпїЅпїЅпїЅпїЅпїЅпїЅпїЅпїЅ');
    }
    const finalClassName = className || originalConstructor.name;
    if (!finalClassName) {
      throw new Error('пїЅпїЅ пїЅпїЅпїЅпїЅпїЅпїЅпїЅ пїЅпїЅпїЅпїЅпїЅпїЅпїЅпїЅпїЅпїЅ пїЅпїЅпїЅ пїЅпїЅпїЅпїЅпїЅпїЅ');
    }
    return wrapConstructor(originalConstructor, finalClassName);
  }

  /**
   * Explicitly observes properties on a target object.
   * @param {object} target - Target object.
   * @param {string|string[]|true|object} [options] - Property selector or options.
   * @returns {object} Target object or Proxy in deep/proxy mode.
   */
  static observeProperties(target, options = {}) {
    const resolvedOptions = normalizeObservePropertiesOptions(target, options);
    const finalClassName = resolvedOptions.name;
    const properties = getObservePropertiesList(target, resolvedOptions.properties);
    if (resolvedOptions.deep === true) {
      const propName = properties[0];
      if (!propName) return target;
      const objectOptions = normalizeObserveObjectOptions(resolvedOptions);
      const canUseProxy = isPlainObject(target) && (objectOptions.useProxy === true || (typeof objectOptions.shouldUseProxy === "function" && objectOptions.shouldUseProxy({ target, propName, className: finalClassName }) === true)) && !hasOwnFunctionProps(target);
      if (canUseProxy) return wrapProperty(target, propName, finalClassName, objectOptions);
      return observeNestedPropertyShallow(target, propName, finalClassName);
    }
    properties.forEach((propName) => wrapProxyPropDescriptor(target, propName, finalClassName));
    return target;
  }

  /**
   * пїЅпїЅпїЅпїЅпїЅпїЅпїЅпїЅпїЅпїЅ пїЅпїЅпїЅпїЅпїЅпїЅпїЅ пїЅ пїЅпїЅпїЅпїЅпїЅпїЅпїЅпїЅпїЅ пїЅпїЅ пїЅпїЅпїЅпїЅпїЅ пїЅпїЅпїЅпїЅпїЅпїЅпїЅпїЅпїЅпїЅ пїЅ пїЅпїЅпїЅпїЅпїЅпїЅпїЅпїЅ пїЅпїЅпїЅпїЅпїЅпїЅпїЅпїЅ пїЅпїЅпїЅпїЅпїЅпїЅпїЅ
   * @param {object} target - пїЅпїЅпїЅпїЅпїЅпїЅпїЅ пїЅпїЅпїЅпїЅпїЅпїЅ пїЅпїЅпїЅ пїЅпїЅпїЅпїЅпїЅпїЅпїЅпїЅпїЅпїЅпїЅ
   * @param {string} targetName - пїЅпїЅпїЅ пїЅпїЅпїЅпїЅпїЅпїЅпїЅпїЅ пїЅпїЅпїЅпїЅпїЅпїЅпїЅ
   * @returns {typeof Tracer} пїЅпїЅпїЅпїЅпїЅ Tracer пїЅпїЅпїЅ пїЅпїЅпїЅпїЅпїЅпїЅпїЅ пїЅпїЅпїЅпїЅпїЅпїЅпїЅ
   */
  static observe(target, targetName) {
    const finalTargetName = targetName || target?.name || target?.constructor?.name || "Object";
    const protoInstrumentationMarker = "__tracerObservedPrototype__";
    const report = traverse(target, finalTargetName, buildInstrumentationOptions());
    const targetCtor = target && typeof target === "object" ? target.constructor : null;
    if (targetCtor && typeof targetCtor === "function" && targetCtor.prototype && targetCtor !== Object && targetCtor !== Function && targetCtor !== Array && targetCtor.prototype !== Object.prototype && targetCtor.prototype !== Function.prototype && targetCtor[protoInstrumentationMarker] !== true) {
      const prototypeReport = traverse(targetCtor.prototype, targetCtor?.name || finalTargetName, buildInstrumentationOptions());
      mergeInstrumentationReport(report, prototypeReport);
      targetCtor[protoInstrumentationMarker] = true;
    }
    Tracer.tracerState.set(instrumentationReportKey, report);
    return target;
  }

  /**
   * пїЅпїЅпїЅпїЅпїЅпїЅпїЅпїЅпїЅ пїЅпїЅ пїЅпїЅпїЅпїЅпїЅпїЅпїЅпїЅпїЅпїЅ пїЅпїЅпїЅпїЅпїЅпїЅ, пїЅпїЅпїЅпїЅпїЅпїЅпїЅпїЅпїЅпїЅ пїЅпїЅпїЅ пїЅпїЅпїЅпїЅпїЅпїЅ пїЅ пїЅпїЅпїЅпїЅпїЅпїЅпїЅпїЅ
   * @param {Function} target - пїЅпїЅпїЅпїЅпїЅ пїЅпїЅпїЅ пїЅпїЅпїЅпїЅпїЅпїЅпїЅпїЅпїЅпїЅпїЅ
   * @param {string} className - пїЅпїЅпїЅ пїЅпїЅпїЅпїЅпїЅпїЅ
   * @returns {typeof Tracer} пїЅпїЅпїЅпїЅпїЅ Tracer пїЅпїЅпїЅ пїЅпїЅпїЅпїЅпїЅпїЅпїЅ пїЅпїЅпїЅпїЅпїЅпїЅпїЅ
   * @throws {Error} пїЅпїЅпїЅпїЅ пїЅ пїЅпїЅпїЅпїЅпїЅпїЅ пїЅпїЅпїЅпїЅпїЅпїЅпїЅпїЅпїЅпїЅпїЅ пїЅпїЅпїЅпїЅпїЅпїЅпїЅпїЅ
   */
  static observePrototype(target, className) {
    if (!target.prototype) {
      throw new Error(`пїЅпїЅ пїЅпїЅпїЅпїЅпїЅпїЅ пїЅпїЅпїЅпїЅпїЅпїЅпїЅпїЅ пїЅпїЅпїЅпїЅпїЅпїЅ ${className}`);
    }
    const finalClassName = className || target?.name || "AnonymousClass";
    const report = traverse(target.prototype, `${finalClassName}`, buildInstrumentationOptions());
    Tracer.tracerState.set(instrumentationReportKey, report);

    return Tracer;
  }

  /**
   * пїЅпїЅпїЅпїЅпїЅпїЅпїЅпїЅпїЅ пїЅпїЅ пїЅпїЅпїЅпїЅпїЅпїЅпїЅ пїЅпїЅпїЅпїЅпїЅпїЅпїЅпїЅ
   * @param {Array} targetList - пїЅпїЅпїЅпїЅпїЅпїЅ пїЅпїЅпїЅпїЅпїЅпїЅпїЅпїЅ пїЅпїЅпїЅ пїЅпїЅпїЅпїЅпїЅпїЅпїЅпїЅпїЅпїЅ
   * @returns {typeof Tracer} пїЅпїЅпїЅпїЅпїЅ Tracer пїЅпїЅпїЅ пїЅпїЅпїЅпїЅпїЅпїЅпїЅ пїЅпїЅпїЅпїЅпїЅпїЅпїЅ
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
   * пїЅпїЅпїЅпїЅпїЅпїЅпїЅпїЅпїЅ пїЅпїЅ пїЅпїЅпїЅпїЅпїЅпїЅпїЅпїЅпїЅпїЅпїЅ пїЅпїЅпїЅпїЅ пїЅпїЅпїЅпїЅпїЅпїЅпїЅ пїЅ пїЅпїЅпїЅпїЅпїЅпїЅ
   * @param {Array} targetList - пїЅпїЅпїЅпїЅпїЅпїЅ пїЅпїЅпїЅпїЅпїЅпїЅпїЅ пїЅпїЅпїЅ пїЅпїЅпїЅпїЅпїЅпїЅпїЅпїЅпїЅпїЅ
   * @returns {typeof Tracer} пїЅпїЅпїЅпїЅпїЅ Tracer пїЅпїЅпїЅ пїЅпїЅпїЅпїЅпїЅпїЅпїЅ пїЅпїЅпїЅпїЅпїЅпїЅпїЅ
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
   * пїЅпїЅпїЅпїЅпїЅпїЅпїЅпїЅпїЅ пїЅпїЅ пїЅпїЅпїЅпїЅпїЅ пїЅпїЅпїЅпїЅпїЅпїЅпїЅпїЅпїЅпїЅпїЅпїЅпїЅпїЅпїЅпїЅпїЅ пїЅпїЅпїЅпїЅпїЅпїЅпїЅпїЅ пїЅпїЅ пїЅпїЅпїЅпїЅпїЅпїЅ
   * @param {object} exportTarget - пїЅпїЅпїЅпїЅпїЅпїЅ пїЅпїЅпїЅпїЅпїЅпїЅпїЅпїЅ пїЅпїЅпїЅпїЅпїЅпїЅ
   * @returns {typeof Tracer} пїЅпїЅпїЅпїЅпїЅ Tracer пїЅпїЅпїЅ пїЅпїЅпїЅпїЅпїЅпїЅпїЅ пїЅпїЅпїЅпїЅпїЅпїЅпїЅ
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
   * пїЅпїЅпїЅпїЅпїЅпїЅпїЅпїЅпїЅ пїЅпїЅ пїЅпїЅпїЅпїЅпїЅпїЅпїЅпїЅпїЅпїЅпїЅ пїЅпїЅпїЅпїЅ пїЅпїЅпїЅпїЅпїЅпїЅпїЅпїЅпїЅпїЅпїЅпїЅпїЅпїЅпїЅпїЅ пїЅпїЅпїЅпїЅпїЅпїЅпїЅ пїЅпїЅ пїЅпїЅпїЅпїЅпїЅпїЅ
   * @param {object} exportTarget - пїЅпїЅпїЅпїЅпїЅпїЅ пїЅпїЅпїЅпїЅпїЅпїЅпїЅпїЅ пїЅпїЅпїЅпїЅпїЅпїЅ
   * @returns {Map} пїЅпїЅпїЅпїЅпїЅ пїЅпїЅпїЅпїЅпїЅпїЅпїЅпїЅпїЅпїЅпїЅ пїЅпїЅпїЅпїЅпїЅпїЅпїЅ
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
   * пїЅпїЅпїЅпїЅпїЅпїЅпїЅпїЅпїЅпїЅ пїЅпїЅпїЅпїЅпїЅ пїЅпїЅпїЅпїЅпїЅпїЅпїЅпїЅпїЅ пїЅпїЅпїЅпїЅпїЅпїЅпїЅ пїЅпїЅпїЅпїЅпїЅпїЅпїЅпїЅпїЅпїЅпїЅпїЅпїЅпїЅ.
   * пїЅпїЅпїЅпїЅпїЅпїЅ пїЅпїЅпїЅ пїЅпїЅпїЅпїЅпїЅпїЅпїЅпїЅпїЅпїЅпїЅ пїЅпїЅпїЅпїЅпїЅпїЅпїЅ, пїЅпїЅпїЅпїЅпїЅ пїЅпїЅпїЅпїЅпїЅ пїЅпїЅпїЅпїЅпїЅпїЅпїЅ/пїЅпїЅпїЅпїЅпїЅпїЅпїЅ пїЅпїЅ пїЅпїЅпїЅпїЅ пїЅпїЅпїЅпїЅпїЅпїЅпїЅпїЅ.
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
   * пїЅпїЅпїЅпїЅпїЅпїЅпїЅ пїЅпїЅпїЅпїЅпїЅпїЅпїЅпїЅ пїЅпїЅпїЅпїЅпїЅпїЅпїЅпїЅпїЅпїЅ, пїЅпїЅпїЅпїЅпїЅпїЅпїЅ пїЅпїЅпїЅпїЅпїЅпїЅпїЅпїЅпїЅпїЅ пїЅпїЅ пїЅпїЅпїЅпїЅпїЅпїЅпїЅ config.predicate
   * config.beforeCall() === true => пїЅпїЅпїЅпїЅпїЅпїЅ пїЅпїЅпїЅпїЅпїЅпїЅпїЅпїЅ
   * config.afterCall() === false => пїЅпїЅпїЅпїЅпїЅпїЅпїЅпїЅпїЅ пїЅпїЅпїЅпїЅпїЅпїЅпїЅпїЅ
   * @param {string} streamSliceName - пїЅпїЅпїЅ пїЅпїЅпїЅпїЅпїЅпїЅ пїЅ пїЅпїЅпїЅпїЅпїЅпїЅ пїЅпїЅпїЅпїЅпїЅпїЅпїЅ пїЅпїЅпїЅпїЅпїЅпїЅпїЅ
   * @param {object|Function} config - пїЅпїЅпїЅпїЅпїЅпїЅпїЅпїЅпїЅ пїЅпїЅпїЅпїЅпїЅпїЅ пїЅпїЅпїЅ пїЅпїЅпїЅпїЅпїЅпїЅпїЅ-пїЅпїЅпїЅпїЅпїЅпїЅпїЅпїЅ
   * @param {Function} [config.predicate] - пїЅпїЅпїЅпїЅпїЅпїЅпїЅ-пїЅпїЅпїЅпїЅпїЅпїЅпїЅпїЅ пїЅпїЅпїЅ пїЅпїЅпїЅпїЅпїЅпїЅпїЅпїЅпїЅпїЅпїЅ пїЅпїЅпїЅпїЅпїЅпїЅ/пїЅпїЅпїЅпїЅпїЅ пїЅпїЅпїЅпїЅпїЅпїЅ
   * @param {Function} [config.beforeCall] - пїЅпїЅпїЅпїЅпїЅпїЅпїЅпїЅпїЅпїЅ пїЅпїЅпїЅпїЅпїЅ пїЅпїЅпїЅпїЅпїЅпїЅпїЅ пїЅпїЅпїЅпїЅпїЅпїЅпїЅ
   * @param {Function} [config.afterCall] - пїЅпїЅпїЅпїЅпїЅпїЅпїЅпїЅпїЅпїЅ пїЅпїЅпїЅпїЅпїЅ пїЅпїЅпїЅпїЅпїЅпїЅ пїЅпїЅпїЅпїЅпїЅпїЅпїЅ
   * @param {*} [config.initial] - пїЅпїЅпїЅпїЅпїЅпїЅпїЅпїЅпїЅ пїЅпїЅпїЅпїЅпїЅпїЅпїЅпїЅ пїЅпїЅпїЅпїЅпїЅпїЅпїЅпїЅпїЅ пїЅпїЅпїЅпїЅпїЅпїЅ
   * @param {string} [config.description] - пїЅпїЅпїЅпїЅпїЅпїЅпїЅпїЅ пїЅпїЅпїЅпїЅпїЅпїЅ
   * @returns {typeof Tracer} пїЅпїЅпїЅпїЅпїЅ Tracer пїЅпїЅпїЅ пїЅпїЅпїЅпїЅпїЅпїЅпїЅ пїЅпїЅпїЅпїЅпїЅпїЅпїЅ
   * @throws {Error} пїЅпїЅпїЅпїЅ пїЅпїЅпїЅпїЅпїЅ пїЅ пїЅпїЅпїЅпїЅпїЅ пїЅпїЅпїЅпїЅпїЅпїЅ пїЅпїЅпїЅ пїЅпїЅпїЅпїЅпїЅпїЅпїЅпїЅпїЅ
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
   * пїЅпїЅпїЅпїЅпїЅпїЅпїЅпїЅпїЅ пїЅпїЅпїЅпїЅпїЅпїЅпїЅ пїЅпїЅпїЅпїЅ пїЅпїЅпїЅпїЅпїЅпїЅпїЅпїЅпїЅпїЅпїЅпїЅ пїЅпїЅпїЅпїЅпїЅпїЅ
   * @param {string} streamSliceName - пїЅпїЅпїЅ пїЅпїЅпїЅпїЅпїЅпїЅ
   * @returns {typeof Tracer} пїЅпїЅпїЅпїЅпїЅ Tracer пїЅпїЅпїЅ пїЅпїЅпїЅпїЅпїЅпїЅпїЅ пїЅпїЅпїЅпїЅпїЅпїЅпїЅ
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
   * пїЅпїЅпїЅпїЅпїЅ пїЅпїЅпїЅпїЅпїЅпїЅпїЅпїЅ пїЅпїЅпїЅпїЅпїЅпїЅпїЅпїЅпїЅпїЅ пїЅпїЅ пїЅпїЅпїЅпїЅпїЅпїЅпїЅ пїЅпїЅпїЅпїЅпїЅпїЅпїЅ пїЅпїЅпїЅ пїЅпїЅпїЅпїЅпїЅпїЅпїЅпїЅпїЅпїЅ пїЅпїЅпїЅпїЅпїЅпїЅ
   * @param {string} streamSliceName - пїЅпїЅпїЅ пїЅпїЅпїЅпїЅпїЅпїЅ
   * @returns {typeof Tracer} пїЅпїЅпїЅпїЅпїЅ Tracer пїЅпїЅпїЅ пїЅпїЅпїЅпїЅпїЅпїЅпїЅ пїЅпїЅпїЅпїЅпїЅпїЅпїЅ
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
   * пїЅпїЅпїЅпїЅпїЅ пїЅпїЅпїЅпїЅпїЅпїЅпїЅпїЅпїЅпїЅпїЅпїЅпїЅ пїЅпїЅ пїЅпїЅпїЅпїЅпїЅпїЅпїЅ beforeCallMethod/afterCallMethod,
   * пїЅпїЅпїЅпїЅ пїЅ пїЅпїЅпїЅпїЅпїЅпїЅ пїЅпїЅпїЅпїЅпїЅпїЅпїЅпїЅпїЅпїЅпїЅпїЅ пїЅпїЅпїЅпїЅпїЅпїЅпїЅ tracerState[streamSliceName] === true => пїЅпїЅпїЅпїЅпїЅпїЅпїЅпїЅ callback(eventArgs)
   * @param {string} sliceName - пїЅпїЅпїЅ пїЅпїЅпїЅпїЅпїЅпїЅ
   * @param {Function} callback - пїЅпїЅпїЅпїЅпїЅпїЅпїЅ пїЅпїЅпїЅпїЅпїЅпїЅпїЅпїЅпїЅ пїЅпїЅпїЅпїЅпїЅпїЅ, пїЅпїЅпїЅпїЅпїЅпїЅпїЅпїЅпїЅпїЅ пїЅпїЅпїЅ пїЅпїЅпїЅпїЅпїЅпїЅпїЅпїЅ пїЅпїЅпїЅпїЅпїЅпїЅ
   * @returns {typeof Tracer} пїЅпїЅпїЅпїЅпїЅ Tracer пїЅпїЅпїЅ пїЅпїЅпїЅпїЅпїЅпїЅпїЅ пїЅпїЅпїЅпїЅпїЅпїЅпїЅ
   * @throws {Error} пїЅпїЅпїЅпїЅ пїЅпїЅ пїЅпїЅпїЅпїЅпїЅпїЅпїЅ пїЅпїЅпїЅ пїЅпїЅпїЅпїЅпїЅпїЅ пїЅпїЅпїЅ пїЅпїЅпїЅпїЅпїЅпїЅ, пїЅпїЅпїЅ пїЅпїЅпїЅпїЅпїЅ пїЅпїЅ пїЅпїЅпїЅпїЅпїЅпїЅпїЅпїЅпїЅ
   */
  static traceBySlice(sliceName, callback) {
    if (!sliceName || !callback) throw new Error("??????? ??? ????????? ? ??????");
    const sliceRuntime = Tracer[stateConfigKey].get(sliceName);
    if (!sliceRuntime) throw new Error(`?? ????????? ????? ${sliceName}`);
    const unsubscribe = Tracer.trace(callback, { slice: sliceName });
    sliceRuntime.callbacks.set(callback, { events: [], callback, dispose: unsubscribe });
    return Tracer;
  }

  /**
   * пїЅпїЅпїЅпїЅпїЅпїЅпїЅпїЅпїЅ пїЅпїЅпїЅпїЅпїЅпїЅпїЅпїЅпїЅпїЅпїЅ пїЅпїЅпїЅпїЅпїЅпїЅ пїЅпїЅпїЅпїЅ пїЅпїЅпїЅ, пїЅпїЅпїЅпїЅпїЅ пїЅпїЅпїЅпїЅ пїЅпїЅпїЅпїЅпїЅпїЅпїЅпїЅпїЅпїЅпїЅпїЅпїЅ пїЅпїЅпїЅпїЅпїЅпїЅпїЅпїЅпїЅпїЅпїЅпїЅ
   * @param {string} sliceName - пїЅпїЅпїЅ пїЅпїЅпїЅпїЅпїЅпїЅ
   * @param {Function} callback - пїЅпїЅпїЅпїЅпїЅпїЅпїЅ пїЅпїЅпїЅпїЅпїЅпїЅпїЅпїЅпїЅ пїЅпїЅпїЅпїЅпїЅпїЅ
   * @returns {typeof Tracer} пїЅпїЅпїЅпїЅпїЅ Tracer пїЅпїЅпїЅ пїЅпїЅпїЅпїЅпїЅпїЅпїЅ пїЅпїЅпїЅпїЅпїЅпїЅпїЅ
   */
  static traceBySliceOnce(sliceName, callback) {
    if (!sliceName || !callback) throw new Error("??????? ??? ????????? ? ??????");
    const sliceRuntime = Tracer[stateConfigKey].get(sliceName);
    if (!sliceRuntime) throw new Error(`?? ????????? ????? ${sliceName}`);
    const oneShot = (event) => { callback(event); Tracer.untraceBySlice(sliceName, callback); };
    const unsubscribe = Tracer.trace(oneShot, { slice: sliceName });
    sliceRuntime.callbacks.set(callback, { events: [], callback: oneShot, dispose: unsubscribe });
    return Tracer;
  }

  /**
   * пїЅпїЅпїЅпїЅпїЅпїЅпїЅпїЅпїЅ пїЅпїЅпїЅпїЅпїЅпїЅпїЅпїЅпїЅпїЅпїЅ пїЅпїЅпїЅпїЅпїЅпїЅпїЅпїЅпїЅпїЅпїЅпїЅпїЅпїЅпїЅпїЅпїЅпїЅ пїЅпїЅпїЅпїЅпїЅпїЅпїЅ
   * @param {string[]} sliceSeq - пїЅпїЅпїЅпїЅпїЅпїЅ пїЅпїЅпїЅпїЅ пїЅпїЅпїЅпїЅпїЅпїЅпїЅ
   * @param {Function} callback - пїЅпїЅпїЅпїЅпїЅпїЅпїЅ пїЅпїЅпїЅпїЅпїЅпїЅпїЅпїЅпїЅ пїЅпїЅпїЅпїЅпїЅпїЅ, пїЅпїЅпїЅпїЅпїЅпїЅпїЅпїЅпїЅпїЅ пїЅпїЅпїЅпїЅпїЅ пїЅпїЅпїЅ пїЅпїЅпїЅпїЅпїЅпїЅ пїЅпїЅпїЅпїЅпїЅпїЅпїЅ
   * @returns {typeof Tracer} пїЅпїЅпїЅпїЅпїЅ Tracer пїЅпїЅпїЅ пїЅпїЅпїЅпїЅпїЅпїЅпїЅ пїЅпїЅпїЅпїЅпїЅпїЅпїЅ
   */
  static traceBySliceSequence(sliceSeq, callback) {
    subscriptionService.traceSubscription({ emitter, store: traceCallback, callback, options: { sliceSequence: sliceSeq } });
    return Tracer;
  }


  /**
   * пїЅпїЅпїЅпїЅпїЅ пїЅпїЅпїЅпїЅпїЅпїЅпїЅпїЅпїЅ пїЅпїЅпїЅпїЅпїЅпїЅпїЅ пїЅпїЅпїЅпїЅ пїЅпїЅпїЅпїЅпїЅпїЅпїЅпїЅпїЅпїЅпїЅпїЅ пїЅпїЅпїЅпїЅпїЅпїЅ sliceName
   * @param {string} sliceName - пїЅпїЅпїЅ пїЅпїЅпїЅпїЅпїЅпїЅ
   * @param {Function} [callback] - пїЅпїЅпїЅпїЅпїЅпїЅпїЅ пїЅпїЅпїЅпїЅпїЅпїЅпїЅпїЅпїЅпїЅ, пїЅпїЅпїЅпїЅпїЅ пїЅпїЅпїЅпїЅпїЅпїЅпїЅпїЅ пїЅпїЅпїЅпїЅ пїЅпїЅпїЅпїЅпїЅпїЅпїЅ
   * @returns {typeof Tracer} пїЅпїЅпїЅпїЅпїЅ Tracer пїЅпїЅпїЅ пїЅпїЅпїЅпїЅпїЅпїЅпїЅ пїЅпїЅпїЅпїЅпїЅпїЅпїЅ
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
   * пїЅпїЅпїЅпїЅпїЅ пїЅпїЅпїЅпїЅпїЅпїЅпїЅпїЅпїЅ пїЅпїЅпїЅпїЅ пїЅпїЅ пїЅпїЅпїЅпїЅпїЅпїЅпїЅ пїЅ пїЅпїЅпїЅпїЅпїЅпїЅ.
   * пїЅпїЅпїЅпїЅпїЅпїЅ пїЅпїЅпїЅпїЅпїЅпїЅпїЅпїЅпїЅпїЅ пїЅпїЅпїЅ пїЅпїЅпїЅпїЅпїЅпїЅпїЅпїЅпїЅпїЅпїЅпїЅ пїЅпїЅпїЅпїЅпїЅпїЅпїЅ, пїЅпїЅпїЅпїЅ пїЅпїЅпїЅпїЅпїЅпїЅпїЅ пїЅпїЅпїЅпїЅпїЅпїЅпїЅпїЅпїЅпїЅ true,
   * пїЅпїЅпїЅпїЅпїЅпїЅпїЅпїЅпїЅпїЅпїЅ пїЅпїЅпїЅпїЅпїЅ пїЅпїЅпїЅпїЅпїЅпїЅпїЅпїЅ debugger
   * @param {string} eventName - пїЅпїЅпїЅ пїЅпїЅпїЅпїЅпїЅпїЅпїЅ (beforeCallMethod/afterCallMethod/propertyGet/propertySet)
   * @param {Function} conditionCallback - пїЅпїЅпїЅпїЅпїЅпїЅпїЅ, пїЅпїЅпїЅпїЅпїЅпїЅпїЅпїЅпїЅпїЅпїЅпїЅ boolean пїЅпїЅпїЅ пїЅпїЅпїЅпїЅпїЅпїЅпїЅпїЅпїЅ пїЅпїЅпїЅпїЅпїЅпїЅпїЅ
   * @returns {typeof Tracer} пїЅпїЅпїЅпїЅпїЅ Tracer пїЅпїЅпїЅ пїЅпїЅпїЅпїЅпїЅпїЅпїЅ пїЅпїЅпїЅпїЅпїЅпїЅпїЅ
   * @throws {Error} пїЅпїЅпїЅпїЅ пїЅпїЅ пїЅпїЅпїЅпїЅпїЅпїЅпїЅ пїЅпїЅпїЅ пїЅпїЅпїЅпїЅпїЅпїЅпїЅ пїЅпїЅпїЅ пїЅпїЅпїЅпїЅпїЅпїЅ
   */
  static debugOn(eventName, conditionCallback) {

    if (!eventName || !conditionCallback) {
      throw new Error("пїЅпїЅпїЅпїЅпїЅпїЅпїЅ пїЅпїЅпїЅ пїЅпїЅпїЅпїЅпїЅпїЅпїЅ пїЅ пїЅпїЅпїЅпїЅпїЅпїЅ!");
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
   * пїЅпїЅпїЅпїЅпїЅпїЅпїЅпїЅпїЅпїЅпїЅпїЅпїЅ пїЅпїЅпїЅпїЅпїЅпїЅпїЅпїЅпїЅпїЅ пїЅпїЅпїЅпїЅ пїЅпїЅпїЅпїЅ пїЅпїЅпїЅ, пїЅпїЅпїЅпїЅ conditionCallback() === true
   * @param {string} eventName - пїЅпїЅпїЅ пїЅпїЅпїЅпїЅпїЅпїЅпїЅ
   * @param {Function} conditionCallback - пїЅпїЅпїЅпїЅпїЅпїЅпїЅ, пїЅпїЅпїЅпїЅпїЅпїЅпїЅпїЅпїЅпїЅпїЅпїЅ boolean пїЅпїЅпїЅ пїЅпїЅпїЅпїЅпїЅпїЅпїЅпїЅпїЅ пїЅпїЅпїЅпїЅпїЅпїЅпїЅ
   * @returns {typeof Tracer} пїЅпїЅпїЅпїЅпїЅ Tracer пїЅпїЅпїЅ пїЅпїЅпїЅпїЅпїЅпїЅпїЅ пїЅпїЅпїЅпїЅпїЅпїЅпїЅ
   * @throws {Error} пїЅпїЅпїЅпїЅ пїЅпїЅ пїЅпїЅпїЅпїЅпїЅпїЅпїЅ пїЅпїЅпїЅ пїЅпїЅпїЅпїЅпїЅпїЅпїЅ пїЅпїЅпїЅ пїЅпїЅпїЅпїЅпїЅпїЅ
   */
  static debugOnceOn(eventName, conditionCallback) {

    if (!eventName || !conditionCallback) {
      throw new Error("пїЅпїЅпїЅпїЅпїЅпїЅпїЅ пїЅпїЅпїЅ пїЅпїЅпїЅпїЅпїЅпїЅпїЅ пїЅ пїЅпїЅпїЅпїЅпїЅпїЅ!");
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
   * пїЅпїЅпїЅпїЅпїЅпїЅпїЅпїЅпїЅ пїЅпїЅпїЅпїЅпїЅпїЅпїЅпїЅ пїЅпїЅ пїЅпїЅпїЅпїЅпїЅ пїЅпїЅпїЅпїЅпїЅпїЅпїЅ пїЅпїЅпїЅпїЅпїЅпїЅпїЅ пїЅ пїЅпїЅпїЅпїЅпїЅпїЅ/пїЅпїЅпїЅпїЅпїЅпїЅ пїЅпїЅпїЅпїЅпїЅпїЅпїЅ
   * @param {Function} callback - пїЅпїЅпїЅпїЅпїЅпїЅпїЅ пїЅпїЅпїЅпїЅпїЅпїЅпїЅпїЅпїЅ пїЅпїЅпїЅпїЅпїЅпїЅ, пїЅпїЅпїЅпїЅпїЅпїЅпїЅпїЅпїЅпїЅ пїЅпїЅпїЅпїЅпїЅпїЅпїЅ
   * @returns {typeof Tracer} пїЅпїЅпїЅпїЅпїЅ Tracer пїЅпїЅпїЅ пїЅпїЅпїЅпїЅпїЅпїЅпїЅ пїЅпїЅпїЅпїЅпїЅпїЅпїЅ
   * @throws {Error} пїЅпїЅпїЅпїЅ пїЅпїЅ пїЅпїЅпїЅпїЅпїЅпїЅ пїЅпїЅпїЅпїЅпїЅпїЅ
   */
  /**
   * Canonical subscription API for trace events.
   * @param {Function} callback - Event handler. Receives an event or a batch when options.batch is set.
   * @param {object} [options] - Trace filters and delivery options.
   * @returns {Function} Unsubscribe function.
   */
  static trace(callback, options = {}) { return subscriptionService.traceSubscription({ emitter, callback, options }); }

  static traceAll(callback) { subscriptionService.traceSubscription({ emitter, store: traceCallback, callback }); return Tracer; }


  /**
   * пїЅпїЅпїЅпїЅ-пїЅпїЅпїЅпїЅпїЅпїЅпїЅпїЅ пїЅпїЅ пїЅпїЅпїЅ пїЅпїЅпїЅпїЅпїЅпїЅпїЅ пїЅпїЅпїЅпїЅпїЅпїЅпїЅпїЅпїЅпїЅпїЅ.
   * @param {Function} callback - пїЅпїЅпїЅпїЅпїЅпїЅпїЅпїЅ пїЅпїЅпїЅпїЅпїЅпїЅ пїЅпїЅпїЅпїЅпїЅпїЅпїЅ
   * @param {object} [options]
   * @param {number} [options.maxBatchSize=100]
   * @param {number} [options.flushIntervalMs=16]
   * @param {number} [options.bufferSize=2000]
   * @returns {typeof Tracer}
   */
  static traceAllBatched(callback, options = {}) {
    subscriptionService.traceSubscription({
      emitter,
      store: traceBatchCallback,
      callback,
      options: { batch: options || true },
    });
    return Tracer;
  }

  /**
   * пїЅпїЅпїЅпїЅпїЅпїЅпїЅпїЅ пїЅпїЅпїЅпїЅпїЅпїЅ пїЅпїЅ пїЅпїЅпїЅпїЅпїЅпїЅпїЅ пїЅпїЅпїЅпїЅпїЅпїЅпїЅ пїЅпїЅпїЅпїЅпїЅпїЅпїЅ.
   * @param {Function} callback
   * @returns {typeof Tracer}
   */
  static traceCalls(callback) { subscriptionService.traceSubscription({ emitter, store: traceCallCallback, callback, options: { eventTypes: "calls" } }); return Tracer; }

  /**
   * пїЅпїЅпїЅпїЅ-пїЅпїЅпїЅпїЅпїЅпїЅпїЅпїЅ пїЅпїЅ пїЅпїЅпїЅпїЅпїЅпїЅпїЅ пїЅпїЅпїЅпїЅпїЅпїЅпїЅ пїЅпїЅпїЅпїЅпїЅпїЅпїЅ.
   * @param {Function} callback - пїЅпїЅпїЅпїЅпїЅпїЅпїЅпїЅ пїЅпїЅпїЅпїЅпїЅпїЅ пїЅпїЅпїЅпїЅпїЅпїЅпїЅ
   * @param {object} [options]
   * @returns {typeof Tracer}
   */
  static traceCallsBatched(callback, options = {}) {
    subscriptionService.traceSubscription({
      emitter,
      store: traceCallBatchCallback,
      callback,
      options: { eventTypes: "calls", batch: options || true },
    });
    return Tracer;
  }

  /**
   * пїЅпїЅпїЅпїЅпїЅпїЅпїЅпїЅ пїЅпїЅпїЅпїЅпїЅпїЅ пїЅпїЅ пїЅпїЅпїЅпїЅпїЅпїЅпїЅ пїЅпїЅпїЅпїЅпїЅпїЅ/пїЅпїЅпїЅпїЅпїЅпїЅ пїЅпїЅпїЅпїЅпїЅпїЅпїЅ.
   * @param {Function} callback
   * @returns {typeof Tracer}
   */
  static traceProperties(callback) { subscriptionService.traceSubscription({ emitter, store: tracePropertyCallback, callback, options: { eventTypes: "properties" } }); return Tracer; }


  /**
   * пїЅпїЅпїЅпїЅпїЅпїЅпїЅпїЅ пїЅпїЅ пїЅпїЅпїЅпїЅпїЅпїЅпїЅ пїЅпїЅпїЅпїЅпїЅпїЅ/пїЅпїЅпїЅпїЅпїЅпїЅ пїЅпїЅпїЅпїЅпїЅпїЅпїЅпїЅпїЅпїЅ пїЅпїЅпїЅпїЅпїЅпїЅпїЅ пїЅпїЅпїЅ пїЅпїЅпїЅпїЅпїЅпїЅпїЅ if пїЅ callback.
   * @param {string | string[] | Function} propSelector - пїЅпїЅпїЅ пїЅпїЅпїЅпїЅпїЅпїЅпїЅпїЅ, пїЅпїЅпїЅпїЅпїЅпїЅ пїЅпїЅпїЅпїЅ пїЅпїЅпїЅ пїЅпїЅпїЅпїЅпїЅпїЅпїЅпїЅ(event) => boolean
   * @param {Function} callback
   * @returns {typeof Tracer}
   */
  static traceProperty(propSelector, callback) {
    if (!isSupportedTracePropertySelector(propSelector)) {
      return Tracer;
    }

    subscriptionService.traceSubscription({
      emitter,
      store: tracePropertyCallback,
      callback,
      options: { eventTypes: "properties", property: propSelector },
    });
    return Tracer;
  }

  /**
   * пїЅпїЅпїЅпїЅ-пїЅпїЅпїЅпїЅпїЅпїЅпїЅпїЅ пїЅпїЅ пїЅпїЅпїЅпїЅпїЅпїЅпїЅ пїЅпїЅпїЅпїЅпїЅпїЅ/пїЅпїЅпїЅпїЅпїЅпїЅ пїЅпїЅпїЅпїЅпїЅпїЅпїЅ.
   * @param {Function} callback - пїЅпїЅпїЅпїЅпїЅпїЅпїЅпїЅ пїЅпїЅпїЅпїЅпїЅпїЅ пїЅпїЅпїЅпїЅпїЅпїЅпїЅ
   * @param {object} [options]
   * @returns {typeof Tracer}
   */
  static tracePropertiesBatched(callback, options = {}) {
    subscriptionService.traceSubscription({
      emitter,
      store: tracePropertyBatchCallback,
      callback,
      options: { eventTypes: "properties", batch: options || true },
    });
    return Tracer;
  }

  /**
   * пїЅпїЅпїЅпїЅпїЅпїЅпїЅ пїЅпїЅпїЅ пїЅпїЅпїЅпїЅпїЅпїЅпїЅпїЅ пїЅпїЅпїЅпїЅпїЅпїЅпїЅпїЅпїЅпїЅпїЅ
   * @returns {typeof Tracer} пїЅпїЅпїЅпїЅпїЅ Tracer пїЅпїЅпїЅ пїЅпїЅпїЅпїЅпїЅпїЅпїЅ пїЅпїЅпїЅпїЅпїЅпїЅпїЅ
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
   * пїЅпїЅпїЅпїЅпїЅпїЅпїЅ пїЅпїЅпїЅпїЅпїЅпїЅпїЅпїЅ пїЅпїЅ пїЅпїЅпїЅпїЅпїЅпїЅпїЅ пїЅпїЅпїЅпїЅпїЅпїЅпїЅ пїЅпїЅпїЅпїЅпїЅпїЅпїЅ.
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
   * пїЅпїЅпїЅпїЅпїЅпїЅпїЅ пїЅпїЅпїЅпїЅпїЅпїЅпїЅпїЅ пїЅпїЅ пїЅпїЅпїЅпїЅпїЅпїЅпїЅ пїЅпїЅпїЅпїЅпїЅпїЅ/пїЅпїЅпїЅпїЅпїЅпїЅ пїЅпїЅпїЅпїЅпїЅпїЅпїЅ.
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
   * пїЅпїЅпїЅпїЅпїЅпїЅпїЅ пїЅпїЅпїЅпїЅпїЅпїЅпїЅпїЅпїЅ пїЅпїЅпїЅпїЅпїЅпїЅпїЅпїЅпїЅпїЅпїЅ пїЅпїЅпїЅ пїЅпїЅпїЅпїЅпїЅпїЅпїЅпїЅпїЅпїЅ пїЅпїЅпїЅпїЅпїЅпїЅпїЅ пїЅпїЅ пїЅпїЅпїЅпїЅпїЅпїЅпїЅпїЅпїЅ пїЅпїЅпїЅпїЅпїЅпїЅпїЅ:
   * - string: пїЅпїЅпїЅпїЅпїЅпїЅпїЅ пїЅпїЅпїЅпїЅпїЅпїЅпїЅпїЅпїЅ пїЅпїЅпїЅпїЅпїЅ;
   * - string[]: пїЅпїЅпїЅпїЅпїЅпїЅпїЅ пїЅпїЅпїЅ пїЅпїЅпїЅпїЅпїЅпїЅпїЅпїЅпїЅ пїЅпїЅпїЅпїЅпїЅпїЅ;
   * - predicate(args): пїЅпїЅпїЅпїЅпїЅпїЅпїЅпїЅпїЅпїЅпїЅпїЅпїЅпїЅпїЅпїЅ пїЅпїЅпїЅпїЅпїЅпїЅпїЅпїЅ пїЅпїЅпїЅпїЅпїЅпїЅ true.
   * @param {string | string[] | Function} sliceSelector - пїЅпїЅпїЅпїЅпїЅпїЅпїЅпїЅ пїЅпїЅпїЅпїЅпїЅпїЅ пїЅпїЅпїЅ пїЅпїЅпїЅпїЅпїЅпїЅпїЅпїЅ
   * @param {...*} values - пїЅпїЅпїЅпїЅпїЅпїЅпїЅпїЅ пїЅпїЅпїЅ пїЅпїЅпїЅпїЅпїЅпїЅпїЅпїЅпїЅпїЅпїЅ
   * @returns {typeof Tracer} пїЅпїЅпїЅпїЅпїЅ Tracer пїЅпїЅпїЅ пїЅпїЅпїЅпїЅпїЅпїЅпїЅ пїЅпїЅпїЅпїЅпїЅпїЅпїЅ
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
   * пїЅпїЅпїЅпїЅпїЅпїЅпїЅпїЅпїЅ пїЅпїЅпїЅпїЅпїЅпїЅпїЅ пїЅпїЅпїЅпїЅ пїЅпїЅпїЅпїЅпїЅ пїЅпїЅпїЅпїЅпїЅпїЅпїЅ
   * @param {string} sliceName - пїЅпїЅпїЅ пїЅпїЅпїЅпїЅпїЅпїЅ
   * @param {Function} fn - пїЅпїЅпїЅпїЅпїЅпїЅпїЅ пїЅпїЅпїЅ пїЅпїЅпїЅпїЅпїЅпїЅпїЅпїЅпїЅпїЅ
   * @returns {typeof Tracer} пїЅпїЅпїЅпїЅпїЅ Tracer пїЅпїЅпїЅ пїЅпїЅпїЅпїЅпїЅпїЅпїЅ пїЅпїЅпїЅпїЅпїЅпїЅпїЅ
   */
  static invokeOnSlice(sliceName, fn) {
    if (Tracer.tracerState.get(sliceName)) {
      fn();
    }

    return Tracer;
  }

  /**
   * пїЅпїЅпїЅпїЅпїЅпїЅпїЅпїЅпїЅпїЅ пїЅпїЅпїЅпїЅпїЅпїЅпїЅ пїЅпїЅпїЅпїЅпїЅпїЅпїЅпїЅ пїЅпїЅпїЅпїЅпїЅпїЅпїЅпїЅпїЅпїЅ
   * @returns {import('./observers/context.js').ExecutionContext} пїЅпїЅпїЅпїЅпїЅпїЅпїЅ пїЅпїЅпїЅпїЅпїЅпїЅпїЅпїЅ пїЅпїЅпїЅпїЅпїЅпїЅпїЅпїЅпїЅпїЅ
   */
  static getCurrentContext() {
    return ExecutionContext.getCurrentContext();
  }

  static defineSliceByCall(sliceName, target, targetFnName, predicate) {
    Tracer.registerSliceDefinition(sliceName, predicate);
    const originalFn = target[targetFnName];
    target[targetFnName] = function() {
      if (predicate(arguments)) return sliceService.executeInSlice({ tracerState: Tracer.tracerState, sliceName, invoke: () => originalFn.apply(this, arguments) });
      return originalFn.apply(this, arguments);
    };
    return target;
  }

  /**
   * пїЅпїЅпїЅпїЅпїЅпїЅпїЅпїЅпїЅ пїЅпїЅпїЅпїЅпїЅпїЅпїЅ пїЅ пїЅпїЅпїЅпїЅпїЅпїЅпїЅпїЅпїЅпїЅ пїЅпїЅпїЅпїЅпїЅ пїЅпїЅпїЅпїЅпїЅпїЅпїЅ, пїЅпїЅпїЅпїЅпїЅпїЅпїЅ пїЅпїЅпїЅпїЅпїЅпїЅпїЅ пїЅпїЅпїЅпїЅпїЅ.
   * пїЅпїЅпїЅпїЅпїЅ пїЅпїЅпїЅпїЅпїЅпїЅпїЅпїЅпїЅ пїЅпїЅпїЅпїЅпїЅпїЅ пїЅпїЅпїЅпїЅпїЅпїЅпїЅ-пїЅпїЅпїЅпїЅпїЅпїЅпїЅпїЅпїЅ
   * @param {string} sliceName - пїЅпїЅпїЅ пїЅпїЅпїЅпїЅпїЅпїЅ
   * @param {Function} fn - пїЅпїЅпїЅпїЅпїЅпїЅпїЅ пїЅпїЅпїЅпїЅпїЅпїЅпїЅ пїЅпїЅпїЅ пїЅпїЅпїЅпїЅпїЅпїЅпїЅпїЅ пїЅпїЅпїЅпїЅпїЅпїЅ пїЅпїЅпїЅпїЅпїЅпїЅ
   * @returns {Function} пїЅпїЅпїЅпїЅпїЅпїЅпїЅпїЅпїЅ пїЅпїЅпїЅпїЅпїЅпїЅпїЅ, пїЅпїЅпїЅпїЅпїЅпїЅпїЅпїЅпїЅпїЅпїЅпїЅ пїЅпїЅпїЅпїЅпїЅ пїЅпїЅ пїЅпїЅпїЅпїЅпїЅ пїЅпїЅпїЅпїЅпїЅпїЅпїЅпїЅпїЅпїЅ
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
   * пїЅпїЅпїЅпїЅпїЅпїЅпїЅпїЅпїЅпїЅ пїЅпїЅпїЅпїЅпїЅ, пїЅпїЅпїЅпїЅпїЅпїЅпїЅ пїЅпїЅпїЅпїЅпїЅпїЅпїЅпїЅпїЅпїЅпїЅпїЅ пїЅпїЅпїЅ пїЅпїЅпїЅпїЅпїЅпїЅ пїЅпїЅпїЅпїЅпїЅпїЅпїЅпїЅпїЅ пїЅпїЅпїЅпїЅпїЅпїЅпїЅ
   * @param {string} sliceName - пїЅпїЅпїЅ пїЅпїЅпїЅпїЅпїЅпїЅ
   * @param {string} fnName - пїЅпїЅпїЅпїЅпїЅпїЅ пїЅпїЅпїЅ пїЅпїЅпїЅпїЅпїЅпїЅпїЅ пїЅпїЅпїЅ пїЅпїЅпїЅпїЅпїЅпїЅпїЅпїЅпїЅпїЅпїЅпїЅ
   * @returns {typeof Tracer} пїЅпїЅпїЅпїЅпїЅ Tracer пїЅпїЅпїЅ пїЅпїЅпїЅпїЅпїЅпїЅпїЅ пїЅпїЅпїЅпїЅпїЅпїЅпїЅ
   */
  static defineSliceByFunctionName(sliceName, fnName) {
    if (!sliceName || !fnName) {
      throw new Error('sliceName пїЅ fnName пїЅпїЅпїЅпїЅпїЅпїЅпїЅпїЅпїЅпїЅпїЅ');
    }
    Tracer.defineSlice(sliceName, (args) => {
      return args.fullName === fnName;
    });
    return Tracer;
  }

  /**
   * пїЅпїЅпїЅпїЅпїЅпїЅпїЅпїЅ пїЅпїЅпїЅпїЅпїЅпїЅ пїЅпїЅпїЅпїЅ пїЅпїЅпїЅпїЅпїЅпїЅпїЅпїЅ пїЅпїЅпїЅпїЅпїЅпїЅпїЅ
   * @returns {Array} пїЅпїЅпїЅпїЅпїЅпїЅ пїЅпїЅпїЅпїЅ пїЅпїЅпїЅпїЅпїЅпїЅпїЅ
   */
  static getEnabledSlices() {
    return sliceService.getEnabledSlices({
      stateConfig: Tracer[stateConfigKey],
      tracerState: Tracer.tracerState,
    });
  }

  /**
   * пїЅпїЅпїЅпїЅпїЅпїЅпїЅпїЅ пїЅпїЅпїЅпїЅпїЅпїЅпїЅпїЅпїЅ пїЅпїЅпїЅпїЅпїЅ
   * @param {string} sliceName - пїЅпїЅпїЅ пїЅпїЅпїЅпїЅпїЅпїЅ
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
   * пїЅпїЅпїЅпїЅпїЅпїЅ пїЅпїЅпїЅпїЅпїЅпїЅ пїЅпїЅпїЅпїЅпїЅпїЅпїЅпїЅпїЅпїЅпїЅпїЅпїЅпїЅпїЅпїЅпїЅпїЅ пїЅпїЅпїЅпїЅпїЅпїЅпїЅ
   * @returns {Array} пїЅпїЅпїЅпїЅпїЅпїЅ пїЅпїЅпїЅпїЅ пїЅпїЅпїЅпїЅпїЅпїЅпїЅ
   */
  static getRegisteredSlices() {
    return sliceService.getRegisteredSlices({
      stateConfig: Tracer[stateConfigKey],
    });
  }

  static printRegisteredSlices() {
    const slices = Tracer.getRegisteredSlices();
    if (!slices.length) { console.log("??? ?????????????????? ???????"); return []; }
    console.log("?????????????????? ??????:");
    slices.forEach((sliceName, index) => console.log(String(index + 1) + ". " + sliceName));
    return slices;
  }

  static isX2tEnvironment() {
    return typeof EventTarget === 'undefined';
  }

  /** пїЅпїЅпїЅпїЅпїЅпїЅ пїЅ пїЅпїЅпїЅпїЅпїЅпїЅпїЅпїЅ пїЅпїЅпїЅпїЅпїЅпїЅпїЅпїЅпїЅпїЅпїЅ */
  static reports = reports;

  /**
   * пїЅпїЅпїЅпїЅпїЅпїЅ пїЅпїЅпїЅпїЅпїЅ пїЅпїЅпїЅпїЅпїЅпїЅпїЅпїЅпїЅпїЅпїЅпїЅ пїЅпїЅпїЅпїЅпїЅпїЅпїЅ
   * @type {Map}
   */
  static [stateConfigKey] = new Map();
}

const initialTraceOptions = buildTraceOptions(TRACE_PROFILES.balanced);
tracerState.set(traceOptionsSymbol, initialTraceOptions);
applySubscriberErrorPolicy(initialTraceOptions);



