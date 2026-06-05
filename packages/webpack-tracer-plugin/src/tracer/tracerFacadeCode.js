module.exports = function getTracerFacadeCode() {
    return `
(() => {
  const g = typeof globalThis !== "undefined"
    ? globalThis
    : (typeof window !== "undefined" ? window : undefined);
  if (!g) return;

  if (g.Tracer && g.Tracer.__isTracerFacade !== true) {
    return;
  }

  const pendingKey = "__WEBPACK_TRACER_PENDING_CALLS__";
  g[pendingKey] = Array.isArray(g[pendingKey]) ? g[pendingKey] : [];

  if (g.Tracer && g.Tracer.__isTracerFacade === true) {
    return;
  }

  const facade = new Proxy({ __isTracerFacade: true }, {
    get(target, prop) {
      if (prop === "__isTracerFacade") return true;
      return function(...args) {
        const runtime = g.__WEBPACK_TRACER_RUNTIME_INSTANCE__;
        const tracer = runtime && runtime.__isTracerFacade !== true ? runtime : null;
        if (tracer && typeof tracer[prop] === "function") {
          return tracer[prop](...args);
        }
        g[pendingKey].push([prop, args]);
        return undefined;
      };
    },
  });

  g.Tracer = facade;
  if (typeof window !== "undefined") {
    window.Tracer = facade;
  }
})();
    `.trim();
};
