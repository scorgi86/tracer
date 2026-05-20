# Tracer: Асинхронность

Tracer поддерживает `Promise` и `async/await`, чтобы сохранять связность цепочки вызовов.

## Базовая настройка

```javascript
Tracer.configure({ asyncContext: 'stack' });
```

## Мини-пример

```javascript
async function processOrder(orderId) {
  const order = await loadOrder(orderId);
  return saveOrder(order);
}

const tracedProcessOrder = Tracer.createProxyFn(processOrder, 'OrderService.processOrder');

Tracer.traceCalls((event) => {
  console.log(event.type, event.fullName);
});

await tracedProcessOrder('ORD-123');
```

## Подсказка

Если порядок асинхронных событий выглядит странно, начните с профиля `balanced`, затем временно переключайтесь на `full`.

- [Полная документация](./index.md)
