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

  test("properties example: observeProperties + traceProperties tracks set value", () => {
    class Order {
      constructor() {
        this.status = "pending";
      }
    }

    const order = new Order();
    const events = [];
    Tracer.observeProperties(order, { name: "Order", properties: "status" });
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

  test("readme: background slice captures autosave flow only", () => {
    const sliceName = nextName("AutoSave");
    const calls = [];

    const documentService = {
      autosave() {
        this.writeSnapshot();
      },
      writeSnapshot() {
        return "saved";
      },
      checkOnly() {
        return false;
      },
    };

    Tracer.observe(documentService, "DocumentService");
    Tracer.defineSlice(sliceName, {
      predicate: ({ fullName }) => fullName === "DocumentService.autosave",
      beforeCall: () => true,
      afterCall: () => false,
    });

    Tracer.traceBySlice(sliceName, (event) => {
      if (event.place === "before") {
        calls.push(event.fullName);
      }
    });

    documentService.checkOnly();
    documentService.autosave();

    expect(calls).toEqual([
      "DocumentService.autosave",
      "DocumentService.writeSnapshot",
    ]);
  });

  test("readme: UserAction slice and logSlice stay scoped to active slice", () => {
    const sliceName = nextName("UserAction");
    const events = [];
    const logSpy = jest.spyOn(console, "log").mockImplementation(() => {});

    const jqueryEvent = {
      dispatch(event) {
        this.handleClick(event);
      },
      handleClick() {
        Tracer.logSlice(sliceName, "click scenario reached important step");
      },
    };

    Tracer.observe(jqueryEvent, "jQuery.event");
    Tracer.defineSlice(sliceName, {
      predicate: ({ fullName, args }) =>
        fullName === "jQuery.event.dispatch" &&
        typeof args?.[0] === "object" &&
        args[0]?.type === "click",
      beforeCall: () => true,
      afterCall: () => false,
    });
    logSpy.mockClear();

    Tracer.traceBySlice(sliceName, (event) => {
      if (event.place === "before") {
        events.push(event.fullName);
      }
    });

    jqueryEvent.dispatch({ type: "mousemove" });
    jqueryEvent.dispatch({ type: "click" });

    expect(events).toEqual([
      "jQuery.event.dispatch",
      "jQuery.event.handleClick",
    ]);
    expect(logSpy).toHaveBeenCalledTimes(1);
    expect(logSpy.mock.calls[0][0]).toContain(sliceName);
    expect(logSpy.mock.calls[0][0]).toContain("click scenario reached important step");

    logSpy.mockRestore();
  });

  test("readme: MessageFlow slice captures callback chain from event bus", () => {
    const sliceName = nextName("MessageFlow");
    const calls = [];

    const messageBus = {
      dispatch() {
        windowMessageHandler.onMessage();
      },
    };
    const windowMessageHandler = {
      onMessage() {
        return "handled";
      },
    };

    Tracer.observe(messageBus, "MessageBus");
    Tracer.observe(windowMessageHandler, "WindowMessageHandler");
    Tracer.defineSlice(sliceName, {
      predicate: ({ fullName }) =>
        fullName === "MessageBus.dispatch" ||
        fullName === "WindowMessageHandler.onMessage",
      beforeCall: () => true,
      afterCall: () => false,
    });

    Tracer.traceBySlice(sliceName, (event) => {
      if (event.place === "before") {
        calls.push(event.fullName);
      }
    });

    messageBus.dispatch();

    expect(calls).toEqual([
      "MessageBus.dispatch",
      "WindowMessageHandler.onMessage",
    ]);
  });

  test("readme: observeProperties tracks nested rgba assignment path", () => {
    const color = {
      rgba: {
        r: "",
        g: "",
        b: "",
        a: "",
      },
    };
    const propertyEvents = [];

    Tracer.observeProperties(color.rgba, {
      name: "Color",
      properties: "rgba",
      deep: true,
    });
    Tracer.traceProperties((event) => {
      if (event.fullName === "Color.rgba.r") {
        propertyEvents.push(event);
      }
    });

    color.rgba.r = "255";

    expect(propertyEvents).toHaveLength(1);
    expect(propertyEvents[0]).toMatchObject({
      eventType: "propertySet",
      fullName: "Color.rgba.r",
      propName: "rgba.r",
      curValue: "",
      value: "255",
    });
  });

  test("readme: target method example finds the relevant observed call", () => {
    class OrderService {
      calculateTotal(items) {
        return items.reduce((sum, item) => sum + item.price, 0);
      }
    }

    const calls = [];
    Tracer.traceCalls((event) => {
      if (event.fullName === "OrderService.calculateTotal") {
        calls.push(`${event.fullName}:${event.place}`);
      }
    });

    const service = Tracer.observe(new OrderService(), "OrderService");
    const total = service.calculateTotal([{ price: 100 }, { price: 250 }]);

    expect(total).toBe(350);
    expect(calls).toEqual([
      "OrderService.calculateTotal:before",
      "OrderService.calculateTotal:after",
    ]);
  });

  test("readme: callStack.trace can be called from a filtered tracer event", () => {
    const logSpy = jest.spyOn(console, "log").mockImplementation(() => {});
    const service = {
      checkout() {
        return this.calculateTotal([{ price: 100 }, { price: 250 }]);
      },
      calculateTotal(items) {
        return items.reduce((sum, item) => sum + item.price, 0);
      },
    };

    Tracer.observe(service, "OrderService");
    Tracer.traceCalls((event) => {
      if (
        event.place === "before" &&
        event.fullName === "OrderService.calculateTotal"
      ) {
        event.callStack.trace("OrderService.calculateTotal call path");
      }
    });

    service.checkout();

    expect(logSpy).toHaveBeenCalled();
    expect(logSpy.mock.calls.map((args) => args.join(" ")).join("\n")).toContain(
      "OrderService.calculateTotal call path",
    );

    logSpy.mockRestore();
  });

  test("readme: durationMs example collects the slowest observed calls", () => {
    const slowCalls = [];
    const service = {
      fast() {
        return "fast";
      },
      slow() {
        for (let index = 0; index < 50000; index += 1) {
          Math.sqrt(index);
        }
        return "slow";
      },
    };

    Tracer.observe(service, "PerfService");
    Tracer.traceCalls((event) => {
      if (event.place !== "after" || typeof event.durationMs !== "number") {
        return;
      }

      slowCalls.push({
        fullName: event.fullName,
        durationMs: event.durationMs,
        status: event.status,
      });
    });

    service.fast();
    service.slow();

    const topSlowCalls = slowCalls
      .sort((a, b) => b.durationMs - a.durationMs)
      .slice(0, 20);

    expect(topSlowCalls.map((call) => call.fullName)).toEqual(
      expect.arrayContaining(["PerfService.fast", "PerfService.slow"]),
    );
    expect(topSlowCalls.every((call) => typeof call.durationMs === "number")).toBe(true);
  });

  test("readme: TreeViewReport and UsageReport collect call tree and class usage", () => {
    const { ReportTreeView, ReportUsage } = Tracer.reports;
    const treeReport = new ReportTreeView();
    const usageLogs = [];
    const usageReport = new ReportUsage({
      logProvider: { log: (value) => usageLogs.push(value) },
    });
    const treeLogSpy = jest.spyOn(console, "log").mockImplementation(() => {});
    const service = {
      processOrder() {
        this.validate();
      },
      validate() {
        return true;
      },
    };

    Tracer.observe(service, "OrderService");
    Tracer.traceCalls((event) => {
      if (event.place === "before") {
        treeReport.log(event, JSON.stringify(event.args || []));
        usageReport.log({
          className: event.className,
          fnKey: event.fnKey,
        });
      } else {
        treeReport.log(event);
      }
    });

    service.processOrder();
    usageReport.print();

    expect(treeReport.getResults().join("\n")).toContain("OrderService.processOrder");
    expect(treeReport.getResults().join("\n")).toContain("OrderService.validate");
    expect(usageLogs.join("\n")).toContain("OrderService");
    expect(usageLogs.join("\n")).toContain("Class: OrderService.processOrder");
    expect(usageLogs.join("\n")).toContain("Class: OrderService.validate");

    treeLogSpy.mockRestore();
  });
});
