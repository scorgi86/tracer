# Tracer: Слайсы

Слайс помогает фокусировать трассировку только на интересующем сценарии.

## Пример

```javascript
Tracer.defineSlice('checkout-payment', {
  predicate: (event) =>
    event.fullName.includes('CheckoutService') ||
    event.fullName.includes('PaymentService'),
  description: 'Только вызовы checkout/payment'
});

Tracer.enableSlice('checkout-payment');
Tracer.traceBySlice('checkout-payment', (event) => {
  console.log(`[slice:checkout-payment] ${event.type} ${event.fullName}`);
});

// ... ваш сценарий ...

Tracer.disableSlice('checkout-payment');
```

## Как это читать

- `predicate` решает, какие события войдут в слайс.
- `traceBySlice` получает только события активного слайса.
- `enableSlice/disableSlice` позволяют включать фокус только на время диагностики.

- [Полная документация](./index.md)
