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
