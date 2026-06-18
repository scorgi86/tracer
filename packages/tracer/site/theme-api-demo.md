# Tracer API Layout Demo

Эта страница демонстрирует использование `vitepress-theme-api` в документации проекта.

<script setup>
import { DividePage } from 'vitepress-theme-api';
</script>

<DividePage :top="8">
  <template #left>

## Endpoint

`Tracer.traceCalls(callback)`

### Назначение

Подписка на события вызовов функций (`before`/`after`).

### Параметры

- `callback: (event) => void`

### Возвращает

- `unsubscribe` (если используется через внутренний pub/sub)

::: tip
Для production используйте батч-подписки (`traceCallsBatched`) и фильтры шума.
:::

  </template>
  <template #right>

```js
const { Tracer } = require('./dist/tracer.cjs.js');

Tracer.setTraceProfile('balanced');

Tracer.traceCalls((event) => {
  if (event.place === 'before') {
    console.log('->', event.fullName);
  }
});
```

```js
Tracer.configureTracing({
  suppressNoisy: true,
  noisyCalls: ['CEditorPage.onTimerScroll']
});
```

  </template>
</DividePage>
