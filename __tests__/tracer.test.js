const { Tracer } = require("../dist/tracer.umd.js");

let seq = 0;
const nextName = (prefix) => `${prefix}_${Date.now()}_${seq++}`;

const flushTraceSubscriptions = () => {
  Tracer.traceClear();
  Tracer.traceCallsClear();
  Tracer.tracePropertiesClear();
};

describe("Tracer", () => {
  afterEach(() => {
    flushTraceSubscriptions();
  });

  test("createProxyFn + trace emits before/after function events", () => {
    const events = [];
    Tracer.trace((event) => events.push(event));

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
    Tracer.trace((event) => events.push(event));

    const current = target.value;
    target.value = current + 2;

    expect(events.map((e) => e.eventType)).toEqual(["propertyGet", "propertySet"]);
    expect(events[0]).toMatchObject({ propName: "value", className: "Counter" });
    expect(events[1]).toMatchObject({ propName: "value", className: "Counter", value: 3 });
  });

  test("wrapValueWithProxy tracks nested get/set paths", () => {
    const events = [];
    const nested = { city: "Ekb", zip: 620000 };
    const wrapped = Tracer.wrapValueWithProxy(nested, "address", "User");
    Tracer.traceProperties((event) => events.push(event));

    const city = wrapped.city;
    wrapped.zip = 620999;

    expect(city).toBe("Ekb");
    expect(events.map((e) => e.propName)).toEqual(["address.city", "address.zip"]);
    expect(events.map((e) => e.eventType)).toEqual(["propertyGet", "propertySet"]);
  });

  test("observePropertyAll tracks all non-function own props", () => {
    const target = { a: 1, b: 2, fn() { return 1; } };
    const events = [];
    Tracer.observePropertyAll(target, "Obj");
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
    Tracer.traceSlice(sliceName, (event) => tracedEvents.push(event));

    fn(2);

    expect(tracedEvents).toHaveLength(1);
    expect(tracedEvents[0].place).toBe("before");
  });

  test("traceSliceSeq triggers only when all slices are active", () => {
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
    Tracer.traceSliceSeq([s1, s2], (event) => events.push(event));

    fn();

    expect(events).toHaveLength(1);
    expect(events[0].place).toBe("before");
  });

  test("defineSliceFromFn resets state for async function", async () => {
    const sliceName = nextName("from_fn");
    let resolveAsync;
    const pending = new Promise((resolve) => {
      resolveAsync = resolve;
    });

    const wrapped = Tracer.defineSliceFromFn(sliceName, async () => {
      await pending;
      return "ok";
    });

    const runPromise = wrapped();
    expect(Tracer.getActiveSlices()).toContain(sliceName);

    resolveAsync();
    const result = await runPromise;

    expect(result).toBe("ok");
    expect(Tracer.getActiveSlices()).not.toContain(sliceName);
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

    Tracer.traceCallsClear();
    Tracer.tracePropertiesClear();
    fn();
    target.value;

    expect(calls.length).toBe(2);
    expect(props.length).toBe(1);
  });

  test("exportScenarios/importScenarios roundtrip", () => {
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

    const payload = Tracer.exportScenarios();
    const sourceConfig = payload.slices.find((x) => x.name === sourceSlice);
    sourceConfig.name = targetSlice;
    payload.slices = [sourceConfig];

    Tracer.importScenarios(payload, { overwrite: true, activate: true });
    Tracer.traceSlice(targetSlice, (event) => hits.push(event));
    fn();

    expect(hits).toHaveLength(1);
    expect(hits[0].place).toBe("before");
    expect(Tracer.getRegistredSlices()).toContain(targetSlice);
  });

  test("importScenarios validates payload", () => {
    expect(() => Tracer.importScenarios(null)).toThrow();
    expect(() => Tracer.importScenarios({})).toThrow();
    expect(() => Tracer.importScenarios({ slices: {} })).toThrow();
  });
});
