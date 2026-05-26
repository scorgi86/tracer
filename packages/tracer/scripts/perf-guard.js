const { Tracer } = require("../dist/tracer.umd.js");
const fs = require("node:fs");
const path = require("node:path");

const ITER = Number(process.env.TRACER_PERF_ITER || 300000);
const BASELINE_FILE = path.resolve(process.cwd(), ".perf-baseline.json");

const bench = (name, fn) => {
  const t0 = process.hrtime.bigint();
  const value = fn();
  const t1 = process.hrtime.bigint();
  return {
    name,
    ms: Number(t1 - t0) / 1e6,
    value,
  };
};

const reset = () => {
  Tracer.untraceAll();
  Tracer.untraceCalls();
  Tracer.untraceProperties();
};

const runCalls = (profile) => {
  reset();
  Tracer.setTraceProfile(profile);
  const fn = Tracer.createProxyFn((x) => x + 1, "perfHotCall");
  return bench(`calls_${profile}`, () => {
    let acc = 0;
    for (let i = 0; i < ITER; i += 1) {
      acc += fn(i);
    }
    return acc;
  });
};

const runProps = (profile) => {
  reset();
  Tracer.setTraceProfile(profile);
  const target = { value: 1 };
  Tracer.observeProperty(target, "value", "PerfCounter");
  return bench(`props_${profile}`, () => {
    let acc = 0;
    for (let i = 0; i < ITER; i += 1) {
      acc += target.value;
      target.value = i;
    }
    return acc;
  });
};

const toMap = (items) => {
  const map = Object.create(null);
  items.forEach((item) => {
    map[item.name] = item.ms;
  });
  return map;
};

const readBaseline = () => {
  if (!fs.existsSync(BASELINE_FILE)) {
    return null;
  }
  try {
    return JSON.parse(fs.readFileSync(BASELINE_FILE, "utf8"));
  } catch {
    return null;
  }
};

const computeDelta = (current, baseline) => {
  if (!baseline || !baseline.results) {
    return null;
  }

  const currentMap = toMap(current.results);
  const baselineMap = toMap(baseline.results);
  const delta = [];

  Object.keys(currentMap).forEach((name) => {
    if (typeof baselineMap[name] !== "number") {
      return;
    }
    const prev = baselineMap[name];
    const next = currentMap[name];
    delta.push({
      name,
      prevMs: prev,
      nextMs: next,
      diffMs: next - prev,
      diffPct: prev === 0 ? 0 : ((next - prev) / prev) * 100,
    });
  });

  return delta;
};

const writeBaseline = (payload) => {
  fs.writeFileSync(BASELINE_FILE, JSON.stringify(payload, null, 2), "utf8");
};

const profiles = ["minimal", "balanced", "full"];
const results = [];

profiles.forEach((profile) => {
  results.push(runCalls(profile));
  results.push(runProps(profile));
});

const payload = {
  generatedAt: new Date().toISOString(),
  iter: ITER,
  results,
};

const baseline = readBaseline();
const delta = computeDelta(payload, baseline);

console.log(JSON.stringify({ ...payload, delta }, null, 2));

if (process.argv.includes("--write-baseline")) {
  writeBaseline(payload);
  console.log(`Baseline saved to ${BASELINE_FILE}`);
}

