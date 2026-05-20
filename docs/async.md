---
title: "Tracer: Асинхронность"
layout: default
---

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

