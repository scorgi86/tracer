# Tracer: Быстрый старт

## Установка

```bash
npm i github:scorgi86/tracer
npm ls tracer
```

## Подключение

```javascript
// ESM
import { Tracer } from 'tracer';

// CommonJS
// const { Tracer } = require('tracer');
```

## Первая трассировка

```javascript
const tracedSum = Tracer.createProxyFn((a, b) => a + b, 'sum');
Tracer.traceCalls((event) => console.log(event.type, event.fullName));
tracedSum(1, 2);
```

## Дальше

- [Слайсы](./slices.md)
- [Асинхронность](./async.md)
- [Отчеты](./reports-guide.md)
- [Полная документация](./index.md)
