# release-checklist

## Purpose
Provide a minimal release gate for tracer runtime safety and performance.

## Checklist
1. Build:
```bash
npm run build
```
2. Tests:
```bash
npm test
```
3. Runtime profile safety:
```bash
npm run profile:check
```
4. Performance snapshot:
```bash
npm run perf:guard
```
5. Optional error scan from collected runtime logs:
```bash
npm run errors:scan -- path/to/runtime.log
```

## Exit criteria
- Tests are green.
- No forced `full` profile in runtime sources.
- No major perf regression in `delta` vs baseline.

