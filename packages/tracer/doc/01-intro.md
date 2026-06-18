# Intro
const mergedDocumentation = `# Tracer - Единая документация

## Версия 4.3 | Руководство по трассировке JavaScript-кода

---

## Оглавление

1. [Термины и определения](#1-термины-и-определения)
2. [Введение](#2-введение)
3. [Структура событий трассировки](#3-структура-событий-трассировки)
4. [Быстрый старт](#4-быстрый-старт)
5. [Слайсы: отрезки в стеке вызовов](#5-слайсы-отрезки-в-стеке-вызовов)
6. [Отчеты: статистические модели слайсов](#6-отчеты-статистические-модели-слайсов)
7. [Фильтрация шума](#7-фильтрация-шума)
8. [API Reference](#8-api-reference)
9. [Асинхронная трассировка](#9-асинхронная-трассировка)
10. [Профили трассировки](#10-профили-трассировки)
11. [Практические примеры](#11-практические-примеры)
12. [Решение проблем](#12-решение-проблем)
13. [Чеклист разработчика](#13-чеклист-разработчика)
14. [Типичные ошибки](#14-типичные-ошибки)
15. [История изменений](#15-история-изменений)

---

## 1. Термины и определения

| Термин | Определение |
|--------|-------------|
| **Стек вызовов (Call Stack)** | Последовательность вложенных вызовов функций в порядке их выполнения |
| **Глубина стека (Stack Depth)** | Количество вложенных вызовов в текущий момент |
| **Слайс (Slice)** | Отрезок в стеке вызовов, ограниченный двумя точками: началом (вход в функцию) и концом (выход из функции) |
| **Отчет (Report)** | Структурированная статистическая модель одного или нескольких слайсов |
| **Шум (Noise)** | Частые, повторяющиеся или малозначимые вызовы, которые засоряют логи |
| **NoisyCalls** | Список полных имен функций, которые исключаются из трассировки |
| **NoisyProperties** | Список полных имен свойств, которые исключаются из трассировки |
| **CallFilter** | Функция для гибкой фильтрации вызовов по пользовательской логике |
| **PropertyFilter** | Функция для гибкой фильтрации доступа к свойствам |
| **CallId** | Уникальный идентификатор вызова для связывания асинхронных цепочек |

---

## 2. Введение

### 2.1 Что такое Tracer?

**Tracer** — библиотека для runtime-трассировки JavaScript/TypeScript кода, позволяющая:

- Отслеживать вызовы функций (до и после выполнения)
- Мониторить чтение и запись свойств объектов
- Выделять отрезки в стеке вызовов (слайсы)
- Строить статистические отчеты для анализа
- Фильтровать шумные вызовы
- Работать с асинхронным кодом

### 2.2 Основная концепция

\`\`\`
Стек вызовов → Слайс (отрезок) → Отчет (статистическая модель)
\`\`\`

### 2.3 Проблема шума

\`\`\`
Без фильтрации:                        С фильтрацией:

→ CEditorPage.onTimerScroll            → PaymentService.processPayment
← CEditorPage.onTimerScroll                → PaymentService.validateAmount
→ PaintMessageLoop._animation              ← PaymentService.validateAmount
← PaintMessageLoop._animation              → PaymentService.chargeCard
→ PaymentService.processPayment            ← PaymentService.chargeCard
    → PaymentService.validateAmount    ← PaymentService.processPayment
    ← PaymentService.validateAmount    
    → PaymentService.chargeCard        
    ← PaymentService.chargeCard        
← PaymentService.processPayment        
\`\`\`

---

## 3. Структура событий трассировки

### 3.1 Базовый интерфейс

\`\`\`typescript
interface BaseTraceEvent {
  eventType: 'functionCall' | 'propertyGet' | 'propertySet';
  place: 'before' | 'after';
  fullName: string;      // 'ClassName.methodName'
  className: string;
  fnKey?: string;
  propName?: string;
  tracerState: Map<string, boolean>;
  depth?: number;
  callStack?: any;
  thisArg?: any;
}
\`\`\`

### 3.2 Событие вызова функции

\`\`\`typescript
interface FunctionCallEvent extends BaseTraceEvent {
  eventType: 'functionCall';
  args: any[];
  targetFn: Function;
  startedAt: number;
  callId?: number;
  parentCallId?: number;
  status?: 'started' | 'ok' | 'rejected' | 'error';
  value?: any;
  error?: Error;
  endedAt?: number;
  durationMs?: number;
}
\`\`\`

### 3.3 Событие чтения свойства

\`\`\`typescript
interface PropertyGetEvent extends BaseTraceEvent {
  eventType: 'propertyGet';
  propName: string;
  value: any;
}
\`\`\`

### 3.4 Событие записи свойства

\`\`\`typescript
interface PropertySetEvent extends BaseTraceEvent {
  eventType: 'propertySet';
  propName: string;
  curValue: any;
  value: any;
}
\`\`\`

### 3.5 Пример обработки

\`\`\`javascript
function handleTraceEvent(event) {
  switch (event.eventType) {
    case 'functionCall':
      if (event.place === 'before') {
        console.log(\`→ \${event.fullName}\`, event.args);
      } else {
        console.log(\`← \${event.fullName} (\${event.durationMs}ms)\`);
      }
      break;
    case 'propertyGet':
      console.log(\`📖 \${event.className}.\${event.propName} = \${event.value}\`);
      break;
    case 'propertySet':
      console.log(\`✏️ \${event.className}.\${event.propName}: \${event.curValue} → \${event.value}\`);
      break;
  }
}

Tracer.traceAll(handleTraceEvent);
\`\`\`

---

## 4. Быстрый старт

### 4.1 Установка

\`\`\`bash
npm install @scorgi86/tracer
\`\`\`

### 4.2 Импорт

\`\`\`javascript
import { Tracer } from '@scorgi86/tracer';
import { 
  ReportUsage, 
  ReportTreeView, 
  ReportSimple, 
  ReportSliceDiff,
  ReportSliceUsage 
} from '@scorgi86/tracer/reports';
\`\`\`

### 4.3 Первая трассировка

\`\`\`javascript
function calculateTotal(items) {
  return items.reduce((sum, item) => sum + item.price, 0);
}

const tracedCalculate = Tracer.createProxyFn(calculateTotal, 'calculateTotal');

Tracer.traceAll((event) => {
  console.log(\`\${event.eventType}: \${event.fullName}\`);
});

tracedCalculate([{ price: 100 }, { price: 200 }]);
// Вывод:
// functionCall: calculateTotal
// functionCall: calculateTotal
\`\`\`

### 4.4 Настройка профиля

\`\`\`javascript
Tracer.setTraceProfile('balanced', {
  enableCalls: true,
  enableProperties: false,
  suppressNoisy: true
});

const config = Tracer.getTraceConfig();
console.log(config);
\`\`\`

---

## 5. Слайсы: отрезки в стеке вызовов

### 5.1 Определение

**Слайс** — отрезок в стеке вызовов от входа в функцию до выхода из нее.

\`\`\`
Полный стек:              Слайс (отрезок):
level1                    (вне слайса)
│ level2 ◄── НАЧАЛО        │
│ │ level3                │
│ │ level3                │
│ level2 ◄── КОНЕЦ         │
level1                    (вне слайса)
\`\`\`

### 5.2 Создание слайса

\`\`\`javascript
Tracer.defineSlice('sliceName', {
  predicate: (event) => event.fullName === 'TargetFunction',
  beforeCall: () => {
    console.log('НАЧАЛО ОТРЕЗКА');
    return true;
  },
  afterCall: () => {
    console.log('КОНЕЦ ОТРЕЗКА');
    return false;
  },
  initial: false,
  description: 'Описание'
});
\`\`\`

### 5.3 Использование

\`\`\`javascript
Tracer.traceBySlice('sliceName', (event) => {
  console.log(\`[Отрезок] \${event.fullName}\`);
});

Tracer.enableSlice('sliceName');
Tracer.disableSlice('sliceName');
Tracer.disableSliceListeners('sliceName');
Tracer.untraceBySlice('sliceName');
\`\`\`

### 5.4 Sticky-слайс

\`\`\`javascript
Tracer.defineSlice('debugMode', {
  predicate: (event) => event.fullName === 'enableDebug',
  beforeCall: () => true,
  afterCall: () => true,  // true = остается активным
  initial: false
});
\`\`\`

### 5.5 Вложенные слайсы

\`\`\`javascript
Tracer.defineSlice('fullProcess', {
  predicate: (event) => event.fullName === 'processAll',
  beforeCall: () => console.log('Весь процесс начат'),
  afterCall: () => console.log('Весь процесс завершен')
});

Tracer.defineSlice('validationPart', {
  predicate: (event) => event.fullName === 'validate',
  beforeCall: () => console.log('Валидация начата'),
  afterCall: () => console.log('Валидация завершена')
});
\`\`\`

---

## 6. Отчеты: статистические модели слайсов

### 6.1 ReportUsage - счетчик вызовов

\`\`\`javascript
const usageReport = new ReportUsage({ logProvider: console });

Tracer.traceCalls((event) => {
  if (event.place === 'before') {
    const [className, fnKey] = event.fullName.split('.');
    usageReport.log({ className, fnKey });
  }
});

usageReport.print();
// Вывод:
// UserService
// PaymentService
// Class: UserService.login
// Class: PaymentService.processPayment
\`\`\`

### 6.2 ReportTreeView - структура вложенности

\`\`\`javascript
const treeReport = new ReportTreeView();

Tracer.traceCalls((event) => {
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
console.log(tree.join('\\n'));
\`\`\`

### 6.3 ReportSimple - плоский список

\`\`\`javascript
const simpleReport = new ReportSimple({ logProvider: console });

Tracer.traceCalls((event) => {
  if (event.place === 'before') {
    const [className, fnKey] = event.fullName.split('.');
    simpleReport.log({ className, fnKey });
  }
});
\`\`\`

### 6.4 ReportSliceDiff - сравнение проходов

\`\`\`javascript
const diffReport = new ReportSliceDiff({
  tracer: Tracer,
  sliceName: 'comparison',
  startPredicate: (event) => event.fullName === 'TargetFunction',
  endPredicate: (event) => event.fullName === 'TargetFunction' && event.place === 'after'
});

diffReport.start();
await targetFunction();
diffReport.stop();

diffReport.start();
await targetFunction();
diffReport.stop();

const diffs = diffReport.getDiffs();
diffs.forEach(diff => {
  if (diff.changed.args) {
    console.log(\`Аргументы изменились в \${diff.next.fullName}\`);
  }
});
\`\`\`

### 6.5 ReportSliceUsage - полная статистика

\`\`\`javascript
const sliceUsage = new ReportSliceUsage({
  tracer: Tracer,
  sliceName: 'mySlice',
  startPredicate: (event) => event.fullName === 'TargetFunction',
  endPredicate: (event) => event.fullName === 'TargetFunction' && event.place === 'after'
});

sliceUsage.start();
await targetFunction();
sliceUsage.stop();

const run = sliceUsage.getLastRun();
console.log(\`Классы: \${run.classes.join(', ')}\`);
console.log(\`Методы: \${run.methods.join(', ')}\`);
console.log(\`Событий: \${run.eventsCount}\`);

const diffs = sliceUsage.getAdjacentDiffs();
diffs.forEach(diff => {
  console.log(\`Новые методы: \${diff.methods.added}\`);
});
\`\`\`

### 6.6 Сравнение отчетов

| Отчет | Что делает | Результат |
|-------|------------|-----------|
| ReportUsage | Счетчик вызовов | \`Class.method: N раз\` |
| ReportTreeView | Структура вложенности | Дерево с отступами |
| ReportSimple | Плоский список | Уникальные вызовы |
| ReportSliceDiff | Сравнение проходов | Изменения между вызовами |
| ReportSliceUsage | Полная статистика | Списки классов, методов, свойств |

---

## 7. Фильтрация шума

### 7.1 Что такое шум?

Вызовы, которые происходят часто и засоряют логи:
- \`onTimerScroll\` (60 раз/сек)
- \`_animation\` (60 раз/сек)
- \`_autoSave\`
- \`Logger.log\`

### 7.2 NoisyCalls - исключение вызовов

\`\`\`javascript
Tracer.configureTracing({
  suppressNoisy: true,
  noisyCalls: [
    'CEditorPage.onTimerScroll',
    'PaintMessageLoop._animation',
    'baseEditorsApi._autoSave'
  ]
});
\`\`\`

### 7.3 NoisyProperties - исключение свойств

\`\`\`javascript
Tracer.configureTracing({
  suppressNoisy: true,
  noisyProperties: [
    'Component._internal',
    'Cache._timestamp'
  ]
});
\`\`\`

### 7.4 CallFilter - пользовательская фильтрация

\`\`\`javascript
Tracer.configureTracing({
  callFilter: ({ fullName, className, fnKey }) => {
    // Только методы сервисов
    return fullName.includes('Service') || fullName.includes('Repository');
  }
});
\`\`\`

### 7.5 PropertyFilter - пользовательская фильтрация

\`\`\`javascript
Tracer.configureTracing({
  propertyFilter: ({ phase, propName, className }) => {
    if (propName.startsWith('_')) return false;
    if (phase === 'get') return false;
    return true;
  }
});
\`\`\`

### 7.6 Порядок применения фильтров

\`\`\`
1. noisyCalls / noisyProperties (полное исключение)
   ↓
2. callFilter / propertyFilter (пользовательская логика)
   ↓
3. Событие передается в слайсы
   ↓
4. traceBySlice получает событие (если слайс активен)
\`\`\`

---

## 8. API Reference

### 8.1 Основные методы Tracer

```javascript
// Наблюдение функций и классов
Tracer.createProxyFn(targetFn, eventName);
Tracer.observeConstructor(classCtor, className?);
Tracer.observe(target, targetName?);
Tracer.observePrototype(classCtor, className?);
Tracer.observeAll(targetList);
Tracer.observePrototypeAll(targetList);

// Наблюдение свойств
Tracer.observeProperties(target, {
  name: className,
  properties: "propName" | ["a", "b"] | true,
  deep: false,
  maxDepth: 3,
  useProxy: false,
});

// Каноническая подписка на трассировку
const unsubscribe = Tracer.trace(callback, {
  eventTypes: "all" | "calls" | "properties",
  property: "propName",
  slice: "sliceName",
  batch: false,
});
unsubscribe();

// Совместимые wrappers
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

// Слайсы
Tracer.defineSlice(name, config);
Tracer.enableSlice(name);
Tracer.disableSlice(name);
Tracer.disableSliceListeners(name);
Tracer.traceBySlice(name, callback);
Tracer.traceBySliceOnce(name, callback);
Tracer.traceBySliceSequence(sliceSeq, callback);
Tracer.untraceBySlice(name, callback?);
Tracer.getEnabledSlices();
Tracer.getRegisteredSlices();
Tracer.defineSliceByCall(sliceName, target, targetFnName, predicate);
Tracer.defineSliceByFunction(sliceName, fn);
Tracer.defineSliceByFunctionName(sliceName, fnName);
Tracer.printRegisteredSlices();

// Конфигурация и отладка
Tracer.configure(options);
Tracer.setTraceProfile(profileName, overrides);
Tracer.configureTracing(options);
Tracer.getTraceConfig();
Tracer.logSlice(sliceSelector, ...values);
Tracer.invokeOnSlice(sliceName, fn);
Tracer.getCurrentContext();
Tracer.debugOn(eventName, conditionCallback);
Tracer.debugOnceOn(eventName, conditionCallback);
Tracer.tracerState;
Tracer.reports;
```

### 8.2 Конфигурация трассировки

\`\`\`javascript
Tracer.configureTracing({
  enableCalls: true,
  enableProperties: false,
  suppressNoisy: true,
  noisyCalls: ['Class.method'],
  noisyProperties: ['Class.property'],
  callFilter: ({ fullName, className, fnKey }) => boolean,
  propertyFilter: ({ phase, propName, className }) => boolean,
  captureContext: false
});
\`\`\`

### 8.3 Конфигурация слайса

\`\`\`javascript
Tracer.defineSlice('sliceName', {
  predicate: (event) => boolean,
  beforeCall: (event) => boolean,
  afterCall: (event) => boolean,
  initial: false,
  description: 'string'
});
\`\`\`

### 8.4 Batch-подписки

\`\`\`javascript
Tracer.traceAllBatched((batch) => {
  console.log(\`Получено \${batch.length} событий\`);
  fetch('/api/trace', { method: 'POST', body: JSON.stringify(batch) });
}, { maxBatchSize: 100, flushIntervalMs: 100 });
\`\`\`

---

## 9. Асинхронная трассировка

### 9.1 Настройка контекста

\`\`\`javascript
// Node.js
Tracer.configure({ asyncContext: 'stack' });

// Браузер (требуется Zone.js)
Tracer.configure({ asyncContext: 'zone' });
\`\`\`

### 9.2 Включение CallId

\`\`\`javascript
Tracer.setTraceProfile('full', { captureContext: true });
// или
Tracer.configureTracing({ captureContext: true });
\`\`\`

### 9.3 Пример асинхронной трассировки

\`\`\`javascript
class OrderService {
  async createOrder(items) {
    const validated = await this.validateItems(items);
    const total = await this.calculateTotal(validated);
    return await this.processPayment(total);
  }
  async validateItems(items) { /* ... */ }
  async calculateTotal(items) { /* ... */ }
  async processPayment(amount) { /* ... */ }
}

Tracer.configure({ asyncContext: 'stack' });
Tracer.setTraceProfile('full', { captureContext: true });

Tracer.traceCalls((event) => {
  const arrow = event.place === 'before' ? '→' : '←';
  console.log(\`[\${event.callId}] \${arrow} \${event.fullName}\`);
});
\`\`\`

### 9.4 Получение контекста

\`\`\`javascript
const context = Tracer.getCurrentContext();

context.forEach((node) => {
  if (node.val) {
    console.log(\`\${node.val.className}.\${node.val.fnKey}\`);
  }
});

context.trace('Дополнительная информация');
\`\`\`

---

## 10. Профили трассировки

| Профиль | enableCalls | enableProperties | suppressNoisy | captureContext |
|---------|-------------|------------------|---------------|----------------|
| minimal | true | false | true | false |
| balanced | true | false | true | false |
| full | true | true | false | true |

\`\`\`javascript
Tracer.setTraceProfile('minimal');
Tracer.setTraceProfile('full');
Tracer.setTraceProfile('balanced', { enableProperties: true });
\`\`\`

---

## 11. Практические примеры

### 11.1 Полный цикл отладки

\`\`\`javascript
class ECommerceService {
  async checkout(cartId, paymentMethod) {
    const cart = await this.getCart(cartId);
    const validated = await this.validateCart(cart);
    const total = this.calculateTotal(validated);
    const payment = await this.processPayment(total, paymentMethod);
    return await this.createOrder(cart, payment);
  }
  async getCart(id) { return { items: [] }; }
  async validateCart(cart) { return cart; }
  calculateTotal(items) { return 100; }
  async processPayment(amount, method) { return { success: true }; }
  async createOrder(cart, payment) { return { id: 1 }; }
}

// Настройка
Tracer.configure({ asyncContext: 'stack' });
Tracer.setTraceProfile('balanced');

// Оборачиваем
const TracedService = Tracer.observeConstructor(ECommerceService, 'ECommerceService');
const service = new TracedService();

// Сбор статистики
const usageReport = new ReportUsage({ logProvider: console });
Tracer.traceCalls((event) => {
  if (event.place === 'before') {
    const [className, fnKey] = event.fullName.split('.');
    usageReport.log({ className, fnKey });
  }
});

// Слайс для детального анализа
Tracer.defineSlice('checkoutFlow', {
  predicate: (event) => event.fullName === 'ECommerceService.checkout',
  beforeCall: () => console.log('НАЧАЛО ОФОРМЛЕНИЯ'),
  afterCall: () => console.log('КОНЕЦ ОФОРМЛЕНИЯ')
});

Tracer.traceBySlice('checkoutFlow', (event) => {
  console.log(\`[Checkout] \${event.fullName}\`);
});

await service.checkout('cart123', 'card');
usageReport.print();
\`\`\`

### 11.2 Отслеживание изменения свойства

\`\`\`javascript
class Order {
  constructor() { this.status = 'pending'; }
  approve() { this.status = 'approved'; }
  reject() { this.status = 'rejected'; }
}

Tracer.observeProperties(Order.prototype, { name: 'Order', properties: 'status' });

Tracer.traceProperties((event) => {
  if (event.propName === 'status') {
    console.log(\`Статус: \${event.curValue} → \${event.value}\`);
    console.log(new Error().stack.split('\\n')[3]);
  }
});

const order = new Order();
order.approve();
// Вывод: Статус: pending → approved
\`\`\`

### 11.3 Batch-отправка в production

\`\`\`javascript
const batch = [];

Tracer.setTraceProfile('minimal');
Tracer.configureTracing({ suppressNoisy: true });

Tracer.traceAllBatched((events) => {
  batch.push(...events);
}, { maxBatchSize: 50, flushIntervalMs: 5000 });

setInterval(async () => {
  if (batch.length > 0) {
    const events = [...batch];
    batch.length = 0;
    await fetch('/api/trace', { method: 'POST', body: JSON.stringify(events) });
  }
}, 5000);
\`\`\`

### 11.4 Поиск цепочки присвоений

\`\`\`javascript
class Repository { constructor() { this.data = null; } }
class Service { constructor(repo) { this.repo = repo; } }
class Controller { constructor(svc) { this.svc = svc; } }

Tracer.observeProperties(Repository.prototype, { name: 'Repository', properties: 'data' });

Tracer.defineSlice('dataFlow', {
  predicate: (event) => ['updateData', 'saveData', 'store'].some(m => event.fullName.includes(m)),
  beforeCall: () => true,
  afterCall: () => false
});

const path = [];
Tracer.traceBySlice('dataFlow', (event) => {
  if (event.place === 'before') path.push(event.fullName);
  if (event.eventType === 'propertySet' && event.propName === 'data') {
    console.log('Цепочка:', path.join(' → '));
    path.length = 0;
  }
});
\`\`\`

---

## 12. Решение проблем

| Проблема | Решение |
|----------|---------|
| Слайс не активируется | Проверьте predicate, добавьте console.log |
| Асинхронные вызовы не связаны | Настройте \`asyncContext: 'stack'\` |
| Слишком много событий | Используйте профиль minimal или batch |
| Утечка памяти | Вызывайте \`untraceBySlice\` или \`disableSliceListeners\` |
| Нет callId в событиях | Включите \`captureContext: true\` |

### Отладка Tracer

\`\`\`javascript
console.log('Активные слайсы:', Tracer.getEnabledSlices());
console.log('Зарегистрированные:', Tracer.getRegisteredSlices());
console.log('Конфигурация:', Tracer.getTraceConfig());
console.log('Контекст:', Tracer.getCurrentContext());
\`\`\`

---

## 13. Чеклист разработчика

### 13.1 Перед началом

\`\`\`markdown
- [ ] Определить цель трассировки (баг, производительность, анализ)
- [ ] Выбрать профиль (minimal/balanced/full)
- [ ] Настроить асинхронный контекст если нужно
- [ ] Определить нужные слайсы
\`\`\`

### 13.2 В процессе

\`\`\`markdown
- [ ] Начать с ReportUsage
- [ ] Визуализировать ReportTreeView
- [ ] Сузить до слайса
- [ ] Использовать debugOn для остановки
- [ ] Применить фильтрацию шума если нужно
\`\`\`

### 13.3 После завершения

\`\`\`markdown
- [ ] Отключить подписки (untraceAll)
- [ ] Очистить слайсы (disableSliceListeners)
- [ ] Сохранить отчеты для анализа
\`\`\`

---

## 14. Типичные ошибки

### ❌ Не делайте так

\`\`\`javascript
// 1. Тяжелые операции в predicate
Tracer.defineSlice('slow', {
  predicate: (event) => {
    return JSON.stringify(event).includes('pattern'); // Медленно!
  }
});

// 2. Забыли отписаться
Tracer.traceAll(callback);
// ... нет вызова Tracer.untraceAll() → утечка памяти


// 4. Фильтруйте внутри callback
Tracer.traceBySlice('slice', (event) => {
  if (Tracer.tracerState.get('someSlice')) {
    // обработка
  }
});

// 5. Фиксируйте baseline
const baseline = new ReportSliceDiff({...});
baseline.start();
await runWithData(testData);
baseline.stop();
// потом сравнивайте с тем же testData
\`\`\`

---

## 15. История изменений

### 4.3 (2024)
- Объединение документации в единый файл
- Добавлен раздел "Типичные ошибки"

### 4.2 (2024)
- Добавлен ReportSliceUsage
- Улучшена фильтрация шума
- Добавлены batch-подписки

### 4.1 (2024)
- Добавлены профили трассировки
- Добавлен captureContext для асинхронности

### 4.0 (2024)
- Переработана архитектура слайсов
- Добавлена поддержка Zone.js
- Улучшены отчеты

---

## Быстрая шпаргалка

\`\`\`javascript
// Базовые команды
Tracer.traceAll(console.log);
Tracer.traceCalls(console.log);
Tracer.traceProperties(console.log);
Tracer.untraceAll();

// Слайсы
Tracer.defineSlice('name', { predicate: (e) => e.fullName === 'target', beforeCall: () => true, afterCall: () => false });
Tracer.traceBySlice('name', callback);
Tracer.enableSlice('name');
Tracer.disableSlice('name');

// Отчеты
new ReportUsage({ logProvider: console }).print();
new ReportTreeView().getResults();
new ReportSliceDiff({ tracer: Tracer, startPredicate, endPredicate });
new ReportSliceUsage({ tracer: Tracer, startPredicate, endPredicate });

// Отладка
Tracer.debugOn('beforeCallMethod', (e) => e.fullName === 'target');
Tracer.observeProperties(obj, { name: 'Class', properties: 'prop' });

// Конфигурация
Tracer.setTraceProfile('minimal');
Tracer.configure({ asyncContext: 'stack' });
Tracer.configureTracing({ suppressNoisy: true, noisyCalls: ['method'] });
\`\`\`

---

**Tracer v4.3 | Единая документация**

\`\`\`javascript
// Скачать: const blob = new Blob([documentation], { type: 'text/markdown' });
// const url = URL.createObjectURL(blob);
// const a = document.createElement('a');
// a.href = url;
// a.download = 'tracer-documentation.md';
// a.click();
\`\`\`
`;

// Функция для скачивания
function downloadDocumentation() {
  const blob = new Blob([mergedDocumentation], { type: 'text/markdown' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'tracer-documentation.md';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  console.log('✅ Документация скачана как tracer-documentation.md');
}

// Для браузера
if (typeof window !== 'undefined') {
  window.downloadTracerDocs = downloadDocumentation;
  window.tracerDocumentation = mergedDocumentation;
  console.log('📚 Используйте downloadTracerDocs() для скачивания документации');
}

// Для Node.js
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { mergedDocumentation, downloadDocumentation };
}
