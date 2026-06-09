# Tracer

Tracer — инструмент для расследования поведения JavaScript/TypeScript-кода в runtime: вызовов функций, изменения свойств и цепочек выполнения.

Он нужен не для того, чтобы «логировать больше», а чтобы быстрее находить полезный сигнал в сложных сценариях: пользовательских действиях, фоновых процессах, асинхронных цепочках, изменениях состояния и вызовах методов.

Tracer не заменяет APM, production monitoring или обычные тесты. Это инструмент для разработки и расследования: когда нужно понять, что реально происходит в коде во время выполнения.

## Оглавление

- [Зачем нужен Tracer](#зачем-нужен-tracer)
- [Когда использовать](#когда-использовать)
- [Когда не использовать](#когда-не-использовать)
- [Быстрый старт](#быстрый-старт)
- [Подключение через webpack-сборку](#подключение-через-webpack-сборку)
- [API](#api)
- [Профили и фильтры](#профили-и-фильтры)
- [Отчеты](#отчеты)

## Зачем нужен Tracer

### Какие проблемы решает

- В приложении есть частые фоновые циклы, например `setInterval(..., 40)`. В одних итерациях они делают только проверки, в других запускают значимую работу вроде автосохранения. При обычном логировании такой поток быстро создает много записей с низкой плотностью полезной информации.
- Есть асинхронные фоновые механики: анимации, `postMessage`, internal event bus, server events/WebSocket, внутренний event loop приложения. Они формируют длинные цепочки callback'ов и обработчиков, поведение которых команда часто восстанавливает уже во время расследования. Обычный лог в таких сценариях быстро раздувается, а полезный сигнал теряется среди служебных вызовов.
- Нужно понять цепочку вызовов внутри конкретного пользовательского действия: клика, ввода с клавиатуры, paste, drag-and-drop. В общем потоке приложения такие действия смешиваются с фоновыми процессами и асинхронными обработчиками.
- Нужно найти место, где конкретному объекту присваивается конкретное значение. Это особенно сложно, когда один и тот же класс постоянно клонируется или пересоздается: в лог попадают десятки похожих присвоений из разных инстансов, и нужное изменение трудно отличить от похожих.
- Та же проблема возникает с методами и функциями: нужный вызов теряется среди множества похожих вызовов из других сценариев, объектов или фоновых потоков.
- Есть подозрения в расхождении между описанием и реальным runtime-поведением (например, цепочка загрузки документа): неясно, какие классы и методы действительно участвуют.
- Есть подсистемы с плотной цепочкой вызовов и высоким служебным шумом. Нужен быстрый способ отличить существенные шаги бизнес-логики от второстепенных служебных операций.

Пример типичного источника шума:

```js
setInterval(() => {
  if (!documentModel.isReady()) {
    return;
  }

  if (documentModel.hasPendingChanges()) {
    autosave(documentModel);
  }

  animationLoop.flush();
  eventBus.processQueue();
}, 40);
```

В таком коде большинство итераций могут быть холостыми, часть запускает автосохранение, часть обрабатывает анимации или внутреннюю очередь событий. Если поставить `console.log` внутри обработчиков, лог быстро смешает фоновые проверки, пользовательские действия и реальные изменения состояния.

### Как Tracer помогает

- **Slices** позволяют наблюдать конкретный сценарий как отдельную цепочку выполнения. Например, `UserAction` показывает вызовы только в пределах пользовательского клика.
- **Наблюдение функций и свойств** помогает увидеть, где именно был вызван метод или где конкретному объекту присвоили нужное значение.
- **TreeViewReport** показывает вложенность вызовов как дерево: видно не только «что вызвалось», но и «из какого контекста».
- **UsageReport** собирает статистику по классам, методам и свойствам. Это помогает сначала получить общую картину, а затем постепенно сузить поиск до нужной цепочки.

В итоге Tracer помогает перейти от ручного разбора шумного лога к последовательному расследованию: сначала увидеть общую картину поведения, затем отфильтровать лишнее и дойти до конкретного сценария, вызова или присваивания.

## Когда использовать

### Фоновые циклы и периодические задачи

**Сценарий:** в приложении есть частые фоновые циклы, например `setInterval(..., 40)`, автосохранение, синхронизация или регулярные проверки состояния.

**Проблема:** часть итераций может быть холостой, часть запускает полезную работу, но обычные логи быстро превращаются в поток однотипных записей. Разработчику приходится вручную отделять полезные события от фонового шума.

**Решение:** через слайсы и фильтры Tracer позволяет выделить только интересующий участок выполнения: например, момент реального автосохранения, конкретную проверку или цепочку вызовов внутри фонового процесса.

```js
Tracer.defineSlice("AutoSave", {
  predicate: ({ fullName }) => fullName === "DocumentService.autosave",
  beforeCall: () => true,
  afterCall: () => false,
});

Tracer.traceBySlice("AutoSave", (event) => {
  console.log(event.fullName, event.place);
});
```

### Пользовательские действия

**Сценарий:** нужно понять, что происходит после клика, ввода с клавиатуры, paste, drag-and-drop или другого действия пользователя.

**Проблема:** пользовательское действие смешивается с фоновыми процессами, асинхронными обработчиками и служебными вызовами. По обычному `console.log` трудно понять цельную цепочку: где действие началось, через какие методы прошло и где привело к изменению состояния.

**Решение:** слайс вроде `UserAction` показывает цепочку вызовов только в пределах конкретного пользовательского сценария. Это помогает смотреть не на весь поток приложения, а на один понятный путь выполнения.

```js
Tracer.defineSlice("UserAction", {
  predicate: ({ fullName, args }) =>
    fullName === "jQuery.event.dispatch" &&
    typeof args?.[0] === "object" &&
    args[0]?.type === "click",
  beforeCall: () => true,
  afterCall: () => false,
});

Tracer.traceBySlice("UserAction", (event) => {
  console.log(event.fullName, event.place);
});

Tracer.logSlice("UserAction", "click scenario reached important step");
```

`predicate` зависит от приложения: в этом примере пользовательский клик определяется через `jQuery.event.dispatch`, но в другом проекте это может быть DOM event handler, command dispatcher или событие внутреннего event bus.

`Tracer.logSlice(sliceSelector, ...values)` полезен как scoped-лог: сообщение попадет в вывод только тогда, когда активен нужный слайс. Это помогает добавлять диагностические сообщения в конкретный сценарий, не засоряя общий лог приложения.

### Асинхронные цепочки и внутренние события

**Сценарий:** поведение строится вокруг анимаций, `postMessage`, internal event bus, server events/WebSocket, внутреннего event loop приложения или других callback-цепочек.

**Проблема:** вызовы приходят из разных асинхронных источников, порядок выполнения трудно восстановить по исходникам, а команда часто понимает реальное поведение уже во время расследования. Лог раздувается, но не дает ясной картины причинно-следственной цепочки.

**Решение:** Tracer собирает цепочку вызовов в runtime и позволяет смотреть на нее как на дерево или как на ограниченный слайс. Так проще увидеть, какой обработчик что вызвал и в каком контексте это произошло.

```js
Tracer.defineSlice("MessageFlow", {
  predicate: ({ fullName }) =>
    fullName === "MessageBus.dispatch" ||
    fullName === "WindowMessageHandler.onMessage",
  beforeCall: () => true,
  afterCall: () => false,
});

Tracer.traceBySlice("MessageFlow", (event) => {
  console.log(event.fullName, event.place);
});
```

### Поиск места присваивания свойства

**Сценарий:** известен целевой объект или значение, но непонятно, где именно свойству присваивается это значение.

**Проблема:** в приложении может постоянно создаваться много инстансов одного класса, в том числе через клонирование или пересоздание объектов. В лог попадают десятки похожих присваиваний одного свойства из разных мест, и нужное изменение трудно отличить от похожих.

**Решение:** наблюдение свойств (`observeProperty`, `observePropertyObject`) помогает зафиксировать конкретные `get`/`set` события и связать их с цепочкой вызовов. Вместо общего шума разработчик видит, где именно произошло нужное изменение.

```js
Tracer.observeProperty(target, "status", "Order");

Tracer.traceProperties((event) => {
  if (event.propName === "status") {
    console.log(event.fullName, event.curValue, "->", event.value);
  }
});
```

### Поиск присваивания по вложенному пути

**Сценарий:** значение хранится во вложенной структуре, например `color.rgba.r`.

```js
const color = {
  rgba: {
    r: "",
    g: "",
    b: "",
    a: "",
  },
};
```

**Проблема:** если наблюдать только свойства первого уровня, видно присваивание `color.rgba`, но не видно, где меняется `color.rgba.r` или `color.rgba.a`. При обычном `console.log` приходится вручную добавлять логи в разные места или отдельно оборачивать объект, который лежит внутри `rgba`.

**Решение:** `Tracer.observePropertyObject(...)` позволяет повесить наблюдение на объект, который лежит внутри свойства, и получать события по полному пути.

```js
Tracer.observePropertyObject(color.rgba, "rgba", "Color");

Tracer.traceProperties((event) => {
  if (event.fullName === "Color.rgba.r") {
    console.log(event.fullName, event.curValue, "->", event.value);
  }
});

color.rgba.r = "255";
```

В таком сценарии Tracer помогает увидеть не только факт изменения `rgba`, а конкретное вложенное присваивание: `Color.rgba.r`.

### Поиск нужного вызова метода или функции

**Сценарий:** известно, какой метод или функция важны для расследования, но они вызываются много раз из разных сценариев.

**Проблема:** обычный лог показывает все вызовы подряд, без хорошего разделения по контексту. Нужный вызов теряется среди похожих вызовов из других объектов, пользовательских действий или фоновых процессов.

**Решение:** Tracer позволяет оборачивать функции и методы, а затем ограничивать наблюдение слайсами и фильтрами. Это помогает найти не просто факт вызова, а конкретный вызов в нужной цепочке выполнения.

```js
class OrderService {
  calculateTotal(items) {
    return items.reduce((sum, item) => sum + item.price, 0);
  }
}

Tracer.traceCalls((event) => {
  if (event.fullName === "OrderService.calculateTotal") {
    console.log(event.fullName, event.place);
  }
});

const service = Tracer.observe(new OrderService(), "OrderService");
service.calculateTotal([{ price: 100 }, { price: 250 }]);
```

### Поиск места, откуда вызвали целевой метод

**Сценарий:** известен целевой метод, который участвует в проблеме, но непонятно, из какого места он был вызван.

**Проблема:** метод может вызываться из разных обработчиков, фоновых процессов или пользовательских сценариев. Обычный `console.log` показывает сам факт вызова, но не всегда удобно восстанавливать путь до него, особенно когда таких вызовов много.

**Решение:** в событиях Tracer доступен `event.callStack`. У него есть метод `event.callStack.trace(...)`, который выводит логический стек Tracer: цепочку наблюдаемых функций и методов приложения, которая привела к событию. Это отличается от `console.trace()` внутри обработчика: он покажет технический стек самого callback-а Tracer, включая emitter/proxy/wrapper.

```js
Tracer.traceCalls((event) => {
  if (
    event.place === "before" &&
    event.fullName === "OrderService.calculateTotal"
  ) {
    // console.trace() здесь покажет технический стек подписки Tracer.
    // callStack.trace() показывает логическую цепочку вызовов приложения.
    event.callStack.trace("OrderService.calculateTotal call path");
  }
});
```

`console.trace()` внутри такого обработчика покажет путь до callback-а подписки Tracer: emitter, proxy/wrapper и внутренние функции трассировки. `event.callStack.trace(...)` показывает логический стек приложения: какие наблюдаемые функции и методы привели к целевому вызову.

### Проверка цепочки загрузки документа

**Сценарий:** нужно быстро проверить, как у вас действительно работает загрузка документа в runtime: какие классы и методы участвуют, в каком порядке и какие ветки исполняются.

**Проблема:** внешняя документация описывает желаемое поведение, но в вашем окружении и конкретном сценарии неясно, что реально вызывается. Попытка добавить логи вручную размывает картину и не даёт цельной структуры вызовов.

**Решение:** оборачивайте только путь загрузки в отдельный срез `DocLoad`, собирайте в нём tree и usage отчёты и уменьшайте объём наблюдения до целевой цепочки.

```js
const { ReportTreeView, ReportUsage } = Tracer.reports;
const treeReport = new ReportTreeView();
const usageReport = new ReportUsage({ logProvider: console });

Tracer.defineSlice("DocLoad", {
  predicate: ({ fullName, args }) =>
    fullName === "DocumentService.openDocument" &&
    args?.[0]?.type === "open",
  beforeCall: () => true,
  afterCall: () => false,
});

Tracer.traceBySlice("DocLoad", (event) => {
  if (event.place === "before") {
    treeReport.log(event, JSON.stringify(event.args || []));
    usageReport.log({
      className: event.className,
      fnKey: event.fnKey,
    });
  } else {
    treeReport.log(event);
  }
});

// Прогоняем конкретный сценарий открытия документа.
documentController.openDocument({ type: "open", docId: 42 });

console.log(treeReport.getResults().join("\n"));
usageReport.print();
```

### Отладка производительности и шума в графическом рендере

**Сценарий:** нужно быстро понять, как работает 2D/3D рендер-контур (`renderFrame`, `draw`, `tick`) и где теряются кадры, не разбирая вручную весь слой логов.

**Проблема:** рендер содержит много фоновых и служебных вызовов. Даже с обычными логами вы видите только «шум» вместо причинно-следственной цепочки: какой шаг рендера выполняется лишний раз, где лишние пересборки, и какой узел добавил задержку.

**Решение:** ограничьте трассировку одним слайсом `RenderFlow`, собирайте только вызовы, относящиеся к кадру/сцене, и используйте `noisyCalls`/`callFilter` для уноса мусора. Параллельно считайте длительности (`durationMs`) по ключевым функциям (`renderFrame`, `submitScene`, `prepareFrame`) и сразу получаете список «дорогих» узлов.

```js
const { ReportUsage } = Tracer.reports;
const usageReport = new ReportUsage({ logProvider: console });
const renderCalls = [];

Tracer.defineSlice("RenderFlow", {
  predicate: ({ fullName, className }) =>
    fullName === "Renderer.renderFrame" ||
    className === "Renderer" ||
    className === "SceneGraph",
  beforeCall: () => true,
  afterCall: () => false,
});

Tracer.traceBySlice("RenderFlow", (event) => {
  if (event.place === "before") {
    usageReport.log({
      className: event.className,
      fnKey: event.fnKey,
    });

    if (event.fnKey === "Renderer.renderFrame") {
      console.log("frame start", event.args?.[0]?.frameId);
    }
  } else if (event.place === "after" && typeof event.durationMs === "number") {
    renderCalls.push({
      fnKey: event.fnKey,
      durationMs: event.durationMs,
      status: event.status,
    });
  }
});

// Прогоним несколько кадров/сценарий рендера.
renderer.tick();

usageReport.print();
console.table(
  renderCalls.sort((a, b) => b.durationMs - a.durationMs).slice(0, 20),
);
```

### Исследование производительности вызовов

**Сценарий:** сценарий работает медленно, но заранее непонятно, какой метод или участок цепочки дает основной вклад в задержку.

**Проблема:** ручные замеры через `performance.now()` приходится расставлять в разных местах исходника, а в сложной цепочке легко измерить не тот участок или потерять вложенность вызовов.

**Решение:** call-события Tracer содержат `startedAt`, `endedAt` и `durationMs`. Можно собрать длительности всех наблюдаемых вызовов, отсортировать их и быстро увидеть самые дорогие методы. После первого широкого прохода наблюдение обычно сужают через слайсы и фильтры до конкретного сценария.

```js
const slowCalls = [];

Tracer.traceCalls((event) => {
  if (event.place !== "after" || typeof event.durationMs !== "number") {
    return;
  }

  slowCalls.push({
    fullName: event.fullName,
    durationMs: event.durationMs,
    status: event.status,
  });
});

// Запустите проблемный сценарий приложения.

const topSlowCalls = slowCalls
  .sort((a, b) => b.durationMs - a.durationMs)
  .slice(0, 20);

console.table(topSlowCalls);
```

Такой первый проход помогает увидеть, какие наблюдаемые методы дают самый большой вклад во время выполнения. После этого можно сузить трассировку через `traceBySlice(...)`, `callFilter` или `noisyCalls`.

### Исследование незнакомого участка кода

**Сценарий:** команда отлаживает сложный участок, поведение которого заранее не знает: например, фоновый процесс, загрузку документа, обработку событий или внутреннюю подсистему приложения.

**Проблема:** чтение исходников не всегда быстро дает понимание реального runtime-поведения. Приходится добавлять временные логи, запускать сценарий много раз и постепенно восстанавливать картину происходящего.

**Решение:** `TreeViewReport` показывает вложенность вызовов как дерево, а `UsageReport` собирает статистику по классам, методам и свойствам. Разработчик сначала получает широкую картину, затем постепенно сужает наблюдение до целевого сценария.

```js
const { ReportTreeView, ReportUsage } = Tracer.reports;
const treeReport = new ReportTreeView();
const usageReport = new ReportUsage({ logProvider: console });

Tracer.traceCalls((event) => {
  if (event.place === "before") {
    treeReport.log(event, JSON.stringify(event.args || []));
    usageReport.log({
      className: event.className,
      fnKey: event.fnKey,
    });
  } else {
    treeReport.log(event);
  }
});

// Запустите проблемный сценарий приложения, затем посмотрите дерево и статистику.
console.log(treeReport.getResults().join("\n"));
usageReport.print();
```

`TreeViewReport` помогает увидеть вложенность вызовов, а `UsageReport` — список классов и методов, которые реально участвовали в сценарии. Это удобно для первого широкого прохода по незнакомому фоновому процессу, после которого наблюдение можно постепенно сужать.

## Когда не использовать

- Tracer обычно не нужен в production как постоянный инструмент наблюдения.
- Если команда хорошо ориентируется в кодовой базе и понимает ее поведение, Tracer, как правило, будет избыточен.
- Если достаточно обычных логов, тестов, debugger или существующей документации, лучше начать с них.

## Важные особенности текущей версии

- По умолчанию свойства **не оборачиваются автоматически** при `observe(...)`.
- Ручные вотчеры свойств (`observeProperty`, `observeAllProperties`, `observePropertyObject`) работают глобально.
- Сбор внутри слайса работает отдельно через `traceBySlice(...)` и отчеты `ReportSlice*`.
- Профиль по умолчанию: `balanced` (минимальная нагрузка, свойства не включены глобально).

## Быстрый старт

```js
const { Tracer } = require("./dist/tracer.cjs.js");

class OrderService {
  calculateTotal(items) {
    return items.reduce((sum, item) => sum + item.price, 0);
  }
}

Tracer.setTraceProfile("balanced");
Tracer.traceCalls((event) => {
  console.log(event.fullName, event.place);
});

const service = Tracer.observe(new OrderService(), "OrderService");
service.calculateTotal([{ price: 100 }, { price: 250 }]);
```

Подробные примеры под разные задачи находятся в разделе [Когда использовать](#когда-использовать).

### Подключение через webpack-сборку

Если нужно не оборачивать классы и методы вручную, можно подключить `packages/webpack-tracer-plugin`. Он добавляет трассирующий код во время сборки и по умолчанию подключает runtime `tracer` первым entry-скриптом, чтобы `globalThis.Tracer` был доступен для сгенерированных вставок.

```js
const path = require("node:path");
const { UniversalCodeInjectorPlugin } = require("webpack-tracer-plugin");

module.exports = {
  mode: "development",
  entry: "./src/index.js",
  output: {
    path: path.resolve(__dirname, "dist"),
    filename: "bundle.js",
  },
  plugins: [
    new UniversalCodeInjectorPlugin({
      enableCacheFilesystem: true,
      cacheDirectory: path.resolve(__dirname, ".webpack-cache"),
      injectLoaderOpts: {
        targets: ["UserService", "OrderService"],
        fallbackOnError: false,
        generateCode: {
          onConstructor: ({ className }) => {
            return `Tracer.observeProperty(this, "status", "${className}");`;
          },
        },
      },
    }),
  ],
};
```

В этом примере webpack-плагин найдет целевые классы и вставит в их конструкторы наблюдение за свойством `status`. Для больших проектов лучше указывать узкий список `targets`, чтобы не увеличивать время обхода AST.

## API

### События трассировки

Все подписки `trace*` получают объект `event`. Набор полей зависит от типа события, но базовые поля общие:

- `eventType` — тип события: `functionCall`, `propertyGet`, `propertySet`.
- `place` — момент события: `"before"` или `"after"` (для property-событий обычно `"before"`).
- `className` — имя класса/объекта, где произошло событие.
- `fullName` — полное имя цели, например `ClassName.method` или `ClassName.prop`.
- `tracerState` — `Map` с состоянием активных слайсов.
- `thisArg` — значение `this` для вызова функции или доступа к свойству.

### Поля call-событий (`functionCall`)

Для `traceCalls` / `traceAll` при `eventType: "functionCall"` доступны:

- `fnKey` — имя функции или метода.
- `targetFn` — исходная функция до оборачивания.
- `args` — аргументы вызова.
- `startedAt` — время начала вызова.
- `status` — статус в `after`: `"started"`, `"ok"`, `"error"` или `"rejected"` для Promise.
- `endedAt` — время завершения в `after`.
- `durationMs` — длительность вызова в `after`.
- `value` — результат выполнения в `after`, если вызов завершился успешно.
- `error` — ошибка в `after`, если вызов завершился `error` или `rejected`.
- `callStack` — логический стек Tracer для текущего события.
- `callId`, `parentCallId` — идентификаторы для связывания вызовов, если включен `captureContext`.

### Поля property-событий

Для `traceProperties` / `traceAll` при `eventType: "propertyGet"` или `eventType: "propertySet"` доступны:

- `propName` — имя свойства.
- `value` — текущее значение при `get` или новое значение при `set`.
- `curValue` — предыдущее значение при `propertySet`.
- `callStack` — логический стек Tracer на момент чтения или записи свойства.

Набор полей `event` может расширяться в зависимости от режима трассировки и профиля.

### Наблюдение функций и классов

- `Tracer.createProxyFn(fn, eventName)` — ручное оборачивание функции в `proxy`.
- `Tracer.observeConstructor(classCtor, className?)` — трассирование методов экземпляра класса.
- `Tracer.observe(target, targetName?)` — обходит объект/класс/прототип и оборачивает функции.
- `Tracer.observePrototype(classCtor, className?)` — трассирует методы класса (prototype).
- `Tracer.observeAll(listOrMap)` — трассирование списка объектов/классов.
- `Tracer.observePrototypeAll(listOrMap)` — трассирование массивов/мап прототипов.

### Наблюдение свойств

- `Tracer.observeProperty(target, propName, className?)` — наблюдение отдельного getter/setter-свойства.
- `Tracer.observeAllProperties(target, className?)` — обёртка всех свойств объекта/прототипа.
- `Tracer.observePropertyObject(target, propName, classNameOrOptions?, options?)` — гибридный shallow/Proxy режим для вложенных свойств.

`observePropertyObject` работает в двух режимах:
- безопасный `shallow` без `Proxy` (по умолчанию);
- `Proxy` только когда это явно разрешено (`useProxy: true` или `shouldUseProxy`) и только для подходящих `plain-object`.

### Подписки на события трассировки

- `Tracer.traceAll(callback)` — все события (`functionCall`, `propertyGet`, `propertySet`).
- `Tracer.traceCalls(callback)` — только `functionCall`.
- `Tracer.traceProperties(callback)` — только `propertyGet`/`propertySet`.
- `Tracer.traceProperty(propSelector, callback)` — фильтр по одному свойству.
- `Tracer.traceAllBatched(callback, options)` — батч для всех событий.
- `Tracer.traceCallsBatched(callback, options)` — батч только по вызовам.
- `Tracer.tracePropertiesBatched(callback, options)` — батч по свойствам.
- `Tracer.untraceAll()` — снять все общие подписки.
- `Tracer.untraceCalls()` — снять только call-подписки.
- `Tracer.untraceProperties()` — снять только property-подписки.

Опции batch-подписок:

```js
{
  maxBatchSize: 100,
  flushIntervalMs: 16,
  bufferSize: 2000
}
```

### Конфиг трассировки

- `Tracer.setTraceProfile(profileName, overrides?)`
- `Tracer.configureTracing(options)`
- `Tracer.getTraceConfig()`
- `Tracer.configure(options?)`
- `Tracer.isX2tEnvironment()`

### Слайсы (сегменты в стеке вызовов)

- `Tracer.defineSlice(sliceName, config)`  
  (`predicate`, `beforeCall`, `afterCall`, `initial`, `description`).
- `Tracer.enableSlice(sliceName)`
- `Tracer.disableSlice(sliceName)`
- `Tracer.traceBySlice(sliceName, callback)`
- `Tracer.traceBySliceOnce(sliceName, callback)`
- `Tracer.traceBySliceSequence(sliceSeq, callback)`
- `Tracer.untraceBySlice(sliceName, callback?)`
- `Tracer.defineSliceByCall(sliceName, target, targetFnName, predicate)`
- `Tracer.defineSliceByFunction(sliceName, fn)`
- `Tracer.defineSliceByFunctionName(sliceName, fnName)`
- `Tracer.exportSliceScenarios(payload, options?)`
- `Tracer.importSliceScenarios(payload, options?)`
- `Tracer.getEnabledSlices()`
- `Tracer.getRegisteredSlices()`
- `Tracer.getCurrentContext()`
- `Tracer.invokeOnSlice(sliceName, fn)`
- `Tracer.logSlice(sliceSelector, ...values)`

### Отладочные утилиты

- `Tracer.traceBySlice` + `Tracer.traceCalls` + `Tracer.traceAll` — единый паттерн подписок и анализа.
- `Tracer.tracerState` — Map состояния слайсов/состояний для фильтров и отладки.
- `Tracer.reports` — доступ ко всем отчетам (`ReportSimple`, `ReportUsage`, `ReportTreeView`, `ReportSliceDiff`, `ReportSliceUsage`).

## Профили и фильтры

```js
Tracer.setTraceProfile("minimal"); // minimal | balanced | full

Tracer.configureTracing({
  noisyCalls: ["CEditorPage.onTimerScroll"],
  noisyProperties: ["CEditorPage.temp"],
  callFilter: ({ fullName }) => !fullName.includes("debug"),
  propertyFilter: ({ fullName }) => fullName.includes("zoom"),
});
```

## Отчеты

`Tracer.reports` содержит:

- `ReportSimple`
- `ReportUsage`
- `ReportTreeView`
- `ReportSliceDiff`
- `ReportSliceUsage`

`ReportSliceUsage` собирает классы/методы/property get/set только внутри активного слайса и умеет строить diff между прогонами.

## Документация

Полная документация собирается в `docs/`:

```bash
npm run docs:build
```

Проверка примеров из документации:

```bash
npm run test:docs-examples
```
