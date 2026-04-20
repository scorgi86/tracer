class BaseReport {
  
  logProvider = null;
  constructor({ logProvider }) {
    this.logProvider = logProvider;
  }

  log() {

  }
}

/**
 * Отчет создат
 */
class ReportUsage {
  static description =
    "Отчет соберет информацию использованных классах и вызовах их метотдов";

  _store;
  logProvider;

  constructor({ logProvider = console }) {
    this._store = new Map();
    this.logProvider = logProvider;
  }
  
  log(args) {

    if (!this._store.has(args.className)) {
      this._store.set(args.className, new Set);
    }

    if (this._store.get(args.className).has(args.fnKey) === false) {
      this._store.get(args.className).add(args.fnKey);
    }
  }

  print() {
    let classStack = [];
    let methodsStack = [];

    this._store.forEach((valueSet, key) => {
      classStack.push(key);
      valueSet.forEach((method) => {
        methodsStack.push(`Class: ${key}.${method}`);
      })
    });
    this.logProvider.log(classStack.join('\n\t\r'));
    this.logProvider.log(methodsStack.join('\n\t\r'));
  }
}

class ReportTreeView {
  _stack;

  constructor() {
    this._stack = [];
    this._result = [];
  }

  log(args, serializedValues) {
    const { eventType, className, fnKey, propName } = args;
    const fullKey = `${className}.${fnKey || propName}`;

     if (eventType === "propertySet") {

      this._result.push(`${this._stack.join("")} ${fullKey} - ${serializedValues || "none values"}`);
    } else if (eventType === 'functionCall') {
      
      if (args.place === "before") {
        const newLogItem = `${this._stack.join("")} ${fullKey} - ${serializedValues || "none values"}`;
        this._result.push(newLogItem);
        
        console.log(newLogItem);

        this._stack.push("	");

      } else if (args.place === "after") {
        this._stack.pop();
      }
    }
  }

  getResults() {
    return this._result;
  }
}

class ReportSimple {
  _store;
  constructor({ logProvider }) {
    this._store = new Set();
    this.logProvider = logProvider;
  }

  log({ fnKey, className }) {
    const fullKey = `${className}.${fnKey}`;

    this.logProvider.log(fullKey);
    this._store.add(fullKey);
  }
}

class ReportSliceDiff {
  tracer;
  sliceName;
  startPredicate;
  endPredicate;
  shouldTrack;
  logProvider;
  diffBuilder;
  _calls;
  _diffs;
  _prevCall;
  _isStarted;

  constructor({
    tracer,
    sliceName = "slice-diff-report",
    startPredicate,
    endPredicate,
    shouldTrack = (event) =>
      event.eventType === "functionCall" && event.place === "before",
    logProvider = console,
    diffBuilder,
  }) {
    if (typeof startPredicate !== "function") {
      throw new Error("startPredicate должен быть функцией");
    }
    if (typeof endPredicate !== "function") {
      throw new Error("endPredicate должен быть функцией");
    }
    if (!tracer) {
      throw new Error("Передайте tracer в ReportSliceDiff");
    }

    this.tracer = tracer;
    this.sliceName = sliceName;
    this.startPredicate = startPredicate;
    this.endPredicate = endPredicate;
    this.shouldTrack = shouldTrack;
    this.logProvider = logProvider;
    this.diffBuilder = diffBuilder || ReportSliceDiff.defaultDiffBuilder;
    this._calls = [];
    this._diffs = [];
    this._prevCall = null;
    this._isStarted = false;
  }

  static safeClone(value) {
    if (value === undefined) {
      return undefined;
    }
    try {
      if (typeof structuredClone === "function") {
        return structuredClone(value);
      }
    } catch (e) {}

    try {
      return JSON.parse(JSON.stringify(value));
    } catch (e) {
      return value;
    }
  }

  static defaultDiffBuilder(prevCall, nextCall) {
    const changed = {
      fullName: prevCall.fullName !== nextCall.fullName,
      fnKey: prevCall.fnKey !== nextCall.fnKey,
      className: prevCall.className !== nextCall.className,
      args:
        JSON.stringify(prevCall.args) !== JSON.stringify(nextCall.args),
    };

    return {
      index: nextCall.index,
      prev: {
        fullName: prevCall.fullName,
        args: prevCall.args,
      },
      next: {
        fullName: nextCall.fullName,
        args: nextCall.args,
      },
      changed,
    };
  }

  start() {
    if (this._isStarted) {
      return this;
    }

    this.tracer.defineSlice(this.sliceName, {
      description: "Slice для отчета о diff вызовов",
      initial: false,
      predicate: (event) =>
        this.startPredicate(event) || this.endPredicate(event),
      beforeCall: (event) => {
        if (this.startPredicate(event)) {
          return true;
        }
        return this.tracer.tracerState.get(this.sliceName) === true;
      },
      afterCall: (event) => {
        if (this.endPredicate(event)) {
          return false;
        }
        return this.tracer.tracerState.get(this.sliceName) === true;
      },
    });

    this.tracer.traceBySlice(this.sliceName, (event) => this.log(event));
    this._isStarted = true;
    return this;
  }

  log(event) {
    if (!this.shouldTrack(event)) {
      return;
    }

    const call = {
      index: this._calls.length,
      timestamp: Date.now(),
      fullName: event.fullName,
      fnKey: event.fnKey,
      className: event.className,
      place: event.place,
      eventType: event.eventType,
      args: ReportSliceDiff.safeClone(event.args),
    };

    this._calls.push(call);

    if (this._prevCall) {
      const diff = this.diffBuilder(this._prevCall, call);
      this._diffs.push(diff);
      if (this.logProvider && typeof this.logProvider.log === "function") {
        this.logProvider.log(diff);
      }
    }

    this._prevCall = call;
  }

  getCalls() {
    return [...this._calls];
  }

  getDiffs() {
    return [...this._diffs];
  }

  clear() {
    this._calls = [];
    this._diffs = [];
    this._prevCall = null;
    return this;
  }

  /**
   * Собирает исходный текст функций отчета в одну строку.
   * @param {object} [options]
   * @param {string} [options.separator='\n'] - Разделитель между функциями
   * @returns {string}
   */
  getSourceFunctionsText(options = {}) {
    const separator = options.separator ?? "\n";
    const parts = [];

    const addFunctionSource = (name, fn) => {
      if (typeof fn !== "function") {
        return;
      }
      parts.push(`${name}: ${fn.toString()}`);
    };

    addFunctionSource("startPredicate", this.startPredicate);
    addFunctionSource("endPredicate", this.endPredicate);
    addFunctionSource("shouldTrack", this.shouldTrack);
    addFunctionSource("diffBuilder", this.diffBuilder);

    return parts.join(separator);
  }

  stop() {
    if (!this._isStarted) {
      return this;
    }
    this.tracer.untraceBySlice(this.sliceName);
    this.tracer.disableSliceListeners(this.sliceName);
    this._isStarted = false;
    return this;
  }
}


module.exports = {
  ReportUsage,
  ReportTreeView,
  ReportSimple,
  ReportSliceDiff
};
