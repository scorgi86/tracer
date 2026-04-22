# editors-tracer-integration

## Purpose
Validate tracer behavior against editors integration scenarios and known error signatures.

## Runbook
1. Run integration-derived tests:
```bash
npm test -- __tests__/editors-tracer-derived.test.js
```
2. Run full test suite:
```bash
npm test
```
3. If you have browser/runtime logs, scan for known breakages:
```bash
npm run errors:scan -- path/to/runtime.log
```

## Focus checks
- Receiver binding and illegal invocation errors.
- Function replacement regressions (`... is not a function`).
- Slice behavior for timer/autosave/clipboard scenarios.

