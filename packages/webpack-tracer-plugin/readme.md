# webpack-tracer-plugin

Плагин для Webpack, который автоматически добавляет трассирующий код в целевые классы/функции во время сборки.

Основной сценарий: добавить `Tracer.observeProperty(...)` (или любой другой код) в конструкторы выбранных классов без ручного редактирования исходников.

Важно: плагин теперь явно подключает пакет `tracer` автоматически и делает это первым entry-скриптом (`ENTRY_ORDER.First`), чтобы `globalThis.Tracer` был доступен до остальных инъекций.

## Как подключить

1. Установите зависимости:

```bash
npm i -D webpack webpack-cli
npm i webpack-tracer-plugin
```

2. Подключите плагин в `webpack.config.js`:

```js
const path = require('node:path');
const { UniversalCodeInjectorPlugin } = require('webpack-tracer-plugin');

module.exports = {
  mode: 'development',
  entry: './src/index.js',
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: 'bundle.js'
  },
  plugins: [
    new UniversalCodeInjectorPlugin({
      // включает webpack cache: { type: 'filesystem' } по умолчанию
      enableCacheFilesystem: true,
      cacheDirectory: path.resolve(__dirname, '.webpack-cache'),

      injectLoaderOpts: {
        targets: ['UserService', 'OrderService'],
        fallbackOnError: false,
        debug: false,
        generateCode: {
          construct: ({ className }) => {
            return `Tracer.observeProperty(this, 'id', '${className}');`;
          }
        }
      }
    })
  ]
};
```

## Как использовать на примерах

### Пример 1. Вставка `Tracer.observeProperty` в выбранные классы

```js
new UniversalCodeInjectorPlugin({
  // по умолчанию true: подключает tracer первым скриптом
  injectTracerRuntimeFirst: true,
  injectLoaderOpts: {
    targets: ['UserService', 'PaymentService'],
    generateCode: {
      construct: ({ className }) => {
        return [
          `Tracer.observeProperty(this, 'state', '${className}');`,
          `Tracer.observeProperty(this, 'status', '${className}');`
        ].join('\n');
      }
    }
  }
});
```

Если в проекте нужен полностью ручной контроль подключения runtime, можно отключить авто-инъекцию:

```js
new UniversalCodeInjectorPlugin({
  injectTracerRuntimeFirst: false,
  injectLoaderOpts: { ... }
});
```

### `generateCode` и доступные хуки

В `injectLoaderOpts.generateCode` можно передать до пяти хуков. Каждый хук получает объект с параметрами и может вернуть строку, которая будет вставлена в итоговый код.

```js
new UniversalCodeInjectorPlugin({
  injectLoaderOpts: {
    generateCode: {
      construct: ({ className, hasInstanceMethodsOnThis }) => `Tracer.observeProperty(this, 'id', '${className}');`,
      afterClass: ({ className }) => `globalThis.__afterClass('${className}');`,
      afterPrototypeMethod: ({ className, methodName }) => `globalThis.__afterPrototype('${className}', '${methodName}');`,
      afterAll: ({ filePath, moduleSymbols, hasIIFE }) =>
        `globalThis.__afterAll('${filePath}', ${hasIIFE}, ${JSON.stringify(moduleSymbols.classes)});`,
      beforeEndIIFE: ({ filePath, moduleSymbols, hasIIFE }) =>
        `globalThis.__beforeEndIIFE('${filePath}', ${hasIIFE}, ${JSON.stringify(moduleSymbols.functions)});`
    }
  }
});
```

Таблица параметров и места вставки:

| Хук | Параметры | Куда вставляется код |
| --- | --- | --- |
| `construct` | `className`<br/>`hasInstanceMethodsOnThis` | В тело конструктора целевого класса или в тело целевой функции. Если класс без конструктора, создаётся конструктор и туда вставляется код. Для классов вставка идёт в начало/конец конструктора по `insertPosition` (`start`/`end`). |
| `afterClass` | `className` | Как отдельное statement в контейнере AST сразу после `ClassDeclaration` целевого класса. |
| `afterPrototypeMethod` | `className`, `methodName` | После последнего найденного присваивания прототипного метода целевого класса (`C.prototype.m = ...`, скобочные и object-style варианты), в тот же контейнер после этой инструкции. |
| `afterAll` | `filePath`, `moduleSymbols`, `hasIIFE` | В модульный уровень: добавляется в конец `ast.body`, когда top-level IIFE отсутствует. `moduleSymbols` содержит списки найденных в модуле символов верхнего уровня (`constructors`, `classes`, `functions`), `hasIIFE = false`. |
| `beforeEndIIFE` | `filePath`, `moduleSymbols`, `hasIIFE` | В тело top-level IIFE, перед его закрытием (`findBeforeEndIndex`). `moduleSymbols` собираются из верхнего уровня этой IIFE, `hasIIFE = true`. |

Примечание по `construct`: параметр `hasInstanceMethodsOnThis` равен `true`, если в верхнем уровне конструктора/функции есть присваивание вида `this.<prop> = ...`.

Краткое итоговое правило:

- `afterAll` выполняется в конце JS-модуля (вставка в конец `ast.body`) и только когда top-level IIFE отсутствует.
- `beforeEndIIFE` выполняется только при наличии top-level IIFE и вставляется в конец IIFE перед `})();` (в таком файле `afterAll` для того же вызова не добавляется).
- `afterPrototypeMethod` выполняется после последнего найденного определения метода на прототипе целевого класса.
- `afterClass` выполняется для каждого ES6 `class`-объявления целевого класса.

## Формат `moduleSymbols`

`moduleSymbols` — это объект со списками имён, найденных на верхнем уровне анализируемого блока:

```js
{
  constructors: string[],
  classes: string[],
  functions: string[],
}
```

Как формируется:

- Для `afterAll` (`hasIIFE: false`) список собирается по `ast.body` модуля.
- Для `beforeEndIIFE` (`hasIIFE: true`) список собирается по телу top-level IIFE.

Что туда попадает:

- `constructors`: имена классов и/или функций, которые рассматриваются как конструкторы целевых сущностей.
- `classes`: имена `class`-объявлений на верхнем уровне блока.
- `functions`: имена function-объявлений на верхнем уровне блока.

Важно: это только верхний уровень анализируемого контейнера (без глубокого сканирования вложенных блоков и вложенных функций).

### Пример 2. Подключение runtime-файла трассера в бандл

```js
const path = require('node:path');
const { ENTRY_ORDER } = require('webpack-inject-plugin');

new UniversalCodeInjectorPlugin({
  injectLoaderOpts: {
    targets: ['UserService'],
    generateCode: {
      construct: ({ className }) => `Tracer.observeProperty(this, 'id', '${className}');`
    }
  },
  listInjectPluginOptions: [
    {
      options: {
        entryName: (name) => name === 'main',
        entryOrder: ENTRY_ORDER.First
      },
      files: [path.resolve(__dirname, './src/tracer-runtime.js')]
    }
  ]
});
```

## Описание принципа через пример

Исходный код:

```js
class UserService {
  constructor() {
    this.id = 10;
  }
}
```

`generateCode.construct`:

```js
({ className }) => `Tracer.observeProperty(this, 'id', '${className}');`
```

Результат после трансформации:

```js
class UserService {
  constructor() {
    Tracer.observeProperty(this, 'id', 'UserService');
    this.id = 10;
  }
}
```

## Схема с принципом работы плагина

```mermaid
flowchart TD
  A[Webpack compilation starts] --> B[UniversalCodeInjectorPlugin.apply]
  B --> C[Inject SWCInjectLoaderWebpack into module.rules]
  B --> D[Optional inject runtime files via webpack-inject-plugin]
  C --> E[Loader reads options and reuses cached SWCInjectLoader instance]
  E --> F{target name found in source?}
  F -->|No| G[Return source as is]
  F -->|Yes| H[Parse AST with SWC]
  H --> I[Find target classes and functions]
  I --> J[Insert statements from generateCode.construct]
  J --> K[Generate transformed code]
  K --> L[Store in in-memory cache by file content + options]
  L --> M[Return transformed module]
```

## Описание крайних случаев

- `targets` пустой или не задан: модуль возвращается без изменений.
- `generateCode`-хук вернул пустую строку/`undefined`: инъекция для конкретного вхождения не выполняется.
- Класс/функция не найден(а) в файле: файл проходит без изменений.
- Ошибка AST-трансформации: включается fallback на строковую трансформацию.
- Ошибка в loader:
  - `fallbackOnError: false` (по умолчанию): сборка падает с ошибкой.
  - `fallbackOnError: true`: возвращается исходный `source`, сборка продолжается.
- Плагин добавляет правило только для `/\.js$/` (не `ts/tsx` на уровне webpack rule в текущей реализации).
- Автокэш webpack filesystem включается только если в конфиге уже не задан `options.cache`.
- В большом проекте лучше указывать узкий список `targets`, иначе увеличится время обхода AST.

## Рекомендации по производительности

- Держите `targets` как можно уже.
- Оставляйте `enableCacheFilesystem: true` для dev-сборок.
- Не генерируйте очень длинные строки в `construct`.
- Используйте `listInjectPluginOptions` только для реально нужных runtime-файлов.

## Экспорт из пакета

```js
const {
  TracerCodeGenerator,
  UniversalCodeInjectorPlugin,
  SWCInjectLoader
} = require('webpack-tracer-plugin');
```
