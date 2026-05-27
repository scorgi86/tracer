---
title: "Context"
layout: default
---

# Context

## Project scope

`tracer` is a runtime tracing library for large JS codebases and editors.  
Primary goals:

- track function/method calls with low overhead;
- track property read/write only when explicitly enabled;
- support scenario-based diagnostics (slices);
- keep production stability as a first priority.

## Runtime strategy

The runtime is designed for stability-first integration in complex environments.

### Core principles

1. No automatic property wrapping in `observe(...)`.
2. Property watchers are opt-in and explicit.
3. Hybrid object strategy:
- no `Proxy` by default for object-property observation;
- `Proxy` only for explicit, safe, plain-object cases.
4. Non-full profiles suppress noisy paths to reduce overhead.

## Core API layers

### Instrumentation

- `observe`, `observePrototype`, `observeAll`, `observePrototypeAll`
- `createProxyFn`, `observeConstructor`
- `observeProperty`, `observeAllProperties`, `observePropertyObject`

### Subscriptions

- `traceCalls`, `traceProperties`, `traceAll`
- batched variants: `trace*Batched`
- cleanup: `untraceCalls`, `untraceProperties`, `untraceAll`

### Slice diagnostics

- define/enable/disable slice
- `traceBySlice*` flow for scenario windows
- reports focused on slice-contained events

## Profiles

- `minimal`: production-safe baseline with lowest tracing overhead.
- `balanced`: default profile, behavior close to `minimal`.
- `full`: diagnostics mode (calls + properties + context).

## Event model

- Global stream:
  - function/method call traces
  - manually configured property watchers
- Slice-scoped stream:
  - subset of traces active only in slice window
  - usage accounting for classes/methods/properties only inside slice

## Integration context (large codebase)

Typical integration pattern for 1M+ LOC projects:

1. Build-time injector plugin inserts `Tracer.observe(...)` / `Tracer.observeProperty(...)` into selected targets.
2. Runtime `tracer` handles subscriptions, filters, batching, and reports.
3. Cache + invalidation on build side reduce reinstrumentation cost.
4. Runtime profile (`minimal`/`balanced`) keeps overhead acceptable in daily runs.

## Behavior contract (must stay stable)

1. `observe(...)` and `observePrototype(...)` do not auto-wrap arbitrary object properties.
2. Manual property watchers stay active globally, regardless of active slices.
3. Slice reports (`ReportSliceDiff`, `ReportSliceUsage`) aggregate only slice-contained events.
4. Slice lifecycle is controlled by start/end predicates and can be exported/imported across teams.
