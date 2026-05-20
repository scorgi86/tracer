# Tracer: Быстрый старт

Этот гайд нужен, чтобы за 10-15 минут запустить трассировку в проекте и получить полезный сигнал, а не поток шума.

## 1. Установка

### Вариант A: из GitHub

```bash
npm i github:scorgi86/tracer
npm ls tracer
```

### Вариант B: локальная сборка из репозитория

```bash
git clone https://github.com/scorgi86/tracer.git
cd tracer
npm install
npm run build
```

## 2. Подключение

### ESM

```javascript
import { Tracer } from 'tracer';
```

### CommonJS

```javascript
const { Tracer } = require('tracer');
```

### Smoke-проверка

```javascript
const tracedProbe = Tracer.createProxyFn((a, b) => a + b, 'probe.sum');
Tracer.traceCalls((event) => console.log(event.type, event.fullName));
console.log(tracedProbe(1, 2)); // 3
```

Ожидаемо в логе:

```text
beforeCallMethod probe.sum
afterCallMethod probe.sum
```

## 3. Базовая рабочая конфигурация

```javascript
Tracer.setTraceProfile('balanced');
Tracer.configureTracing({
  noisyCalls: ['CEditorPage.onTimerScroll'],
  callFilter: ({ fullName }) => !fullName.includes('debug')
});
```

Почему так:
- `balanced` дает нормальный компромисс между деталями и нагрузкой.
- `noisyCalls` сразу убирает известные источники мусора.
- `callFilter` позволяет локально сузить фокус.

## 4. Первый реальный сценарий

```javascript
function calculateTotal(items) {
  return items.reduce((sum, item) => sum + item.price, 0);
}

const tracedCalculateTotal = Tracer.createProxyFn(calculateTotal, 'Cart.calculateTotal');

const stop = Tracer.traceCalls((event) => {
  console.log(`[${event.type}] ${event.fullName}`);
});

tracedCalculateTotal([{ price: 100 }, { price: 250 }]);
stop?.();
```

## 5. Частые проблемы

### Не вижу событий
- Убедитесь, что вызываете именно `tracedFn`, а не оригинальную функцию.
- Временно отключите фильтр `callFilter`.
- Временно поставьте `Tracer.setTraceProfile('full')`.

### Слишком много событий
- Добавьте `noisyCalls`.
- Ужесточите `callFilter` по `fullName`.
- Перейдите с `full` на `balanced`.

### Высокая нагрузка
- Используйте `minimal` или `balanced`.
- Трассируйте ограниченный участок кода (через слайсы).

## 6. Что делать дальше

- [Слайсы: фокус на сценарии](./slices.md)
- [Асинхронность: Promise/async-await](./async.md)
- [Отчеты: от логов к аналитике](./reports-guide.md)
- [Полная документация](./index.md)
