# tracer-perf

## Purpose
Quickly measure tracer runtime overhead and track regressions.

## Runbook
1. Build tracer:
```bash
npm run build
```
2. Run performance guard:
```bash
npm run perf:guard
```
3. Save baseline after approved optimization:
```bash
npm run perf:baseline
```
4. Compare output `delta` and investigate the slowest items first.

## Notes
- Uses `scripts/perf-guard.js`.
- Default iteration count can be overridden by `TRACER_PERF_ITER`.

