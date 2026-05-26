# Project Context

## Goal

`webpack-tracer-plugin` is a development plugin for webpack that injects tracing code into application source files during build.

Primary use case:
- add tracer hooks (for example, `Tracer.observeProperty(...)` / `Tracer.observeAllProperties(...)`) into selected classes and functions without manual source edits.

## Architecture

- Entry exports: `src/index.js`
- Main webpack plugin: `src/UniversalCodeInjectorPlugin.js`
- Webpack loader bridge: `src/SWCInjectLoaderWebpack.js`
- AST transformation engine: `src/SWCInjectLoader.js`
- Code generation helpers: `src/TracerCodeGenerator.js`

## Current Tracer Integration

- Tracer implementation was rewritten in another project.
- Actual tracer path used for alignment:
  - `C:\work\R7\main\tracer\src\tracer.js`
- Plugin-side code generation is aligned to tracer methods such as:
  - `Tracer.observeProperty(target, propName, className)`
  - `Tracer.observeAllProperties(target, className)`
  - `Tracer.observePrototype(target, className)`

## Important Runtime Behavior

- `UniversalCodeInjectorPlugin` can auto-enable webpack filesystem cache when cache is not configured explicitly.
- `SWCInjectLoaderWebpack` reuses loader instances by normalized options.
- `SWCInjectLoader` uses:
  - content+options cache key,
  - target-name pre-scan regex,
  - observer statements memoization.
- On loader errors:
  - `fallbackOnError: false` -> fail build,
  - `fallbackOnError: true` -> return original source.

## Known Constraints

- Webpack rule in current plugin wiring targets `/\.js$/` files.
- For large codebases, keep `targets` narrow to reduce AST work.
- Generated code is controlled by `injectLoaderOpts.generateCode.construct`.

## Tests and Current Status

- Test command: `npx jest --runInBand`
- Last verified status in this workspace: `2 passed, 2 total`.

## Documentation

- User-facing guide is maintained in:
  - `readme.md`
- It includes:
  - setup and connection,
  - usage examples,
  - edge cases,
  - plugin workflow diagram.
