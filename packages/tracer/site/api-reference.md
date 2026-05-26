---
title: "Tracer API Reference"
layout: default
---

# Tracer API Reference

Каноничный справочник по публичному API `Tracer` и `Reports`.

Источник: `src/tracer.js`, `src/reports/index.js`, `src/index.js`.

## 1. Export Surface

```js
const { Tracer, Reports } = require("tracer");
```

- `Tracer`: основной статический API трассировки
- `Reports`: `ReportUsage`, `ReportTreeView`, `ReportSimple`, `ReportSliceDiff`, `ReportSliceUsage`

## 2. Event Model

Базовые поля события:

- `eventType`: `functionCall | propertyGet | propertySet`
- `place`: `before | after` (для `functionCall`)
- `fullName`, `className`, `fnKey`, `propName`
- `args`, `value`, `curValue`, `durationMs`, `error`, `callId`, `parentCallId`

## 3. Configuration

### `Tracer.configure(options = {})`
- Назначение: общая конфигурация (например, `asyncContext`)
- Возврат: `void`

### `Tracer.setTraceProfile(profileName = "balanced", overrides = {})`
- Назначение: профиль трассировки `minimal | balanced | full`
- Возврат: `void`

### `Tracer.configureTracing(options = {})`
- Назначение: тонкая настройка фильтров/шумоподавления
- Ключевые поля:
  - `enableCalls`, `enableProperties`, `suppressNoisy`
  - `noisyCalls`, `noisyProperties`
  - `callFilter({ fullName, className, fnKey })`
  - `propertyFilter({ phase, propName, className, fullName })`
  - `captureContext`
- Возврат: `void`

### `Tracer.getTraceConfig()`
- Назначение: получить текущую конфигурацию
- Возврат: `object`

## 4. Observers

### `Tracer.createProxyFn(targetFn, eventName)`
- Назначение: обернуть функцию в трассировку
- Возврат: `Function`

### `Tracer.observeConstructor(originalConstructor, className?)`
- Назначение: обернуть конструктор класса
- Возврат: `Function` (обернутый конструктор)

### `Tracer.observeProperty(target, propName, className?)`
- Назначение: наблюдение за одним свойством
- Возврат: `void`

### `Tracer.observePropertyObject(target, propName, classNameOrOptions?, options?)`
- Назначение: наблюдение объекта/вложенного дерева свойств
- Возврат: `object` (target/proxy в зависимости от режима)

### `Tracer.observeAllProperties(target, className?)`
- Назначение: подписать все собственные нефункциональные свойства
- Возврат: `void`

### `Tracer.observe(target, targetName?)`
- Назначение: обернуть методы объекта
- Возврат: `object`

### `Tracer.observePrototype(target, className?)`
- Назначение: обернуть методы прототипа
- Возврат: `Function|object`

### `Tracer.observeAll(targetList)`
- Назначение: массовая обертка объектов
- Возврат: `void`

### `Tracer.observePrototypeAll(targetList)`
- Назначение: массовая обертка прототипов
- Возврат: `void`

### `Tracer.observeFromExports(exportTarget)`
### `Tracer.observePrototypesFromExports(exportTarget)`
- Назначение: обертка модулей/экспортов
- Возврат: `void`

## 5. Slices

### `Tracer.defineSlice(streamSliceName, config)`
- Назначение: зарегистрировать слайс
- `config`: `predicate`, `beforeCall`, `afterCall`, `initial`, `description`
- Возврат: `void`

### `Tracer.enableSlice(streamSliceName)`
### `Tracer.disableSlice(streamSliceName)`
### `Tracer.disableSliceListeners(streamSliceName)`
- Назначение: управление состоянием/слушателями слайса
- Возврат: `void`

### `Tracer.traceBySlice(sliceName, callback)`
### `Tracer.traceBySliceOnce(sliceName, callback)`
### `Tracer.traceBySliceSequence(sliceSeq, callback)`
- Назначение: подписка на события в слайсах
- Возврат: `void`

### `Tracer.untraceBySlice(sliceName, callback?)`
- Назначение: отписка от слайса
- Возврат: `void`

### `Tracer.getEnabledSlices()`
### `Tracer.getRegisteredSlices()`
- Возврат: `string[]`

### `Tracer.defineSliceByCall(sliceName, target, targetFnName, predicate?)`
### `Tracer.defineSliceByFunctionName(sliceName, fnName)`
- Назначение: вспомогательные способы определения слайсов
- Возврат: зависит от метода (обычно `Function`/`void`)

## 6. Subscriptions

### `Tracer.traceAll(callback)`
### `Tracer.traceCalls(callback)`
### `Tracer.traceProperties(callback)`
### `Tracer.traceProperty(propSelector, callback)`
- Назначение: обычные подписки
- Возврат: `void`

### `Tracer.traceAllBatched(callback, options = {})`
### `Tracer.traceCallsBatched(callback, options = {})`
### `Tracer.tracePropertiesBatched(callback, options = {})`
- Назначение: батч-подписки
- `options`: `maxBatchSize`, `flushIntervalMs`, `bufferSize`
- Возврат: `void`

### `Tracer.untraceAll()`
### `Tracer.untraceCalls()`
### `Tracer.untraceProperties()`
- Назначение: глобальная очистка подписок
- Возврат: `void`

## 7. Debug / Utilities

### `Tracer.debugOn(eventName, conditionCallback)`
### `Tracer.debugOnceOn(eventName, conditionCallback)`
- Назначение: условные точки останова
- Возврат: `void`

### `Tracer.logSlice(sliceSelector, ...values)`
### `Tracer.invokeOnSlice(sliceName, fn)`
- Назначение: утилиты для работы со слайсом
- Возврат: `void`

`traceProperty(propSelector, callback)`:
- `propSelector: string` - точное имя свойства
- `propSelector: string[]` - одно из перечисленных имен
- `propSelector: (event) => boolean` - пользовательский предикат

`logSlice(sliceSelector, ...values)`:
- `sliceSelector: string` - лог, если активен указанный слайс
- `sliceSelector: string[]` - лог, если активны все слайсы из массива
- `sliceSelector: (args) => boolean` - лог, если предикат вернул `true`

### `Tracer.getCurrentContext()`
- Назначение: получить текущий async-контекст
- Возврат: `object|null`

### `Tracer.exportSliceScenarios(options = {})`
### `Tracer.importSliceScenarios(payload, options = {})`
- Назначение: экспорт/импорт сценариев слайсов
- Возврат: `object|void`

### `Tracer.isX2tEnvironment()`
- Назначение: env-check для специфичного окружения
- Возврат: `boolean`

## 8. Reports API

### `new Reports.ReportUsage({ logProvider })`
- Методы: `log({ className, fnKey })`, `print()`

### `new Reports.ReportTreeView()`
- Методы: `log(event, serializedValues?)`, `getResults()`

### `new Reports.ReportSimple({ logProvider })`
- Методы: `log({ className, fnKey })`

### `new Reports.ReportSliceDiff({...})`
- Методы:
  - `start()`, `stop()`, `clear()`
  - `log(event)`
  - `getCalls()`, `getDiffs()`
  - `getSourceFunctionsText(options?)`

### `new Reports.ReportSliceUsage({...})`
- Методы:
  - `start()`, `stop()`, `clear()`
  - `getRuns()`, `getLastRun()`
  - `getDiff(prevRunIndex, nextRunIndex)`
  - `getAdjacentDiffs()`

## 9. Minimal Verified Snippets

Проверяемые тестами примеры:

- [__tests__/docs-examples.test.js](../__tests__/docs-examples.test.js)
- [__tests__/tracer-regression-critical.test.js](../__tests__/tracer-regression-critical.test.js)
