# Context

## Runtime strategy

The current tracer runtime is optimized for stability-first integration in complex editor environments.

### Default principles

1. No automatic property wrapping in `observe(...)`.
2. Property watchers are opt-in and explicit.
3. Hybrid object strategy:
- no proxy by default for property object observation;
- proxy only for explicit and safe plain-object cases.
4. Non-full profiles suppress noisy paths and reduce overhead.

## Profiles

- `minimal`: production-safe baseline with lowest tracing overhead.
- `balanced`: default profile, same behavior as minimal.
- `full`: diagnostics mode (calls + properties + context).

## Event streams

- Global stream:
  - call traces
  - explicitly configured property watchers (manual)
- Slice-scoped stream:
  - trace subset active only between slice start/end conditions
  - usage collection for classes/methods/properties only inside active window

## Why this split matters

- Global stream keeps explicit watchers reliable.
- Slice-scoped stream allows targeted diagnostics and run-level comparisons.
- Combined model reduces regressions while keeping useful observability.

## Current behavior contract

1. `observe(...)` and `observePrototype(...)` do not auto-wrap arbitrary object properties.
2. Manual property watchers stay active globally, regardless of active slices.
3. Slice reports (`ReportSliceDiff`, `ReportSliceUsage`) aggregate only slice-contained events.
4. Slice lifecycle is controlled by start/end predicates and can be exported/imported across teams.
