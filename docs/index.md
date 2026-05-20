# Tracer - Полная документация

## Версия 2.0 | Руководство по трассировке JavaScript-кода

---

## Оглавление

1. [Введение](#1-введение)
2. [Быстрый старт](#2-быстрый-старт)
3. [Архитектура и компоненты](#3-архитектура-и-компоненты)
4. [API Reference](#4-api-reference)
5. [Отчеты и аналитика](#5-отчеты-и-аналитика)
6. [Гайд по отладке](#6-гайд-по-отладке)
7. [Мониторинг объектов внутри метода](#7-мониторинг-объектов-внутри-метода)
8. [Практические примеры](#8-практические-примеры)
9. [Решение проблем](#9-решение-проблем)
10. [Чеклист разработчика](#10-чеклист-разработчика)

---

## 1. Введение

### 1.1 Что такое Tracer?

**Tracer** — это библиотека для runtime-трассировки JavaScript/TypeScript кода, позволяющая:

- Отслеживать вызовы функций (до и после выполнения)
- Мониторить чтение и запись свойств объектов
- Создавать контекстные "слайсы" для условной трассировки
- Генерировать структурированные отчеты о работе приложения
- Автоматически находить регрессии и узкие места
- **Отслеживать все объекты, свойства и вызовы внутри конкретного метода**

### 1.2 Ключевые возможности

| Возможность | Описание |
|-------------|----------|
| **Трассировка функций** | Обертка любых функций с перехватом вызовов |
| **Трассировка свойств** | Мониторинг get/set операций |
| **Слайсы** | Контекстная трассировка с условиями активации |
| **Отчеты** | Автоматический анализ использования кода |
| **Мониторинг метода** | Отслеживание всех объектов внутри вызова |
| **Асинхронность** | Поддержка Promise, async/await, call stacks |
| **Фильтрация** | Многоуровневая фильтрация шума |

### 1.3 Когда использовать?

```javascript
// ✅ КОГДА НУЖЕН TRACER:
// 1. Непонятно, почему свойство изменилось
// 2. Функция вызывается не оттуда, откуда ожидалось
// 3. Нужно понять поток выполнения в сложном сценарии
// 4. Поиск узких мест производительности
// 5. Анализ покрытия кода тестами
// 6. Отладка создания и связей объектов

// ❌ КОГДА НЕ НУЖЕН:
// 1. Простое логирование (используйте console.log)
// 2. Production без явной необходимости (есть оверхед)
// 3. Код с экстремальными требованиями к производительности
```

---

## 2. Быстрый старт

### 2.1 Установка и подключение (`scorgi86/tracer`)

#### Вариант A: Подключение напрямую из GitHub

```bash
npm i github:scorgi86/tracer
```

ESM:

```javascript
import { Tracer } from 'tracer';
```

CommonJS:

```javascript
const { Tracer } = require('tracer');
```

#### Вариант B: Локальная сборка из репозитория

```bash
git clone https://github.com/scorgi86/tracer.git
cd tracer
npm install
npm run build
```

Подключение после сборки:

```javascript
// CommonJS
const { Tracer } = require('./dist/tracer.cjs.js');

// ESM
// import { Tracer } from './dist/tracer.es.js';
```

#### Быстрая проверка, что подключение работает

```javascript
const tracedSum = Tracer.createProxyFn((a, b) => a + b, 'sum');
Tracer.traceCalls((e) => console.log(e.type, e.fullName));
tracedSum(1, 2);
```

### 2.2 Первая трассировка

```javascript
// 1. Создаем функцию
function calculateTotal(items) {
  return items.reduce((sum, item) => sum + item.price, 0);
}

// 2. Оборачиваем для трассировки
const tracedCalculate = Tracer.createProxyFn(calculateTotal, 'calculateTotal');

// 3. Подписываемся на события
Tracer.traceAll((event) => {
  console.log(\`\${event.type}: \${event.fullName}\`);
});

// 4. Вызываем
tracedCalculate([{ price: 100 }, { price: 200 }]);
// Вывод:
// beforeCallMethod: calculateTotal
// afterCallMethod: calculateTotal
```

### 2.3 Первый отчет

```javascript
// Собираем информацию об использовании
const usageReport = new ReportUsage({ logProvider: console });

Tracer.traceCalls((event) => {
  if (event.type === 'beforeCallMethod') {
    const [className, fnKey] = event.fullName.split('.');
    usageReport.log({ className, fnKey });
  }
});

// Выполняем сценарий
// ... ваш код ...

// Получаем отчет
usageReport.print();
// Вывод:
// UserService
// PaymentService
// 
// Class: UserService.login
// Class: UserService.logout
// Class: PaymentService.processPayment
```

### 2.4 Как работает трассировка вызовов (ASCII-схема)

```text
┌─────────────────────────────────────────────────────────────────────┐
│                         КЛИЕНТСКИЙ КОД                              │
│ const tracedFn = Tracer.createProxyFn(targetFn, "Order.pay")        │
│ tracedFn(arg1, arg2)                                                 │
└─────────────────────────────────────────────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────────┐
│                        PROXY-ОБЕРТКА (Tracer)                       │
│ 1) beforeCallMethod                                                  │
│ 2) Добавление метаданных (fullName, args, context/slice)            │
│ 3) Передача события подписчикам                                      │
└─────────────────────────────────────────────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────────┐
│                      ВЫПОЛНЕНИЕ targetFn(...)                        │
│ 4) Запуск оригинальной функции                                       │
│ 5) Если внутри вызван tracedFn2(...) -> tracedFn2 проходит           │
│    этот же цикл независимо (before -> run -> after/error)            │
│ 6) При исключении формируется errorCallMethod                        │
└─────────────────────────────────────────────────────────────────────┘
                               │
                 ┌─────────────┴─────────────┐
                 │                           │
                 ▼                           ▼
┌───────────────────────────────┐   ┌────────────────────────────────┐
│ УСПЕХ                          │   │ ОШИБКА                         │
│ 7a) afterCallMethod            │   │ 7b) errorCallMethod            │
│     + result                   │   │     + error info               │
└───────────────────────────────┘   └────────────────────────────────┘
                 │                           │
                 └─────────────┬─────────────┘
                               ▼
┌─────────────────────────────────────────────────────────────────────┐
│            ФИЛЬТРЫ И ПОЛУЧАТЕЛИ (reports / console)                 │
│ 8) Применяются фильтры                                               │
│ 9) Событие попадает только в нужные подписки/отчеты                  │
└─────────────────────────────────────────────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────────┐
│                             РЕЗУЛЬТАТ                                │
│ 10) tracedFn возвращает result или пробрасывает ошибку               │
└─────────────────────────────────────────────────────────────────────┘
```

**Что значит "вложенные traced-вызовы"**

Это ситуация, когда трассируемая функция внутри себя вызывает другую тоже трассируемую функцию.

Пример:

```javascript
const a = Tracer.createProxyFn(function a() { b(); }, 'A');
const b = Tracer.createProxyFn(function b() {}, 'B');
a();
```

События будут в таком порядке:

```text
beforeCallMethod A
beforeCallMethod B
afterCallMethod B
afterCallMethod A
```

**Что такое фильтры (`profile`, `callFilter`, `noisyCalls`)**

- `profile` - готовый пресет глубины трассировки (`minimal`, `balanced`, `full`).
- `callFilter` - функция-условие. Если вернула `false`, событие вызова отбрасывается.
- `noisyCalls` - список "шумных" вызовов, которые нужно исключить из потока.

Пример:

```javascript
Tracer.setTraceProfile('balanced');
Tracer.configureTracing({
  noisyCalls: ['CEditorPage.onTimerScroll'],
  callFilter: ({ fullName }) => !fullName.includes('debug')
});
```

---

## 3. Архитектура и компоненты

### 3.1 Общая схема

```
┌─────────────────────────────────────────────────────────────────────┐
│                           Tracer (API)                              │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐  │
│  │ createProxy │ │  observe    │ │ defineSlice │ │   reports   │  │
│  └─────────────┘ └─────────────┘ └─────────────┘ └─────────────┘  │
└─────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────┐
│                          Core Components                            │
├─────────────────┬─────────────────┬─────────────────┬───────────────┤
│    proxy.js     │   slices.js     │  context.js     │ subscriptions │
│  Обертки функций│ Управление      │ Асинхронный     │   Подписки    │
│  и свойств      │ слайсами        │ контекст        │ на события    │
└─────────────────┴─────────────────┴─────────────────┴───────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────┐
│                           Reports                                   │
├───────────────┬───────────────┬───────────────┬───────────────────┤
│ ReportUsage   │ ReportSimple  │ ReportTreeView│ ReportSliceDiff   │
│ Анализ        │ Простой       │ Дерево         │ Сравнение         │
│ использования │ список        │ вызовов        │ сценариев         │
└───────────────┴───────────────┴───────────────┴───────────────────┘
```

### 3.2 Компоненты

#### Tracer (главный класс)
Статический API для всей функциональности трассировки.

#### proxy.js
- \`createProxyFn\` - обертка для функций
- \`wrapConstructor\` - обертка для классов
- \`wrapProperty\` / \`wrapProxyPropDescriptor\` - прокси для свойств
- \`traverse\` - рекурсивный обход объектов

#### slices.js
- Регистрация слайсов
- Управление состоянием слайсов
- Подписка на события в контексте слайса

#### context.js
- \`ExecutionContext\` - управление асинхронным контекстом
- Поддержка stack (AsyncLocalStorage) и zone режимов

#### reports/
Готовые отчеты для анализа трассировки:
- \`ReportUsage\` - статистика использования классов/методов
- \`ReportSimple\` - простой список вызовов
- \`ReportTreeView\` - древовидное представление
- \`ReportSliceDiff\` - сравнение сценариев

---

## 4. API Reference

### 4.1 Основные методы Tracer

#### \`Tracer.createProxyFn(targetFn, eventName)\`
Оборачивает функцию для трассировки.

```javascript
const tracedFn = Tracer.createProxyFn(originalFn, 'myFunction');
// Возвращает функцию с тем же API
```

#### \`Tracer.observeConstructor(Constructor, className)\`
Оборачивает класс, все экземпляры трассируются.

```javascript
const TracedClass = Tracer.observeConstructor(MyClass, 'MyClass');
const instance = new TracedClass();
```

#### \`Tracer.observeProperty(target, propName, className)\`
Наблюдает за конкретным свойством объекта.

```javascript
Tracer.observeProperty(user, 'name', 'User');
user.name = 'John'; // Будет отслежено
```

#### \`Tracer.observeAllProperties(target, className)\`
Наблюдает за всеми свойствами объекта.

```javascript
Tracer.observeAllProperties(config, 'Config');
// Любое изменение любого свойства будет отслежено
```

#### \`Tracer.observe(target, targetName)\`
Рекурсивно обходит объект и трассирует все свойства.

```javascript
Tracer.observe(complexObject, 'AppConfig');
// Все вложенные свойства также отслеживаются
```

#### \`Tracer.observePrototype(target, className)\`
Наблюдает за прототипом класса.

```javascript
Tracer.observePrototype(UserService, 'UserService');
// Все методы всех экземпляров трассируются
```

### 4.2 Слайсы

#### \`Tracer.defineSlice(name, config)\`
Определяет новый слайс трассировки.

```javascript
Tracer.defineSlice('payment', {
  predicate: (args) => args.fullName.includes('Payment'),
  beforeCall: () => console.log('Payment started'),
  afterCall: () => console.log('Payment finished'),
  initial: false,
  description: 'Payment processing flow'
});
```

**Параметры config:**
- \`predicate\` - функция, определяющая активацию слайса
- \`beforeCall\` - вызывается при входе, возвращает boolean
- \`afterCall\` - вызывается при выходе, возвращает boolean
- \`initial\` - начальное состояние (по умолчанию false)
- \`description\` - описание слайса

#### \`Tracer.traceBySlice(sliceName, callback)\`
Подписывается на события активного слайса.

```javascript
Tracer.traceBySlice('payment', (event) => {
  console.log(\`[Payment] \${event.fullName}\`);
});
```

#### \`Tracer.enableSlice(sliceName)\` / \`Tracer.disableSlice(sliceName)\`
Включает/выключает слайс.

```javascript
Tracer.enableSlice('payment');
// ... трассировка ...
Tracer.disableSlice('payment');
```

### 4.3 Подписки

#### \`Tracer.traceAll(callback)\`
Подписка на все события.

```javascript
Tracer.traceAll((event) => {
  console.log(event.type, event.fullName);
});
```

#### \`Tracer.traceCalls(callback)\`
Только вызовы функций.

```javascript
Tracer.traceCalls((event) => {
  if (event.type === 'beforeCallMethod') {
    console.log(\`Calling: \${event.fullName}\`);
  }
});
```

#### \`Tracer.traceProperties(callback)\`
Только доступ к свойствам.

```javascript
Tracer.traceProperties((event) => {
  console.log(\`\${event.type}: \${event.className}.\${event.propName}\`);
});
```

### 4.4 Отладка

#### \`Tracer.debugOn(eventName, conditionCallback)\`
Условная точка останова.

```javascript
Tracer.debugOn('beforeCallMethod', (args) => {
  return args.fullName === 'PaymentService.processPayment';
});
// При вызове processPayment сработает debugger
```

#### \`Tracer.debugOnceOn(eventName, conditionCallback)\`
Однократная точка останова.

```javascript
Tracer.debugOnceOn('propertySet', (args) => {
  return args.propName === 'balance' && args.newValue < 0;
});
// Сработает только при первом отрицательном балансе
```

---

## 5. Отчеты и аналитика

### 5.1 ReportUsage - Анализ использования

**Назначение:** Собрать информацию о том, какие классы и методы используются.

```javascript
const usageReport = new ReportUsage({ logProvider: console });

// Собираем данные
Tracer.traceCalls((event) => {
  if (event.type === 'beforeCallMethod') {
    const [className, fnKey] = event.fullName.split('.');
    usageReport.log({ className, fnKey });
  }
});

// Получаем отчет
usageReport.print();
// Вывод:
// UserService
// PaymentService
// 
// Class: UserService.login
// Class: UserService.logout
// Class: PaymentService.processPayment
```

**Когда использовать:**
- Анализ покрытия кода
- Поиск неиспользуемых методов
- Документирование API

### 5.2 ReportSimple - Простой список

**Назначение:** Быстрый дамп всех уникальных вызовов.

```javascript
const simpleReport = new ReportSimple({ logProvider: console });

Tracer.traceCalls((event) => {
  if (event.type === 'beforeCallMethod') {
    const [className, fnKey] = event.fullName.split('.');
    simpleReport.log({ className, fnKey });
  }
});

// Результат: чистый список без дубликатов
```

**Когда использовать:**
- Быстрая проверка "кто что вызывает"
- Создание базового отчета

### 5.3 ReportTreeView - Дерево вызовов

**Назначение:** Визуализация иерархии вызовов.

```javascript
const treeReport = new ReportTreeView();

Tracer.traceCalls((event) => {
  if (event.type === 'beforeCallMethod') {
    const [className, fnKey] = event.fullName.split('.');
    treeReport.log({
      eventType: 'functionCall',
      place: 'before',
      className,
      fnKey
    });
  }
  
  if (event.type === 'afterCallMethod') {
    const [className, fnKey] = event.fullName.split('.');
    treeReport.log({
      eventType: 'functionCall',
      place: 'after',
      className,
      fnKey
    });
  }
});

const tree = treeReport.getResults();
// Вывод с отступами, показывающими вложенность
```

**Фильтрация шума:**
```javascript
class FilteredTreeView extends ReportTreeView {
  constructor(options) {
    super();
    this.excludePatterns = options.excludePatterns || [];
    this.includePatterns = options.includePatterns || [];
    this.maxDepth = options.maxDepth || Infinity;
  }
  
  log(args, serializedValues) {
    const depth = this._stack.length;
    const fullKey = \`\${args.className}.\${args.fnKey || args.propName}\`;
    
    if (depth > this.maxDepth) return;
    if (this.excludePatterns.some(p => fullKey.match(p))) return;
    if (this.includePatterns.length && !this.includePatterns.some(p => fullKey.match(p))) return;
    
    super.log(args, serializedValues);
  }
}
```

### 5.4 ReportSliceDiff - Сравнение сценариев

**Назначение:** Отслеживает изменения между последовательными вызовами.

```javascript
const diffReport = new ReportSliceDiff({
  tracer: Tracer,
  sliceName: 'orderFlow',
  startPredicate: (event) => event.fullName === 'OrderService.createOrder',
  endPredicate: (event) => event.fullName === 'OrderService.saveOrder',
  logProvider: console
});

diffReport.start();

// Выполняем сценарий
await processOrder({ items: [{ price: 100 }] });

const diffs = diffReport.getDiffs();
diffs.forEach(diff => {
  if (diff.changed.args) {
    console.log(\`Arguments changed in \${diff.next.fullName}\`);
  }
});

diffReport.stop();
```

**Кастомный diffBuilder:**
```javascript
const customDiff = new ReportSliceDiff({
  tracer: Tracer,
  sliceName: 'custom',
  startPredicate: () => true,
  endPredicate: () => false,
  diffBuilder: (prev, next) => ({
    changed: JSON.stringify(prev.args) !== JSON.stringify(next.args)
  })
});
```

---

## 6. Гайд по отладке

### 6.1 Стратегия: От общего к частному

```
Шаг 1: Общая картина     → ReportUsage / ReportSimple
Шаг 2: Визуализация      → ReportTreeView
Шаг 3: Фокус на модуль   → Слайс + фильтры
Шаг 4: Сравнение         → ReportSliceDiff
Шаг 5: Точечная отладка  → debugOn / observeProperty
```

### 6.2 Сценарий 1: Поиск источника изменения свойства

```javascript
// Проблема: Свойство status меняется непонятно откуда

// 1. Наблюдаем за свойством
Tracer.observeProperty(Order.prototype, 'status', 'Order');

// 2. Логируем каждое изменение со стеком
Tracer.traceProperties((event) => {
  if (event.propName === 'status') {
    console.log(\`Status changed: \${event.oldValue} → \${event.newValue}\`);
    console.log(new Error().stack.split('\\n')[3]); // Кто вызвал
  }
});

// 3. При необходимости - останавливаемся
Tracer.debugOn('propertySet', (event) => {
  return event.propName === 'status' && event.newValue === 'cancelled';
});
```

### 6.3 Сценарий 2: Анализ производительности

```javascript
// Проблема: Функция работает медленно

// 1. Создаем слайс для замера
Tracer.defineSlice('perf', {
  predicate: (args) => args.fullName === 'slowFunction',
  beforeCall: (args) => {
    args.startTime = performance.now();
    return true;
  },
  afterCall: (args) => {
    const duration = performance.now() - args.startTime;
    if (duration > 100) {
      console.warn(\`⚠️ Slow call: \${duration}ms\`);
    }
    return false;
  }
});

// 2. Собираем статистику
const timings = [];
Tracer.traceBySlice('perf', (event) => {
  if (event.type === 'afterCallMethod') {
    timings.push(event.duration);
  }
});
```

### 6.4 Сценарий 3: Отладка асинхронного кода

```javascript
// Проблема: Порядок выполнения Promise неясен

// Включаем контекст
Tracer.configure({ asyncContext: 'stack' });

// Отслеживаем с callId
Tracer.traceCalls((event) => {
  console.log(\`[\${event.callId}] \${event.type}: \${event.fullName}\`);
});

// Видим цепочку вызовов с одинаковыми callId
```

---

## 7. Мониторинг объектов внутри метода

### 7.1 Концепция: "Песочница вызова"

```javascript
// Цель: Отследить ВСЕ, что происходит внутри конкретного метода
// - Какие объекты создаются
// - Какие свойства читаются/изменяются  
// - Какие методы вызываются
// - Какой путь проходят данные

class OrderService {
  async processOrder(orderId) {
    // Здесь мы хотим видеть все операции
    const order = await this.loadOrder(orderId);
    const validator = new OrderValidator();
    const result = validator.validate(order);
    return result;
  }
}
```

### 7.2 MethodInvestigator - Полный мониторинг метода

```javascript
class MethodInvestigator {
  constructor(tracer) {
    this.tracer = tracer;
    this.investigations = new Map();
  }
  
  investigate(methodName, targetObject, options = {}) {
    const investigation = {
      id: Date.now(),
      methodName,
      startTime: null,
      endTime: null,
      objects: new Set(),
      properties: new Map(),
      calls: [],
      dataFlow: [],
      trackProperties: options.trackProperties !== false,
      trackObjects: options.trackObjects !== false,
      trackDataFlow: options.trackDataFlow !== false,
      result: null,
      error: null
    };
    
    this.investigations.set(investigation.id, investigation);
    this.setupInvestigation(investigation, targetObject);
    
    return investigation;
  }
  
  setupInvestigation(investigation, targetObject) {
    const sliceName = \`investigation_\${investigation.id}\`;
    
    this.tracer.defineSlice(sliceName, {
      predicate: (event) => {
        if (event.fullName === investigation.methodName && 
            event.place === 'before') {
          investigation.startTime = Date.now();
          console.log(\`\\n🔍 INVESTIGATION STARTED: \${investigation.methodName}\`);
          return true;
        }
        return this.tracer.tracerState.get(sliceName) === true;
      },
      beforeCall: () => true,
      afterCall: (event) => {
        if (event.fullName === investigation.methodName && 
            event.place === 'after') {
          investigation.endTime = Date.now();
          investigation.result = event.result;
          this.printReport(investigation);
          return false;
        }
        return true;
      }
    });
    
    this.tracer.traceBySlice(sliceName, (event) => {
      this.collectData(investigation, event);
    });
    
    this.tracer.enableSlice(sliceName);
    
    investigation.cleanup = () => {
      this.tracer.disableSlice(sliceName);
      this.tracer.untraceBySlice(sliceName);
    };
  }
  
  collectData(investigation, event) {
    const time = Date.now() - investigation.startTime;
    
    if (event.type === 'beforeCallMethod') {
      investigation.calls.push({
        method: event.fullName,
        args: this.safeClone(event.args),
        time
      });
    }
    
    if (investigation.trackObjects && 
        event.type === 'afterCallMethod' && 
        event.fullName.includes('constructor')) {
      investigation.objects.add({
        type: event.fullName,
        time
      });
    }
    
    if (investigation.trackProperties) {
      if (event.type === 'propertyGet') {
        const key = \`\${event.className}.\${event.propName}\`;
        if (!investigation.properties.has(key)) {
          investigation.properties.set(key, { reads: 0, writes: 0 });
        }
        investigation.properties.get(key).reads++;
      }
      
      if (event.type === 'propertySet') {
        const key = \`\${event.className}.\${event.propName}\`;
        if (!investigation.properties.has(key)) {
          investigation.properties.set(key, { reads: 0, writes: 0 });
        }
        investigation.properties.get(key).writes++;
        
        if (investigation.trackDataFlow) {
          investigation.dataFlow.push({
            property: key,
            from: event.oldValue,
            to: event.newValue,
            time
          });
        }
      }
    }
  }
  
  printReport(investigation) {
    const duration = investigation.endTime - investigation.startTime;
    
    console.log(\`\\n📊 INVESTIGATION REPORT: \${investigation.methodName}\`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(\`⏱️ Duration: \${duration}ms\`);
    
    console.log(\`\\n📈 STATISTICS:\`);
    console.log(\`   Methods called: \${investigation.calls.length}\`);
    console.log(\`   Objects created: \${investigation.objects.size}\`);
    console.log(\`   Properties accessed: \${investigation.properties.size}\`);
    console.log(\`   Data changes: \${investigation.dataFlow.length}\`);
    
    if (investigation.calls.length > 0) {
      const methodCounts = {};
      investigation.calls.forEach(call => {
        methodCounts[call.method] = (methodCounts[call.method] || 0) + 1;
      });
      
      console.log(\`\\n🔥 TOP CALLED METHODS:\`);
      const sorted = Object.entries(methodCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10);
      sorted.forEach(([method, count]) => {
        console.log(\`   \${method}: \${count} times\`);
      });
    }
    
    if (investigation.dataFlow.length > 0) {
      console.log(\`\\n🔄 LAST DATA CHANGES:\`);
      investigation.dataFlow.slice(-5).forEach(flow => {
        console.log(\`   [+\${flow.time}ms] \${flow.property}: \${flow.from} → \${flow.to}\`);
      });
    }
    
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\\n');
  }
  
  safeClone(value) {
    try {
      return JSON.parse(JSON.stringify(value));
    } catch {
      return String(value);
    }
  }
  
  async run(investigation, targetObject, ...args) {
    try {
      const result = await targetObject[investigation.methodName](...args);
      investigation.result = result;
      return result;
    } catch (error) {
      investigation.error = error;
      throw error;
    } finally {
      if (investigation.cleanup) {
        investigation.cleanup();
      }
      this.investigations.delete(investigation.id);
    }
  }
}

// ИСПОЛЬЗОВАНИЕ:
const investigator = new MethodInvestigator(Tracer);
const investigation = investigator.investigate('processOrder', orderService, {
  trackObjects: true,
  trackProperties: true,
  trackDataFlow: true
});

const result = await investigator.run(investigation, orderService, 'ORD-123');
```

### 7.3 Отслеживание цепочек присвоений свойств

```javascript
class PropertyPathTracker {
  constructor(tracer) {
    this.tracer = tracer;
    this.paths = new Map();
  }
  
  trackMethod(methodName, targetProperty) {
    this.tracer.defineSlice(\`path_\${methodName}\`, {
      predicate: (args) => args.fullName === methodName,
      beforeCall: () => true,
      afterCall: () => false
    });
    
    this.tracer.traceBySlice(\`path_\${methodName}\`, (event) => {
      if (event.type === 'propertySet' && event.propName === targetProperty) {
        this.recordPath(event);
      }
    });
    
    this.tracer.enableSlice(\`path_\${methodName}\`);
  }
  
  recordPath(event) {
    const stack = new Error().stack;
    console.log(\`\\n🔍 PATH TRACE for \${event.propName}:\`);
    console.log(\`   \${event.oldValue} → \${event.newValue}\`);
    console.log(\`   At: \${event.className}\`);
    console.log(\`   Stack:\`);
    stack.split('\\n').slice(2, 6).forEach(line => {
      console.log(\`     \${line.trim()}\`);
    });
  }
}

// Использование
const pathTracker = new PropertyPathTracker(Tracer);
pathTracker.trackMethod('OrderService.processOrder', 'status');
```

---

## 8. Практические примеры

### 8.1 Пример: Полный цикл отладки

```javascript
class OrderCheckout {
  async process(orderId) {
    const order = await this.loadOrder(orderId);
    const validated = await this.validate(order);
    const payment = await this.processPayment(validated);
    return payment;
  }
}

// ШАГ 1: Общая картина
const usage = new ReportUsage({ logProvider: console });
Tracer.traceCalls((e) => {
  if (e.type === 'beforeCallMethod') {
    const [c, m] = e.fullName.split('.');
    usage.log({ className: c, fnKey: m });
  }
});

// ШАГ 2: Фокус на метод
const investigator = new MethodInvestigator(Tracer);
const investigation = investigator.investigate('process', new OrderCheckout(), {
  trackObjects: true,
  trackProperties: true,
  trackDataFlow: true
});

// ШАГ 3: Анализ
const result = await investigator.run(investigation, new OrderCheckout(), 'ORD-123');
```

### 8.2 Пример: Интеграция с тестами

```javascript
describe('OrderService', () => {
  let callSequence = [];
  
  beforeEach(() => {
    callSequence = [];
    Tracer.traceCalls((event) => {
      if (event.type === 'beforeCallMethod') {
        callSequence.push(event.fullName);
      }
    });
  });
  
  afterEach(() => {
    Tracer.untraceCalls();
  });
  
  it('should call methods in correct order', async () => {
    const service = new OrderService();
    await service.createOrder({ items: [] });
    
    expect(callSequence).toEqual([
      'OrderService.createOrder',
      'OrderService.validateOrder',
      'OrderService.calculateTotal',
      'OrderService.saveOrder'
    ]);
  });
});
```

### 8.3 Пример: Сравнение двух сценариев

```javascript
// Базовый сценарий
const baseline = new ReportSliceDiff({
  tracer: Tracer,
  sliceName: 'baseline',
  startPredicate: () => true,
  endPredicate: () => false
});

baseline.start();
await processOrder({ items: [{ price: 100 }] });
baseline.stop();

// Новый сценарий
const current = new ReportSliceDiff({
  tracer: Tracer,
  sliceName: 'current',
  startPredicate: () => true,
  endPredicate: () => false
});

current.start();
await processOrder({ items: [{ price: 200 }, { price: 300 }] });
current.stop();

// Сравниваем
const baselineCalls = baseline.getCalls();
const currentCalls = current.getCalls();

for (let i = 0; i < Math.max(baselineCalls.length, currentCalls.length); i++) {
  if (baselineCalls[i]?.fullName !== currentCalls[i]?.fullName) {
    console.error(\`Regression at index \${i}\`);
  }
}
```

---

## 9. Решение проблем

### 9.1 Частые проблемы

| Проблема | Решение |
|----------|---------|
| Слайс не активируется | Проверьте predicate: добавьте console.log внутрь |
| Слишком много событий | Используйте фильтры или слайсы |
| Асинхронные вызовы не связаны | Настройте \`Tracer.configure({ asyncContext: 'stack' })\` |
| Утечка памяти | Всегда вызывайте \`untrace\` или \`disableSlice\` |
| Не видно создание объектов | Используйте MethodInvestigator с trackObjects: true |

### 9.2 Отладка самого Tracer

```javascript
// Включение диагностики
Tracer.traceAll((event) => {
  console.log(\`[DIAG] \${event.type}: \${event.fullName}\`);
});

// Проверка состояния
console.log('Active slices:', Tracer.getEnabledSlices());
console.log('Registered slices:', Tracer.getRegisteredSlices());
console.log('Current context:', Tracer.getCurrentContext());
```

### 9.3 Советы по производительности

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
const subscription = Tracer.traceAll(callback);
// ... после использования
Tracer.untraceAll();
```

---

## 10. Чеклист разработчика

### 10.1 Перед началом отладки

```markdown
- [ ] Определить цель: что именно нужно отследить?
- [ ] Выбрать уровень детализации (минимальный/нормальный/полный)
- [ ] Решить, нужны ли слайсы или глобальная трассировка
- [ ] Настроить асинхронный контекст если нужно
```

### 10.2 В процессе отладки

```markdown
- [ ] Начать с общего отчета (ReportUsage)
- [ ] Сузить до проблемного модуля (слайс)
- [ ] Визуализировать поток (ReportTreeView)
- [ ] При необходимости - сравнить сценарии (ReportSliceDiff)
- [ ] Использовать MethodInvestigator для мониторинга конкретного метода
- [ ] Использовать debugOn для остановки в нужном месте
```

### 10.3 После отладки

```markdown
- [ ] Отключить трассировку (untraceAll)
- [ ] Очистить подписки (disableSliceListeners)
- [ ] Удалить обертки если не нужны больше
- [ ] Сохранить отчеты для документации
```

### 10.4 Шаблон для нового отчета

```javascript
class CustomReport extends BaseReport {
  constructor(options) {
    super(options);
    this.data = new Map();
  }
  
  log(event, args) {
    const key = \`\${args.className}.\${args.fnKey}\`;
    this.data.set(key, (this.data.get(key) || 0) + 1);
  }
  
  print() {
    for (const [key, count] of this.data) {
      console.log(\`\${key}: \${count} calls\`);
    }
  }
}
```

---

## 11. Заключение

### 11.1 Резюме

Tracer предоставляет мощный инструментарий для:

1. **Понимания кода** - видите реальный поток выполнения
2. **Отладки багов** - находите источник проблем
3. **Анализа производительности** - выявляете узкие места
4. **Тестирования** - проверяете последовательности вызовов
5. **Мониторинга объектов** - отслеживаете создание и связи объектов
6. **Документации** - генерируете отчеты об использовании

### 11.2 Лучшие практики

```javascript
// ✅ DO:
// 1. Используйте слайсы для фокусировки
Tracer.defineSlice('target', { predicate: (args) => /* условие */ });

// 2. Используйте MethodInvestigator для глубокого анализа
const investigator = new MethodInvestigator(Tracer);
const inv = investigator.investigate('methodName', target);

// 3. Фильтруйте шум на ранних этапах
const tree = new FilteredTreeView({ excludePatterns: [/^_/] });

// 4. Очищайте за собой
Tracer.untraceAll();

// ❌ DON'T:
// 1. Не включайте traceAll в production без необходимости
// 2. Не забывайте про асинхронный контекст
// 3. Не игнорируйте утечки подписок
```

### 11.3 Быстрая шпаргалка

```javascript
// Быстрый старт
Tracer.traceAll(console.log);
Tracer.createProxyFn(myFn, 'name')();

// Слайсы
Tracer.defineSlice('name', predicate);
Tracer.traceBySlice('name', callback);

// Отчеты
new ReportUsage({ logProvider: console }).print();
new ReportTreeView().getResults();

// Мониторинг метода
const investigator = new MethodInvestigator(Tracer);
const inv = investigator.investigate('methodName', target);
await investigator.run(inv, target, ...args);

// Отладка
Tracer.debugOn('event', condition);
Tracer.observeProperty(obj, 'prop', 'Class');

// Управление
Tracer.enableSlice('name');
Tracer.disableSlice('name');
Tracer.untraceAll();
```

---

**Tracer v2.0 | Документация**


