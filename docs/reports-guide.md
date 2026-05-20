# Tracer: Отчеты

Этот гайд показывает, как перейти от "сырых" событий к понятным выводам.

## 1. Какие отчеты использовать

- `ReportSimple` - быстрый плоский список событий.
- `ReportUsage` - статистика по классам/методам.
- `ReportTreeView` - дерево последовательности вызовов.
- `ReportSliceDiff` - сравнение двух прогонов сценария.

## 2. Базовый `ReportUsage`

```javascript
const usageReport = new ReportUsage({ logProvider: console });

const stop = Tracer.traceCalls((event) => {
  if (event.type === 'beforeCallMethod') {
    const [className, fnKey] = event.fullName.split('.');
    usageReport.log({ className, fnKey });
  }
});

// ... запускаем сценарий ...
// await runCheckout();

stop?.();
usageReport.print();
```

Что смотреть в выводе:
- какие методы вызваны чаще всего;
- какие классы участвуют в сценарии неожиданно;
- есть ли лишние/дублирующиеся вызовы.

## 3. `ReportTreeView` для порядка вызовов

```javascript
const treeReport = new ReportTreeView({ logProvider: console });

Tracer.traceCalls((event) => {
  treeReport.log(event);
});

// ... сценарий ...

treeReport.print();
```

Используйте, когда надо понять "почему вызов пошел сюда".

## 4. `ReportSliceDiff` для регрессий

Идея: сравнить baseline и текущий прогон одного и того же сценария.

```javascript
const diffReport = new ReportSliceDiff({ logProvider: console });

// baseline
// ... run scenario A ...
// diffReport.capture('baseline');

// current
// ... run scenario B ...
// diffReport.capture('current');

// diffReport.print('baseline', 'current');
```

Сравнивайте только одинаковые входные данные, иначе получите шумные отличия.

## 5. Практический pipeline

1. `traceCalls` + `ReportSimple` для первичного сигнала.
2. `ReportUsage` для hot-методов.
3. `ReportTreeView` для порядка.
4. `ReportSliceDiff` для подтверждения регрессии.

## 6. Частые ошибки

- Смешивание нескольких сценариев в один прогон.
- Отсутствие фиксации baseline.
- Слишком широкая область трассировки без фильтров.

## 7. Мини-чеклист перед выводами

- [ ] Одинаковые входные данные
- [ ] Одинаковая конфигурация профиля
- [ ] Шум отфильтрован
- [ ] Результат воспроизводится минимум 2 раза

- [Полная документация](./index.md)
