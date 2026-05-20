# tracer

Библиотека трассировки вызовов функций, чтения/записи свойств и слайс-сценариев.

## Что важно сейчас

- По умолчанию свойства **не оборачиваются автоматически** при `observe(...)`.
- Ручные вотчеры свойств (`observeProperty`, `observeAllProperties`, `observePropertyObject`) работают глобально.
- Сбор внутри слайса работает отдельно через `traceBySlice(...)` и отчеты `ReportSlice*`.
- Профиль по умолчанию: `balanced` (минимальная нагрузка, свойства не включены глобально).

## Быстрый старт

```js
const { Tracer } = require("./dist/tracer.cjs.js");

Tracer.setTraceProfile("balanced");
Tracer.traceCalls((event) => {
  console.log(event.fullName, event.place);
});

const sum = Tracer.createProxyFn((a, b) => a + b, "sum");
sum(1, 2);
```

## API наблюдения

### Функции и методы

- `Tracer.createProxyFn(fn, name)`
- `Tracer.observe(target, targetName?)`
- `Tracer.observePrototype(classCtor, className?)`
- `Tracer.observeAll(listOrMap)`
- `Tracer.observePrototypeAll(listOrMap)`
- `Tracer.observeConstructor(classCtor, className?)`

### Свойства (ручной режим)

- `Tracer.observeProperty(target, propName, className?)`
- `Tracer.observeAllProperties(target, className?)`
- `Tracer.observePropertyObject(target, propName, classNameOrOptions?, options?)`

`observePropertyObject` работает в гибридном режиме:
- безопасный shallow-режим без `Proxy` по умолчанию;
- `Proxy` включается явно (`useProxy: true`) и только для подходящих plain-object.

## Подписки

- `traceAll(callback)`
- `traceCalls(callback)`
- `traceProperties(callback)`
- `traceAllBatched(callback, options)`
- `traceCallsBatched(callback, options)`
- `tracePropertiesBatched(callback, options)`
- `untraceAll()`
- `untraceCalls()`
- `untraceProperties()`

Опции batch-подписок:

```js
{
  maxBatchSize: 100,
  flushIntervalMs: 16,
  bufferSize: 2000
}
```

## Профили и фильтры

```js
Tracer.setTraceProfile("minimal"); // minimal | balanced | full

Tracer.configureTracing({
  noisyCalls: ["CEditorPage.onTimerScroll"],
  noisyProperties: ["CEditorPage.temp"],
  callFilter: ({ fullName }) => !fullName.includes("debug"),
  propertyFilter: ({ fullName }) => fullName.includes("zoom"),
});
```

## Слайсы и сценарии

Основное API:

- `defineSlice`
- `enableSlice`
- `disableSlice`
- `traceBySlice`
- `traceBySliceOnce`
- `traceBySliceSequence`
- `untraceBySlice`
- `defineSliceByCall`
- `defineSliceByFunction`
- `defineSliceByFunctionName`

Передача сценариев между разработчиками:

- `exportSliceScenarios`
- `importSliceScenarios`

## Отчеты

`Tracer.reports` содержит:

- `ReportSimple`
- `ReportUsage`
- `ReportTreeView`
- `ReportSliceDiff`
- `ReportSliceUsage`

`ReportSliceUsage` собирает классы/методы/property get/set только внутри активного слайса и умеет строить diff между прогонами.

## Скрипты

```bash
npm run build
npm test
npm run test:coverage
npm run perf:guard
npm run perf:baseline
npm run profile:check
npm run errors:scan -- path/to/runtime.log
```

## Документация

- [docs/readme.md](./docs/readme.md)
- [docs/context.md](./docs/context.md)
- [docs/reports.md](./docs/reports.md)
- [Test-plan-1.md](./Test-plan-1.md)
