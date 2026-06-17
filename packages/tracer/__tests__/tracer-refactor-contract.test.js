const { Tracer } = require("../dist/tracer.umd.js");
const fs = require("fs");
const path = require("path");

let seq = 0;
const nextName = (prefix) => `${prefix}_${Date.now()}_${seq++}`;

const clearTracing = () => {
  Tracer.untraceAll();
  Tracer.untraceCalls();
  Tracer.untraceProperties();
};

const resetTracing = () => {
  clearTracing();
  Tracer.setTraceProfile("balanced");
};

const resetTracingFilters = () => {
  Tracer.configureTracing({
    suppressNoisy: false,
    noisyCalls: [],
    noisyProperties: [],
    callFilter: null,
    propertyFilter: null,
    captureContext: true,
  });
};

describe("Tracer refactor contract", () => {
  beforeEach(() => {
    Tracer.setTraceProfile("full");
    resetTracingFilters();
  });

  afterEach(() => {
    resetTracing();
    Tracer.configureTracing({
      suppressNoisy: true,
      noisyCalls: [
        "CEditorPage.onTimerScroll",
        "PaintMessageLoop._animation",
        "baseEditorsApi._autoSave",
      ],
      noisyProperties: [],
      callFilter: null,
      propertyFilter: null,
      captureContext: false,
    });
  });

  test("getTraceConfig returns isolated filter arrays", () => {
    Tracer.setTraceProfile("minimal");

    const publicConfig = Tracer.getTraceConfig();
    expect(Array.isArray(publicConfig.noisyCalls)).toBe(true);
    expect(Array.isArray(publicConfig.noisyProperties)).toBe(true);

    publicConfig.noisyCalls.push("external");
    publicConfig.noisyProperties.push("property.external");

    const freshConfig = Tracer.getTraceConfig();
    expect(freshConfig.noisyCalls).not.toContain("external");
    expect(freshConfig.noisyProperties).not.toContain("property.external");
  });

  test("setTraceProfile applies overrides and preserves requested profile", () => {
    Tracer.setTraceProfile("minimal", {
      noisyCalls: ["UserService.fetchData"],
      enableProperties: true,
    });

    const config = Tracer.getTraceConfig();

    expect(config.profile).toBe("minimal");
    expect(config.enableProperties).toBe(true);
    expect(config.noisyCalls).toEqual(["UserService.fetchData"]);
    expect(config.suppressNoisy).toBe(true);
  });

  test("configureTracing merges into existing profile and keeps profile flag", () => {
    Tracer.setTraceProfile("full");
    Tracer.configureTracing({
      noisyCalls: ["Service.run", "Service.save"],
      captureContext: false,
    });

    const config = Tracer.getTraceConfig();

    expect(config.profile).toBe("full");
    expect(config.captureContext).toBe(false);
    expect(config.noisyCalls).toEqual(["Service.run", "Service.save"]);
    expect(config.enableCalls).toBe(true);
    expect(config.enableProperties).toBe(true);
  });

  test("trace config is isolated from caller-owned arrays passed by reference", () => {
    const noisyCalls = ["User.load"];
    const noisyProperties = ["model.value"];

    Tracer.setTraceProfile("minimal", {
      noisyCalls,
      noisyProperties,
    });

    noisyCalls.push("User.save");
    noisyProperties.push("model.version");

    const configAfterProfileSet = Tracer.getTraceConfig();
    expect(configAfterProfileSet.noisyCalls).toEqual(["User.load"]);
    expect(configAfterProfileSet.noisyProperties).toEqual(["model.value"]);

    const nextCalls = ["Service.call"];
    const nextProps = ["service.url"];
    Tracer.configureTracing({
      noisyCalls: nextCalls,
      noisyProperties: nextProps,
    });

    nextCalls.push("Service.extra");
    nextProps.push("service.retry");

    const configAfterConfigureTracing = Tracer.getTraceConfig();
    expect(configAfterConfigureTracing.noisyCalls).toEqual(["Service.call"]);
    expect(configAfterConfigureTracing.noisyProperties).toEqual(["service.url"]);
  });

  test("observeConstructor keeps constructor contract and traces own instance methods", () => {
    const Wrapped = Tracer.observeConstructor(function CounterCtor(name) {
      this.name = name;
      this.getValue = function(value) {
        return `${this.name}:${value}`;
      };
    }, "Counter");

    const calls = [];
    const instance = new Wrapped("alpha");
    Tracer.traceCalls((event) => calls.push(`${event.fnKey}:${event.place}`));
    const result = instance.getValue(42);

    expect(Wrapped.isProxyConstructor).toBe(true);
    expect(result).toBe("alpha:42");
    expect(calls).toEqual(["getValue:before", "getValue:after"]);
    expect(instance.getValue).toBeInstanceOf(Function);
  });

  test("observeConstructor throws when class name cannot be inferred", () => {
    expect(() => Tracer.observeConstructor(function() {})).toThrow();
  });

  test("defineSliceByCall enables slice only inside wrapped method execution", () => {
    const sliceName = nextName("bycall");
    const events = [];

    const api = {
      coeff: 3,
      compute(value) {
        return this.process(value + 1);
      },
      process(value) {
        return this.coeff * value;
      },
    };
    api.process = Tracer.createProxyFn(api.process, "process");

    Tracer.defineSliceByCall(sliceName, api, "compute", () => true);
    Tracer.enableSlice(sliceName);
    Tracer.traceBySlice(sliceName, (event) => {
      events.push(`${event.place}:${event.fullName}`);
    });

    const innerResult = api.compute(4);
    api.process(5);

    expect(innerResult).toBe(15);
    expect(events).toContain("before:commonFn.process");
  });

  test("traceBySliceOnce unsubscribes after first matching event", () => {
    const sliceName = nextName("slice-once");
    const hits = [];
    const fn = Tracer.createProxyFn((value) => value + 1, "onceFn");

    Tracer.defineSlice(sliceName, {
      predicate: (event) => event.fnKey === "onceFn",
      beforeCall: () => true,
      afterCall: () => false,
      initial: false,
    });

    Tracer.traceBySliceOnce(sliceName, (event) => {
      hits.push(event.place);
    });

    fn(1);
    fn(2);

    expect(hits).toEqual(["before"]);
  });

  test("traceCalls tracks call events", () => {
    const events = [];
    const fn = Tracer.createProxyFn((value) => value + 1, "traceCalls");

    Tracer.traceCalls((event) => {
      events.push(event.place);
    });
    fn(1);

    expect(events).toEqual(["before", "after"]);
  });

  test("traceProperties tracks property events", () => {
    const events = [];
    const model = { zoom: 1 };

    Tracer.observeProperties(model, { name: "TracePropertiesModel", properties: "zoom" });
    Tracer.traceProperties((event) => {
      events.push(event.eventType);
    });

    model.zoom;

    expect(events).toEqual(["propertyGet"]);
  });

  test("defineSlice is enabled and disabled explicitly", () => {
    const sliceName = nextName("define-slice");
    const sequence = [];
    const fn = Tracer.createProxyFn(() => "ok", "defineSliceFn");

    Tracer.defineSlice(sliceName, {
      predicate: (event) => event.fnKey === "defineSliceFn",
      beforeCall: () => true,
      afterCall: () => true,
    });
    Tracer.enableSlice(sliceName);
    Tracer.traceBySlice(sliceName, (event) => {
      sequence.push(event.place);
    });

    fn();

    Tracer.disableSlice(sliceName);
    fn();

    expect(sequence).toEqual(["before", "after"]);
  });

  test("traceBySlice delegates to enabled slice events", () => {
    const sliceName = nextName("trace-slice");
    const events = [];
    const fn = Tracer.createProxyFn((value) => value + 1, "traceSlice");
    Tracer.defineSlice(sliceName, {
      predicate: (event) => event.fnKey === "traceSlice",
      beforeCall: () => true,
      afterCall: () => true,
    });
    Tracer.enableSlice(sliceName);

    Tracer.traceBySlice(sliceName, (event) => {
      events.push(event.place);
    });
    fn(0);

    expect(events).toEqual(["before", "after"]);
  });

  test("traceBySliceSequence uses canonical API", () => {
    const sequence = [nextName("first"), nextName("second")];
    const events = [];
    const second = Tracer.createProxyFn(() => "second", "traceSliceSeqSecond");
    const first = Tracer.createProxyFn(() => {
      second();
      return "first";
    }, "traceSliceSeqFirst");

    Tracer.defineSlice(sequence[0], {
      predicate: (event) => event.fnKey === "traceSliceSeqFirst",
      beforeCall: () => true,
      afterCall: () => false,
    });
    Tracer.defineSlice(sequence[1], {
      predicate: (event) => event.fnKey === "traceSliceSeqSecond",
      beforeCall: () => true,
      afterCall: () => false,
    });
    Tracer.enableSlice(sequence[0]);
    Tracer.enableSlice(sequence[1]);

    Tracer.traceBySliceSequence(sequence, (event) => {
      events.push(event.fnKey);
    });
    first();

    expect(events).toEqual(["traceSliceSeqSecond"]);
  });

  test("traceProperty accepts only supported selectors and ignores unsupported ones", () => {
    const events = [];
    const model = { zoom: 1 };

    Tracer.observeProperties(model, { name: "Model", properties: "zoom" });
    Tracer.traceProperty({ selector: "zoom" }, (event) => {
      events.push(event);
    });
    Tracer.traceProperty(123, (event) => {
      events.push(event);
    });
    Tracer.traceProperty(null, (event) => {
      events.push(event);
    });

    model.zoom = 2;

    expect(events).toHaveLength(0);
  });

  test("Tracer.reports public API for diagnostics remains available", () => {
    const { reports } = Tracer;

    expect(reports).toBeDefined();
    expect(reports.ReportSliceDiff).toBeDefined();
    expect(reports.ReportSliceUsage).toBeDefined();

    const sliceDiff = new reports.ReportSliceDiff({
      tracer: Tracer,
      sliceName: nextName("contract-diff"),
      startPredicate: () => false,
      endPredicate: () => false,
      logProvider: { log: () => {} },
    });

    const sliceUsage = new reports.ReportSliceUsage({
      tracer: Tracer,
      sliceName: nextName("contract-usage"),
      startPredicate: () => false,
      endPredicate: () => false,
    });

    expect(typeof sliceDiff.start).toBe("function");
    expect(typeof sliceDiff.log).toBe("function");
    expect(typeof sliceDiff.getCalls).toBe("function");
    expect(typeof sliceDiff.getDiffs).toBe("function");
    expect(typeof sliceDiff.clear).toBe("function");

    expect(typeof sliceUsage.start).toBe("function");
    expect(typeof sliceUsage.log).toBe("function");
    expect(typeof sliceUsage.getRuns).toBe("function");
    expect(typeof sliceUsage.getDiff).toBe("function");
    expect(typeof sliceUsage.getAdjacentDiffs).toBe("function");
  });

  test("core has no direct window side-effect and index exports Tracer to window when possible", () => {
    const tracerSource = fs.readFileSync(path.join(__dirname, "../src/tracer.js"), "utf8");
    const indexSource = fs.readFileSync(path.join(__dirname, "../src/index.js"), "utf8");

    expect(tracerSource.includes("window.Tracer")).toBe(false);
    expect(indexSource.includes("window.Tracer = Tracer")).toBe(true);
  });

  describe("canonical Tracer.trace subscription API migration contract", () => {
    test("Tracer.trace(callback) behaves like traceAll(callback) and returns unsubscribe", () => {
      const events = [];
      const fn = Tracer.createProxyFn((value) => value + 1, "canonicalTraceAll");
      const model = { zoom: 1 };

      Tracer.observeProperties(model, { name: "CanonicalTraceAllModel", properties: "zoom" });
      const unsubscribe = Tracer.trace((event) => {
        events.push(event.eventType);
      });

      fn(1);
      model.zoom = 2;
      unsubscribe();
      fn(2);

      expect(typeof unsubscribe).toBe("function");
      expect(events).toEqual(["functionCall", "functionCall", "propertySet"]);
    });

    test("Tracer.trace(callback, { eventTypes: 'calls' }) behaves like traceCalls(callback)", () => {
      const events = [];
      const fn = Tracer.createProxyFn((value) => value + 1, "canonicalTraceCalls");
      const model = { zoom: 1 };

      Tracer.observeProperties(model, { name: "CanonicalTraceCallsModel", properties: "zoom" });
      Tracer.trace((event) => {
        events.push(event.eventType);
      }, { eventTypes: "calls" });

      fn(1);
      model.zoom = 2;

      expect(events).toEqual(["functionCall", "functionCall"]);
    });

    test("Tracer.trace(callback, { eventTypes: 'properties' }) behaves like traceProperties(callback)", () => {
      const events = [];
      const fn = Tracer.createProxyFn((value) => value + 1, "canonicalTraceProperties");
      const model = { zoom: 1 };

      Tracer.observeProperties(model, { name: "CanonicalTracePropertiesModel", properties: "zoom" });
      Tracer.trace((event) => {
        events.push(event.eventType);
      }, { eventTypes: "properties" });

      fn(1);
      model.zoom = 2;
      model.zoom;

      expect(events).toEqual(["propertySet", "propertyGet"]);
    });

    test("Tracer.trace(callback, { property }) behaves like traceProperty(property, callback)", () => {
      const events = [];
      const model = { zoom: 1, page: 1 };

      Tracer.observeProperties(model, { name: "CanonicalTracePropertyModel", properties: ["zoom", "page"] });
      Tracer.trace((event) => {
        events.push(event.propName);
      }, { eventTypes: "properties", property: "zoom" });

      model.zoom = 2;
      model.page = 2;

      expect(events).toEqual(["zoom"]);
    });

    test("Tracer.trace(callback, { slice }) behaves like traceBySlice(slice, callback)", () => {
      const sliceName = nextName("canonical-slice");
      const events = [];
      const fn = Tracer.createProxyFn((value) => value + 1, "canonicalTraceSlice");

      Tracer.defineSlice(sliceName, {
        predicate: (event) => event.fnKey === "canonicalTraceSlice",
        beforeCall: () => true,
        afterCall: () => true,
      });
      Tracer.enableSlice(sliceName);
      Tracer.trace((event) => {
        events.push(event.place);
      }, { slice: sliceName });

      fn(1);

      expect(events).toEqual(["before", "after"]);
    });

    test("Tracer.trace(callback, { slice, once: true }) behaves like traceBySliceOnce(slice, callback)", () => {
      const sliceName = nextName("canonical-slice-once");
      const events = [];
      const fn = Tracer.createProxyFn((value) => value + 1, "canonicalTraceSliceOnce");

      Tracer.defineSlice(sliceName, {
        predicate: (event) => event.fnKey === "canonicalTraceSliceOnce",
        beforeCall: () => true,
        afterCall: () => true,
      });
      Tracer.enableSlice(sliceName);
      Tracer.trace((event) => {
        events.push(event.place);
      }, { slice: sliceName, once: true });

      fn(1);
      fn(2);

      expect(events).toEqual(["before"]);
    });

    test("Tracer.trace(callback, { batch }) behaves like traceAllBatched(callback, batch)", async () => {
      const batches = [];
      const fn = Tracer.createProxyFn((value) => value + 1, "canonicalTraceBatch");

      Tracer.trace((events) => {
        batches.push(events.map((event) => event.place));
      }, {
        eventTypes: "calls",
        batch: {
          maxBatchSize: 2,
          flushIntervalMs: 1000,
          bufferSize: 10,
        },
      });

      fn(1);

      expect(batches).toEqual([["before", "after"]]);
    });

    test("legacy trace* wrappers keep returning Tracer during the compatibility period", () => {
      expect(Tracer.traceAll(() => {})).toBe(Tracer);
      expect(Tracer.traceCalls(() => {})).toBe(Tracer);
      expect(Tracer.traceProperties(() => {})).toBe(Tracer);
      expect(Tracer.traceProperty("zoom", () => {})).toBe(Tracer);
      expect(Tracer.traceAllBatched(() => {})).toBe(Tracer);
      expect(Tracer.traceCallsBatched(() => {})).toBe(Tracer);
      expect(Tracer.tracePropertiesBatched(() => {})).toBe(Tracer);
    });
  });
});
