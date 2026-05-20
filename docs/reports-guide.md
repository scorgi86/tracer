# Tracer: Отчеты

Для базовой аналитики используйте отчеты из `Tracer.reports`.

## Частые варианты

- `ReportSimple` - простой список событий.
- `ReportUsage` - статистика вызовов методов.
- `ReportTreeView` - дерево вызовов.
- `ReportSliceDiff` - сравнение сценариев.

## Пример `ReportUsage`

```javascript
const usageReport = new ReportUsage({ logProvider: console });

Tracer.traceCalls((event) => {
  if (event.type === 'beforeCallMethod') {
    const [className, fnKey] = event.fullName.split('.');
    usageReport.log({ className, fnKey });
  }
});

// ... выполняем сценарий ...
usageReport.print();
```

- [Полная документация](./index.md)
