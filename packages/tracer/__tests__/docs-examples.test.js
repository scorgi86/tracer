const { Tracer } = require("../dist/tracer.umd.js");

let seq = 0;
const nextName = (prefix) => `${prefix}_${Date.now()}_${seq++}`;
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const resetTracer = () => {
  Tracer.untraceAll();
  Tracer.untraceCalls();
  Tracer.untraceProperties();
  Tracer.configure({ asyncContext: "stack" });
  Tracer.setTraceProfile("balanced");
};

describe("Documentation examples", () => {
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

  test("quick start: createProxyFn + traceAll emits functionCall events", () => {
    function calculateTotal(items) {
      return items.reduce((sum, item) => sum + item.price, 0);
    }

    const events = [];
    const tracedCalculate = Tracer.createProxyFn(calculateTotal, "calculateTotal");
    Tracer.traceAll((event) => events.push(`${event.eventType}:${event.fullName}`));

    const total = tracedCalculate([{ price: 100 }, { price: 200 }]);

    expect(total).toBe(300);
    expect(events).toEqual([
      "functionCall:commonFn.calculateTotal",
      "functionCall:commonFn.calculateTotal",
    ]);
  });

  test("slice example: defineSlice + traceBySlice captures only in-slice events", () => {
    const sliceName = nextName("orderFlow");
    const hits = [];

    const service = {
      processOrder() {
        this.validate();
        return "ok";
      },
      validate() {
        return true;
      },
    };

    Tracer.observe(service, "OrderService");
    Tracer.defineSlice(sliceName, {
      predicate: (event) => event.fullName === "OrderService.processOrder",
      beforeCall: () => true,
      afterCall: () => false,
      initial: false,
    });
    Tracer.traceBySlice(sliceName, (event) => {
      if (event.place === "before") {
        hits.push(event.fullName);
      }
    });

    service.processOrder();

    expect(hits).toEqual([
      "OrderService.processOrder",
      "OrderService.validate",
    ]);
  });

  test("properties example: observeProperty + traceProperties tracks set value", () => {
    class Order {
      constructor() {
        this.status = "pending";
      }
    }

    const order = new Order();
    const events = [];
    Tracer.observeProperty(order, "status", "Order");
    Tracer.traceProperties((event) => events.push(event));

    order.status = "approved";

    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      eventType: "propertySet",
      className: "Order",
      propName: "status",
      value: "approved",
    });
  });

  test("filtering example: callFilter keeps only service/repository calls", () => {
    const events = [];
    Tracer.configureTracing({
      callFilter: ({ fullName, fnKey }) => {
        if (fullName.includes("Service") || fullName.includes("Repository")) {
          return true;
        }
        if (fnKey && fnKey.startsWith("_")) {
          return false;
        }
        return false;
      },
    });

    const userService = { getUser() { return 1; } };
    const helperUtil = { format() { return "x"; } };
    Tracer.observe(userService, "UserService");
    Tracer.observe(helperUtil, "HelperUtil");
    Tracer.traceCalls((event) => events.push(`${event.fullName}:${event.place}`));

    userService.getUser();
    helperUtil.format();

    expect(events).toEqual([
      "UserService.getUser:before",
      "UserService.getUser:after",
    ]);
  });

  test("async example: async slice with delay helper is executable", async () => {
    const sliceName = nextName("asyncFlow");
    const calls = [];
    const processAsync = Tracer.createProxyFn(async (data) => {
      await delay(5);
      return { ...data, step1: true, step2: true };
    }, "AsyncProcessor.process");

    Tracer.defineSlice(sliceName, {
      predicate: (event) => event.fullName.endsWith("AsyncProcessor.process"),
      beforeCall: () => true,
      afterCall: () => false,
      initial: false,
    });
    Tracer.traceBySlice(sliceName, (event) => {
      if (event.place === "before") {
        calls.push(event.fullName);
      }
    });
    Tracer.enableSlice(sliceName);

    const result = await processAsync({ id: 1 });

    expect(result).toMatchObject({ id: 1, step1: true, step2: true });
    expect(calls.some((name) => name.endsWith("AsyncProcessor.process"))).toBe(true);
  });
});
