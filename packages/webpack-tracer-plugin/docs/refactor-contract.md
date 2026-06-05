# Webpack Tracer Plugin Refactor Contract

## Purpose

This document fixes the behavior that must stay stable during the upcoming refactor of `webpack-tracer-plugin`.

The refactor goal is internal structure improvement only: smaller modules, clearer responsibilities, easier debugging, and safer maintenance.

## Stable Public Contract

The following API is considered stable and must not change during the refactor:

- `generateCode.onConstructor(ctx)`
- `generateCode.onAfterLastPrototypeAssign(ctx)`
- `generateCode.onBeforeEndModule(ctx)`
- `targets` supports `Set`, `Array`, and `function`
- runtime facade / bootstrap behavior remains compatible with the current implementation
- watch/cache behavior remains compatible with the current implementation unless explicitly changed in a separate task

## Required Runtime Behavior

The following scenarios are mandatory and must keep working after every refactor step:

- HtmlPage-style constructor tracing works
- HtmlPage-style instance-method detection works and sets `hasInstanceMethodsOnThis = true`
- Format-style prototype tracing works
- `onBeforeEndModule` works for modules with top-level IIFE
- `onBeforeEndModule` works for modules without IIFE
- `targets` as function works without `debug` dependency

## Executable Baseline

These requirements are backed by permanent fixtures and tests in `test/webpack-tracer-plugin`.

Fixture-backed scenarios:

- `fixtures/htmlpage-constructor.js`
- `fixtures/htmlpage-instance-method.js`
- `fixtures/format-prototype-flow.js`
- `fixtures/module-no-iife.js`
- `fixtures/module-with-iife.js`
- `fixtures/function-targets.js`

Tests covering the baseline:

- `swc-hooks.test.js`
- `swc-module-hooks.test.js`
- `swc-loader-webpack-options.test.js`
- `swc-cache.test.js`
- `webpack-tracer-plugin.test.js`

Baseline acceptance rule:

- `npm run test:plugin` stays green after every refactor step

## Out Of Scope

The following changes are out of scope for the refactor unless explicitly requested in a separate task:

- redesign of tracer runtime
- redesign of facade/bootstrap protocol
- semantic changes to hook names
- semantic changes to `targets` matching rules
- cache policy redesign
- watch lifecycle redesign

## Refactor Stage 1 Boundary

The first safe extraction stage may move code into separate modules, but must not change behavior.

Recommended first extractions:

- options normalization
- options hash builder
- hook statement builder
- tracer facade code provider

Stage 1 must not change:

- generated output semantics
- hook invocation timing
- target matching behavior
- module hook placement behavior

Stage 1 exit criteria:

- all plugin tests pass
- fixture-backed scenarios still pass
- no runtime regression in the established baseline scenarios

## Refactor Stage 2 Boundary

The second stage may extract AST scanning and injection planning.

Recommended extractions:

- AST scanner
- injection plan builder
- AST writer / applier

Stage 2 must not change:

- resulting injected behavior
- target selection
- constructor/prototype/module insertion semantics

Stage 2 exit criteria:

- all plugin tests pass
- scan result and injection plan can be inspected in debug mode if needed
- fixture-backed scenarios still behave the same

## Definition Of Success

The refactor is considered successful when:

- the loader code is structurally simpler
- the stable contract above is preserved
- fixture-backed behavior remains unchanged
- failures become easier to explain through isolated scanner / planner / writer responsibilities

## Remaining Roadmap

### Step 1: Injection-Level Dedup

Goal:

- avoid inserting duplicate observer calls when equivalent wrapping actions or preexisting observer calls already target the same symbol

Definition of Done:

- repeated `observeProperty(...)` insertions for the same class/method are skipped
- repeated `observePrototype(...)` insertions for the same class are skipped
- plugin tests cover dedup behavior directly
- `npm run test:plugin` stays green

### Step 2: Final Injector Cleanup

Goal:

- make `createNodeInjectors` a thin orchestration layer over model -> actions -> applier

Definition of Done:

- `createNodeInjectors` no longer owns low-level apply details
- constructor / instance / prototype paths use the same staged pipeline vocabulary
- each stage is independently testable
- `npm run test:plugin` stays green

### Step 3: Observer Strategy Review

Goal:

- decide whether some instance-tracing cases should keep `observeProperty(...)` or switch to `observeAllProperties(...)`

Definition of Done:

- desired runtime semantics are written down explicitly
- at least one fixture-backed test documents the chosen behavior
- no ambiguity remains about when per-property and all-properties observation should be used
