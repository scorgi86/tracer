const { Tracer } = require("../dist/tracer.umd.js");

let seq = 0;
const nextName = (prefix) => `${prefix}_${Date.now()}_${seq++}`;

const flushTraceSubscriptions = () => {
  Tracer.untraceAll();
  Tracer.untraceCalls();
  Tracer.untraceProperties();
};

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

describe("Tracer", () => {
  beforeEach(() => {
    Tracer.setTraceProfile("full");
  });

  afterEach(() => {
    flushTraceSubscriptions();
    Tracer.setTraceProfile("balanced");
  });

  test("createProxyFn + trace emits before/after function events", () => {
    const events = [];
    Tracer.traceAll((event) => events.push(event));

    const add = Tracer.createProxyFn((a, b) => a + b, "add");
    const result = add(2, 3);

    expect(result).toBe(5);
    expect(events).toHaveLength(2);
    expect(events[0]).toMatchObject({
      eventType: "functionCall",
      place: "before",
      fnKey: "add",
      className: "commonFn",
      fullName: "commonFn.add",
    });
    expect(events[1]).toMatchObject({
      eventType: "functionCall",
      place: "after",
      fnKey: "add",
      className: "commonFn",
      fullName: "commonFn.add",
      value: 5,
    });
  });

  test("observeProperty emits propertyGet/propertySet", () => {
    const events = [];
    const target = { value: 1 };
    Tracer.observeProperty(target, "value", "Counter");
    Tracer.traceAll((event) => events.push(event));

    const current = target.value;
    target.value = current + 2;

    expect(events.map((e) => e.eventType)).toEqual(["propertyGet", "propertySet"]);
    expect(events[0]).toMatchObject({ propName: "value", className: "Counter" });
    expect(events[1]).toMatchObject({ propName: "value", className: "Counter", value: 3 });
  });

  test("traceProperties receives manually observed property events in balanced profile", () => {
    Tracer.setTraceProfile("balanced");
    const events = [];
    const page = { m_nZoomValue: 100 };

    Tracer.observeProperty(page, "m_nZoomValue", "CEditorPage");
    Tracer.traceProperties((event) => events.push(event));

    page.m_nZoomValue = 120;

    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      className: "CEditorPage",
      fullName: "CEditorPage.m_nZoomValue",
      eventType: "propertySet",
    });
  });

  test("traceProperty filters by property name string", () => {
    const events = [];
    const model = { zoom: 100, width: 200 };
    Tracer.observeProperty(model, "zoom", "Page");
    Tracer.observeProperty(model, "width", "Page");
    Tracer.traceProperty("zoom", (event) => events.push(event));

    model.zoom = 120;
    model.width = 250;

    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({ propName: "zoom", eventType: "propertySet" });
  });

  test("traceProperty filters by property names array", () => {
    const events = [];
    const model = { zoom: 100, width: 200, height: 300 };
    Tracer.observeProperty(model, "zoom", "Page");
    Tracer.observeProperty(model, "width", "Page");
    Tracer.observeProperty(model, "height", "Page");
    Tracer.traceProperty(["zoom", "width"], (event) => events.push(event.propName));

    model.zoom = 120;
    model.width = 250;
    model.height = 350;

    expect(events).toEqual(["zoom", "width"]);
  });

  test("traceProperty supports predicate selector", () => {
    const events = [];
    const model = { zoom: 100, width: 200 };
    Tracer.observeProperty(model, "zoom", "Page");
    Tracer.observeProperty(model, "width", "Page");
    Tracer.traceProperty(
      (event) => event.propName === "zoom" && event.eventType === "propertySet",
      (event) => events.push(event),
    );

    model.zoom = 120;
    model.width = 250;
    const current = model.zoom;
    expect(current).toBe(120);

    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({ propName: "zoom", eventType: "propertySet", value: 120 });
  });

  test("observePropertyObject tracks nested get/set paths", () => {
    const events = [];
    const nested = { city: "Ekb", zip: 620000 };
    const wrapped = Tracer.observePropertyObject(nested, "address", "User");
    Tracer.traceProperties((event) => events.push(event));

    const city = wrapped.city;
    wrapped.zip = 620999;

    expect(city).toBe("Ekb");
    expect(events.map((e) => e.propName)).toEqual(["address.city", "address.zip"]);
    expect(events.map((e) => e.eventType)).toEqual(["propertyGet", "propertySet"]);
  });

  test("observePropertyObject wraps only first level by default", () => {
    const events = [];
    const wrapped = Tracer.observePropertyObject(
      { nested: { value: 7 } },
      "root",
      "DeepObj",
    );
    Tracer.traceProperties((event) => events.push(event));

    const nested = wrapped.nested;
    const value = nested.value;

    expect(value).toBe(7);
    expect(events.map((e) => e.propName)).toEqual(["root.nested"]);
  });

  test("observePropertyObject uses non-proxy mode by default", () => {
    const target = { a: 1 };
    const wrapped = Tracer.observePropertyObject(target, "root", "Obj");

    expect(wrapped).toBe(target);
    expect(wrapped.__isProxy).toBeUndefined();
  });

  test("observePropertyObject ignores proxy mode for objects with own methods", () => {
    const target = {
      Read_FromBinary2() {
        return "ok";
      },
    };
    const wrapped = Tracer.observePropertyObject(target, "element", "Element", {
      useProxy: true,
      maxDepth: 2,
      shouldWrap: () => true,
    });

    expect(wrapped).toBe(target);
    expect(wrapped.__isProxy).toBeUndefined();
    expect(wrapped.Read_FromBinary2()).toBe("ok");
  });

  test("observePropertyObject supports configurable wrapping depth", () => {
    const events = [];
    const wrapped = Tracer.observePropertyObject(
      { nested: { value: 7 } },
      "root",
      "DeepObj",
      { useProxy: true, maxDepth: 2, shouldWrap: () => true },
    );
    Tracer.traceProperties((event) => events.push(event));

    const value = wrapped.nested.value;

    expect(value).toBe(7);
    expect(events.map((e) => e.propName)).toEqual(["root.nested", "root.nested.value"]);
  });

  test("observePropertyObject enables wrapping on the fly via condition", () => {
    const events = [];
    let isWrapEnabled = false;
    const wrapped = Tracer.observePropertyObject(
      { nested: { value: 7 } },
      "root",
      "DeepObj",
      {
        useProxy: true,
        maxDepth: 2,
        shouldWrap: () => isWrapEnabled,
      },
    );
    Tracer.traceProperties((event) => events.push(event));

    const valueBefore = wrapped.nested.value;
    isWrapEnabled = true;
    const valueAfter = wrapped.nested.value;

    expect(valueBefore).toBe(7);
    expect(valueAfter).toBe(7);
    expect(events.map((e) => e.propName)).toEqual([
      "root.nested",
      "root.nested",
      "root.nested.value",
    ]);
  });

  test("observePropertyObject does not break Symbol.toPrimitive access", () => {
    const wrapped = Tracer.observePropertyObject({ value: 1 }, "payload", "Payload");

    expect(() => Number(wrapped)).not.toThrow();
    expect(wrapped[Symbol.toPrimitive]).toBeUndefined();
  });

  test("observePropertyObject keeps class method receiver compatible with private fields", () => {
    class CGlobalImageLoader {
      #name = "ok";
      getName() {
        return this.#name;
      }
    }

    const wrapped = Tracer.observePropertyObject(
      new CGlobalImageLoader(),
      "imageLoader",
      "ImageLoader",
    );

    expect(() => wrapped.getName()).not.toThrow();
    expect(wrapped.getName()).toBe("ok");
  });

  test("observeProperty preserves receiver for accessor getters", () => {
    const target = {};
    let child;
    Object.defineProperty(target, "token", {
      configurable: true,
      enumerable: true,
      get() {
        if (this !== child) {
          throw new TypeError("Illegal invocation");
        }
        return "ok";
      },
    });

    Tracer.observeProperty(target, "token", "Accessor");
    child = Object.create(target);

    expect(child.token).toBe("ok");
  });

  test("observeProperty does not replace accessor-set function value with undefined", () => {
    const target = {
      _handler: () => "initial",
      get handler() {
        return this._handler;
      },
      set handler(value) {
        this._handler = value;
      },
    };

    Tracer.observeProperty(target, "handler", "AccessorFunc");

    const nextFn = () => "next";
    target.handler = nextFn;

    expect(typeof target.handler).toBe("function");
    expect(target.handler).toBe(nextFn);
    expect(target.handler()).toBe("next");
  });

  test("observePropertyObject skips proxying EventTarget host objects", () => {
    if (typeof EventTarget === "undefined") {
      return;
    }

    const host = new EventTarget();
    const wrapped = Tracer.observePropertyObject(host, "host", "Host");

    expect(wrapped).toBe(host);
  });

  test("observeAllProperties tracks all non-function own props", () => {
    const target = { a: 1, b: 2, fn() { return 1; } };
    const events = [];
    Tracer.observeAllProperties(target, "Obj");
    Tracer.traceProperties((event) => events.push(event));

    const a = target.a;
    target.b = 3;
    target.fn();

    expect(a).toBe(1);
    expect(events.map((e) => e.propName)).toEqual(["a", "b"]);
  });

  test("observeAll accepts object map and wraps methods", () => {
    const service = {
      ping() {
        return "pong";
      },
    };
    const events = [];
    Tracer.observeAll({ service });
    Tracer.traceCalls((event) => events.push(event));

    const result = service.ping();

    expect(result).toBe("pong");
    expect(events.some((e) => e.fnKey === "ping")).toBe(true);
  });

  test("observe does not auto-wrap properties by default", () => {
    const events = [];
    const target = {
      value: 1,
      ping() {
        return "pong";
      },
    };

    Tracer.observe(target, "PlainObj");
    Tracer.traceAll((event) => events.push(event));

    const current = target.value;
    target.value = current + 1;
    target.ping();

    expect(events.some((e) => e.eventType === "propertyGet" || e.eventType === "propertySet")).toBe(false);
    expect(events.filter((e) => e.eventType === "functionCall").length).toBe(2);
  });

  test("manually observed properties are included in global tracing", () => {
    const events = [];
    const target = { value: 1 };

    Tracer.observe(target, "PlainObj");
    Tracer.observeProperty(target, "value", "PlainObj");
    Tracer.traceAll((event) => events.push(event));

    target.value;
    target.value = 2;

    expect(events.map((e) => e.eventType)).toEqual(["propertyGet", "propertySet"]);
    expect(events.every((e) => e.className === "PlainObj")).toBe(true);
  });

  test("observe() assigns fallback className for plain objects", () => {
    const events = [];
    const target = {
      ping() {
        return "pong";
      },
    };
    Tracer.observe(target);
    Tracer.traceCalls((event) => events.push(event));

    target.ping();

    expect(events).toHaveLength(2);
    expect(events[0].className).toBe("Object");
    expect(events[1].className).toBe("Object");
  });

  test("observePrototypeAll accepts object map of classes", () => {
    class Service {
      ping() {
        return "pong";
      }
    }
    const events = [];
    Tracer.observePrototypeAll({ Service });
    Tracer.traceCalls((event) => events.push(event));

    const result = new Service().ping();

    expect(result).toBe("pong");
    expect(events.some((e) => e.fnKey === "ping")).toBe(true);
  });

  test("defineSlice enables and disables flow between before/after", () => {
    const sliceName = nextName("slice");
    const tracedEvents = [];
    const fn = Tracer.createProxyFn((x) => x * 2, "mul");

    Tracer.defineSlice(sliceName, {
      predicate: (args) => args.fnKey === "mul",
      beforeCall: () => true,
      afterCall: () => false,
      initial: false,
    });
    Tracer.traceBySlice(sliceName, (event) => tracedEvents.push(event));

    fn(2);

    expect(tracedEvents).toHaveLength(1);
    expect(tracedEvents[0].place).toBe("before");
  });

  test("traceBySliceSequence triggers only when all slices are active", () => {
    const s1 = nextName("seq_a");
    const s2 = nextName("seq_b");
    const events = [];
    const fn = Tracer.createProxyFn(() => 1, "job");

    Tracer.defineSlice(s1, {
      predicate: (args) => args.fnKey === "job",
      beforeCall: () => true,
      afterCall: () => false,
    });
    Tracer.defineSlice(s2, {
      predicate: (args) => args.fnKey === "job",
      beforeCall: () => true,
      afterCall: () => false,
    });
    Tracer.traceBySliceSequence([s1, s2], (event) => events.push(event));

    fn();

    expect(events).toHaveLength(1);
    expect(events[0].place).toBe("before");
  });

  test("logSlice logs for active single slice name", () => {
    const sliceName = nextName("log_single");
    const fn = Tracer.createProxyFn(() => 1, "logSingleFn");
    const logs = [];
    const originalLog = console.log;
    console.log = (...args) => logs.push(args.join(" "));

    try {
      Tracer.defineSlice(sliceName, {
        predicate: (args) => args.fnKey === "logSingleFn",
        beforeCall: () => true,
        afterCall: () => false,
      });

      Tracer.traceBySlice(sliceName, () => {
        Tracer.logSlice(sliceName, { ok: true });
      });

      fn();
      expect(logs.length).toBeGreaterThan(0);
    } finally {
      console.log = originalLog;
    }
  });

  test("logSlice logs only when all slices from array are active", () => {
    const s1 = nextName("log_arr_a");
    const s2 = nextName("log_arr_b");
    const fn = Tracer.createProxyFn(() => 1, "logArrayFn");
    const logs = [];
    const originalLog = console.log;
    console.log = (...args) => logs.push(args.join(" "));

    try {
      Tracer.defineSlice(s1, {
        predicate: (args) => args.fnKey === "logArrayFn",
        beforeCall: () => true,
        afterCall: () => false,
      });
      Tracer.defineSlice(s2, {
        predicate: (args) => args.fnKey === "logArrayFn",
        beforeCall: () => true,
        afterCall: () => false,
      });

      Tracer.traceBySlice(s1, () => {
        Tracer.logSlice([s1, s2], "all-active");
      });

      fn();
      expect(logs.length).toBeGreaterThan(0);
    } finally {
      console.log = originalLog;
    }
  });

  test("logSlice supports predicate as first argument", () => {
    const sliceName = nextName("log_predicate");
    const fn = Tracer.createProxyFn(() => 1, "logPredicateFn");
    const logs = [];
    const originalLog = console.log;
    console.log = (...args) => logs.push(args.join(" "));

    try {
      Tracer.defineSlice(sliceName, {
        predicate: (args) => args.fnKey === "logPredicateFn",
        beforeCall: () => true,
        afterCall: () => false,
      });

      Tracer.traceBySlice(sliceName, () => {
        Tracer.logSlice(({ tracerState, enabledSlices, registeredSlices }) => {
          return (
            tracerState.get(sliceName) === true &&
            enabledSlices.includes(sliceName) &&
            registeredSlices.includes(sliceName)
          );
        }, "predicate-ok");
      });

      fn();
      expect(logs.length).toBeGreaterThan(0);
    } finally {
      console.log = originalLog;
    }
  });

  test("defineSliceByFunction resets state for async function", async () => {
    const sliceName = nextName("from_fn");
    let resolveAsync;
    const pending = new Promise((resolve) => {
      resolveAsync = resolve;
    });

    const wrapped = Tracer.defineSliceByFunction(sliceName, async () => {
      await pending;
      return "ok";
    });

    const runPromise = wrapped();
    expect(Tracer.getEnabledSlices()).toContain(sliceName);

    resolveAsync();
    const result = await runPromise;

    expect(result).toBe("ok");
    expect(Tracer.getEnabledSlices()).not.toContain(sliceName);
  });

  test("defineSliceByFunction keeps slice active for nested calls", () => {
    const sliceName = nextName("nested_fn_slice");
    let wrapped;
    const original = (n) => {
      if (n === 0) {
        return Tracer.tracerState.get(sliceName);
      }
      return wrapped(n - 1);
    };
    wrapped = Tracer.defineSliceByFunction(sliceName, original);

    const result = wrapped(3);

    expect(result).toBe(true);
    expect(Tracer.tracerState.get(sliceName)).toBe(false);
  });

  test("traceCalls/traceProperties and clear methods unsubscribe correctly", () => {
    const calls = [];
    const props = [];
    const fn = Tracer.createProxyFn(() => 7, "seven");
    const target = { value: 1 };
    Tracer.observeProperty(target, "value", "Num");

    Tracer.traceCalls((e) => calls.push(e));
    Tracer.traceProperties((e) => props.push(e));
    fn();
    target.value;

    expect(calls.length).toBe(2);
    expect(props.length).toBe(1);

    Tracer.untraceCalls();
    Tracer.untraceProperties();
    fn();
    target.value;

    expect(calls.length).toBe(2);
    expect(props.length).toBe(1);
  });

  test("minimal profile keeps explicit property subscriptions working", () => {
    Tracer.setTraceProfile("minimal");
    const events = [];
    const target = { value: 1 };

    Tracer.observeProperty(target, "value", "Counter");
    Tracer.traceProperties((event) => events.push(event));

    target.value;
    target.value = 2;

    expect(events).toHaveLength(2);
    expect(events.map((e) => e.eventType)).toEqual(["propertyGet", "propertySet"]);
  });

  test("balanced profile suppresses noisy timer call events", () => {
    Tracer.setTraceProfile("balanced");
    const events = [];
    const target = {
      onTimerScroll() {
        return "ok";
      },
    };

    Tracer.observe(target, "CEditorPage");
    Tracer.traceCalls((event) => events.push(event));
    const result = target.onTimerScroll();

    expect(result).toBe("ok");
    expect(events).toHaveLength(0);
  });

  test("full profile does not suppress noisy timer call events", () => {
    Tracer.setTraceProfile("full");
    const events = [];
    const target = {
      onTimerScroll() {
        return "ok";
      },
    };

    Tracer.observe(target, "CEditorPage");
    Tracer.traceCalls((event) => events.push(event));
    const result = target.onTimerScroll();

    expect(result).toBe("ok");
    expect(events).toHaveLength(2);
    expect(events[0].fnKey).toBe("onTimerScroll");
  });

  test("configureTracing callFilter drops call events before emit", () => {
    Tracer.setTraceProfile("full");
    Tracer.configureTracing({
      callFilter: ({ fnKey }) => fnKey !== "skipMe",
    });

    const events = [];
    const target = {
      keepMe() {
        return 1;
      },
      skipMe() {
        return 2;
      },
    };

    Tracer.observe(target, "FilterTarget");
    Tracer.traceCalls((event) => events.push(`${event.fnKey}:${event.place}`));

    target.keepMe();
    target.skipMe();

    expect(events).toEqual(["keepMe:before", "keepMe:after"]);
  });

  test("traceCallsBatched returns events in batches", async () => {
    Tracer.setTraceProfile("full");
    const batches = [];
    const fn = Tracer.createProxyFn((x) => x + 1, "batchedCall");

    Tracer.traceCallsBatched((batch) => batches.push(batch), {
      maxBatchSize: 3,
      flushIntervalMs: 50,
      bufferSize: 10,
    });

    fn(1);
    fn(2);

    await sleep(80);

    expect(batches.length).toBeGreaterThan(0);
    expect(Array.isArray(batches[0])).toBe(true);
    expect(batches[0].length).toBeGreaterThan(0);
    expect(batches[0][0].eventType).toBe("functionCall");
  });

  test("exportSliceScenarios/importSliceScenarios roundtrip with trusted parser", () => {
    const sourceSlice = nextName("exported");
    const targetSlice = nextName("imported");
    const fn = Tracer.createProxyFn(() => "ok", "act");
    const hits = [];

    Tracer.defineSlice(sourceSlice, {
      predicate: (args) => args.fnKey === "act",
      beforeCall: () => true,
      afterCall: () => false,
      initial: false,
      description: "test scenario",
    });

    const payload = Tracer.exportSliceScenarios();
    const sourceConfig = payload.slices.find((x) => x.name === sourceSlice);
    sourceConfig.name = targetSlice;
    payload.slices = [sourceConfig];

    Tracer.importSliceScenarios(payload, {
      overwrite: true,
      activate: true,
      functionParser: (source) => new Function(`return (${source});`)(),
    });
    Tracer.traceBySlice(targetSlice, (event) => hits.push(event));
    fn();

    expect(hits).toHaveLength(1);
    expect(hits[0].place).toBe("before");
    expect(Tracer.getRegisteredSlices()).toContain(targetSlice);
  });

  test("importSliceScenarios validates payload", () => {
    expect(() => Tracer.importSliceScenarios(null)).toThrow();
    expect(() => Tracer.importSliceScenarios({})).toThrow();
    expect(() => Tracer.importSliceScenarios({ slices: {} })).toThrow();
  });

  test("importSliceScenarios safe mode does not execute serialized functions", () => {
    const payload = {
      slices: [
        {
          name: nextName("safe_slice"),
          predicate: "(args) => args.fnKey === 'act'",
          beforeCall: "() => true",
          afterCall: "() => false",
        },
      ],
    };

    Tracer.importSliceScenarios(payload, { overwrite: true, activate: true });

    expect(Tracer.getRegisteredSlices()).toContain(payload.slices[0].name);
    expect(Tracer.tracerState.get(payload.slices[0].name)).toBe(false);
  });

  test("function call emits error status for thrown errors", () => {
    const events = [];
    const fn = Tracer.createProxyFn(() => {
      throw new Error("boom");
    }, "crash");
    Tracer.traceCalls((event) => events.push(event));

    expect(() => fn()).toThrow("boom");

    expect(events).toHaveLength(2);
    expect(events[0]).toMatchObject({ place: "before", status: "started" });
    expect(events[1]).toMatchObject({ place: "after", status: "error" });
    expect(events[1].error).toBeInstanceOf(Error);
  });

  test("ReportSliceDiff: creates slice from start/end predicates and tracks calls inside", () => {
    const sliceName = nextName("report_slice");
    const fn = Tracer.createProxyFn((value) => value, "step");
    const report = new Tracer.reports.ReportSliceDiff({
      tracer: Tracer,
      sliceName,
      startPredicate: (event) => event.fnKey === "step" && event.args[0] === "start",
      endPredicate: (event) => event.fnKey === "step" && event.args[0] === "stop",
    }).start();

    fn("outside-1");
    fn("start");
    fn("inside-1");
    fn("inside-2");
    fn("stop");
    fn("outside-2");

    const calls = report.getCalls();
    expect(calls.map((x) => x.args[0])).toEqual(["start", "inside-1", "inside-2", "stop"]);
    expect(report.getDiffs()).toHaveLength(3);
  });

  test("ReportSliceDiff: calculates diffs between sequential calls", () => {
    const sliceName = nextName("report_diff");
    const fn = Tracer.createProxyFn((value) => value, "phase");
    const logs = [];
    const report = new Tracer.reports.ReportSliceDiff({
      tracer: Tracer,
      sliceName,
      startPredicate: (event) => event.fnKey === "phase" && event.args[0] === "start",
      endPredicate: (event) => event.fnKey === "phase" && event.args[0] === "end",
      logProvider: {
        log(value) {
          logs.push(value);
        },
      },
    }).start();

    fn("start");
    fn("A");
    fn("B");
    fn("end");

    const diffs = report.getDiffs();
    expect(diffs).toHaveLength(3);
    expect(diffs[0].changed.args).toBe(true);
    expect(logs.length).toBe(3);
  });

  test("ReportSliceDiff: getSourceFunctionsText joins source text into one string", () => {
    const report = new Tracer.reports.ReportSliceDiff({
      tracer: Tracer,
      sliceName: nextName("source_text"),
      startPredicate: (event) => event.fnKey === "start",
      endPredicate: (event) => event.fnKey === "end",
    });

    const text = report.getSourceFunctionsText();

    expect(typeof text).toBe("string");
    expect(text.length).toBeGreaterThan(0);
    expect(text).toContain("startPredicate:");
    expect(text).toContain("endPredicate:");
    expect(text).toContain("shouldTrack:");
    expect(text).toContain("diffBuilder:");
  });

  test("ReportSliceUsage: collects methods/properties only inside slice run", () => {
    Tracer.setTraceProfile("full");
    const model = { zoom: 100 };
    const globalPropertyEvents = [];
    Tracer.observeProperty(model, "zoom", "CEditorPage");
    Tracer.traceProperties((event) => globalPropertyEvents.push(event.fullName));

    const start = Tracer.createProxyFn(() => "start", "startRun");
    const inside = Tracer.createProxyFn(() => {
      model.zoom = model.zoom + 10;
      return "inside";
    }, "insideRun");
    const end = Tracer.createProxyFn(() => "end", "endRun");

    const report = new Tracer.reports.ReportSliceUsage({
      tracer: Tracer,
      sliceName: nextName("slice_usage"),
      startPredicate: (event) => event.fnKey === "startRun",
      endPredicate: (event) => event.fnKey === "endRun",
    }).start();

    model.zoom = 101; // global, outside slice
    start();
    inside();
    end();
    model.zoom = 102; // global, outside slice

    const runs = report.getRuns();
    expect(runs).toHaveLength(1);
    expect(runs[0].methods).toContain("commonFn.insideRun");
    expect(runs[0].propertiesGet).toContain("CEditorPage.zoom");
    expect(runs[0].propertiesSet).toContain("CEditorPage.zoom");
    expect(globalPropertyEvents.length).toBeGreaterThanOrEqual(4);
  });

  test("ReportSliceUsage: computes diff between slice runs", () => {
    Tracer.setTraceProfile("full");
    const model = { zoom: 100, width: 50 };
    Tracer.observeProperty(model, "zoom", "CEditorPage");
    Tracer.observeProperty(model, "width", "CEditorPage");

    const start = Tracer.createProxyFn(() => "start", "startRunDiff");
    const end = Tracer.createProxyFn(() => "end", "endRunDiff");
    const insideA = Tracer.createProxyFn(() => {
      model.zoom = model.zoom + 1;
    }, "insideA");
    const insideB = Tracer.createProxyFn(() => {
      model.width = model.width + 1;
    }, "insideB");

    const report = new Tracer.reports.ReportSliceUsage({
      tracer: Tracer,
      sliceName: nextName("slice_usage_diff"),
      startPredicate: (event) => event.fnKey === "startRunDiff",
      endPredicate: (event) => event.fnKey === "endRunDiff",
    }).start();

    start();
    insideA();
    end();

    start();
    insideA();
    insideB();
    end();

    const runs = report.getRuns();
    expect(runs).toHaveLength(2);

    const diff = report.getDiff(0, 1);
    expect(diff.methods.added).toContain("commonFn.insideB");
    expect(diff.propertiesSet.added).toContain("CEditorPage.width");
  });

  test("stack async context: context is not preserved after timer boundary", async () => {
    Tracer.configure({ asyncContext: "stack" });

    let beforeAwait;
    let afterAwait;
    const fn = Tracer.createProxyFn(async () => {
      beforeAwait = Tracer.getCurrentContext()?.val?.fnKey;
      await new Promise((resolve) => {
        setTimeout(() => {
          afterAwait = Tracer.getCurrentContext()?.val?.fnKey;
          resolve();
        }, 0);
      });
      return "ok";
    }, "stackAsync");

    await fn();

    expect(beforeAwait).toBe("stackAsync");
    expect(afterAwait).toBeUndefined();
  });

  test("zone async context: context is preserved after timer boundary", async () => {
    require("zone.js/node");
    Tracer.configure({ asyncContext: "zone" });

    let beforeAwait;
    let afterAwait;
    const fn = Tracer.createProxyFn(async () => {
      beforeAwait = Tracer.getCurrentContext()?.val?.fnKey;
      await new Promise((resolve) => {
        setTimeout(() => {
          afterAwait = Tracer.getCurrentContext()?.val?.fnKey;
          resolve();
        }, 0);
      });
      return "ok";
    }, "zoneAsync");

    await fn();

    expect(beforeAwait).toBe("zoneAsync");
    expect(afterAwait).toBe("zoneAsync");

    Tracer.configure({ asyncContext: "stack" });
  });
});

