# Tracer.trace migration plan

## Decisions

- `Tracer.trace(callback, options?)` becomes the canonical subscription API.
- Existing `trace*` methods stay as compatibility wrappers without deprecation warnings for now.
- `Tracer.trace(...)` returns an unsubscribe function.
- Existing `trace*` methods keep their current return model and continue returning `Tracer`.
- `site/` is not updated by hand as part of this migration unless the docs policy changes.

## Current subscription architecture

- `Tracer.trace(...)` delegates to `services/subscriptions.js#traceSubscription`.
- `traceAll`, `traceCalls`, `traceProperties`, `traceProperty`, batched variants, and slice trace wrappers are compatibility methods.
- Legacy compatibility methods keep their old return value (`Tracer`) but internally use `traceSubscription`.
- Batched delivery, `once`, slice filtering, property filtering, and event type filtering share the same matcher path.
- Slice subscription tokens are still stored in each slice runtime so `untraceBySlice(...)` remains compatible.

## Target mapping

| Current API | Target implementation |
| --- | --- |
| `traceAll(callback)` | `trace(callback)` |
| `traceCalls(callback)` | `trace(callback, { eventTypes: "calls" })` |
| `traceProperties(callback)` | `trace(callback, { eventTypes: "properties" })` |
| `traceProperty(selector, callback)` | `trace(callback, { property: selector })` |
| `traceBySlice(sliceName, callback)` | `trace(callback, { slice: sliceName })` |
| `traceBySliceOnce(sliceName, callback)` | `trace(callback, { slice: sliceName, once: true })` |
| `traceBySliceSequence(sequence, callback)` | `trace(callback, { sliceSequence: sequence })` |
| `traceAllBatched(callback, options)` | `trace(callback, { batch: options })` |
| `traceCallsBatched(callback, options)` | `trace(callback, { eventTypes: "calls", batch: options })` |
| `tracePropertiesBatched(callback, options)` | `trace(callback, { eventTypes: "properties", batch: options })` |

## Target options

```js
Tracer.trace(callback, {
  eventTypes,
  slice,
  sliceSequence,
  fullName,
  className,
  fnKey,
  property,
  place,
  once,
  batch,
});
```

## Preparation DoD

- Compatibility policy is explicit.
- Return model is explicit.
- Old-to-new API mapping is explicit.
- Current subscription architecture is documented.
- Contract tests are listed before implementation starts.

## Implementation DoD

- Done: `Tracer.trace(callback)` behaves like `traceAll(callback)`.
- Done: `Tracer.trace(callback, { eventTypes: "calls" })` behaves like `traceCalls(callback)`.
- Done: `Tracer.trace(callback, { eventTypes: "properties" })` behaves like `traceProperties(callback)`.
- Done: `Tracer.trace(callback, { property })` behaves like `traceProperty(property, callback)`.
- Done: `Tracer.trace(callback, { slice })` behaves like `traceBySlice(slice, callback)`.
- Done: `Tracer.trace(callback, { slice, once: true })` behaves like `traceBySliceOnce(slice, callback)`.
- Done: `Tracer.trace(callback, { batch })` behaves like `traceAllBatched(callback, batch)`.
- Done: `Tracer.trace(...)` returns an unsubscribe function.
- Done: existing `trace*` methods remain wrappers without warnings.
- Done: existing `trace*` methods keep returning `Tracer`.
- Pending for future docs sweep: replace long-form guide examples with `Tracer.trace` where readability benefits.
