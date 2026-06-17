const { Tracer } = require("../dist/tracer.umd.js");

let seq = 0;
const nextName = (prefix) => `${prefix}_${Date.now()}_${seq++}`;
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const resetTracer = () => {
  Tracer.untraceAll();
  Tracer.untraceCalls();
  Tracer.untraceProperties();
  Tracer.configure({ asyncContext: "stack" });
  Tracer.setTraceProfile("balanced");
};

describe("Tracer regression critical", () => {
  beforeEach(() => {
    Tracer.setTraceProfile("full");
    Tracer.configureTracing({
      suppressNoisy: false,
      noisyCalls: [],
      noisyProperties: [],
      callFilter: null,
      propertyFilter: null,
      captureContext: true,
    });
  });

  afterEach(() => {
    resetTracer();
  });

  test("cleanup contract: untrace* and disableSliceListeners stop all callbacks", () => {
    const sliceName = nextName("cleanup_slice");
    const calls = [];
    const props = [];
    const all = [];
    const sliced = [];

    const model = { value: 1 };
    const service = {
      run() {
        return model.value;
      },
    };

    Tracer.observe(service, "Svc");
    Tracer.observeProperties(model, { name: "Model", properties: "value" });
    Tracer.defineSlice(sliceName, {
      predicate: (e) => e.fullName === "Svc.run",
      beforeCall: () => true,
      afterCall: () => false,
      initial: false,
    });

    Tracer.traceCalls((e) => calls.push(e));
    Tracer.traceProperties((e) => props.push(e));
    Tracer.traceAll((e) => all.push(e));
    Tracer.traceBySlice(sliceName, (e) => sliced.push(e));

    service.run();
    expect(calls.length).toBeGreaterThan(0);
    expect(all.length).toBeGreaterThan(0);
    expect(sliced.length).toBeGreaterThan(0);

    Tracer.untraceCalls();
    Tracer.untraceProperties();
    Tracer.untraceAll();
    Tracer.disableSliceListeners(sliceName);

    const before = {
      calls: calls.length,
      props: props.length,
      all: all.length,
      sliced: sliced.length,
    };

    service.run();
    model.value = 2;

    expect(calls.length).toBe(before.calls);
    expect(props.length).toBe(before.props);
    expect(all.length).toBe(before.all);
    expect(sliced.length).toBe(before.sliced);
  });

  test("cycle safety: observeAll does not recurse infinitely on cyclic graph", () => {
    const a = {};
    const b = {};
    a.self = a;
    a.peer = b;
    b.peer = a;
    b.items = [a, b];
    a.ping = () => "ok";
    b.pong = () => "ok";

    const wrap = () => Tracer.observeAll({ a, b });
    expect(wrap).not.toThrow();
  });

  test("subscriber error propagation: callback exception is thrown to caller", () => {
    const keeper = [];
    const fn = Tracer.createProxyFn((x) => x + 1, "iso");

    Tracer.traceCalls(() => {
      throw new Error("subscriber crash");
    });
    Tracer.traceCalls((e) => keeper.push(`${e.fnKey}:${e.place}`));

    expect(() => fn(1)).toThrow("subscriber crash");
    expect(keeper).toEqual([]);
  });

  test("concurrent async slice: parallel runs keep stable before-event counting", async () => {
    const sliceName = nextName("parallel_slice");
    const seen = [];

    const job = Tracer.createProxyFn(async (id) => {
      await sleep(5);
      return id;
    }, "parallelJob");

    Tracer.defineSlice(sliceName, {
      predicate: (e) => e.fnKey === "parallelJob",
      beforeCall: () => true,
      afterCall: () => false,
      initial: false,
    });
    Tracer.traceBySlice(sliceName, (e) => {
      if (e.place === "before" && e.fnKey === "parallelJob") {
        seen.push(e.callId || `noid-${seen.length}`);
      }
    });

    await Promise.all([job(1), job(2), job(3), job(4), job(5)]);

    // Exactly one before-event per parallel invocation.
    expect(seen).toHaveLength(5);
  });
});
