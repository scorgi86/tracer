---
title: "Tracer - Единая документация"
layout: default
---

# Tracer - Единая документация

Собрано автоматически из всех файлов `docs/*.md`.

## Оглавление по файлам

- [api-reference.md](#api-reference)
- [async.md](#async)
- [context.md](#context)
- [getting-started.md](#getting-started)
- [index.md](#index)
- [readme.md](#readme)
- [reports.md](#reports)
- [reports-guide.md](#reports-guide)
- [slices.md](#slices)
- [tracer-ai-guide.md](#tracer-ai-guide)
- [tracer-dev-guide.md](#tracer-dev-guide)

---

## api-reference

_Источник: [api-reference.md](./api-reference.md)_

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


---

## async

_Источник: [async.md](./async.md)_

# Tracer: Асинхронность

Этот раздел про трассировку цепочек `Promise` и `async/await`, когда важно понимать порядок и связь вызовов.

## 1. Базовая настройка

```javascript
Tracer.configure({ asyncContext: 'stack' });
Tracer.setTraceProfile('balanced');
```

`asyncContext: 'stack'` помогает сохранять связность событий между `await`-участками.

## 2. Минимальный пример

```javascript
async function loadOrder(orderId) {
  return { id: orderId, total: 120 };
}

async function processOrder(orderId) {
  const order = await loadOrder(orderId);
  return saveOrder(order);
}

async function saveOrder(order) {
  return { ...order, saved: true };
}

const tracedProcess = Tracer.createProxyFn(processOrder, 'OrderService.processOrder');

const stop = Tracer.traceCalls((event) => {
  console.log(event.type, event.fullName);
});

await tracedProcess('ORD-123');
stop?.();
```

## 3. Вложенные async-вызовы

Если `A()` вызывает `await B()`, а `B()` тоже трассируется, вы увидите вложенную последовательность:

```text
beforeCallMethod A
beforeCallMethod B
afterCallMethod B
afterCallMethod A
```

## 4. Обработка ошибок

```javascript
async function pay(order) {
  throw new Error('Payment provider timeout');
}

const tracedPay = Tracer.createProxyFn(pay, 'PaymentService.pay');

Tracer.traceCalls((event) => {
  if (event.type === 'errorCallMethod') {
    console.log('ERROR:', event.fullName);
  }
});

try {
  await tracedPay({ id: 'ORD-1' });
} catch (e) {
  // ожидаемо
}
```

## 5. Практика: как отлавливать рассыпавшийся порядок

1. Поставьте `balanced`.
2. Если сигнала мало, временно включите `full`.
3. Сузьте область через слайс.
4. Уберите шум через `noisyCalls` и `callFilter`.
5. Повторите прогон на одинаковых входных данных.

## 6. Частые проблемы

### События "теряются"
- Проверьте, что вызов идет через traced-обертку.
- Убедитесь, что подписка `traceCalls` активна во время сценария.

### Порядок выглядит нелогично
- Убедитесь, что сравниваете одинаковые прогоны.
- Временно уберите фильтры и шумоподавление.

### Слишком много async-шума
- Ограничьте `callFilter` на нужные классы.
- Используйте слайс под конкретный сценарий.

- [Слайсы](./slices.md)
- [Отчеты](./reports-guide.md)
- [Полная документация](./index.md)


---

## context

_Источник: [context.md](./context.md)_

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


---

## getting-started

_Источник: [getting-started.md](./getting-started.md)_

# Tracer: Быстрый старт

Этот гайд нужен, чтобы за 10-15 минут запустить трассировку в проекте и получить полезный сигнал, а не поток шума.

> Источник истины по API и деталям поведения: [docs/index.md](./index.md).

## 1. Установка

### Вариант A: из GitHub

```bash
npm i github:scorgi86/tracer
npm ls tracer
```

### Вариант B: локальная сборка из репозитория

```bash
git clone https://github.com/scorgi86/tracer.git
cd tracer
npm install
npm run build
```

## 2. Подключение

### ESM

```javascript
import { Tracer } from 'tracer';
```

### CommonJS

```javascript
const { Tracer } = require('tracer');
```

### Smoke-проверка

```javascript
const tracedProbe = Tracer.createProxyFn((a, b) => a + b, 'probe.sum');
Tracer.traceCalls((event) => console.log(event.type, event.fullName));
console.log(tracedProbe(1, 2)); // 3
```

Ожидаемо в логе:

```text
beforeCallMethod probe.sum
afterCallMethod probe.sum
```

## 3. Базовая рабочая конфигурация

```javascript
Tracer.setTraceProfile('balanced');
Tracer.configureTracing({
  noisyCalls: ['CEditorPage.onTimerScroll'],
  callFilter: ({ fullName }) => !fullName.includes('debug')
});
```

Почему так:
- `balanced` дает нормальный компромисс между деталями и нагрузкой.
- `noisyCalls` сразу убирает известные источники мусора.
- `callFilter` позволяет локально сузить фокус.

## 4. Первый реальный сценарий

```javascript
function calculateTotal(items) {
  return items.reduce((sum, item) => sum + item.price, 0);
}

const tracedCalculateTotal = Tracer.createProxyFn(calculateTotal, 'Cart.calculateTotal');

const stop = Tracer.traceCalls((event) => {
  console.log(`[${event.type}] ${event.fullName}`);
});

tracedCalculateTotal([{ price: 100 }, { price: 250 }]);
stop?.();
```

## 5. Частые проблемы

### Не вижу событий
- Убедитесь, что вызываете именно `tracedFn`, а не оригинальную функцию.
- Временно отключите фильтр `callFilter`.
- Временно поставьте `Tracer.setTraceProfile('full')`.

### Слишком много событий
- Добавьте `noisyCalls`.
- Ужесточите `callFilter` по `fullName`.
- Перейдите с `full` на `balanced`.

### Высокая нагрузка
- Используйте `minimal` или `balanced`.
- Трассируйте ограниченный участок кода (через слайсы).

## 6. Что делать дальше

- [Слайсы: фокус на сценарии](./slices.md)
- [Асинхронность: Promise/async-await](./async.md)
- [Отчеты: от логов к аналитике](./reports-guide.md)
- [Полная документация](./index.md)


---

## index

_Источник: [index.md](./index.md)_

# Tracer - Полная документация

## Версия 4.2 | Руководство по трассировке JavaScript-кода

---

## Старт за 15 минут

Этот блок для быстрого входа в Tracer в легаси-проекте без документации.

Для точных сигнатур/параметров API используй отдельный справочник: [API Reference](./api-reference.md).

### 0) Быстрый выбор сценария

| Симптом | Действие |
|---|---|
| Метод вызывается слишком часто | Выполните шаги 1 → 2 и добавьте счетчик вызовов из раздела 11.1 |
| Поле меняется “само” | Выполните шаги 1 → 2 и подключите `observeProperty` из раздела 11.4 |
| Нужен только один бизнес-флоу | Выполните шаги 1 → 3 → 4 |
| Потеря контекста в async | Выполните шаг 1 и включите `captureContext: true` (раздел 9.2) |
| Нужна аварийная остановка | Используйте `Tracer.debugOn(...)` (раздел 8.1) |

### 1) Включите безопасный профиль

Статус: копипаст.

```javascript
Tracer.setTraceProfile('balanced');
Tracer.configure({ asyncContext: 'stack' });
```

### 2) Оберните проблемный модуль

Статус: адаптировать `targetService`, `TargetService`.

```javascript
Tracer.observe(targetService, 'TargetService');
Tracer.traceCalls((event) => {
  if (event.place === 'before') {
    console.log(`→ ${event.fullName}`);
  }
});
```

### 3) Добавьте один слайс для сценария

Статус: адаптировать `incidentFlow`, `TargetService.run`.

```javascript
Tracer.defineSlice('incidentFlow', {
  predicate: (event) => event.fullName === 'TargetService.run',
  beforeCall: () => true,
  afterCall: () => false
});

Tracer.traceBySlice('incidentFlow', (event) => {
  console.log(`[incidentFlow] ${event.fullName}`);
});
```

### 4) Подавите шум

Статус: адаптировать `noisyCalls` под ваш проект.

```javascript
Tracer.configureTracing({
  suppressNoisy: true,
  noisyCalls: ['CEditorPage.onTimerScroll', 'PaintMessageLoop._animation']
});
```

### 5) Завершите сессию корректно

Статус: копипаст.

```javascript
Tracer.untraceAll();
Tracer.disableSliceListeners('incidentFlow');
```

---

## Оглавление

0. [Старт за 15 минут](#старт-за-15-минут)
1. [Термины и определения](#1-термины-и-определения)
2. [Введение](#2-введение)
3. [Структура событий трассировки](#3-структура-событий-трассировки)
4. [Быстрый старт](#4-быстрый-старт)
5. [Слайсы: отрезки в стеке вызовов](#5-слайсы-отрезки-в-стеке-вызовов)
6. [Отчеты: статистические модели слайсов](#6-отчеты-статистические-модели-слайсов)
7. [Фильтрация шума: noisyCalls, noisyProperties, callFilter, propertyFilter](#7-фильтрация-шума-noisycalls-noisyproperties-callfilter-propertyfilter)
8. [API Reference](#8-api-reference)
9. [Асинхронная трассировка](#9-асинхронная-трассировка)
10. [Профили трассировки](#10-профили-трассировки)
11. [Практические примеры](#11-практические-примеры)
12. [Решение проблем](#12-решение-проблем)
13. [Чеклист разработчика](#13-чеклист-разработчика)

---

## 1. Термины и определения

| Термин | Определение |
|--------|-------------|
| **Стек вызовов (Call Stack)** | Последовательность вложенных вызовов функций в порядке их выполнения |
| **Глубина стека (Stack Depth)** | Количество вложенных вызовов в текущий момент |
| **Слайс (Slice)** | Отрезок в стеке вызовов, ограниченный двумя точками: началом (вход в функцию) и концом (выход из функции) |
| **Отчет (Report)** | Структурированная статистическая модель одного или нескольких слайсов, которая агрегирует, анализирует и визуализирует данные |
| **Шум (Noise)** | Частые, повторяющиеся или малозначимые вызовы, которые засоряют логи трассировки |
| **NoisyCalls** | Список полных имен функций, которые считаются "шумными" и полностью исключаются из трассировки |
| **NoisyProperties** | Список полных имен свойств, которые считаются "шумными" и полностью исключаются из трассировки |
| **CallFilter** | Функция для гибкой фильтрации вызовов функций по пользовательской логике |
| **PropertyFilter** | Функция для гибкой фильтрации доступа к свойствам по пользовательской логике |
| **Событие (Event)** | Уведомление о действии: `functionCall`, `propertyGet`, `propertySet` |
| **Прокси (Proxy)** | Объект-обертка, перехватывающий операции доступа к свойствам и вызовам методов |
| **ExecutionContext** | Механизм отслеживания асинхронного контекста выполнения (на основе stack или zone) |
| **Emitter** | PubSub система для публикации/подписки на события трассировки |
| **CallId** | Уникальный идентификатор вызова функции в рамках контекста выполнения |
| **Sticky-слайс** | Слайс, который остается активным после активации до явной деактивации |
| **Diff** | Сравнение двух последовательных проходов одного слайса для выявления изменений |

---

## 2. Введение

### 2.1 Что такое Tracer?

**Tracer** — это библиотека для runtime-трассировки JavaScript/TypeScript кода, позволяющая:

- Отслеживать вызовы функций (до и после выполнения) с сохранением стека вызовов
- Мониторить чтение и запись свойств объектов
- Выделять отрезки в стеке вызовов (слайсы) для условного наблюдения
- Строить статистические модели отрезков (отчеты) для анализа
- Фильтровать шумные вызовы (таймеры, анимации, служебные функции)
- Работать с асинхронным кодом через AsyncLocalStorage или Zone.js
- Поддерживать batch-обработку событий для production-сценариев

### 2.2 Основная концепция

```
┌─────────────────────────────────────────────────────────────────────┐
│                                                                     │
│   Стек вызовов = последовательность вложенных функций               │
│         │                                                          │
│         ▼                                                          │
│   Слайс = отрезок стека от входа до выхода из функции              │
│         │                                                          │
│         ▼                                                          │
│   Отчет = статистическая модель слайса                              │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

**Простыми словами:**
- **Стек вызовов** — это видеозапись всего рабочего дня
- **Слайс** — это вырезанный фрагмент с 10:00 до 11:00
- **Отчет** — это аналитический отчет по этому фрагменту

### 2.3 Проблема шума в трассировке

```
Без фильтрации шума:                    С фильтрацией шума:

[→] CEditorPage.onTimerScroll           [→] PaymentService.processPayment
[←] CEditorPage.onTimerScroll               [→] PaymentService.validateAmount
[→] PaintMessageLoop._animation             [←] PaymentService.validateAmount
[←] PaintMessageLoop._animation             [→] PaymentService.chargeCard
[→] baseEditorsApi._autoSave                [←] PaymentService.chargeCard
[←] baseEditorsApi._autoSave            [←] PaymentService.processPayment
[→] CEditorPage.onTimerScroll           
[←] CEditorPage.onTimerScroll           (Только важные вызовы, шум отфильтрован)
[→] PaymentService.processPayment       
    [→] PaymentService.validateAmount   
    [←] PaymentService.validateAmount   
    [→] PaymentService.chargeCard       
    [←] PaymentService.chargeCard       
[←] PaymentService.processPayment       
```

---

## 3. Структура событий трассировки

Все обработчики трассировки получают объект события. Ниже приведено полное описание интерфейса.

### 3.1 Базовый интерфейс события

```typescript
interface BaseTraceEvent {
  /** Тип события: 'functionCall', 'propertyGet', 'propertySet' */
  eventType: string;
  
  /** Место в потоке выполнения: 'before' - до действия, 'after' - после действия */
  place: 'before' | 'after';
  
  /** Полное имя в формате 'ClassName.methodName' или 'ClassName.propertyName' */
  fullName: string;
  
  /** Имя класса */
  className: string;
  
  /** Имя функции или свойства */
  fnKey?: string;
  
  /** Имя свойства (для propertyGet/propertySet) */
  propName?: string;
  
  /** Глобальное состояние трассировщика (Map с активными слайсами) */
  tracerState: Map<string, boolean>;
  
  /** Текущая глубина в стеке вызовов */
  depth?: number;
  
  /** Контекст выполнения (стек вызовов) */
  callStack?: any;
  
  /** Текущий объект (this) */
  thisArg?: any;
}
```

### 3.2 Событие вызова функции (functionCall)

Возникает при обернутых вызовах функций.

```typescript
interface FunctionCallEvent extends BaseTraceEvent {
  eventType: 'functionCall';
  
  /** Аргументы вызова */
  args: any[];
  
  /** Исходная функция */
  targetFn: Function;
  
  /** Временная метка начала выполнения */
  startedAt: number;
  
  /** Уникальный идентификатор вызова (при captureContext: true) */
  callId?: number;
  
  /** ID родительского вызова (при captureContext: true) */
  parentCallId?: number;
  
  /** Статус выполнения (только для after) */
  status?: 'started' | 'ok' | 'rejected' | 'error';
  
  /** Результат выполнения (при status === 'ok') */
  value?: any;
  
  /** Ошибка выполнения (при status === 'rejected' или 'error') */
  error?: Error;
  
  /** Временная метка окончания выполнения (только для after) */
  endedAt?: number;
  
  /** Длительность выполнения в миллисекундах (только для after) */
  durationMs?: number;
}
```

### 3.3 Событие чтения свойства (propertyGet)

Возникает при доступе к отслеживаемому свойству.

```typescript
interface PropertyGetEvent extends BaseTraceEvent {
  eventType: 'propertyGet';
  
  /** Имя свойства */
  propName: string;
  
  /** Текущее значение свойства */
  value: any;
}
```

### 3.4 Событие записи свойства (propertySet)

Возникает при изменении отслеживаемого свойства.

```typescript
interface PropertySetEvent extends BaseTraceEvent {
  eventType: 'propertySet';
  
  /** Имя свойства */
  propName: string;
  
  /** Текущее значение до изменения */
  curValue: any;
  
  /** Новое значение */
  value: any;
}
```

### 3.5 Пример обработки всех событий

```javascript
function handleTraceEvent(event) {
  switch (event.eventType) {
    case 'functionCall':
      if (event.place === 'before') {
        console.log(`→ ${event.fullName}`, event.args);
      } else {
        console.log(`← ${event.fullName} (${event.durationMs}ms)`);
        if (event.status === 'ok') {
          console.log(`  Результат: `, event.value);
        } else if (event.error) {
          console.error(`  Ошибка: `, event.error);
        }
      }
      break;
      
    case 'propertyGet':
      console.log(`📖 Чтение: ${event.className}.${event.propName} = ${event.value}`);
      break;
      
    case 'propertySet':
      console.log(`✏️ Запись: ${event.className}.${event.propName}: ${event.curValue} → ${event.value}`);
      break;
  }
}

Tracer.traceAll(handleTraceEvent);
```

---

## 4. Быстрый старт

### 4.1 Установка

```javascript
// Импорт основного класса
import { Tracer } from './tracer.js';

// Импорт отчетов
import { 
  ReportUsage, 
  ReportTreeView, 
  ReportSimple, 
  ReportSliceDiff,
  ReportSliceUsage 
} from './reports/index.js';
```

### 4.2 Первая трассировка

```javascript
// 1. Создаем функцию
function calculateTotal(items) {
  return items.reduce((sum, item) => sum + item.price, 0);
}

// 2. Оборачиваем для трассировки
const tracedCalculate = Tracer.createProxyFn(calculateTotal, 'calculateTotal');

// 3. Подписываемся на события
Tracer.traceAll((event) => {
  console.log(`${event.eventType}: ${event.fullName}`);
});

// 4. Вызываем
tracedCalculate([{ price: 100 }, { price: 200 }]);
// Вывод:
// functionCall: calculateTotal
// functionCall: calculateTotal
```

### 4.3 Настройка профиля

```javascript
// Установка профиля (minimal, balanced, full)
Tracer.setTraceProfile('balanced', {
  enableCalls: true,
  enableProperties: false,
  suppressNoisy: true
});

// Получение текущей конфигурации
const config = Tracer.getTraceConfig();
console.log(config);
// { profile: 'balanced', enableCalls: true, enableProperties: false, suppressNoisy: true, ... }
```

---

## 5. Слайсы: отрезки в стеке вызовов

### 5.1 Определение

**Слайс (Slice)** — это отрезок в стеке вызовов, ограниченный двумя точками: началом (вход в функцию) и концом (выход из функции).

```
Полный стек вызовов:                    Слайс (отрезок):
                                        
        level1                          (вне слайса)
        │       │                       │
        │       │                       │
    ┌───┴───────┴───┐                   │
    │    level2    │ ◄── НАЧАЛО         │
    │    │   │     │                   │
    │    │   │     │                   │
    │    level3    │                   │
    │    │   │     │                   │
    │    │   │     │                   │
    │    level2    │ ◄── КОНЕЦ          │
    └──────────────┘                   │
        level1                          (вне слайса)
```

### 5.2 Создание слайса

```javascript
Tracer.defineSlice('sliceName', {
  // Условие: когда начинается отрезок
  predicate: (event) => event.fullName === 'TargetFunction',
  
  // Вызывается при входе в отрезок
  beforeCall: () => {
    console.log('🔴 НАЧАЛО ОТРЕЗКА');
    return true;  // true = активировать слайс
  },
  
  // Вызывается при выходе из отрезка
  afterCall: () => {
    console.log('⚫ КОНЕЦ ОТРЕЗКА');
    return false; // false = деактивировать слайс
  },
  
  // Начальное состояние
  initial: false,
  
  // Описание слайса
  description: 'Описание отрезка'
});
```

### 5.3 Использование слайса

```javascript
// Подписка на события ТОЛЬКО внутри отрезка
Tracer.traceBySlice('sliceName', (event) => {
  console.log(`[Отрезок] ${event.fullName}`);
});

// Управление слайсом
Tracer.enableSlice('sliceName');
Tracer.disableSlice('sliceName');
Tracer.disableSliceListeners('sliceName');
Tracer.untraceBySlice('sliceName');
```

### 5.4 Пример: слайс как отрезок

```javascript
function level1() {
  console.log('Уровень 1 начал');
  level2();
  console.log('Уровень 1 закончил');
}

function level2() {
  console.log('  Уровень 2 начал');
  level3();
  console.log('  Уровень 2 закончил');
}

function level3() {
  console.log('    Уровень 3 начал');
  console.log('    Уровень 3 закончил');
}

// Оборачиваем функции
const traced1 = Tracer.createProxyFn(level1, 'level1');
const traced2 = Tracer.createProxyFn(level2, 'level2');
const traced3 = Tracer.createProxyFn(level3, 'level3');

// Слайс = отрезок от входа в level2 до выхода из level2
Tracer.defineSlice('middleOnly', {
  predicate: (event) => event.fullName === 'level2',
  beforeCall: () => true,
  afterCall: () => false
});

Tracer.traceBySlice('middleOnly', (event) => {
  console.log(`  [Слайс] ${event.fullName}`);
});

traced1();

// Вывод:
// Уровень 1 начал
//   Уровень 2 начал
//   [Слайс] level2
//     Уровень 3 начал
//     [Слайс] level3
//     Уровень 3 закончил
//     [Слайс] level3
//   Уровень 2 закончил
//   [Слайс] level2
// Уровень 1 закончил
```

### 5.5 Sticky-слайс (остается активным)

```javascript
Tracer.defineSlice('debugMode', {
  predicate: (event) => event.fullName === 'enableDebug',
  beforeCall: () => true,
  afterCall: () => true,  // true = остаемся активными
  initial: false
});

let debugEnabled = false;

function enableDebug() {
  debugEnabled = true;
}

function doSomething() {
  console.log('Операция...');
}

const tracedEnable = Tracer.createProxyFn(enableDebug, 'enableDebug');
const tracedDo = Tracer.createProxyFn(doSomething, 'doSomething');

Tracer.traceBySlice('debugMode', (event) => {
  console.log(`[DEBUG] ${event.fullName}`);
});

tracedDo();      // Не отслеживается (слайс не активен)
tracedEnable();  // Активируем слайс
tracedDo();      // Отслеживается
```

### 5.6 Вложенные слайсы

```javascript
// Слайс A: весь процесс
Tracer.defineSlice('fullProcess', {
  predicate: (event) => event.fullName === 'processAll',
  beforeCall: () => console.log('🟢 Весь процесс начат'),
  afterCall: () => console.log('🔴 Весь процесс завершен')
});

// Слайс B: только часть процесса
Tracer.defineSlice('validationPart', {
  predicate: (event) => event.fullName === 'validate',
  beforeCall: () => console.log('  🔵 Валидация начата'),
  afterCall: () => console.log('  ⚪ Валидация завершена')
});

function processAll() {
  validate();
  process();
}

function validate() {
  console.log('    Валидация...');
}

function process() {
  console.log('    Обработка...');
}

Tracer.observePrototype({ processAll, validate, process }, 'App');
```

---

## 6. Отчеты: статистические модели слайсов

### 6.1 Определение

**Отчет (Report)** — это структурированная статистическая модель одного или нескольких слайсов, которая агрегирует, анализирует и визуализирует данные о вызовах функций, доступе к свойствам и потоке выполнения внутри этих отрезков.

```
Стек вызовов → Слайс (отрезок) → Отчет (статистическая модель)
     │              │                      │
     ▼              ▼                      ▼
  сырой поток   вырезанный фрагмент   агрегированные данные
```

### 6.2 ReportUsage - счетчик вызовов

**Назначение:** Собрать информацию о том, какие классы и методы используются.

```javascript
const usageReport = new ReportUsage({ logProvider: console });

Tracer.traceBySlice('mySlice', (event) => {
  if (event.place === 'before') {
    const [className, fnKey] = event.fullName.split('.');
    usageReport.log({ className, fnKey });
  }
});

usageReport.print();
// Вывод:
// UserService
// PaymentService
// 
// Class: UserService.login
// Class: PaymentService.processPayment
```

### 6.3 ReportTreeView - структура вложенности

**Назначение:** Визуализация иерархии вызовов с отступами.

```javascript
const treeReport = new ReportTreeView();

Tracer.traceBySlice('mySlice', (event) => {
  if (event.place === 'before') {
    treeReport.log({
      eventType: 'functionCall',
      place: 'before',
      className: event.className,
      fnKey: event.fnKey
    }, JSON.stringify(event.args));
  } else {
    treeReport.log({
      eventType: 'functionCall',
      place: 'after',
      className: event.className,
      fnKey: event.fnKey
    });
  }
});

const tree = treeReport.getResults();
console.log(tree.join('\n'));
// Вывод с отступами, показывающими вложенность:
//  OrderService.processOrder - [{"id":"123"}]
//    OrderService.validateOrder - none values
//    OrderService.calculateTotal - none values
//  OrderService.processOrder - none values
```

### 6.4 ReportSimple - плоский список

**Назначение:** Быстрый дамп уникальных вызовов без дубликатов.

```javascript
const simpleReport = new ReportSimple({ logProvider: console });

Tracer.traceBySlice('mySlice', (event) => {
  if (event.place === 'before') {
    const [className, fnKey] = event.fullName.split('.');
    simpleReport.log({ className, fnKey });
  }
});

// Вывод: уникальные вызовы без дубликатов
```

### 6.5 ReportSliceDiff - сравнение проходов отрезка

**Назначение:** Отслеживает изменения между последовательными проходами одного слайса.

```javascript
const diffReport = new ReportSliceDiff({
  tracer: Tracer,
  sliceName: 'comparison',
  startPredicate: (event) => event.fullName === 'TargetFunction',
  endPredicate: (event) => event.fullName === 'TargetFunction' && event.place === 'after'
});

async function targetFunction() {
  return { ok: true };
}

// Первый проход
diffReport.start();
await targetFunction();
diffReport.stop();

// Второй проход
diffReport.start();
await targetFunction();
diffReport.stop();

// Анализ изменений
const diffs = diffReport.getDiffs();
diffs.forEach(diff => {
  if (diff.changed.args) {
    console.log(`🔄 Изменились аргументы в ${diff.next.fullName}`);
    console.log(`   Было: ${JSON.stringify(diff.prev.args)}`);
    console.log(`   Стало: ${JSON.stringify(diff.next.args)}`);
  }
});
```

### 6.6 ReportSliceUsage - полная статистика отрезка

**Назначение:** Собирает полную статистику о классах, методах и свойствах, использованных внутри слайса.

```javascript
const sliceUsage = new ReportSliceUsage({
  tracer: Tracer,
  sliceName: 'mySlice',
  startPredicate: (event) => event.fullName === 'TargetFunction',
  endPredicate: (event) => event.fullName === 'TargetFunction' && event.place === 'after'
});

async function targetFunction() {
  return { ok: true };
}

sliceUsage.start();
await targetFunction();
sliceUsage.stop();

const run = sliceUsage.getLastRun();
console.log('📊 Статистика отрезка:');
console.log(`  Классы: ${run.classes.join(', ')}`);
console.log(`  Методы: ${run.methods.join(', ')}`);
console.log(`  Прочитано свойств: ${run.propertiesGet.length}`);
console.log(`  Изменено свойств: ${run.propertiesSet.length}`);
console.log(`  Всего событий: ${run.eventsCount}`);

// Получение diff между последовательными прогонами
const diffs = sliceUsage.getAdjacentDiffs();
diffs.forEach(diff => {
  console.log(`Новые методы: ${diff.methods.added}`);
  console.log(`Исчезнувшие методы: ${diff.methods.removed}`);
});
```

### 6.7 Сравнение отчетов

| Отчет | Что делает | Результат |
|-------|------------|-----------|
| **ReportUsage** | Счетчик вызовов | `Class.method: N раз` |
| **ReportTreeView** | Структура вложенности | Дерево с отступами |
| **ReportSimple** | Плоский список | Уникальные вызовы |
| **ReportSliceDiff** | Сравнение проходов | Изменения между вызовами |
| **ReportSliceUsage** | Полная статистика | Списки классов, методов, свойств |

---

## 7. Фильтрация шума: noisyCalls, noisyProperties, callFilter, propertyFilter

### 7.1 Что такое шум?

**Шум (Noise)** — это вызовы функций или доступ к свойствам, которые:
- Происходят очень часто (сотни раз в секунду)
- Не имеют отношения к отлаживаемому сценарию
- Засоряют логи и мешают анализу
- Создают лишнюю нагрузку на систему трассировки

**Примеры шумных вызовов:**
- `onTimerScroll` — вызывается при каждом скролле (60 раз в секунду)
- `_animation` — вызывается в каждом кадре анимации
- `_autoSave` — автоматическое сохранение каждые 30 секунд
- `console.log` — вспомогательные логи
- `performance.now()` — измерения производительности

### 7.2 NoisyCalls — фильтрация шумных вызовов функций

**Что делает:** Позволяет указать список полных имен функций, которые следует полностью исключать из трассировки.

```javascript
Tracer.configureTracing({
  suppressNoisy: true,  // Включить подавление шума
  noisyCalls: [
    'CEditorPage.onTimerScroll',     // Таймер скролла
    'PaintMessageLoop._animation',   // Анимация
    'baseEditorsApi._autoSave',      // Автосохранение
    'Logger.log',                    // Логирование
    'Metrics.record'                 // Сбор метрик
  ]
});
```

**Как это работает:**
```
Без фильтрации:                     С фильтрацией:
→ CEditorPage.onTimerScroll         (тишина)
← CEditorPage.onTimerScroll         (тишина)
→ PaintMessageLoop._animation       (тишина)
← PaintMessageLoop._animation       (тишина)
→ PaymentService.processPayment     → PaymentService.processPayment
```

### 7.3 NoisyProperties — фильтрация шумных свойств

**Что делает:** Позволяет указать список полных имен свойств, доступ к которым следует полностью исключать из трассировки.

```javascript
Tracer.configureTracing({
  suppressNoisy: true,
  noisyProperties: [
    'Component._internal',      // Внутренние свойства
    'Cache._timestamp',         // Служебные временные метки
    'View._renderCount',        // Счетчики рендеринга
    'Store._listeners'          // Внутренние слушатели
  ]
});
```

### 7.4 CallFilter — пользовательская фильтрация вызовов

**Что делает:** Позволяет написать свою функцию для фильтрации вызовов функций по любому критерию.

```javascript
Tracer.configureTracing({
  callFilter: ({ fullName, className, fnKey }) => {
    // Возвращает true — вызов будет отслежен
    // Возвращает false — вызов будет пропущен
    
    // Пример 1: Только методы сервисов
    return fullName.includes('Service') || fullName.includes('Repository');
    
    // Пример 2: Только методы без подчеркивания (не приватные)
    // return !fnKey.startsWith('_');
    
    // Пример 3: Только методы с определенными аргументами
    // if (fnKey === 'findById' && true) return true;
    // return false;
  }
});
```

**Полные примеры:**

```javascript
// Сценарий 1: Отладка конкретного пользователя
Tracer.configureTracing({
  callFilter: ({ fullName }) => {
    if (fullName === 'UserService.getUser' && true) return true;
    if (fullName === 'UserService.updateUser' && true) return true;
    return false;
  }
});

// Сценарий 2: Только критические операции
Tracer.configureTracing({
  callFilter: ({ fullName }) => {
    const critical = ['Payment', 'Order', 'Auth', 'Checkout'];
    return critical.some(c => fullName.includes(c));
  }
});

// Сценарий 3: Исключение библиотек
Tracer.configureTracing({
  callFilter: ({ className }) => {
    const exclude = ['Logger', 'Metrics', 'Cache', 'EventEmitter'];
    return !exclude.includes(className);
  }
});

// Сценарий 4: Фильтрация по длительности (сбор + анализ)
let timings = new Map();
Tracer.configureTracing({
  callFilter: () => true  // собираем все
});
Tracer.traceCalls((event) => {
  if (event.place === 'after' && event.durationMs > 100) {
    console.log(`Медленный вызов: ${event.fullName} (${event.durationMs}ms)`);
  }
});
```

### 7.5 PropertyFilter — пользовательская фильтрация свойств

**Что делает:** Позволяет написать свою функцию для фильтрации доступа к свойствам.

```javascript
Tracer.configureTracing({
  propertyFilter: ({ phase, propName, className, fullName }) => {
    // phase: 'get' — чтение, 'set' — запись
    
    // Пример 1: Не отслеживаем приватные свойства
    if (propName.startsWith('_')) return false;
    
    // Пример 2: Отслеживаем только запись важных свойств
    if (phase === 'set') {
      const important = ['status', 'balance', 'total'];
      return important.includes(propName);
    }
    
    // Пример 3: Не отслеживаем чтение кэша
    if (className === 'Cache' && phase === 'get') return false;
    
    // Пример 4: Только определенные классы
    return className === 'PaymentService' || className === 'OrderService';
  }
});
```

**Полный пример:**

```javascript
class BankAccount {
  constructor() {
    this._balance = 1000;     // Приватное (не отслеживаем)
    this.status = 'active';    // Важное (отслеживаем)
    this._lastAccess = Date.now(); // Приватное (не отслеживаем)
  }
  
  withdraw(amount) {
    this._balance -= amount;   // Запись приватного — НЕ отслеживаем
    if (this._balance < 0) {
      this.status = 'overdrawn'; // Запись важного — отслеживаем
    }
  }
}

Tracer.configureTracing({
  propertyFilter: ({ phase, propName }) => {
    // Не отслеживаем приватные свойства
    if (propName.startsWith('_')) return false;
    
    // Отслеживаем только запись свойств (не чтение)
    if (phase === 'get') return false;
    
    return true;
  }
});

const account = new BankAccount();
Tracer.observeAllProperties(account, 'BankAccount');
account.withdraw(1500);
// Будет отслежено только: status изменен на 'overdrawn'
// _balance изменен НЕ будет отслежено
```

### 7.6 Комбинирование всех фильтров

```javascript
// Полная настройка фильтрации для production
Tracer.configureTracing({
  // 1. Включаем подавление шума
  suppressNoisy: true,
  
  // 2. Список шумных вызовов (полное исключение)
  noisyCalls: [
    'CEditorPage.onTimerScroll',
    'PaintMessageLoop._animation',
    'baseEditorsApi._autoSave'
  ],
  
  // 3. Список шумных свойств (полное исключение)
  noisyProperties: [
    'Component._renderCount',
    'Cache._timestamp',
    'Store._listeners'
  ],
  
  // 4. Пользовательский фильтр вызовов (дополнительная логика)
  callFilter: ({ fullName }) => {
    // Только критически важные операции
    const critical = ['Payment', 'Order', 'Auth'];
    const isCritical = critical.some(c => fullName.includes(c));
    
    // Плюс отслеживаем конкретного пользователя
    const isSpecificUser = fullName === 'UserService.getUser' && true;
    
    return isCritical || isSpecificUser;
  },
  
  // 5. Пользовательский фильтр свойств
  propertyFilter: ({ phase, propName, className }) => {
    // Не отслеживаем чтение
    if (phase === 'get') return false;
    
    // Не отслеживаем приватные свойства
    if (propName.startsWith('_')) return false;
    
    // Отслеживаем только важные классы
    return className === 'PaymentService' || className === 'OrderService';
  }
});
```

### 7.7 Сравнение методов фильтрации

| Метод | Тип | Что делает | Когда использовать |
|-------|-----|------------|-------------------|
| **noisyCalls** | Список строк | Полностью исключает указанные вызовы | Для частых, предсказуемых вызовов (таймеры, анимации) |
| **noisyProperties** | Список строк | Полностью исключает доступ к указанным свойствам | Для служебных свойств (_internal, _cache) |
| **callFilter** | Функция | Гибкая фильтрация по любой логике | Когда нужны сложные условия (по аргументам, времени, контексту) |
| **propertyFilter** | Функция | Гибкая фильтрация доступа к свойствам | Когда нужно различать чтение/запись или фильтровать по классам |

### 7.8 Порядок применения фильтров

```
Tracer применяет фильтры в следующем порядке:

1. Проверка noisyCalls (если suppressNoisy: true)
   ↓ если имя в списке → вызов полностью пропускается
   
2. Проверка callFilter (если задан)
   ↓ если функция вернула false → вызов пропускается
   
3. Событие генерируется и передается в слайсы
   
4. Слайс проверяет активность
   ↓ если слайс активен → событие попадает в traceBySlice
```

### 7.9 Фильтрация и слайсы: порядок работы

```
┌─────────────────────────────────────────────────────────┐
│                   Трассировка                           │
└─────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────┐
│     Фильтры (noisyCalls, callFilter)                    │
│     Применяются КО ВСЕМ вызовам ГЛОБАЛЬНО               │
│     НЕ имеют доступа к tracerState                      │
└─────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────┐
│     Слайс (отрезок)                                     │
│     Проверяет: активен ли слайс в этот момент?         │
│     Имеет доступ к tracerState                          │
└─────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────┐
│     traceBySlice(callback)                              │
│     Callback получает только события внутри отрезка    │
└─────────────────────────────────────────────────────────┘
```

**Важно:** Фильтры применяются ДО слайсов. Нельзя использовать `tracerState` в фильтрах, так как в момент применения фильтра слайс еще не обновил состояние.

---

## 8. API Reference

### 8.1 Основные методы Tracer

```javascript
// Обертки функций и классов
Tracer.createProxyFn(targetFn, eventName);
Tracer.observeConstructor(Constructor, className);
Tracer.observeProperty(target, propName, className);
Tracer.observe(target, targetName);
Tracer.observePrototype(target, className);
Tracer.observeAllProperties(target, className);
Tracer.observeAll(targetList);
Tracer.observePrototypeAll(targetList);
Tracer.observeFromExports(exportTarget);
Tracer.observePrototypesFromExports(exportTarget);

// Слайсы (отрезки в стеке)
Tracer.defineSlice(name, config);
Tracer.traceBySlice(name, callback);
Tracer.traceBySliceOnce(name, callback);
Tracer.untraceBySlice(name, callback);
Tracer.enableSlice(name);
Tracer.disableSlice(name);
Tracer.disableSliceListeners(name);
Tracer.traceBySliceSequence(sliceSeq, callback);
Tracer.getEnabledSlices();
Tracer.getRegisteredSlices();

// Подписки на события
Tracer.traceAll(callback);
Tracer.traceCalls(callback);
Tracer.traceProperties(callback);
Tracer.traceAllBatched(callback, options);
Tracer.traceCallsBatched(callback, options);
Tracer.tracePropertiesBatched(callback, options);
Tracer.untraceAll();
Tracer.untraceCalls();
Tracer.untraceProperties();

// Конфигурация
Tracer.configure(options);
Tracer.setTraceProfile(profileName, overrides);
Tracer.configureTracing(options);
Tracer.getTraceConfig();

// Отладка
Tracer.debugOn(eventName, conditionCallback);
Tracer.debugOnceOn(eventName, conditionCallback);

// Вспомогательные методы
Tracer.getCurrentContext();
Tracer.defineSliceByCall(sliceName, target, targetFnName, predicate);
Tracer.defineSliceByFunction(sliceName, fn);

// Статические свойства
Tracer.tracerState;  // Map с состояниями слайсов
Tracer.reports;      // Объект с отчетами
```

### 8.2 Конфигурация трассировки

```javascript
Tracer.configureTracing({
  // Включить/выключить отслеживание вызовов
  enableCalls: true,
  
  // Включить/выключить отслеживание свойств
  enableProperties: false,
  
  // Включить подавление шума
  suppressNoisy: true,
  
  // Список шумных вызовов (полные имена)
  noisyCalls: ['Class.method'],
  
  // Список шумных свойств
  noisyProperties: ['Class.property'],
  
  // Фильтр вызовов (функция)
  callFilter: ({ fullName, className, fnKey }) => boolean,
  
  // Фильтр свойств (функция)
  propertyFilter: ({ phase, propName, className, fullName }) => boolean,
  
  // Включить захват контекста (callId)
  captureContext: false
});
```

### 8.3 Конфигурация слайса

```javascript
Tracer.defineSlice('sliceName', {
  // Условие активации слайса (получает событие)
  predicate: (event) => boolean,
  
  // Вызывается при входе в отрезок (возвращает boolean)
  beforeCall: (event) => boolean,
  
  // Вызывается при выходе из отрезка (возвращает boolean)
  afterCall: (event) => boolean,
  
  // Начальное состояние слайса
  initial: false,
  
  // Описание слайса
  description: 'string'
});
```

**Правила возврата beforeCall/afterCall:**
- `true` → слайс становится активным (sticky или добавляется токен)
- `false` → слайс деактивируется
- `undefined` → состояние не меняется

### 8.4 Конфигурация асинхронного контекста

```javascript
Tracer.configure({ 
  asyncContext: 'stack',  // 'stack' для Node.js (AsyncLocalStorage)
  traceProfile: 'balanced',  // опционально
  traceOptions: {}  // опционально
});

// Или для браузера с Zone.js
Tracer.configure({ asyncContext: 'zone' });
```

### 8.5 Batch-подписки

```javascript
// Параметры batch-обработки
const batchOptions = {
  maxBatchSize: 100,      // Максимальный размер батча
  flushIntervalMs: 16,    // Интервал сброса (мс)
  bufferSize: 2000        // Максимальный размер буфера
};

Tracer.traceAllBatched((batch) => {
  // batch - массив событий
  console.log(`Получено ${batch.length} событий`);
  fetch('/api/trace', { method: 'POST', body: JSON.stringify(batch) });
}, batchOptions);
```

---

## 9. Асинхронная трассировка

### 9.1 Настройка контекста

Tracer поддерживает два режима асинхронного контекста:

- **stack** (по умолчанию) - использует AsyncLocalStorage для Node.js
- **zone** - использует Zone.js для браузеров

```javascript
// Настройка режима
Tracer.configure({ asyncContext: 'stack' }); // Для Node.js
Tracer.configure({ asyncContext: 'zone' });   // Для браузера (требуется Zone.js)
```

### 9.2 Включение CallId

Для отслеживания асинхронных цепочек необходимо включить захват контекста:

```javascript
Tracer.setTraceProfile('full', { captureContext: true });
// или
Tracer.configureTracing({ captureContext: true });
```

### 9.3 Пример асинхронной трассировки

```javascript
class OrderService {
  async createOrder(items) {
    console.log('1. Начало createOrder');
    const validated = await this.validateItems(items);
    const total = await this.calculateTotal(validated);
    const payment = await this.processPayment(total);
    console.log('5. Конец createOrder');
    return payment;
  }
  
  async validateItems(items) {
    console.log('2. Валидация');
    await delay(10);
    return items.filter(i => i.price > 0);
  }
  
  async calculateTotal(items) {
    console.log('3. Расчет суммы');
    await delay(5);
    return items.reduce((s, i) => s + i.price, 0);
  }
  
  async processPayment(amount) {
    console.log('4. Платеж');
    await delay(20);
    return { success: true, amount };
  }
}

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Включаем контекстную трассировку
Tracer.configure({ asyncContext: 'stack' });
Tracer.setTraceProfile('full', { captureContext: true });

// Оборачиваем сервис
const TracedService = Tracer.observeConstructor(OrderService, 'OrderService');
const service = new TracedService();

// Отслеживаем с callId
Tracer.traceCalls((event) => {
  const indent = event.place === 'before' ? '→' : '←';
  console.log(`[${event.callId}] ${indent} ${event.fullName}`);
  if (event.parentCallId) {
    console.log(`     родитель: ${event.parentCallId}`);
  }
});

await service.createOrder([{ price: 100 }, { price: 200 }]);

// Вывод (callId одинаков для всей цепочки):
// [1] → OrderService.createOrder
// [1]   → OrderService.validateItems
// [1]   ← OrderService.validateItems
// [1]   → OrderService.calculateTotal
// [1]   ← OrderService.calculateTotal
// [1]   → OrderService.processPayment
// [1]   ← OrderService.processPayment
// [1] ← OrderService.createOrder
```

### 9.4 Получение текущего контекста

```javascript
// В любом месте кода можно получить текущий контекст выполнения
const context = Tracer.getCurrentContext();

// context - объект Node с методами:
// - forEach(callback) - обход всех узлов
// - isContain(callback) - проверка наличия
// - trace(...values) - вывод в консоль

// Обход контекста для отладки
context.forEach((node) => {
  if (node.val) {
    console.log(`${node.val.className}.${node.val.fnKey}`);
  }
});

// Трассировка контекста в консоль
context.trace('Дополнительная информация');
```

### 9.5 Асинхронный слайс

```javascript
// Слайс, который сохраняет контекст через асинхронные вызовы
Tracer.defineSlice('asyncFlow', {
  predicate: (event) => event.fullName === 'AsyncProcess.run',
  beforeCall: () => {
    console.log('🔵 НАЧАЛО АСИНХРОННОГО ОТРЕЗКА');
    return true;
  },
  afterCall: () => {
    console.log('🔴 КОНЕЦ АСИНХРОННОГО ОТРЕЗКА');
    return false;
  }
});

Tracer.traceBySlice('asyncFlow', (event) => {
  console.log(`  [Async] ${event.fullName}`);
});

Tracer.enableSlice('asyncFlow');

const processor = new AsyncProcessor();
await processor.process({ id: 1 });
```

---

## 10. Профили трассировки

### 10.1 Доступные профили

| Профиль | enableCalls | enableProperties | suppressNoisy | captureContext |
|---------|-------------|------------------|---------------|----------------|
| **minimal** | true | false | true | false |
| **balanced** | true | false | true | false |
| **full** | true | true | false | true |

### 10.2 Использование профилей

```javascript
// Установка профиля
Tracer.setTraceProfile('minimal');
// Только вызовы функций, шум подавлен

Tracer.setTraceProfile('full');
// Все вызовы + свойства + контекст

// Переопределение параметров
Tracer.setTraceProfile('balanced', {
  enableProperties: true,  // Включаем свойства поверх balanced
  noisyCalls: ['onTimerScroll', '_animation'] // Кастомные шумные вызовы
});
```

### 10.3 Настройка шумоподавления

```javascript
Tracer.configureTracing({
  suppressNoisy: true,
  noisyCalls: [
    'CEditorPage.onTimerScroll',
    'PaintMessageLoop._animation',
    'baseEditorsApi._autoSave'
  ],
  noisyProperties: [
    'Component._internal',
    'Cache._timestamp'
  ]
});
```

### 10.4 Фильтрация вызовов

```javascript
Tracer.configureTracing({
  callFilter: ({ fullName, className, fnKey }) => {
    // Только методы сервисов
    return fullName.includes('Service') || fullName.includes('Repository');
  },
  propertyFilter: ({ phase, propName, className }) => {
    // Не отслеживаем внутренние свойства
    return !propName.startsWith('_');
  }
});
```

---

## 11. Практические примеры

### 11.1 Полный цикл отладки

```javascript
import { Tracer } from './tracer.js';
import { ReportUsage, ReportTreeView, ReportSliceDiff, ReportSliceUsage } from './reports/index.js';

class ECommerceService {
  async checkout(cartId, paymentMethod) {
    const cart = await this.getCart(cartId);
    const validated = await this.validateCart(cart);
    const total = this.calculateTotal(validated);
    const payment = await this.processPayment(total, paymentMethod);
    const order = await this.createOrder(cart, payment);
    await this.sendConfirmation(order);
    return order;
  }
  
  async getCart(id) { /* ... */ }
  async validateCart(cart) { /* ... */ }
  calculateTotal(items) { /* ... */ }
  async processPayment(amount, method) { /* ... */ }
  async createOrder(cart, payment) { /* ... */ }
  async sendConfirmation(order) { /* ... */ }
}

// ШАГ 1: Настройка
Tracer.configure({ asyncContext: 'stack' });
Tracer.setTraceProfile('balanced');

// ШАГ 2: Оборачиваем сервис
const TracedService = Tracer.observeConstructor(ECommerceService, 'ECommerceService');
const service = new TracedService();

// ШАГ 3: Сбор общей информации
const usageReport = new ReportUsage({ logProvider: console });
Tracer.traceCalls((event) => {
  if (event.place === 'before') {
    const [className, fnKey] = event.fullName.split('.');
    usageReport.log({ className, fnKey });
  }
});

// ШАГ 4: Визуализация дерева
const treeReport = new ReportTreeView();

Tracer.traceCalls((event) => {
  if (event.place === 'before') {
    treeReport.log({
      eventType: 'functionCall',
      place: 'before',
      className: event.className,
      fnKey: event.fnKey
    }, JSON.stringify(event.args));
  } else if (event.place === 'after') {
    treeReport.log({
      eventType: 'functionCall',
      place: 'after',
      className: event.className,
      fnKey: event.fnKey
    });
  }
});

// ШАГ 5: Создание слайса для детального анализа
Tracer.defineSlice('checkoutFlow', {
  predicate: (event) => event.fullName === 'ECommerceService.checkout',
  beforeCall: () => console.log('🟢 НАЧАЛО ОФОРМЛЕНИЯ'),
  afterCall: () => console.log('🔴 КОНЕЦ ОФОРМЛЕНИЯ')
});

// ШАГ 6: Анализ использования слайса
const sliceUsage = new ReportSliceUsage({
  tracer: Tracer,
  sliceName: 'checkoutFlow',
  startPredicate: (event) => event.fullName === 'ECommerceService.checkout',
  endPredicate: (event) => event.fullName === 'ECommerceService.checkout' && event.place === 'after'
});

sliceUsage.start();

// ШАГ 7: Выполнение
const result = await service.checkout('cart123', 'credit_card');

sliceUsage.stop();

// ШАГ 8: Вывод отчетов
console.log('\n📊 ОТЧЕТЫ:');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

console.log('\n1. Использование классов и методов:');
usageReport.print();

console.log('\n2. Дерево вызовов:');
treeReport.getResults().slice(0, 20).forEach(line => console.log(line));

console.log('\n3. Статистика слайса:');
const run = sliceUsage.getLastRun();
if (run) {
  console.log(`  Классов: ${run.classes.length}`);
  console.log(`  Методов: ${run.methods.length}`);
  console.log(`  Свойств (чтение): ${run.propertiesGet.length}`);
  console.log(`  Свойств (запись): ${run.propertiesSet.length}`);
  console.log(`  Всего событий: ${run.eventsCount}`);
}
```

### 11.2 Batch-обработка для production

```javascript
class TraceCollector {
  constructor() {
    this.batch = [];
    this.isSending = false;
  }
  
  start() {
    // Минимальный профиль для production
    Tracer.setTraceProfile('minimal');
    Tracer.configureTracing({ suppressNoisy: true });
    
    // Batch-подписка на все события
    Tracer.traceAllBatched((events) => {
      this.batch.push(...events);
      this.flush();
    }, { maxBatchSize: 50, flushIntervalMs: 5000 });
  }
  
  async flush() {
    if (this.isSending || this.batch.length === 0) return;
    
    this.isSending = true;
    const batchToSend = [...this.batch];
    this.batch = [];
    
    try {
      await fetch('/api/trace', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          timestamp: Date.now(),
          events: batchToSend.map(event => ({
            type: event.eventType,
            name: event.fullName,
            duration: event.durationMs,
            args: event.args
          }))
        })
      });
    } catch (error) {
      console.error('Ошибка отправки трассировки:', error);
      // Возвращаем события обратно в batch
      this.batch.unshift(...batchToSend);
    } finally {
      this.isSending = false;
      if (this.batch.length > 0) this.flush();
    }
  }
  
  stop() {
    Tracer.untraceAll();
    this.flush();
  }
}

const collector = new TraceCollector();
collector.start();

// Приложение работает...
setTimeout(() => collector.stop(), 60000);
```

### 11.3 Сравнение двух версий API

```javascript
async function compareVersions(versionA, versionB, testData) {
  const results = { A: null, B: null };
  
  // Версия A
  const diffA = new ReportSliceDiff({
    tracer: Tracer,
    sliceName: 'versionA',
    startPredicate: (event) => event.fullName === 'API.process',
    endPredicate: (event) => event.fullName === 'API.process' && event.place === 'after'
  });
  diffA.start();
  results.A = await versionA.process(testData);
  diffA.stop();
  
  // Версия B
  const diffB = new ReportSliceDiff({
    tracer: Tracer,
    sliceName: 'versionB',
    startPredicate: (event) => event.fullName === 'API.process',
    endPredicate: (event) => event.fullName === 'API.process' && event.place === 'after'
  });
  diffB.start();
  results.B = await versionB.process(testData);
  diffB.stop();
  
  // Сравнение
  const callsA = diffA.getCalls();
  const callsB = diffB.getCalls();
  
  console.log('📊 СРАВНЕНИЕ ВЕРСИЙ:');
  console.log(`Версия A: ${callsA.length} вызовов`);
  console.log(`Версия B: ${callsB.length} вызовов`);
  
  const maxLen = Math.max(callsA.length, callsB.length);
  for (let i = 0; i < maxLen; i++) {
    if (!callsA[i] && callsB[i]) {
      console.log(`➕ В B добавлен вызов: ${callsB[i].fullName}`);
    } else if (callsA[i] && !callsB[i]) {
      console.log(`➖ В B удален вызов: ${callsA[i].fullName}`);
    } else if (callsA[i]?.fullName !== callsB[i]?.fullName) {
      console.log(`🔄 Изменен вызов #${i}: ${callsA[i]?.fullName} → ${callsB[i]?.fullName}`);
    }
  }
  
  return { results, diffA, diffB };
}
```

### 11.4 Отслеживание изменения свойства со стеком

```javascript
class Order {
  constructor() {
    this.status = 'pending';
  }
  
  approve() { this.status = 'approved'; }
  reject() { this.status = 'rejected'; }
  cancel() { this.status = 'cancelled'; }
}

// Наблюдаем за свойством
const order = new Order();
Tracer.observeProperty(order, 'status', 'Order');

// Отслеживаем изменения с полным стеком
const statusChanges = [];

Tracer.traceProperties((event) => {
  if (event.propName === 'status') {
    const change = {
      from: event.curValue,
      to: event.value,
      time: new Date().toISOString(),
      stack: new Error().stack
    };
    
    statusChanges.push(change);
    
    console.log(`\n🔄 ИЗМЕНЕНИЕ STATUS:`);
    console.log(`  ${change.from} → ${change.to}`);
    console.log(`  Время: ${change.time}`);
    console.log(`  Стек вызовов:`);
    const stackLines = change.stack.split('\n').slice(2, 6);
    stackLines.forEach(line => console.log(`    ${line.trim()}`));
    
    // Проверка на нелегальное изменение
    const isLegal = stackLines.some(line => 
      line.includes('.approve') || line.includes('.reject')
    );
    
    if (!isLegal && change.to === 'cancelled') {
      console.warn(`⚠️ НЕЛЕГАЛЬНАЯ ОТМЕНА! Статус изменен не через approve/reject`);
    }
  }
});

order.approve();
order.cancel();  // Предупреждение, если cancel нелегальный
```

---

## 12. Решение проблем

### 12.1 Частые проблемы и решения

| Проблема | Решение |
|----------|---------|
| Слайс не активируется | Проверьте predicate, добавьте `console.log` внутрь |
| Асинхронные вызовы не связаны | Настройте `Tracer.configure({ asyncContext: 'stack' })` |
| Слишком много событий | Используйте профиль `minimal` или batch-подписки |
| Утечка памяти | Всегда вызывайте `untraceBySlice` или `disableSliceListeners` |
| Свойства не отслеживаются | Убедитесь, что свойство configurable и не является функцией |
| Нет callId в событиях | Включите `captureContext: true` в профиле |
| Шумные вызовы не фильтруются | Добавьте их в `noisyCalls` точным именем |
| Колбэк вызывается слишком часто | Используйте batch-подписки |

### 12.2 Отладка самого Tracer

```javascript
// Включение диагностики
Tracer.traceAll((event) => {
  console.log(`[DIAG] ${event.eventType}: ${event.fullName}`);
});

// Проверка состояния
console.log('Активные слайсы:', Tracer.getEnabledSlices());
console.log('Зарегистрированные слайсы:', Tracer.getRegisteredSlices());
console.log('Текущий контекст:', Tracer.getCurrentContext());
console.log('Конфигурация:', Tracer.getTraceConfig());
```

### 12.3 Советы по производительности

```javascript
// ✅ ХОРОШО: Фильтрация на уровне predicate
Tracer.defineSlice('fast', {
  predicate: (args) => args.fullName.includes('Important')
});

// ❌ ПЛОХО: Тяжелые операции в predicate
Tracer.defineSlice('slow', {
  predicate: (args) => {
    return JSON.stringify(args).includes('pattern'); // Медленно
  }
});

// ✅ ХОРОШО: Очистка подписок
const callback = (event) => console.log(event.fullName);
const subscription = Tracer.traceAll(callback);
// ... после использования
Tracer.untraceAll();

// ✅ ХОРОШО: Использование batch-подписок для production
Tracer.traceAllBatched(callback, { maxBatchSize: 100, flushIntervalMs: 100 });

// ✅ ХОРОШО: Минимальный профиль для production
Tracer.setTraceProfile('minimal');
Tracer.configureTracing({ suppressNoisy: true });

// ❌ ИЗБЕГАЙТЕ:
// - traceAll без фильтрации в production
// - тяжелые операции в колбеках
// - синхронную отправку данных на сервер
// - deep-обход больших объектов
```

---

## 13. Чеклист разработчика

### 13.1 Перед началом отладки

```markdown
- [ ] Определить цель трассировки (баг, производительность, анализ)
- [ ] Выбрать профиль (minimal/balanced/full)
- [ ] Настроить асинхронный контекст если нужно
- [ ] Определить нужные слайсы
- [ ] Изучить структуру событий
```

### 13.2 В процессе отладки

```markdown
- [ ] Начать с общего отчета (ReportUsage)
- [ ] Визуализировать поток (ReportTreeView)
- [ ] Сузить до проблемного модуля (слайс)
- [ ] Использовать event.callId для отслеживания асинхронных цепочек
- [ ] Использовать debugOn для остановки в нужном месте
- [ ] Применить фильтрацию шума если нужно
```

### 13.3 После завершения

```markdown
- [ ] Отключить подписки (untraceAll)
- [ ] Очистить слайсы (disableSliceListeners)
- [ ] Сохранить отчеты для анализа
- [ ] Удалить обертки если не нужны больше
```

### 13.4 Настройка фильтрации

```markdown
- [ ] Определить шумные вызовы (таймеры, анимации)
- [ ] Добавить их в noisyCalls
- [ ] Определить шумные свойства (_internal, _cache)
- [ ] Добавить их в noisyProperties
- [ ] Написать callFilter для сложной логики
- [ ] Написать propertyFilter для различения чтения/записи
```

### 13.5 Проверка фильтрации

```markdown
- [ ] Включить suppressNoisy: true
- [ ] Запустить трассировку
- [ ] Убедиться, что шумные вызовы пропадают
- [ ] Убедиться, что важные вызовы остаются
```

### 13.6 Шаблон обработчика событий

```javascript
// Полный шаблон обработчика всех типов событий
class TraceHandler {
  onEvent(event) {
    switch (event.eventType) {
      case 'functionCall':
        this.onFunctionCall(event);
        break;
      case 'propertyGet':
        this.onPropertyGet(event);
        break;
      case 'propertySet':
        this.onPropertySet(event);
        break;
    }
  }
  
  onFunctionCall(event) {
    if (event.place === 'before') {
      // До вызова
      console.log(`→ ${event.fullName}`, event.args);
    } else {
      // После вызова
      console.log(`← ${event.fullName} (${event.durationMs}ms)`);
      if (event.status === 'ok') {
        console.log(`  Результат:`, event.value);
      } else if (event.error) {
        console.error(`  Ошибка:`, event.error);
      }
    }
  }
  
  onPropertyGet(event) {
    console.log(`📖 ${event.className}.${event.propName} = ${event.value}`);
  }
  
  onPropertySet(event) {
    console.log(`✏️ ${event.className}.${event.propName}: ${event.curValue} → ${event.value}`);
  }
}

const handler = new TraceHandler();
Tracer.traceAll((event) => handler.onEvent(event));
```

---

## 14. Быстрая шпаргалка

### 14.1 Основные команды

```javascript
// Быстрый старт
Tracer.traceAll(console.log);
const myFn = () => 'ok';
Tracer.createProxyFn(myFn, 'name')();

// Слайсы
Tracer.defineSlice('name', { predicate: (e) => e.fullName === 'target' });
const callback = (event) => console.log(event.fullName);
Tracer.traceBySlice('name', callback);

// Отчеты
new ReportUsage({ logProvider: console }).print();
new ReportTreeView().getResults();

// Отладка
const condition = (e) => e.fullName === 'target';
Tracer.debugOn('beforeCallMethod', condition);
const obj = { prop: 1 };
Tracer.observeProperty(obj, 'prop', 'Class');

// Управление
Tracer.enableSlice('name');
Tracer.disableSlice('name');
Tracer.untraceAll();

// Конфигурация
Tracer.setTraceProfile('minimal');
Tracer.configure({ asyncContext: 'stack' });
Tracer.configureTracing({ suppressNoisy: true, noisyCalls: ['method'] });
```

### 14.2 Консольные команды для браузера

```javascript
// Быстрые команды для консоли браузера
traceStart = () => Tracer.traceAll(console.log);
traceStop = () => Tracer.untraceAll();
traceStats = () => {
  console.log('Slices:', Tracer.getEnabledSlices());
  console.log('Config:', Tracer.getTraceConfig());
};
traceFilter = (pattern) => {
  Tracer.configureTracing({
    callFilter: ({ fullName }) => fullName.includes(pattern)
  });
};
traceContext = () => console.log(Tracer.getCurrentContext());
```

---

**Tracer v4.2 | Документация**

```javascript
// Скачать этот документ:
// const blob = new Blob([documentation], { type: 'text/markdown' });
// const url = URL.createObjectURL(blob);
// const a = document.createElement('a');
// a.href = url;
// a.download = 'tracer-documentation.md';
// a.click();
```


---

## readme

_Источник: [readme.md](./readme.md)_

# Tracer Docs

Центральная навигация по документации проекта.

## Source Of Truth

- Каноничный документ по API и поведению: [docs/index.md](./index.md)
- Если есть расхождения между гайдами, приоритет у `index.md`.

## Быстрый маршрут по задачам

| Задача | Куда идти |
|---|---|
| Быстро включить трассировку в проекте | [Быстрый старт](./getting-started.md) |
| Разобраться в полном API и профилях | [Полная документация](./index.md) |
| Нужны сигнатуры и параметры методов | [API Reference](./api-reference.md) |
| Legacy-отладка по сценариям | [Гайд разработчика](./tracer-dev-guide.md) |
| AI-автоматизация анализа | [Tracer + AI гайд](./tracer-ai-guide.md) |
| Слайсы и отрезки стека | [Слайсы](./slices.md) |
| Асинхронный контекст | [Асинхронность](./async.md) |
| Отчеты и статистика | [Отчеты](./reports-guide.md) |

## Основное

- [Полная документация](./index.md)
- [API Reference](./api-reference.md)
- [Быстрый старт](./getting-started.md)
- [Полный гайд разработчика](./tracer-dev-guide.md)
- [Гайд по AI](./tracer-ai-guide.md)
- [Слайсы](./slices.md)
- [Асинхронность](./async.md)
- [Отчеты](./reports-guide.md)

## Дополнительные материалы

- [Контекст архитектуры](./context.md)
- [Исторические заметки по отчетам](./reports.md)
- [Тест-план](../Test-plan-1.md)

## Проверяемые примеры

- Документационные примеры: [__tests__/docs-examples.test.js](../__tests__/docs-examples.test.js)
- Критические регрессии поведения: [__tests__/tracer-regression-critical.test.js](../__tests__/tracer-regression-critical.test.js)


---

## reports

_Источник: [reports.md](./reports.md)_

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


---

## reports-guide

_Источник: [reports-guide.md](./reports-guide.md)_

# Tracer: Отчеты

Этот гайд показывает, как перейти от "сырых" событий к понятным выводам.

## 1. Какие отчеты использовать

- `ReportSimple` - быстрый плоский список событий.
- `ReportUsage` - статистика по классам/методам.
- `ReportTreeView` - дерево последовательности вызовов.
- `ReportSliceDiff` - сравнение двух прогонов сценария.

## 2. Базовый `ReportUsage`

```javascript
const usageReport = new ReportUsage({ logProvider: console });

const stop = Tracer.traceCalls((event) => {
  if (event.type === 'beforeCallMethod') {
    const [className, fnKey] = event.fullName.split('.');
    usageReport.log({ className, fnKey });
  }
});

// ... запускаем сценарий ...
// await runCheckout();

stop?.();
usageReport.print();
```

Что смотреть в выводе:
- какие методы вызваны чаще всего;
- какие классы участвуют в сценарии неожиданно;
- есть ли лишние/дублирующиеся вызовы.

## 3. `ReportTreeView` для порядка вызовов

```javascript
const treeReport = new ReportTreeView({ logProvider: console });

Tracer.traceCalls((event) => {
  treeReport.log(event);
});

// ... сценарий ...

treeReport.print();
```

Используйте, когда надо понять "почему вызов пошел сюда".

## 4. `ReportSliceDiff` для регрессий

Идея: сравнить baseline и текущий прогон одного и того же сценария.

```javascript
const diffReport = new ReportSliceDiff({ logProvider: console });

// baseline
// ... run scenario A ...
// diffReport.capture('baseline');

// current
// ... run scenario B ...
// diffReport.capture('current');

// diffReport.print('baseline', 'current');
```

Сравнивайте только одинаковые входные данные, иначе получите шумные отличия.

## 5. Практический pipeline

1. `traceCalls` + `ReportSimple` для первичного сигнала.
2. `ReportUsage` для hot-методов.
3. `ReportTreeView` для порядка.
4. `ReportSliceDiff` для подтверждения регрессии.

## 6. Частые ошибки

- Смешивание нескольких сценариев в один прогон.
- Отсутствие фиксации baseline.
- Слишком широкая область трассировки без фильтров.

## 7. Мини-чеклист перед выводами

- [ ] Одинаковые входные данные
- [ ] Одинаковая конфигурация профиля
- [ ] Шум отфильтрован
- [ ] Результат воспроизводится минимум 2 раза

- [Полная документация](./index.md)


---

## slices

_Источник: [slices.md](./slices.md)_

# Tracer: Слайсы

Слайс это способ трассировать не весь проект, а конкретный бизнес-сценарий.

## Когда использовать слайс

Используйте слайс, если:
- нужен фокус только на одном use-case (например, checkout);
- глобальная трассировка дает слишком много шума;
- нужно сравнить два прогона одного сценария.

## Базовый пример

```javascript
Tracer.defineSlice('checkout-payment', {
  predicate: (event) =>
    event.fullName.includes('CheckoutService') ||
    event.fullName.includes('PaymentService'),
  description: 'Checkout + payment вызовы'
});

Tracer.enableSlice('checkout-payment');

const stop = Tracer.traceBySlice('checkout-payment', (event) => {
  console.log(`[slice:checkout-payment] ${event.type} ${event.fullName}`);
});

// await checkoutService.placeOrder(order);

stop?.();
Tracer.disableSlice('checkout-payment');
```

## Пошаговый шаблон для новой задачи

1. Назовите слайс по сценарию: `order-create`, `invoice-send`, `auth-login`.
2. Сформулируйте `predicate` через модули/классы.
3. Запустите сценарий 1-2 раза в одинаковых условиях.
4. Сохраните результат в отчет или лог.
5. Выключите слайс.

## Паттерны predicate

### По префиксу класса

```javascript
predicate: (event) => event.fullName.startsWith('OrderService.')
```

### По нескольким модулям

```javascript
predicate: (event) =>
  ['OrderService', 'PaymentService', 'InventoryService']
    .some((name) => event.fullName.includes(name))
```

### Исключение шума

```javascript
predicate: (event) =>
  event.fullName.includes('CheckoutService') &&
  !event.fullName.includes('debug')
```

## Анти-паттерны

- Слишком широкий `predicate` (`event.fullName.includes('Service')`) -> много шума.
- Постоянно включенный слайс в production -> лишняя нагрузка.
- Сравнение прогонов с разными входными данными -> ложные отличия.

## Диагностика, если слайс пустой

- Проверьте, что `enableSlice(...)` вызван до запуска сценария.
- Упростите `predicate` до `() => true` и проверьте поток событий.
- Убедитесь, что методы реально трассируются (`createProxyFn/observe...`).

## Быстрый чеклист

- [ ] Слайс включается перед сценарием
- [ ] Слайс выключается после сценария
- [ ] `predicate` явно ограничен
- [ ] Лог/отчет сохраняется для сравнения

- [Полная документация](./index.md)


---

## tracer-ai-guide

_Источник: [tracer-ai-guide.md](./tracer-ai-guide.md)_

# Гайд по использованию Tracer с Codex/Claude AI

## Как использовать AI для автоматической трассировки, анализа и отладки кода

---

> Источник истины по API Tracer: [docs/index.md](./index.md). Этот документ описывает AI-паттерны поверх актуального API.

## Оглавление

1. [Введение: AI + Tracer](#1-введение-ai--tracer)
2. [Промпты для автоматической трассировки](#2-промпты-для-автоматической-трассировки)
3. [Анализ отчетов с помощью AI](#3-анализ-отчетов-с-помощью-ai)
4. [Автоматическая генерация слайсов](#4-автоматическая-генерация-слайсов)
5. [AI-ассистент для отладки](#5-ai-ассистент-для-отладки)
6. [Шаблоны промптов](#6-шаблоны-промптов)
7. [Интеграция с AI API](#7-интеграция-с-ai-api)
8. [Практические кейсы](#8-практические-кейсы)
9. [Быстрая шпаргалка по промптам](#9-быстрая-шпаргалка-по-промптам)
10. [Советы по использованию](#10-советы-по-использованию)
11. [Заключение](#11-заключение)

---

## 1. Введение: AI + Tracer

### 1.1 Зачем объединять Tracer с AI?

| Без AI | С AI |
|--------|------|
| Сам анализируешь тысячи строк логов | AI анализирует и выделяет проблему |
| Сам пишешь код для трассировки | AI генерирует код под задачу |
| Сам ищешь паттерны в вызовах | AI находит аномалии |
| Часами отлаживаешь | Минуты на промпт |

### 1.2 Что можно делать с AI + Tracer

```javascript
// AI может:
// 1. Написать код трассировки под задачу
// 2. Проанализировать отчеты и найти проблему
// 3. Предложить слайсы на основе кода
// 4. Объяснить, почему произошла ошибка
// 5. Сгенерировать тесты на основе трассировки
// 6. Оптимизировать настройки фильтрации
// 7. Сравнить два сценария и найти различия
```

---

## 2. Промпты для автоматической трассировки

### 2.1 Базовый промпт для трассировки класса

```markdown
**Промпт:**
Напиши код для трассировки класса `UserService` с помощью Tracer.
Нужно отслеживать все методы и их аргументы. Используй профиль 'balanced'.

**Ответ AI:**
```

```javascript
// AI сгенерирует:
import { Tracer } from './tracer.js';

class UserService {
  async getUser(id) {
    return { id, name: 'John' };
  }
  
  async updateUser(id, data) {
    return { id, ...data };
  }
  
  async deleteUser(id) {
    return { success: true };
  }
}

// Настройка профиля
Tracer.setTraceProfile('balanced');

// Оборачиваем класс
const TracedUserService = Tracer.observeConstructor(UserService, 'UserService');

// Подписка на события
Tracer.traceCalls((event) => {
  if (event.place === 'before') {
    console.log(`→ ${event.fullName}`, event.args);
  } else {
    console.log(`← ${event.fullName} (${event.durationMs}ms)`, event.value);
  }
});

const service = new TracedUserService();
await service.getUser(123);
```

### 2.2 Промпт для трассировки конкретного метода

```markdown
**Промпт:**
Нужно отследить ТОЛЬКО метод `processPayment` в классе `PaymentService`.
Используй слайс (отрезок в стеке вызовов). Я хочу видеть все вызовы внутри этого метода.

**Ответ AI:**
```

```javascript
// AI сгенерирует слайс для отрезка стека:
Tracer.defineSlice('paymentSlice', {
  // Начало отрезка: вход в processPayment
  predicate: (event) => event.fullName === 'PaymentService.processPayment',
  beforeCall: () => {
    console.log('🎯 НАЧАЛО ОТРЕЗКА: processPayment');
    return true;
  },
  afterCall: () => {
    console.log('🎯 КОНЕЦ ОТРЕЗКА: processPayment');
    return false;
  },
  description: 'Отрезок стека для метода processPayment'
});

// Подписываемся на события ТОЛЬКО внутри отрезка
Tracer.traceBySlice('paymentSlice', (event) => {
  const indent = '  '.repeat(event.depth || 0);
  console.log(`${indent}${event.place === 'before' ? '→' : '←'} ${event.fullName}`);
});

Tracer.enableSlice('paymentSlice');
```

### 2.3 Промпт для batch-трассировки в production

```markdown
**Промпт:**
Мне нужна трассировка для production. Используй минимальный профиль
и batch-отправку на сервер каждые 5 секунд. Добавь обработку ошибок.

**Ответ AI:**
```

```javascript
// AI сгенерирует:
class ProductionTracer {
  constructor() {
    this.buffer = [];
    this.isSending = false;
    this.setup();
  }
  
  setup() {
    // Минимальный профиль для production
    Tracer.setTraceProfile('minimal');
    Tracer.configureTracing({ 
      suppressNoisy: true,
      enableProperties: false,
      captureContext: false
    });
    
    // Batch-подписка
    Tracer.traceAllBatched((batch) => {
      this.buffer.push(...batch);
      this.flush();
    }, { 
      maxBatchSize: 100, 
      flushIntervalMs: 5000 
    });
  }
  
  async flush() {
    if (this.isSending || this.buffer.length === 0) return;
    
    this.isSending = true;
    const batch = [...this.buffer];
    this.buffer = [];
    
    try {
      await fetch('/api/trace', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          timestamp: Date.now(),
          events: batch.map(e => ({
            type: e.eventType,
            name: e.fullName,
            duration: e.durationMs
          }))
        })
      });
    } catch (error) {
      console.error('Failed to send traces:', error);
      this.buffer.unshift(...batch);
    } finally {
      this.isSending = false;
      if (this.buffer.length > 0) this.flush();
    }
  }
  
  stop() {
    Tracer.untraceAll();
    this.flush();
  }
}

const tracer = new ProductionTracer();
```

### 2.4 Промпт для трассировки с фильтрацией шума

```markdown
**Промпт:**
В моем приложении есть много шумных вызовов: onTimerScroll, _animation, _autoSave.
Настрой Tracer так, чтобы эти вызовы игнорировались. Также добавь фильтр,
чтобы отслеживались только методы сервисов.

**Ответ AI:**
```

```javascript
// AI сгенерирует:
Tracer.configureTracing({
  suppressNoisy: true,
  noisyCalls: [
    'onTimerScroll',
    '_animation', 
    '_autoSave',
    'CEditorPage.onTimerScroll',
    'PaintMessageLoop._animation',
    'baseEditorsApi._autoSave'
  ],
  callFilter: ({ fullName, className }) => {
    // Только методы сервисов и репозиториев
    const allowedPatterns = ['Service', 'Repository', 'Controller', 'Gateway'];
    return allowedPatterns.some(p => fullName.includes(p) || className?.includes(p));
  }
});

// Дополнительно: слайс для критических операций
Tracer.defineSlice('critical', {
  predicate: (event) => {
    const critical = ['Payment', 'Order', 'Auth', 'Checkout'];
    return critical.some(c => event.fullName.includes(c));
  },
  beforeCall: () => true,
  afterCall: () => false
});

Tracer.traceBySlice('critical', (event) => {
  console.log(`[CRITICAL] ${event.fullName}`, event.args);
});
```

---

## 3. Анализ отчетов с помощью AI

### 3.1 Промпт для анализа дерева вызовов

```markdown
**Промпт:**
Вот дерево вызовов из ReportTreeView. Найди аномалии, рекурсии и потенциальные проблемы:

```
OrderService.createOrder - [{"id":"123"}]
  OrderService.validateOrder - none values
    OrderService.checkStock - none values
      OrderService.checkStock - none values
        OrderService.checkStock - none values
          OrderService.checkStock - none values
  OrderService.calculateTotal - none values
  PaymentService.charge - none values
  OrderService.saveOrder - none values
```

**Ответ AI:**
```

```markdown
## Анализ дерева вызовов

### Найденные аномалии:

1. **Рекурсия в checkStock**
   - Функция `OrderService.checkStock` вызывает саму себя
   - Глубина рекурсии: 4 уровня
   - Потенциальная проблема: бесконечная рекурсия или stack overflow
   - Рекомендация: добавить базовый случай или заменить на итеративный подход

2. **Отсутствует проверка после рекурсии**
   - После 4 вызовов checkStock нет проверки результата
   - Возможно, рекурсия не нужна

3. **Порядок вызовов**
   - validateOrder → calculateTotal → charge → saveOrder
   - Нормальный порядок, но рекурсия внутри validateOrder может быть проблемой

### Рекомендации по исправлению:
```javascript
// Исправленная версия checkStock
checkStock(itemId, depth = 0) {
  if (depth > 10) {
    console.error('Max recursion depth reached');
    return false;
  }
  // ... логика проверки
  return this.checkStock(itemId, depth + 1);
}
```
```

### 3.2 Промпт для сравнения отчетов

```markdown
**Промпт:**
У меня есть два отчета ReportSliceDiff:
- До изменения: [вставь отчет A]
- После изменения: [вставь отчет B]

Что изменилось? Какие изменения могли вызвать баг?

**Отчет A (работает корректно):**
```
Calls: [
  {index:0, fullName:"OrderService.createOrder", args:[{items:[{price:100}]}]},
  {index:1, fullName:"OrderService.validateOrder", args:[{items:[{price:100}]}]},
  {index:2, fullName:"OrderService.calculateTotal", args:[{items:[{price:100}]}]},
  {index:3, fullName:"PaymentService.charge", args:[100]},
  {index:4, fullName:"OrderService.saveOrder", args:[{total:100}]}
]
```

**Отчет B (падает с ошибкой):**
```
Calls: [
  {index:0, fullName:"OrderService.createOrder", args:[{items:[]}]},
  {index:1, fullName:"OrderService.validateOrder", args:[{items:[]}]},
  {index:2, fullName:"OrderService.calculateTotal", args:[{items:[]}]},
  {index:3, fullName:"OrderService.saveOrder", args:[{total:0}]}
]
```

**Ответ AI:**
```

```markdown
## Сравнение отчетов

### Изменения в последовательности вызовов:

| Позиция | Отчет A (работает) | Отчет B (падает) |
|---------|-------------------|------------------|
| 3 | `PaymentService.charge` | (отсутствует) |
| 4 | `OrderService.saveOrder` | `OrderService.saveOrder` |

### Потенциальные проблемы:

1. **Пропущен вызов `PaymentService.charge`**
   - Это критично для бизнес-логики
   - Причина: пустая корзина (items: [])
   - В charge не должна передаваться сумма 0

2. **`calculateTotal` вернул 0**
   - При пустой корзине total = 0
   - charge не вызывается при total === 0

### Вероятная причина бага:
В методе `createOrder` есть условие:
```javascript
if (total > 0) {
  await this.charge(total);
}
```
При пустой корзине total = 0, платеж не обрабатывается, но сохранение происходит.

### Решение:
```javascript
async createOrder(items) {
  if (!items || items.length === 0) {
    throw new Error('Cart is empty');
  }
  // ... остальная логика
}
```
```

### 3.3 Промпт для анализа использования (ReportSliceUsage)

```markdown
**Промпт:**
Вот отчет ReportSliceUsage:

```json
{
  "classes": ["UserService", "PaymentService", "Logger", "Cache", "Validator"],
  "methods": ["getUser", "updateUser", "processPayment", "log", "get", "set", "validate"],
  "propertiesGet": ["config.apiKey", "user.balance", "payment.amount"],
  "propertiesSet": ["user.status", "payment.result", "order.status"],
  "eventsCount": 47
}
```

Какие классы/методы не используются, но должны? Найди потенциальные проблемы.

**Ответ AI:**
```

```markdown
## Анализ покрытия

### Используемые классы: 5
### Используемые методы: 7

### Потенциальные проблемы:

1. **Отсутствует `AuditLog.record`**
   - Класс AuditLog не используется
   - Должен логировать все платежи для compliance
   - **Риск:** нарушение требований аудита

2. **Свойство `user.balance` только читается**
   - Ни разу не изменяется внутри платежа
   - Баланс должен уменьшаться при списании
   - **Баг:** баланс пользователя не обновляется

3. **Класс `Validator` используется, но метод `validateOrder` отсутствует**
   - Вызывается только `validate`
   - Возможно, валидация заказа неполная

4. **Частое чтение `config.apiKey` (много вызовов)**
   - Рекомендуется закэшировать

### Рекомендации:

```javascript
// 1. Добавить аудит
class PaymentService {
  async processPayment(amount) {
    const result = await this.gateway.charge(amount);
    await AuditLog.record('payment', { amount, result }); // Добавить
    return result;
  }
}

// 2. Обновлять баланс
class UserService {
  async processPayment(userId, amount) {
    const user = await this.getUser(userId);
    user.balance -= amount; // Добавить обновление баланса
    await this.updateUser(user);
  }
}

// 3. Добавить валидацию заказа
class OrderService {
  async createOrder(items) {
    await this.validator.validateOrder(items); // Добавить вызов
    // ...
  }
}
```
```

---

## 4. Автоматическая генерация слайсов

### 4.1 Промпт для генерации слайсов по коду

```markdown
**Промпт:**
Вот код класса OrderProcessor. Сгенерируй слайсы (отрезки в стеке вызовов)
для всех критических операций: валидация, платеж, сохранение в БД.

```javascript
class OrderProcessor {
  async processOrder(order) {
    await this.validate(order);
    await this.processPayment(order);
    await this.saveToDatabase(order);
    await this.sendNotification(order);
    return { success: true };
  }
  
  async validate(order) { /* ... */ }
  async processPayment(order) { /* ... */ }
  async saveToDatabase(order) { /* ... */ }
  async sendNotification(order) { /* ... */ }
}
```

**Ответ AI:**
```

```javascript
// AI сгенерирует слайсы для каждой критической операции:

// Настройка асинхронного контекста
Tracer.configure({ asyncContext: 'stack' });
Tracer.setTraceProfile('balanced');

// Слайс 1: Валидация заказа
Tracer.defineSlice('orderValidation', {
  predicate: (event) => event.fullName === 'OrderProcessor.validate',
  beforeCall: () => console.log('🔍 НАЧАЛО ВАЛИДАЦИИ'),
  afterCall: (event) => {
    console.log(`✅ КОНЕЦ ВАЛИДАЦИИ: ${event.value?.valid ? 'успешно' : 'ошибка'}`);
    return false;
  },
  description: 'Отрезок стека для валидации заказа'
});

// Слайс 2: Обработка платежа
Tracer.defineSlice('paymentProcessing', {
  predicate: (event) => event.fullName === 'OrderProcessor.processPayment',
  beforeCall: (event) => {
    console.log(`💳 НАЧАЛО ПЛАТЕЖА: сумма ${event.args[0]?.total}`);
    return true;
  },
  afterCall: (event) => {
    console.log(`💰 КОНЕЦ ПЛАТЕЖА: ${event.value?.success ? 'успешен' : 'отклонен'}`);
    return false;
  },
  description: 'Отрезок стека для платежа'
});

// Слайс 3: Сохранение в БД
Tracer.defineSlice('databaseSave', {
  predicate: (event) => event.fullName === 'OrderProcessor.saveToDatabase',
  beforeCall: () => console.log('💾 НАЧАЛО СОХРАНЕНИЯ'),
  afterCall: () => console.log('📀 КОНЕЦ СОХРАНЕНИЯ'),
  description: 'Отрезок стека для БД операций'
});

// Слайс 4: Весь процесс (вложенный)
Tracer.defineSlice('fullProcess', {
  predicate: (event) => event.fullName === 'OrderProcessor.processOrder',
  beforeCall: () => {
    console.log('\n🚀 НАЧАЛО ОБРАБОТКИ ЗАКАЗА');
    console.log('Активированы дочерние слайсы');
    return true;
  },
  afterCall: () => {
    console.log('🏁 КОНЕЦ ОБРАБОТКИ ЗАКАЗА\n');
    return false;
  },
  description: 'Полный отрезок обработки заказа'
});

// Подписка на все слайсы
Tracer.traceBySlice('fullProcess', (event) => {
  console.log(`  [Full] ${event.fullName}`);
});

Tracer.traceBySlice('orderValidation', (event) => {
  if (event.place === 'before') {
    console.log(`    [Validation] → ${event.fullName}`);
  }
});

Tracer.traceBySlice('paymentProcessing', (event) => {
  if (event.place === 'after') {
    console.log(`    [Payment] завершен за ${event.durationMs}ms`);
  }
});

// Включаем нужные слайсы
Tracer.enableSlice('fullProcess');
// Tracer.enableSlice('paymentProcessing'); // можно включать отдельно
```

### 4.2 Промпт для автоматической настройки профиля

```markdown
**Промпт:**
У меня high-load приложение (1000+ запросов в секунду).
Помоги настроить оптимальную трассировку Tracer.
Нужно минимизировать оверхед, но отслеживать критически важные операции.

**Ответ AI:**
```

```javascript
// AI сгенерирует оптимизированную конфигурацию:

// 1. Минимальный профиль
Tracer.setTraceProfile('minimal');

// 2. Настройка шумоподавления
Tracer.configureTracing({
  suppressNoisy: true,
  enableProperties: false,     // Свойства не отслеживаем (экономия памяти)
  captureContext: false,       // Контекст не сохраняем
  noisyCalls: [
    'Logger.log',              // Логи не нужны
    'Metrics.record',          // Метрики тоже шумят
    'HealthCheck.ping',        // Пинг каждую секунду
    'Cache.get',               // Кэш часто читается
    'Cache.set'                // Кэш часто пишется
  ]
});

// 3. Включаем только критичные слайсы
const criticalSlices = [
  'paymentProcessing',
  'orderCreation',
  'userAuthentication'
];

criticalSlices.forEach(slice => Tracer.enableSlice(slice));

// 4. Batch-отправка с адаптивным интервалом
let adaptiveInterval = 5000; // начнем с 5 секунд
let eventCount = 0;

setInterval(() => {
  if (eventCount > 10000) {
    // Слишком много событий - увеличиваем интервал
    adaptiveInterval = Math.min(adaptiveInterval * 1.5, 60000);
    console.log(`Адаптивный интервал увеличен до ${adaptiveInterval}ms`);
  } else if (eventCount < 100 && adaptiveInterval > 5000) {
    // Мало событий - уменьшаем интервал
    adaptiveInterval = Math.max(adaptiveInterval / 1.5, 1000);
  }
  eventCount = 0;
}, 60000);

// 5. Адаптивная трассировка (отключение при перегрузке)
let isTracingEnabled = true;
let highLoadStart = null;

Tracer.traceAllBatched((batch) => {
  eventCount += batch.length;
  
  // Если более 1000 событий в секунду - отключаем трассировку
  if (eventCount > 1000 && isTracingEnabled) {
    if (!highLoadStart) highLoadStart = Date.now();
    if (Date.now() - highLoadStart > 5000) {
      console.warn('⚠️ Высокая нагрузка, трассировка отключена');
      Tracer.untraceAll();
      isTracingEnabled = false;
    }
  } else {
    highLoadStart = null;
  }
  
  // Асинхронная отправка
  setImmediate(() => {
    fetch('/api/trace', {
      method: 'POST',
      body: JSON.stringify(batch)
    }).catch(e => console.error('Trace send failed:', e));
  });
}, { maxBatchSize: 200, flushIntervalMs: adaptiveInterval });

console.log('✅ Оптимизированная трассировка запущена');
```

---

## 5. AI-ассистент для отладки

### 5.1 Промпт для поиска бага по логам

```markdown
**Промпт:**
Вот логи трассировки Tracer. Приложение падает с ошибкой "Cannot read property 'id' of undefined".
Найди, где и почему.

```
[14:32:01.123] → OrderService.getOrder
  args: [123]
[14:32:01.125]   → Database.query
    args: ["SELECT * FROM orders WHERE id = 123"]
[14:32:01.245]   ← Database.query
    result: null
[14:32:01.246]   → OrderService.processOrderData
    args: [null]
[14:32:01.247]     → processOrderData.validate
      args: [null]
[14:32:01.247]       → validate.checkId
        args: [null]
[14:32:01.248]         ERROR: Cannot read property 'id' of undefined
```

**Ответ AI:**
```

```markdown
## Анализ логов

### Найден проблемный участок:

Стек вызовов показывает:
1. `Database.query` вернул `null` (заказ не найден)
2. `OrderService.processOrderData` вызван с аргументом `null`
3. `validate.checkId` пытается прочитать `order.id`
4. `null.id` → ошибка

### Причина:
База данных не вернула заказ с ID 123, но код не обработал эту ситуацию.

### Решение:

```javascript
// Было (проблемный код):
async processOrder(orderId) {
  const order = await Database.query(`SELECT * FROM orders WHERE id = ${orderId}`);
  return this.processOrderData(order); // order может быть null
}

// Стало (исправленный код):
async processOrder(orderId) {
  const order = await Database.query(`SELECT * FROM orders WHERE id = ${orderId}`);
  if (!order) {
    throw new Error(`Order ${orderId} not found`);
  }
  return this.processOrderData(order);
}
```

### Предотвращение в будущем:

Добавить слайс для отслеживания null-значений:

```javascript
Tracer.debugOn('afterCallMethod', (event) => {
  return event.result === null && event.fullName === 'Database.query';
});
```

При срабатывании автоматически остановит выполнение в debugger.
```

### 5.2 Промпт для оптимизации производительности

```markdown
**Промпт:**
Вот отчет с длительностями вызовов. Найди узкие места:

```
Database.aggregate: 2340ms
ImageProcessor.resize: 1500ms
ApiClient.fetch: 800ms
Validator.schema: 450ms
Logger.format: 200ms
```

**Ответ AI:**
```

```markdown
## Анализ производительности

### Топ-5 медленных вызовов:

| Метод | Длительность | Рекомендация | Ожидаемый эффект |
|-------|--------------|--------------|------------------|
| `Database.aggregate` | 2340ms | Добавить индекс | -80% |
| `ImageProcessor.resize` | 1500ms | Использовать worker | -70% |
| `ApiClient.fetch` | 800ms | Параллелизовать | -60% |
| `Validator.schema` | 450ms | Кэшировать схему | -90% |
| `Logger.format` | 200ms | Убрать из hot path | -95% |

### Детальный анализ и код решений:

**1. Database.aggregate (2340ms)**
```javascript
// Проблема: нет индекса
// Решение: добавить индекс
db.orders.createIndex({ createdAt: -1 });
db.orders.createIndex({ userId: 1, status: 1 });
```

**2. ImageProcessor.resize (1500ms)**
```javascript
// Проблема: синхронная обработка
// Решение: использовать Worker Threads
const { Worker } = require('worker_threads');

async function resizeImages(images) {
  const workers = images.map(img => {
    return new Promise((resolve, reject) => {
      const worker = new Worker('./resize-worker.js');
      worker.postMessage(img);
      worker.on('message', resolve);
      worker.on('error', reject);
    });
  });
  return Promise.all(workers);
}
```

**3. ApiClient.fetch (800ms × N)**
```javascript
// Проблема: последовательные запросы
// Решение: параллельные запросы
// Было:
const user = await api.getUser(id);
const orders = await api.getOrders(id);
const payments = await api.getPayments(id);

// Стало:
const [user, orders, payments] = await Promise.all([
  api.getUser(id),
  api.getOrders(id),
  api.getPayments(id)
]);
```

**4. Validator.schema (450ms)**
```javascript
// Проблема: компиляция схемы при каждом вызове
// Решение: кэширование
const schemaCache = new Map();

function validate(data, schemaName) {
  if (!schemaCache.has(schemaName)) {
    schemaCache.set(schemaName, compileSchema(schemaName));
  }
  return schemaCache.get(schemaName).validate(data);
}
```

### Прогноз улучшения:
- Текущее общее время: ~5.5s
- После оптимизации: ~1s
- Ускорение: **~80%**
```

---

## 6. Шаблоны промптов

### 6.1 Для трассировки кода

```markdown
## Шаблон: "Трассируй этот код"

Мне нужно трассировать следующий код с помощью Tracer:

[вставь код]

Требования:
- [ ] Отслеживать все методы класса
- [ ] Собирать статистику по вызовам (ReportUsage)
- [ ] Выводить дерево вызовов (ReportTreeView)
- [ ] Использовать профиль [minimal/balanced/full]
- [ ] Включить контекст для асинхронности
- [ ] Добавить слайс для основного метода

Сгенерируй полный код трассировки.
```

### 6.2 Шаблон: "Найди баг по логам"

```markdown
## Шаблон: "Анализ логов"

Вот логи трассировки из Tracer:

[вставь логи]

Симптомы проблемы:
[опиши, что не так: ошибка, падение, зависание]

Найди:
1. Где именно возникает проблема
2. Почему это происходит
3. Как это исправить
4. Как предотвратить в будущем (слайс/debugOn)

Пожалуйста, предоставь конкретный код исправления.
```

### 6.3 Шаблон: "Оптимизируй производительность"

```markdown
## Шаблон: "Анализ производительности"

Вот отчет о длительности вызовов из Tracer:

[вставь таблицу или JSON с durationMs]

Метрики:
- Допустимое время ответа: [X]ms
- Текущее среднее: [Y]ms

Найди:
1. Самые медленные вызовы
2. Их причину
3. Рекомендации по оптимизации с кодом
4. Ожидаемый эффект
```

### 6.4 Шаблон: "Сравни два сценария"

```markdown
## Шаблон: "Сравнение сценариев"

У меня есть два сценария выполнения:

Сценарий А (работает корректно):
[вставь отчет ReportSliceDiff или логи]

Сценарий Б (падает с ошибкой):
[вставь отчет ReportSliceDiff или логи]

Сравни их и найди:
1. Отличия в последовательности вызовов
2. Отличия в аргументах
3. Какое изменение вызвало проблему
4. Как это исправить
```

### 6.5 Шаблон: "Создай отчет" (для AI)

```markdown
## Шаблон: "Создай анализ трассировки"

Проанализируй эту трассировку Tracer и создай структурированный отчет:

[вставь сырые логи или JSON]

Отчет должен содержать:
1. **Executive Summary** - краткое заключение
2. **Статистика вызовов** - топ методов, частота
3. **Аномалии** - необычные паттерны
4. **Проблемы производительности** - медленные вызовы
5. **Рекомендации** - конкретные шаги по улучшению

Формат: Markdown
```

---

## 7. Интеграция с AI API

### 7.0 Актуальность API и безопасность данных

```markdown
- Для новых интеграций используй OpenAI Responses API (`responses.create`).
- Модель указывай как актуальную для проекта (например, `gpt-4.1-mini` или новее).
- Не отправляй в AI сырые трассировки с персональными данными, токенами, ключами.
- Перед отправкой делай маскирование и ограничивай размер payload.
```

### 7.1 Промпт для создания AI-агента

```markdown
**Промпт:**
Создай агента на JavaScript, который:
1. Собирает трассировку через Tracer
2. Отправляет отчеты в ChatGPT API
3. Получает рекомендации
4. Автоматически применяет простые фиксы
5. Логирует все действия

**Ответ AI:**
```

```javascript
// AI сгенерирует:
import { Tracer } from './tracer.js';
import { ReportSliceUsage, ReportSliceDiff } from './reports/index.js';
import OpenAI from 'openai';

class TracerAIAgent {
  constructor(apiKey) {
    this.openai = new OpenAI({ apiKey });
    this.reports = [];
    this.fixes = [];
  }
  
  async setup() {
    // Настройка Tracer
    Tracer.configure({ asyncContext: 'stack' });
    Tracer.setTraceProfile('balanced');
    
    // Слайс для отслеживания
    Tracer.defineSlice('aiAnalysis', {
      predicate: (event) => event.fullName.includes('Service') || 
                           event.fullName.includes('Controller'),
      beforeCall: () => true,
      afterCall: () => false
    });
    
    // Сбор отчета
    const usageReport = new ReportSliceUsage({
      tracer: Tracer,
      sliceName: 'aiAnalysis',
      startPredicate: (event) => event.fullName.includes('Service'),
      endPredicate: (event) => false
    });
    
    usageReport.start();
    
    // Анализ каждые 5 минут
    setInterval(async () => {
      const run = usageReport.getLastRun();
      if (run) {
        await this.analyze(run);
      }
    }, 300000);
  }
  
  async analyze(run) {
    console.log('🤖 AI Agent: Анализирую трассировку...');
    
    const prompt = `
    Проанализируй отчет трассировки Tracer:
    
    - Классы: ${run.classes.join(', ')}
    - Методы: ${run.methods.join(', ')}
    - Прочитано свойств: ${run.propertiesGet.length}
    - Изменено свойств: ${run.propertiesSet.length}
    - Всего событий: ${run.eventsCount}
    
    Найди:
    1. Потенциальные проблемы производительности
    2. Неиспользуемые методы
    3. Частые ошибки
    4. Рекомендации по улучшению
    `;
    
    try {
      const response = await this.openai.responses.create({
        model: 'gpt-4.1-mini',
        input: [
          { role: 'system', content: 'Ты эксперт по оптимизации кода и отладке.' },
          { role: 'user', content: prompt }
        ],
        temperature: 0.3
      });
      
      const analysis = response.output_text;
      console.log('📊 AI Analysis:', analysis);
      
      this.reports.push({
        timestamp: Date.now(),
        analysis,
        run
      });
      
      await this.extractFixes(analysis);
      
    } catch (error) {
      console.error('AI Analysis failed:', error);
    }
  }
  
  async extractFixes(analysis) {
    // Извлекаем рекомендации из текста
    const fixPrompt = `
    Из этого анализа извлеки конкретные действия по исправлению кода.
    Верни JSON массив с полями: file, line, original, fixed, description.
    
    Анализ:
    ${analysis}
    `;
    
    const response = await this.openai.responses.create({
      model: 'gpt-4.1-mini',
      input: [{ role: 'user', content: fixPrompt }],
      temperature: 0
    });
    
    try {
      const fixes = JSON.parse(response.output_text);
      this.fixes.push(...fixes);
      console.log(`🔧 Найдено ${fixes.length} потенциальных исправлений`);
    } catch (e) {
      console.log('No structured fixes found');
    }
  }
  
  async suggestOptimizations() {
    const allMethods = [...new Set(this.reports.flatMap(r => r.run.methods))];
    
    const prompt = `
    Методы, которые чаще всего вызываются:
    ${allMethods.slice(0, 20).join('\n')}
    
    Предложи оптимизации для самых частых вызовов.
    `;
    
    const response = await this.openai.responses.create({
      model: 'gpt-4.1-mini',
      input: [{ role: 'user', content: prompt }]
    });
    
    return response.output_text;
  }
  
  getReport() {
    return {
      totalReports: this.reports.length,
      totalFixes: this.fixes.length,
      lastAnalysis: this.reports[this.reports.length - 1],
      fixes: this.fixes
    };
  }
}

// Использование
const agent = new TracerAIAgent(process.env.OPENAI_API_KEY);
await agent.setup();
console.log('🤖 AI Agent запущен и анализирует трассировку');

// Получить отчет
setTimeout(() => {
  console.log(agent.getReport());
}, 60000);
```

### 7.2 Промпт для интеграции с CI/CD

```markdown
**Промпт:**
Создай GitHub Action, который:
1. Запускает тесты с включенным Tracer
2. Собирает отчеты
3. Отправляет их в AI для анализа
4. Создает issue с рекомендациями

**Ответ AI:**
```

```yaml
# .github/workflows/tracer-ai-analysis.yml
name: Tracer AI Analysis

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]

jobs:
  analyze:
    runs-on: ubuntu-latest
    
    steps:
      - uses: actions/checkout@v3
      
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
          
      - run: npm ci
      
      - name: Run tests with Tracer
        run: |
          node --trace-warnings \
            -r ./tracer-init.js \
            node_modules/.bin/jest \
            --json \
            --outputFile=test-results.json
        env:
          TRACER_PROFILE: minimal
          TRACER_OUTPUT: trace-report.json
          
      - name: Analyze with AI
        uses: actions/github-script@v6
        with:
          script: |
            const fs = require('fs');
            const trace = JSON.parse(fs.readFileSync('trace-report.json'));
            
            const analysis = await fetch('https://api.openai.com/v1/responses', {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
                'Content-Type': 'application/json'
              },
              body: JSON.stringify({
                model: 'gpt-4.1-mini',
                input: [{
                  role: 'system',
                  content: 'Ты эксперт по качеству кода. Анализируй трассировку.'
                }, {
                  role: 'user',
                  content: `Проанализируй: ${JSON.stringify(trace)}`
                }]
              })
            });
            
            const result = await analysis.json();
            fs.writeFileSync('ai-analysis.md', result.output_text || '');
            
      - name: Create Issue
        if: github.event_name == 'pull_request'
        uses: actions/github-script@v6
        with:
          script: |
            const fs = require('fs');
            const analysis = fs.readFileSync('ai-analysis.md', 'utf8');
            
            await github.rest.issues.create({
              owner: context.repo.owner,
              repo: context.repo.repo,
              title: '🤖 AI Analysis: Performance Recommendations',
              body: analysis,
              labels: ['ai-analysis', 'performance']
            });
```

---

## 8. Практические кейсы

### 8.1 Кейс: Отладка бага за 5 минут

```markdown
**Пользователь:**
У меня падает платеж при сумме больше 1000. Вот код. Помоги быстро найти проблему.

```javascript
class PaymentService {
  async process(amount, method) {
    const fee = this.calculateFee(amount);
    const total = amount + fee;
    const result = await this.charge(total, method);
    return this.formatResponse(result);
  }
  
  calculateFee(amount) { 
    return amount * 0.03; 
  }
  
  async charge(amount, method) { 
    // вызов внешнего API
    return { success: true, amount };
  }
  
  formatResponse(result) { 
    return { status: 'ok', data: result };
  }
}
```

**AI отвечает:**
Вот готовый код трассировки. Запусти и покажи вывод:

```javascript
Tracer.setTraceProfile('full');
Tracer.configure({ asyncContext: 'stack' });

Tracer.defineSlice('paymentDebug', {
  predicate: (event) => event.fullName === 'PaymentService.process',
  beforeCall: () => true,
  afterCall: () => false
});

Tracer.traceBySlice('paymentDebug', (event) => {
  if (event.place === 'before') {
    console.log(`→ ${event.fullName}`, event.args);
  } else if (event.status === 'error') {
    console.error(`❌ Ошибка в ${event.fullName}:`, event.error);
  } else {
    console.log(`← ${event.fullName} ->`, event.value);
  }
});

Tracer.enableSlice('paymentDebug');

const service = new PaymentService();
await service.process(1500, 'card');
```

**Пользователь (после запуска):**
```
→ PaymentService.process [1500, 'card']
→ PaymentService.calculateFee [1500]
← PaymentService.calculateFee -> 45
→ PaymentService.charge [1545, 'card']
❌ Ошибка в PaymentService.charge: Error: Amount exceeds limit (max: 1000)
```

**AI отвечает:**
Нашел проблему! Ошибка в `charge`: лимит 1000, а вы передаете 1545.

**Решение:**
```javascript
async process(amount, method) {
  const MAX_AMOUNT = 1000;
  
  if (amount > MAX_AMOUNT) {
    throw new Error(`Amount ${amount} exceeds limit of ${MAX_AMOUNT}`);
  }
  
  const fee = this.calculateFee(amount);
  const total = amount + fee;
  const result = await this.charge(total, method);
  return this.formatResponse(result);
}
```

**Предотвращение в будущем:**
```javascript
Tracer.debugOn('beforeCallMethod', (event) => {
  return event.fullName === 'PaymentService.charge' && event.args[0] > 1000;
});
```
```

### 8.2 Кейс: Автоматическое создание отчетов

```markdown
**Пользователь:**
Сгенерируй код, который будет собирать отчеты о работе моего API
и отправлять их в AI для анализа каждые 10 минут.

**AI отвечает:**
```javascript
import { Tracer } from './tracer.js';
import { ReportSliceUsage } from './reports/index.js';

class APIMonitor {
  constructor(aiApiKey) {
    this.aiApiKey = aiApiKey;
    this.lastReport = null;
  }
  
  start() {
    Tracer.configure({ asyncContext: 'stack' });
    Tracer.setTraceProfile('balanced');
    
    // Слайс для API запросов
    Tracer.defineSlice('apiCalls', {
      predicate: (event) => event.fullName.includes('Controller') ||
                           event.fullName.includes('Handler'),
      beforeCall: () => true,
      afterCall: () => false
    });
    
    // Сбор статистики
    this.monitor = new ReportSliceUsage({
      tracer: Tracer,
      sliceName: 'apiCalls',
      startPredicate: (event) => event.fullName.includes('.handle'),
      endPredicate: (event) => false
    });
    
    this.monitor.start();
    
    // Анализ каждые 10 минут
    setInterval(() => this.analyze(), 600000);
  }
  
  async analyze() {
    const run = this.monitor.getLastRun();
    if (!run || run === this.lastReport) return;
    
    this.lastReport = run;
    
    const analysis = await this.callAI(run);
    console.log(`[AI Analysis] ${new Date().toISOString()}`);
    console.log(analysis);
    
    // Сохраняем отчет
    await this.saveReport(run, analysis);
  }
  
  async callAI(run) {
    const response = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.aiApiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'gpt-4.1-mini',
        input: [{
          role: 'system',
          content: 'Анализируй API трассировку. Найди проблемы и дай рекомендации.'
        }, {
          role: 'user',
          content: `
          Отчет API за последние 10 минут:
          - Вызовов: ${run.eventsCount}
          - Методы: ${run.methods.join(', ')}
          - Классы: ${run.classes.join(', ')}
          - Чтение свойств: ${run.propertiesGet.length}
          - Запись свойств: ${run.propertiesSet.length}
          `
        }]
      })
    });
    
    const data = await response.json();
    return data.output_text || '';
  }
  
  async saveReport(run, analysis) {
    const report = {
      timestamp: Date.now(),
      stats: {
        events: run.eventsCount,
        methods: run.methods,
        classes: run.classes
      },
      analysis
    };
    
    // Сохраняем в файл
    const fs = await import('fs');
    fs.writeFileSync(`report-${Date.now()}.json`, JSON.stringify(report, null, 2));
    
    // Отправляем в систему мониторинга
    await fetch('https://your-monitor.com/api/trace', {
      method: 'POST',
      body: JSON.stringify(report)
    });
  }
}

const monitor = new APIMonitor(process.env.OPENAI_API_KEY);
monitor.start();
console.log('📊 API Monitor started with AI analysis every 10 minutes');
```

---

## 9. Быстрая шпаргалка по промптам

### 9.1 Промпты для генерации кода

| Задача | Промпт |
|--------|--------|
| Трассировка класса | "Сгенерируй код трассировки для класса [X] с профилем [balanced]" |
| Слайс для метода | "Создай слайс для отрезка стека от входа до выхода из метода [Y]" |
| Batch-обработка | "Сделай batch-трассировку с отправкой на сервер каждые N секунд" |
| Фильтрация шума | "Настрой фильтрацию шумных вызовов: [список методов]" |
| Асинхронность | "Включи асинхронную трассировку с сохранением CallId" |

### 9.2 Промпты для анализа

| Задача | Промпт |
|--------|--------|
| Анализ дерева | "Найди аномалии в этом дереве вызовов: [вставь дерево]" |
| Сравнение | "Сравни два отчета и найди причину бага" |
| Оптимизация | "Найди узкие места в отчете о производительности" |
| Покрытие | "Найди неиспользуемые методы в этом отчете: [вставь отчет]" |

### 9.3 Промпты для AI-агента

| Задача | Промпт |
|--------|--------|
| Создать агента | "Создай AI-агента, который анализирует трассировку и предлагает фиксы" |
| CI/CD интеграция | "Создай GitHub Action для автоматического анализа трассировки" |
| Авто-фиксы | "Создай систему, которая автоматически исправляет простые проблемы" |

### 9.4 Быстрые команды для AI

```markdown
# Для Claude/Codex:

"Напиши Tracer код для отслеживания всех методов класса X"

"Проанализируй этот лог Tracer и найди проблему: [лог]"

"Оптимизируй этот код на основе отчета Tracer: [отчет]"

"Создай слайс для метода X и подписку на события внутри него"

"Настрой фильтрацию шума для методов: onTimerScroll, _animation"

"Сравни два отчета ReportSliceDiff и найди отличия"

"Создай AI-агента для автоматического анализа трассировки"

"Добавь batch-отправку трассировки на сервер с адаптивным интервалом"
```

---

## 10. Советы по использованию

### 10.1 Best Practices

```markdown
1. **Начинай с малого**: Сначала попроси AI сгенерировать простую трассировку
2. **Уточняй контекст**: Чем больше деталей в промпте, тем лучше результат
3. **Итерируй**: Используй результаты AI для уточнения следующих промптов
4. **Проверяй код**: AI может ошибаться, всегда проверяй сгенерированный код
5. **Сохраняй промпты**: Хорошие промпты можно переиспользовать
6. **Санитайзь данные**: Маскируй PII/секреты перед отправкой в AI
7. **Ограничивай объем**: Отправляй только релевантный фрагмент трассировки
8. **Фиксируй модель**: В проде используй закрепленную модель и температуру
```

### 10.2 Что делать, если AI ответил неверно

```markdown
1. **Уточни вопрос**: "Нет, мне нужен слайс, а не глобальная трассировка"
2. **Добавь пример**: "Вот пример того, что я хочу: [код]"
3. **Разбей на части**: "Сначала создай слайс, потом подписку"
4. **Попроси объяснить**: "Объясни, почему ты предлагаешь именно такое решение"
```

### 10.3 Примеры плохих и хороших промптов

```markdown
❌ ПЛОХО: "Сделай трассировку"

✅ ХОРОШО: "Сделай трассировку класса PaymentService с профилем 'balanced', добавь слайс для метода processPayment и выведи дерево вызовов"

❌ ПЛОХО: "Найди баг"

✅ ХОРОШО: "Вот лог Tracer. Ошибка 'Cannot read property id of undefined' возникает при вызове OrderService.process. Найди место в коде, где order становится null"

❌ ПЛОХО: "Оптимизируй"

✅ ХОРОШО: "Вот отчет с длительностями: Database.query 2000ms, API.fetch 500ms. Предложи конкретные оптимизации с кодом"
```

### 10.4 Минимальный санитайзер трассировки перед AI

```javascript
function sanitizeTraceEvent(event) {
  const redact = (v) => {
    if (typeof v !== 'string') return v;
    return v
      .replace(/Bearer\s+[A-Za-z0-9._-]+/g, 'Bearer ***')
      .replace(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g, '***@***')
      .replace(/(api[_-]?key|token|password)\s*[:=]\s*['"]?[^'"\s]+/gi, '$1=***');
  };

  return {
    ...event,
    args: Array.isArray(event.args) ? event.args.map(redact) : event.args,
    value: redact(event.value),
    error: event.error ? String(event.error).slice(0, 300) : undefined
  };
}
```

---

## 11. Заключение

### 11.1 Резюме

Использование Tracer с AI (Claude/Codex/ChatGPT) позволяет:

1. **Ускорить отладку** в 10+ раз
2. **Автоматизировать анализ** отчетов
3. **Генерировать код** трассировки под задачу
4. **Находить аномалии** которые трудно заметить вручную
5. **Получать рекомендации** по оптимизации

### 11.2 Следующие шаги

```markdown
1. Сохрани этот гайд
2. Попробуй первые промпты на своем коде
3. Адаптируй шаблоны под свои задачи
4. Создай своего AI-агента для мониторинга
5. Поделись результатами с командой
```

---

**Tracer + AI | Гайд по использованию | Версия 1.0**

```javascript
// Скачать этот гайд:
// const blob = new Blob([aiGuide], { type: 'text/markdown' });
// const url = URL.createObjectURL(blob);
// const a = document.createElement('a');
// a.href = url;
// a.download = 'tracer-ai-guide.md';
// a.click();
```


---

## tracer-dev-guide

_Источник: [tracer-dev-guide.md](./tracer-dev-guide.md)_

# Tracer - Полный гайд разработчика

## От стратегии к конкретным решениям

---

> Источник истины по API: [docs/index.md](./index.md). Этот гайд сфокусирован на практических сценариях и потоке отладки.

## Оглавление

1. [Введение: Что такое Tracer](#1-введение-что-такое-tracer)
2. [Термины и определения](#2-термины-и-определения)
3. [Структура событий трассировки](#3-структура-событий-трассировки)
4. [Стратегия: От общей картины к точной отладке](#4-стратегия-от-общей-картины-к-точной-отладке)
5. [Фаза 1: Общая картина](#5-фаза-1-общая-картина)
6. [Фаза 2: Сужение до модуля](#6-фаза-2-сужение-до-модуля)
7. [Фаза 3: Отслеживание свойств](#7-фаза-3-отслеживание-свойств)
8. [Фаза 4: Точечная отладка](#8-фаза-4-точечная-отладка)
9. [Фильтрация шума](#9-фильтрация-шума)
10. [Асинхронная трассировка](#10-асинхронная-трассировка)
11. [Практические кейсы](#11-практические-кейсы)
12. [Шпаргалка](#12-шпаргалка)
13. [Минимальный Playbook для Legacy](#13-минимальный-playbook-для-legacy)
14. [Быстрый выбор сценария](#130-быстрый-выбор-сценария)

---

## 1. Введение: Что такое Tracer

**Tracer** — библиотека для runtime-трассировки JavaScript кода.

**Основные возможности:**
- Отслеживание вызовов функций (до/после выполнения)
- Мониторинг чтения/записи свойств объектов
- Выделение отрезков в стеке вызовов (слайсы)
- Генерация отчетов для анализа
- Фильтрация шумных вызовов
- Асинхронная трассировка с сохранением контекста

---

## 2. Термины и определения

| Термин | Определение |
|--------|-------------|
| **Стек вызовов** | Последовательность вложенных вызовов функций |
| **Слайс** | Отрезок в стеке вызовов от входа до выхода из функции |
| **Отчет** | Статистическая модель слайса (агрегация, анализ, визуализация) |
| **Шум** | Частые/малозначимые вызовы, засоряющие логи |
| **NoisyCalls** | Список функций для исключения из трассировки |
| **CallFilter** | Функция для гибкой фильтрации вызовов |
| **ExecutionContext** | Механизм асинхронного контекста (stack/zone) |
| **CallId** | Уникальный идентификатор вызова для связывания асинхронных цепочек |

---

## 3. Структура событий трассировки

### Базовый интерфейс события

```typescript
interface TraceEvent {
  eventType: 'functionCall' | 'propertyGet' | 'propertySet';
  place: 'before' | 'after';
  fullName: string;      // 'ClassName.methodName'
  className: string;
  fnKey?: string;        // Имя функции
  propName?: string;     // Имя свойства
  args?: any[];          // Аргументы вызова
  value?: any;           // Значение (для propertyGet)
  curValue?: any;        // Текущее значение (для propertySet)
  durationMs?: number;   // Длительность (для functionCall after)
  callId?: number;       // ID вызова (при captureContext: true)
  parentCallId?: number; // ID родителя
  tracerState: Map;      // Состояние слайсов
  depth?: number;        // Глубина в стеке
  callStack?: any;       // Полный контекст вызовов
}
```

### Пример обработки

```javascript
function handleEvent(event) {
  switch (event.eventType) {
    case 'functionCall':
      if (event.place === 'before') {
        console.log(`→ ${event.fullName}`, event.args);
      } else {
        console.log(`← ${event.fullName} (${event.durationMs}ms)`, event.value);
      }
      break;
    case 'propertyGet':
      console.log(`📖 ${event.className}.${event.propName} = ${event.value}`);
      break;
    case 'propertySet':
      console.log(`✏️ ${event.className}.${event.propName}: ${event.curValue} → ${event.value}`);
      break;
  }
}

Tracer.traceAll(handleEvent);
```

---

## 4. Стратегия: От общей картины к точной отладке

```
┌─────────────────────────────────────────────────────────────────────┐
│                                                                     │
│   Фаза 1: Общая картина                                             │
│   ┌─────────────────────────────────────────────────────────────┐   │
│   │  • ReportUsage - какие классы/методы используются?          │   │
│   │  • ReportTreeView - какова структура вложенности?           │   │
│   │  • Анализ частоты вызовов - что вызывается слишком часто?   │   │
│   └─────────────────────────────────────────────────────────────┘   │
│                                   │                                 │
│                                   ▼                                 │
│   Фаза 2: Сужение до модуля                                         │
│   ┌─────────────────────────────────────────────────────────────┐   │
│   │  • Слайс на конкретный класс/метод                          │   │
│   │  • ReportSliceUsage - детальная статистика                  │   │
│   │  • ReportSliceDiff - сравнение проходов                     │   │
│   └─────────────────────────────────────────────────────────────┘   │
│                                   │                                 │
│                                   ▼                                 │
│   Фаза 3: Отслеживание свойств                                      │
│   ┌─────────────────────────────────────────────────────────────┐   │
│   │  • observeProperty - наблюдение за конкретным свойством     │   │
│   │  • Трассировка изменений со стеком вызовов                  │   │
│   │  • Поиск цепочки присвоений                                 │   │
│   └─────────────────────────────────────────────────────────────┘   │
│                                   │                                 │
│                                   ▼                                 │
│   Фаза 4: Точечная отладка                                          │
│   ┌─────────────────────────────────────────────────────────────┐   │
│   │  • debugOn - условная точка останова                        │   │
│   │  • debugOnceOn - однократная остановка                      │   │
│   │  • Анализ аргументов и результатов                          │   │
│   └─────────────────────────────────────────────────────────────┘   │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 5. Фаза 1: Общая картина

### 5.1 ReportUsage - какие классы и методы используются?

```javascript
import { Tracer } from './tracer.js';
import { ReportUsage } from './reports/index.js';

const usageReport = new ReportUsage({ logProvider: console });

Tracer.traceCalls((event) => {
  if (event.place === 'before') {
    const [className, fnKey] = event.fullName.split('.');
    usageReport.log({ className, fnKey });
  }
});

// Через 5-10 секунд
usageReport.print();

// Вывод:
// UserService
// PaymentService
// DatabaseService
//
// Class: UserService.login
// Class: UserService.logout
// Class: PaymentService.processPayment
// Class: DatabaseService.query
```

### 5.2 ReportTreeView - структура вложенности

```javascript
import { ReportTreeView } from './reports/index.js';

const treeReport = new ReportTreeView();

Tracer.traceCalls((event) => {
  if (event.place === 'before') {
    treeReport.log({
      eventType: 'functionCall',
      place: 'before',
      className: event.className,
      fnKey: event.fnKey
    });
  } else if (event.place === 'after') {
    treeReport.log({
      eventType: 'functionCall',
      place: 'after',
      className: event.className,
      fnKey: event.fnKey
    });
  }
});

// Получение результата
const tree = treeReport.getResults();
console.log(tree.join('\n'));

// Вывод:
//  OrderService.processOrder - [{"id":"123"}]
//    OrderService.validateOrder - none values
//    OrderService.calculateTotal - none values
//      OrderService.getItems - none values
//    PaymentService.charge - none values
//  OrderService.processOrder - none values
```

### 5.3 ReportSimple - плоский список уникальных вызовов

```javascript
import { ReportSimple } from './reports/index.js';

const simpleReport = new ReportSimple({ logProvider: console });

Tracer.traceCalls((event) => {
  if (event.place === 'before') {
    const [className, fnKey] = event.fullName.split('.');
    simpleReport.log({ className, fnKey });
  }
});

// Вывод: уникальные вызовы без дубликатов и без вложенности
```

### 5.4 Анализ частоты вызовов

```javascript
const callFrequency = new Map();

Tracer.traceCalls((event) => {
  if (event.place === 'before') {
    const count = callFrequency.get(event.fullName) || 0;
    callFrequency.set(event.fullName, count + 1);
  }
});

setTimeout(() => {
  const sorted = Array.from(callFrequency.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10);
  
  console.log('🔥 Топ-10 самых частых вызовов:');
  sorted.forEach(([method, count]) => {
    console.log(`  ${count}x: ${method}`);
  });
}, 10000);
```

---

## 6. Фаза 2: Сужение до модуля

### 6.1 Создание слайса (отрезка в стеке)

```javascript
// Слайс = отрезок от входа в processOrder до выхода из него
Tracer.defineSlice('orderFlow', {
  predicate: (event) => event.fullName === 'OrderService.processOrder',
  beforeCall: () => {
    console.log('🎯 НАЧАЛО ОТРЕЗКА');
    return true;
  },
  afterCall: () => {
    console.log('🎯 КОНЕЦ ОТРЕЗКА');
    return false;
  },
  description: 'Отслеживание оформления заказа'
});

// Подписка на события ТОЛЬКО внутри отрезка
Tracer.traceBySlice('orderFlow', (event) => {
  console.log(`[OrderFlow] ${event.fullName}`);
});

Tracer.enableSlice('orderFlow');
```

### 6.2 ReportSliceUsage - детальная статистика отрезка

```javascript
import { ReportSliceUsage } from './reports/index.js';

const sliceUsage = new ReportSliceUsage({
  tracer: Tracer,
  sliceName: 'orderFlowStats',
  startPredicate: (event) => event.fullName === 'OrderService.processOrder',
  endPredicate: (event) => event.fullName === 'OrderService.processOrder' && event.place === 'after',
  shouldTrack: (event) => event.place === 'before'
});

sliceUsage.start();

// ... выполнение кода ...

sliceUsage.stop();

const run = sliceUsage.getLastRun();
console.log('📊 Статистика отрезка:');
console.log(`  Классы: ${run.classes.join(', ')}`);
console.log(`  Методы: ${run.methods.join(', ')}`);
console.log(`  Прочитано свойств: ${run.propertiesGet.length}`);
console.log(`  Изменено свойств: ${run.propertiesSet.length}`);
console.log(`  Всего событий: ${run.eventsCount}`);
```

### 6.3 ReportSliceDiff - сравнение проходов отрезка

```javascript
import { ReportSliceDiff } from './reports/index.js';

const diffReport = new ReportSliceDiff({
  tracer: Tracer,
  sliceName: 'orderComparison',
  startPredicate: (event) => event.fullName === 'OrderService.processOrder',
  endPredicate: (event) => event.fullName === 'OrderService.processOrder' && event.place === 'after'
});

// Первый проход (работает корректно)
diffReport.start();
await processOrder({ items: [{ price: 100 }] });
diffReport.stop();

// Второй проход (падает с ошибкой)
diffReport.start();
await processOrder({ items: [] });  // Пустая корзина
diffReport.stop();

// Анализ изменений
const diffs = diffReport.getDiffs();
diffs.forEach(diff => {
  if (diff.changed.args) {
    console.log(`🔄 Изменились аргументы в ${diff.next.fullName}`);
    console.log(`   Было: ${JSON.stringify(diff.prev.args)}`);
    console.log(`   Стало: ${JSON.stringify(diff.next.args)}`);
  }
});
```

---

## 7. Фаза 3: Отслеживание свойств

### 7.1 observeProperty - наблюдение за конкретным свойством

```javascript
class Order {
  constructor() {
    this.status = 'pending';
    this.total = 0;
  }
}

// Наблюдаем за свойством status
Tracer.observeProperty(Order.prototype, 'status', 'Order');

const order = new Order();

Tracer.traceProperties((event) => {
  if (event.propName === 'status') {
    console.log(`🔄 Статус изменен: ${event.curValue} → ${event.value}`);
    console.log(`   Стек вызовов:`, new Error().stack.split('\n')[3]);
  }
});

order.status = 'approved';
order.status = 'shipped';
```

### 7.2 Поиск цепочки присвоений

```javascript
class UIComponent {
  constructor(controller) {
    this.controller = controller;
  }
  
  onUserClick() {
    this.controller.updateData({ value: 42 });
  }
}

class Controller {
  constructor(service) {
    this.service = service;
  }
  
  updateData(data) {
    this.service.saveData(data);
  }
}

class Service {
  constructor(repository) {
    this.repository = repository;
  }
  
  saveData(data) {
    this.repository.store(data);
  }
}

class Repository {
  constructor() {
    this.data = null;
  }
  
  store(data) {
    this.data = data;  // ← целевое свойство
  }
}

// Отслеживаем изменение data
Tracer.observeProperty(Repository.prototype, 'data', 'Repository');

// Создаем слайс для отслеживания всей цепочки
Tracer.defineSlice('dataFlow', {
  predicate: (args) => {
    const methods = ['onUserClick', 'updateData', 'saveData', 'store'];
    return methods.some(m => args.fullName.includes(m));
  },
  beforeCall: () => true,
  afterCall: () => false
});

const path = [];

Tracer.traceBySlice('dataFlow', (event) => {
  if (event.place === 'before') {
    path.push(event.fullName);
  }
  
  if (event.eventType === 'propertySet' && event.propName === 'data') {
    console.log('🎯 ПОЛНАЯ ЦЕПОЧКА ПРИСВОЕНИЙ:');
    path.forEach((step, i) => {
      const arrow = i === path.length - 1 ? '  └─► ' : '  ├─► ';
      console.log(`${arrow} ${step}`);
    });
    console.log(`  └─► Repository.data = ${event.value}`);
    path.length = 0;
  }
});

const repo = new Repository();
const service = new Service(repo);
const controller = new Controller(service);
const ui = new UIComponent(controller);

ui.onUserClick();
```

### 7.3 Поиск "нелегальных" изменений

```javascript
class BankAccount {
  constructor() {
    this.balance = 1000;
  }
  
  deposit(amount) {
    this.balance += amount;
  }
  
  withdraw(amount) {
    if (amount > this.balance) throw new Error('Insufficient funds');
    this.balance -= amount;
  }
}

// Белый список разрешенных модификаций
const allowedModifications = new Set([
  'BankAccount.deposit',
  'BankAccount.withdraw'
]);

Tracer.observeProperty(BankAccount.prototype, 'balance', 'BankAccount');

Tracer.traceProperties((event) => {
  if (event.propName === 'balance') {
    const stack = new Error().stack;
    const caller = stack.split('\n')[3]?.trim() || 'unknown';
    
    if (!allowedModifications.has(caller)) {
      console.error(`🚫 НЕЗАКОННОЕ ИЗМЕНЕНИЕ balance!`);
      console.error(`   ${event.curValue} → ${event.value}`);
      console.error(`   Источник: ${caller}`);
      
      if (process.env.NODE_ENV === 'development') {
        debugger;
      }
    }
  }
});

const account = new BankAccount();
account.deposit(500);      // ✅ Разрешено
account.balance = 9999;    // 🚫 Запрещено
```

---

## 8. Фаза 4: Точечная отладка

### 8.1 debugOn - условная точка останова

```javascript
// Остановиться при вызове конкретного метода
Tracer.debugOn('beforeCallMethod', (event) => {
  return event.fullName === 'PaymentService.processPayment';
});

// Остановиться при определенных аргументах
Tracer.debugOn('beforeCallMethod', (event) => {
  return event.fullName === 'UserService.getUser';
});

// Остановиться при ошибке
Tracer.debugOn('afterCallMethod', (event) => {
  return event.error !== undefined;
});

// Остановиться при изменении важного свойства
Tracer.debugOn('propertySet', (event) => {
  return event.propName === 'balance' && event.value < 0;
});

// Остановиться при чтении чувствительных данных
Tracer.debugOn('propertyGet', (event) => {
  const sensitive = ['password', 'token', 'apiKey'];
  return sensitive.includes(event.propName);
});
```

### 8.2 debugOnceOn - однократная остановка

```javascript
// Остановиться только при первой ошибке
Tracer.debugOnceOn('afterCallMethod', (event) => {
  return event.error !== undefined;
});

// Остановиться только при первом отрицательном балансе
Tracer.debugOnceOn('propertySet', (event) => {
  return event.propName === 'balance' && event.value < 0;
});
```

### 8.3 Анализ аргументов и результатов

```javascript
let lastArgs = null;
let lastResult = null;

Tracer.traceCalls((event) => {
  if (event.fullName === 'ProblematicFunction.calculate') {
    if (event.place === 'before') {
      lastArgs = event.args;
      console.log('📥 Входные данные:', JSON.stringify(event.args));
    } else {
      lastResult = event.value;
      console.log('📤 Результат:', JSON.stringify(event.value));
      
      if (event.durationMs > 1000) {
        console.warn(`⚠️ Медленный вызов: ${event.durationMs}ms`);
      }
    }
  }
});
```

---

## 9. Фильтрация шума

### 9.1 Проблема: что такое шум?

Шум — это вызовы, которые происходят очень часто (сотни раз в секунду) и засоряют логи:
- `onTimerScroll` (60 раз/сек)
- `_animation` (60 раз/сек)
- `_autoSave` (1 раз/30 сек)
- `Logger.log`
- `Metrics.record`

### 9.2 NoisyCalls - исключение шумных вызовов

```javascript
Tracer.configureTracing({
  suppressNoisy: true,
  noisyCalls: [
    'CEditorPage.onTimerScroll',
    'PaintMessageLoop._animation',
    'baseEditorsApi._autoSave',
    'Logger.log',
    'Metrics.record'
  ]
});
```

### 9.3 NoisyProperties - исключение шумных свойств

```javascript
Tracer.configureTracing({
  suppressNoisy: true,
  noisyProperties: [
    'Component._internal',
    'Cache._timestamp',
    'View._renderCount',
    'Store._listeners'
  ]
});
```

### 9.4 CallFilter - гибкая фильтрация вызовов

```javascript
Tracer.configureTracing({
  callFilter: ({ fullName, className, fnKey }) => {
    // Только методы сервисов
    if (fullName.includes('Service') || fullName.includes('Repository')) {
      return true;
    }
    
    // Только для конкретного пользователя
    if (fullName === 'UserService.getUser') {
      return true;
    }
    
    // Исключаем внутренние методы
    if (fnKey && fnKey.startsWith('_')) {
      return false;
    }
    
    return false;
  }
});
```

### 9.5 PropertyFilter - гибкая фильтрация свойств

```javascript
Tracer.configureTracing({
  propertyFilter: ({ phase, propName, className }) => {
    // Не отслеживаем приватные свойства
    if (propName.startsWith('_')) return false;
    
    // Отслеживаем только запись свойств
    if (phase === 'get') return false;
    
    // Только важные классы
    return className === 'PaymentService' || className === 'OrderService';
  }
});
```

### 9.6 Порядок применения фильтров

```
1. noisyCalls / noisyProperties (полное исключение)
   ↓
2. callFilter / propertyFilter (пользовательская логика)
   ↓
3. Событие передается в слайсы
   ↓
4. traceBySlice получает событие (если слайс активен)
```

---

## 10. Асинхронная трассировка

### 10.1 Настройка контекста

```javascript
// Для Node.js (AsyncLocalStorage)
Tracer.configure({ asyncContext: 'stack' });

// Для браузера (требуется Zone.js)
Tracer.configure({ asyncContext: 'zone' });
```

### 10.2 Включение CallId

```javascript
Tracer.setTraceProfile('full', { captureContext: true });

Tracer.traceCalls((event) => {
  if (event.place === 'before') {
    console.log(`[${event.callId}] → ${event.fullName}`);
    if (event.parentCallId) {
      console.log(`     parent: ${event.parentCallId}`);
    }
  } else {
    console.log(`[${event.callId}] ← ${event.fullName} (${event.durationMs}ms)`);
  }
});
```

### 10.3 Асинхронный слайс

```javascript
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

class AsyncProcessor {
  async process(data) {
    const step1 = await this.step1(data);
    const step2 = await this.step2(step1);
    return step2;
  }
  
  async step1(data) { await delay(10); return { ...data, step1: true }; }
  async step2(data) { await delay(10); return { ...data, step2: true }; }
}

// Слайс сохраняет контекст через асинхронные вызовы
Tracer.defineSlice('asyncFlow', {
  predicate: (event) => event.fullName === 'AsyncProcessor.process',
  beforeCall: () => {
    console.log('🔵 НАЧАЛО АСИНХРОННОГО ОТРЕЗКА');
    return true;
  },
  afterCall: () => {
    console.log('🔴 КОНЕЦ АСИНХРОННОГО ОТРЕЗКА');
    return false;
  }
});

Tracer.traceBySlice('asyncFlow', (event) => {
  console.log(`  [Async] ${event.fullName}`);
});

Tracer.enableSlice('asyncFlow');

const processor = new AsyncProcessor();
await processor.process({ id: 1 });
```

### 10.4 Получение текущего контекста

```javascript
const context = Tracer.getCurrentContext();

// Обход всех узлов контекста
context.forEach((node) => {
  if (node.val) {
    console.log(`${node.val.className}.${node.val.fnKey}`);
  }
});

// Трассировка контекста в консоль
context.trace('Дополнительная информация');
```

---

## 11. Практические кейсы

### 11.1 Кейс: Баг с состоянием в React/Redux

```javascript
class ReduxStore {
  constructor() {
    this.state = { user: null, loading: false };
    this.listeners = [];
  }
  
  dispatch(action) {
    if (action.type === 'SET_USER') {
      this.state.user = action.payload;
    }
    this.notify();
  }
  
  notify() {
    this.listeners.forEach(fn => fn(this.state));
  }
}

// Отслеживаем изменения состояния
const store = new ReduxStore();
Tracer.observeAllProperties(store.state, 'ReduxState');

let lastChange = null;

Tracer.traceProperties((event) => {
  if (event.className === 'ReduxState') {
    console.log(`📦 State изменен: ${event.propName} = `, event.value);
    lastChange = { prop: event.propName, time: Date.now() };
  }
});

Tracer.traceCalls((event) => {
  if (event.fullName === 'ReduxStore.notify' && lastChange) {
    const delay = Date.now() - lastChange.time;
    if (delay > 100) {
      console.warn(`⚠️ Notify вызван через ${delay}ms после изменения`);
    }
  }
});
```

### 11.2 Кейс: Отладка WebSocket сообщений

```javascript
class WebSocketManager {
  constructor(url) {
    this.ws = new WebSocket(url);
    this.ws.onmessage = (e) => this.handleMessage(e.data);
  }
  
  handleMessage(raw) {
    const data = JSON.parse(raw);
    this.process(data);
  }
  
  process(data) {
    console.log('Processing:', data.type);
  }
}

const wsManager = new WebSocketManager('wss://api.example.com');
Tracer.observe(wsManager, 'WebSocketManager');

const messageFlow = [];

Tracer.defineSlice('websocket', {
  predicate: (args) => args.fullName.includes('WebSocketManager'),
  beforeCall: () => true,
  afterCall: () => false
});

Tracer.traceBySlice('websocket', (event) => {
  if (event.place === 'before') {
    messageFlow.push(event.fullName);
  }
  
  if (event.fullName === 'WebSocketManager.process') {
    console.log('📨 ПОТОК ОБРАБОТКИ СООБЩЕНИЯ:');
    messageFlow.forEach((step, i) => {
      const arrow = i === messageFlow.length - 1 ? '  └─► ' : '  ├─► ';
      console.log(`${arrow} ${step}`);
    });
    messageFlow.length = 0;
  }
});
```

### 11.3 Кейс: Метод-убийца производительности

```javascript
class SlowService {
  expensiveOperation() {
    // Медленный код
    let sum = 0;
    for (let i = 0; i < 1000000; i++) sum += i;
    return sum;
  }
}

const callStats = new Map();

Tracer.defineSlice('perfMonitor', {
  predicate: (args) => args.fullName === 'SlowService.expensiveOperation',
  beforeCall: (args) => {
    args._startTime = performance.now();
    return true;
  },
  afterCall: (args) => {
    const duration = performance.now() - args._startTime;
    
    const stack = new Error().stack;
    const caller = stack.split('\n')[3]?.trim() || 'unknown';
    
    if (!callStats.has(caller)) {
      callStats.set(caller, { count: 0, totalTime: 0, maxTime: 0 });
    }
    
    const stat = callStats.get(caller);
    stat.count++;
    stat.totalTime += duration;
    stat.maxTime = Math.max(stat.maxTime, duration);
    
    if (duration > 100) {
      console.warn(`⚠️ Медленный вызов от ${caller}: ${duration.toFixed(2)}ms`);
    }
    
    return false;
  }
});

setInterval(() => {
  console.log('\n📊 СТАТИСТИКА ВЫЗОВОВ:');
  for (const [caller, stat] of callStats) {
    console.log(`${caller}:`);
    console.log(`  Вызовов: ${stat.count}`);
    console.log(`  Среднее: ${(stat.totalTime / stat.count).toFixed(2)}ms`);
    console.log(`  Максимум: ${stat.maxTime.toFixed(2)}ms`);
  }
}, 30000);
```

---

## 12. Шпаргалка

### 12.1 Быстрые команды

```javascript
// Базовые подписки
Tracer.traceAll(console.log);           // Все события
Tracer.traceCalls(console.log);         // Только вызовы
Tracer.traceProperties(console.log);    // Только свойства
Tracer.untraceAll();                    // Отписка от всего

// Слайсы (отрезки в стеке)
Tracer.defineSlice('name', {            // Определение
  predicate: (e) => e.fullName === 'target',
  beforeCall: () => true,
  afterCall: () => false
});
Tracer.traceBySlice('name', callback);  // Подписка на отрезок
Tracer.enableSlice('name');             // Активация
Tracer.disableSlice('name');            // Деактивация

// Наблюдение за свойствами
Tracer.observeProperty(obj, 'prop', 'ClassName');
Tracer.observeAllProperties(obj, 'ClassName');
Tracer.observe(obj, 'name');            // Рекурсивный обход
Tracer.observePrototype(Class, 'Name'); // Наблюдение за прототипом

// Отладка
Tracer.debugOn('beforeCallMethod', (e) => e.fullName === 'target');
Tracer.debugOnceOn('propertySet', (e) => e.propName === 'balance');

// Конфигурация
Tracer.setTraceProfile('minimal');      // minimal | balanced | full
Tracer.configure({ asyncContext: 'stack' });
Tracer.configureTracing({
  suppressNoisy: true,
  noisyCalls: ['method.name'],
  callFilter: ({ fullName }) => fullName.includes('Service')
});

// Информация
Tracer.getEnabledSlices();              // Активные слайсы
Tracer.getRegisteredSlices();           // Зарегистрированные
Tracer.getCurrentContext();             // Текущий контекст
Tracer.getTraceConfig();                // Текущая конфигурация

// Отчеты
new ReportUsage({ logProvider: console }).print();
new ReportTreeView().getResults();
new ReportSliceDiff({ tracer: Tracer, startPredicate, endPredicate });
new ReportSliceUsage({ tracer: Tracer, startPredicate, endPredicate });
```

### 12.2 Шаблоны для копирования

```javascript
// Шаблон 1: Отследить все вызовы в классе
Tracer.observePrototype(MyClass, 'MyClass');
Tracer.traceCalls((e) => console.log(e.fullName));

// Шаблон 2: Отследить изменение свойства
Tracer.observeProperty(obj, 'prop', 'Name');
Tracer.traceProperties((e) => {
  if (e.propName === 'prop') {
    console.log(`${e.curValue} → ${e.value}`);
    console.log(new Error().stack.split('\n')[3]);
  }
});

// Шаблон 3: Слайс для метода
Tracer.defineSlice('slice', {
  predicate: (e) => e.fullName === 'Class.method',
  beforeCall: () => true,
  afterCall: () => false
});
Tracer.traceBySlice('slice', console.log);

// Шаблон 4: Фильтрация шума
Tracer.configureTracing({
  suppressNoisy: true,
  noisyCalls: ['onTimerScroll', '_animation'],
  callFilter: ({ fullName }) => fullName.includes('Service')
});

// Шаблон 5: Асинхронная трассировка
Tracer.configure({ asyncContext: 'stack' });
Tracer.setTraceProfile('full', { captureContext: true });
Tracer.traceCalls((e) => {
  console.log(`[${e.callId}] ${e.place === 'before' ? '→' : '←'} ${e.fullName}`);
});
```

### 12.3 Консольные команды для браузера

```javascript
// Включение/отключение
window.TRACE_ON = true;
window.TRACE_OFF = false;

// Быстрые команды
traceStart = () => Tracer.traceAll(console.log);
traceStop = () => Tracer.untraceAll();
traceStats = () => {
  console.log('Slices:', Tracer.getEnabledSlices());
  console.log('Config:', Tracer.getTraceConfig());
};

// Фильтры
traceFilter = (pattern) => {
  Tracer.configureTracing({
    callFilter: ({ fullName }) => fullName.includes(pattern)
  });
};

// Дамп контекста
traceContext = () => {
  const ctx = Tracer.getCurrentContext();
  console.log(ctx);
};
```

---

## 13. Минимальный Playbook для Legacy

Ниже 5 типовых сценариев для легаси-проекта, где нужно быстро найти причину бага без полной документации.

### 13.0 Быстрый выбор сценария

| Симптом | Сценарий |
|---|---|
| Метод грузит CPU / вызывается слишком часто | [13.1 Неясно, кто вызывает метод слишком часто](#131-сценарий-неясно-кто-вызывает-метод-слишком-часто) |
| Поле неожиданно меняется | [13.2 Поле внезапно перезаписывается](#132-сценарий-поле-внезапно-перезаписывается) |
| Нужен только конкретный бизнес-флоу | [13.3 Нужен только один бизнес-флоу, а не весь шум](#133-сценарий-нужен-только-один-бизнес-флоу-а-не-весь-шум) |
| Асинхронная цепочка “теряется” | [13.4 Асинхронная цепочка теряет контекст](#134-сценарий-асинхронная-цепочка-теряет-контекст) |
| Нужно остановить выполнение на опасном состоянии | [13.5 Точечная остановка на опасном условии](#135-сценарий-точечная-остановка-на-опасном-условии) |

### 13.1 Сценарий: Неясно, кто вызывает метод слишком часто

Статус: копипаст + заменить `targetService` на ваш модуль.

```javascript
Tracer.setTraceProfile('balanced');
Tracer.observe(targetService, 'TargetService');

const counters = new Map();
Tracer.traceCalls((event) => {
  if (event.place !== 'before') return;
  const count = counters.get(event.fullName) || 0;
  counters.set(event.fullName, count + 1);
});

setTimeout(() => {
  Array.from(counters.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .forEach(([name, count]) => console.log(`${count}x ${name}`));
}, 10000);
```

### 13.2 Сценарий: Поле внезапно перезаписывается

Статус: копипаст + заменить `model`, `status`, `OrderModel`.

```javascript
const model = { status: 'pending' };
Tracer.observeProperty(model, 'status', 'OrderModel');

Tracer.traceProperties((event) => {
  if (event.propName !== 'status') return;
  console.log(`[status] ${event.curValue} -> ${event.value}`);
  console.log(new Error().stack.split('\n').slice(2, 5).join('\n'));
});
```

### 13.3 Сценарий: Нужен только один бизнес-флоу, а не весь шум

Статус: адаптировать `checkoutFlow`, `CheckoutService.checkout` и список `noisyCalls`.

```javascript
Tracer.configureTracing({
  suppressNoisy: true,
  noisyCalls: ['CEditorPage.onTimerScroll', 'PaintMessageLoop._animation']
});

Tracer.defineSlice('checkoutFlow', {
  predicate: (event) => event.fullName === 'CheckoutService.checkout',
  beforeCall: () => true,
  afterCall: () => false
});

Tracer.traceBySlice('checkoutFlow', (event) => {
  console.log(`[checkoutFlow] ${event.fullName}`);
});
```

### 13.4 Сценарий: Асинхронная цепочка теряет контекст

Статус: копипаст; для браузера используйте `asyncContext: 'zone'`.

```javascript
Tracer.configure({ asyncContext: 'stack' });
Tracer.setTraceProfile('full', { captureContext: true });

Tracer.traceCalls((event) => {
  if (event.place === 'before') {
    console.log(`[${event.callId}] -> ${event.fullName}`);
  } else {
    console.log(`[${event.callId}] <- ${event.fullName} (${event.durationMs}ms)`);
  }
});
```

### 13.5 Сценарий: Точечная остановка на опасном условии

Статус: адаптировать `className`, `propName` и условие риска.

```javascript
Tracer.debugOn('propertySet', (event) => {
  return event.className === 'BankAccount' &&
    event.propName === 'balance' &&
    event.value < 0;
});
```

### 13.6 Завершение сессии отладки

Статус: копипаст.

```javascript
Tracer.untraceAll();
Tracer.untraceCalls();
Tracer.untraceProperties();
Tracer.disableSliceListeners('checkoutFlow');
```

---

**Tracer - Полный гайд разработчика | Версия 1.0**

```javascript
// Скачать этот гайд:
// const blob = new Blob([guideText], { type: 'text/markdown' });
// const url = URL.createObjectURL(blob);
// const a = document.createElement('a');
// a.href = url;
// a.download = 'tracer-complete-guide.md';
// a.click();
```


