# Project Context

## Goal

`webpack-tracer-plugin` is a webpack development plugin that injects tracing code into selected classes and functions during build.

Primary use case:

- trace constructor-created instance methods
- trace prototype methods
- add module-level tracing hooks without manual edits in real project sources

The plugin is used to instrument large legacy JavaScript codebases such as `sdkjs`, where direct source edits are undesirable.

## Stable Public API

Current hook API:

- `generateCode.onConstructor(ctx)`
- `generateCode.onAfterLastPrototypeAssign(ctx)`
- `generateCode.onBeforeEndModule(ctx)`

Current `targets` API:

- `Set<string>`
- `Array<string>`
- `function`

Current working `targets` pattern used in `sdkjs`:

- function-based matcher for names like `/^C[A-Z].*/`

Compatibility with older hook names is not a goal anymore.

## What The Plugin Injects

Typical generated runtime calls:

- `Tracer.observe(this, className)`
- `Tracer.observeProperty(this, methodName, className)`
- `Tracer.observePrototype(TargetClass, className)`

The plugin also injects a lightweight `Tracer` facade/queue block before runtime becomes available, so early injected calls do not crash and can be replayed later.

## High-Level Architecture

Entry points:

- `src/index.js`
- `src/UniversalCodeInjectorPlugin.js`
- `src/SWCInjectLoaderWebpack.js`
- `src/SWCInjectLoader.js`

Refactored tracer pipeline:

- `src/tracer/normalizeOptions.js`
- `src/tracer/hookContexts.js`
- `src/tracer/buildTargetWrappingPlan.js`
- `src/tracer/buildWrappingActions.js`
- `src/tracer/wrappingActionsApplier.js`
- `src/tracer/createNodeInjectors.js`

Responsibility split:

- `SWCInjectLoaderWebpack`:
  - normalizes options
  - builds loader cache key
  - reuses loader instances
- `SWCInjectLoader`:
  - parses source
  - resolves targets
  - coordinates AST transformation
  - returns transformed code
- `buildTargetWrappingPlan`:
  - detects constructor body, instance-assigned methods, prototype assignments
- `buildWrappingActions`:
  - converts wrapping model into explicit actions
  - dedupes repeated actions
- `wrappingActionsApplier`:
  - inserts constructor, instance, and prototype observer statements
  - dedupes preexisting observer calls
- `createNodeInjectors`:
  - thin orchestration layer over plan -> actions -> apply

## Current Runtime Semantics

For matching class/function targets:

- `onConstructor` runs inside constructor/function body
- `hasInstanceMethodsOnThis` becomes `true` when top-level assignments like `this.foo = function() {}` are found
- instance-assigned methods can be wrapped with `Tracer.observeProperty(this, methodName, className)`
- prototype assignments like `CEditorPage.prototype.finish = function() {}` can be wrapped after the assignment
- `onBeforeEndModule` works both:
  - for normal module body
  - for files wrapped in top-level IIFE

Current module hook semantics:

- one hook name: `onBeforeEndModule`
- placement depends on file shape
- caller receives `hasIIFE` to distinguish the case

## Current State Of The Refactor

The main structural refactor is effectively complete.

What has already been achieved:

- legacy generate/inject flow was decomposed into smaller stages
- hook naming was simplified to the current 3-hook API
- `targets` as function works without `debug`/`allowTargetsCallbackInDebug` dependency
- action-level dedup was added
- injection-level dedup was added
- fixture-backed behavior from real project patterns was preserved

Out of scope by current agreement:

- watcher lifecycle redesign
- tracer runtime redesign
- facade/bootstrap protocol redesign

## Real Project Usage

Main integration target:

- `C:\work\R7\main\projects\sdkjs\webpack.config.js`

That config currently demonstrates:

- direct plugin connection through `UniversalCodeInjectorPlugin`
- function-based `targets`
- constructor hook usage
- prototype hook usage
- module hook usage
- webpack filesystem cache enabled explicitly

## Test Baseline

Permanent fixtures extracted from real project patterns live under:

- `test/webpack-tracer-plugin/fixtures`

Important scenarios covered:

- HtmlPage-style constructor tracing
- HtmlPage-style instance method detection
- Format-style prototype tracing
- module hook with IIFE
- module hook without IIFE
- `targets` as function
- wrapping action dedup
- applier dedup

Key test files:

- `swc-hooks.test.js`
- `swc-module-hooks.test.js`
- `swc-loader-webpack-options.test.js`
- `swc-cache.test.js`
- `swc-wrapping-plan.test.js`
- `swc-wrapping-actions.test.js`
- `swc-wrapping-actions-applier.test.js`
- `webpack-tracer-plugin.test.js`

Baseline acceptance rule:

- `npm run test:plugin` must stay green after every behavior change or refactor step

Last verified status during this thread:

- `9` suites passed
- `57` tests passed

## Constraints And Risks

- webpack rule is currently JS-focused
- large codebases require narrow `targets` for acceptable AST cost
- watcher behavior was intentionally not reworked in this refactor
- tracer runtime availability still depends on injected facade/bootstrap order
- docs historically lagged the code, so `readme.md` and this file should be kept in sync when API changes

## Source Of Truth

Use these documents together:

- `readme.md`:
  - user-facing setup and usage
- `docs/refactor-contract.md`:
  - stable behavior and refactor boundaries
- `docs/context.md`:
  - current architecture, semantics, and project state
