---
title: "Tracer Docs"
layout: default
---

# Tracer Docs

Центральная навигация по документации проекта.

## Source Of Truth

- Каноничный документ по API и поведению: [docs/index.md](./index.md)
- Если есть расхождения между гайдами, приоритет у `index.md`.
- Единая собранная версия всей документации: [all-docs.md](./all-docs.md)

## Быстрый маршрут по задачам

| Задача | Куда идти |
|---|---|
| Быстро включить трассировку в проекте | [Быстрый старт](./getting-started.md) |
| Объяснить инструмент широкой аудитории | [Tracer для широкой аудитории](./legacy-onboarding.md) |
| Разобраться в полном API и профилях | [Полная документация](./index.md) |
| Нужны сигнатуры и параметры методов | [API Reference](./api-reference.md) |
| Legacy-отладка по сценариям | [Гайд разработчика](./tracer-dev-guide.md) |
| AI-автоматизация анализа | [Tracer + AI гайд](./tracer-ai-guide.md) |
| Слайсы и отрезки стека | [Слайсы](./slices.md) |
| Асинхронный контекст | [Асинхронность](./async.md) |
| Отчеты и статистика | [Отчеты](./reports-guide.md) |

## Основное

- [Единая документация](./all-docs.md)
- [Полная документация](./index.md)
- [API Reference](./api-reference.md)
- [Быстрый старт](./getting-started.md)
- [Tracer для широкой аудитории](./legacy-onboarding.md)
- [Полный гайд разработчика](./tracer-dev-guide.md)
- [Гайд по AI](./tracer-ai-guide.md)
- [Слайсы](./slices.md)
- [Асинхронность](./async.md)
- [Отчеты](./reports-guide.md)

## Дополнительные материалы

- [Контекст архитектуры](./context.md)
- [Исторические заметки по отчетам](./reports.md)
- [Тест-план](../Test-plan-1.md)

## Проверяемые примеры

- Документационные примеры: [__tests__/docs-examples.test.js](../__tests__/docs-examples.test.js)
- Критические регрессии поведения: [__tests__/tracer-regression-critical.test.js](../__tests__/tracer-regression-critical.test.js)

