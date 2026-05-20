# Reports

## Available reports

Reports are exposed via `Tracer.reports`.

## ReportSimple

Collects a flat list of visited `className.fnKey`.

## ReportUsage

Collects class -> method usage map over incoming events.

## ReportTreeView

Builds a call/property tree-like textual representation.

## ReportSliceDiff

Creates a slice using predicates and computes diffs between sequential calls.

### Typical use

```js
const report = new Tracer.reports.ReportSliceDiff({
  tracer: Tracer,
  sliceName: "my-slice",
  startPredicate: (e) => e.fnKey === "start",
  endPredicate: (e) => e.fnKey === "end",
}).start();
```

Capabilities:

- start/end boundaries by predicates;
- tracking only selected events (`shouldTrack`);
- per-call diff (`getDiffs()`);
- source-export helper for predicates/filters: `getSourceFunctionsText()`.

## ReportSliceUsage

Collects usage only while target slice is active.

Tracks per run:
- classes
- methods
- property gets
- property sets
- event count

Supports:
- `getRuns()`
- `getLastRun()`
- `getDiff(prevIndex, nextIndex)`
- `getAdjacentDiffs()`

### Example

```js
const usage = new Tracer.reports.ReportSliceUsage({
  tracer: Tracer,
  sliceName: "editor-zoom-slice",
  startPredicate: (e) => e.fnKey === "start",
  endPredicate: (e) => e.fnKey === "end",
}).start();
```

### Important behavior

- Manual property watchers stay global.
- `ReportSliceUsage` still records only events inside the active slice window.
- Run-to-run diffs are available via `getDiff(...)` and `getAdjacentDiffs()`.
