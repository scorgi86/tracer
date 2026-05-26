---
title: "Гайд по использованию Tracer с Codex/Claude AI"
layout: default
---

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

