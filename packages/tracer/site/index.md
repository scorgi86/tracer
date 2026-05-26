---
title: "Tracer - Полная документация"
layout: default
---

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
Tracer.traceProperty(propSelector, callback);
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
Tracer.defineSliceByFunction(sliceName, fn);
Tracer.defineSliceByFunctionName(sliceName, fnName);
Tracer.defineSliceByCall(sliceName, target, targetFnName, predicate);
Tracer.exportSliceScenarios(options);
Tracer.importSliceScenarios(payload, options);

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



