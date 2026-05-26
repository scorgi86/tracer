---
title: "Tracer - Полный гайд разработчика"
layout: default
---

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

