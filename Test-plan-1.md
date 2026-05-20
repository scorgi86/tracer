# Test-plan-1

## Цель

Проверить корректность трассировки вызовов/свойств, жизненный цикл слайсов, профили производительности и устойчивость интеграции с редакторным кодом.

## Основные проверки

1. События вызовов функций
- `createProxyFn` генерирует `beforeCallMethod` и `afterCallMethod`.
- payload содержит `eventType`, `place`, `fnKey`, `className`, `fullName`.

2. События свойств через descriptor
- `observeProperty` генерирует `propertyGet/propertySet`.
- payload содержит `propName`, `className`, ожидаемые `value/curValue`.

3. Гибридный режим наблюдения объекта свойства
- `observePropertyObject` по умолчанию работает без `Proxy`.
- `Proxy` включается только явно (`useProxy: true`) и в допустимых кейсах.

4. Отсутствие авто-оборачивания свойств
- `observe(...)` не оборачивает свойства объектов автоматически.
- функции/методы продолжают трассироваться.

5. Глобальность ручных вотчеров свойств
- вручную подписанные свойства видны через `traceProperties` и `traceAll` глобально.

6. Поведение профилей
- `minimal/balanced/full` ведут себя по контракту.
- подавление noisy-вызовов работает в `minimal/balanced`.

7. Ручные property-подписки в non-full профилях
- `traceProperties` получает события ручных вотчеров в `minimal/balanced`.

8. Жизненный цикл слайсов
- `defineSlice` корректно включает/выключает слайс.
- `traceBySlice` и `traceBySliceOnce` работают только в активном слайсе.

9. Последовательности слайсов
- `traceBySliceSequence` срабатывает только при активности всех целевых слайсов.

10. Переносимость сценариев
- `exportSliceScenarios/importSliceScenarios` сохраняют поведение слайсов.

11. Batch-подписки
- `traceAllBatched/traceCallsBatched/tracePropertiesBatched` корректно флешат пачки.
- `untrace*` чистит regular и batched подписки.

12. Отчеты по слайсам
- `ReportSliceDiff` строит diff между вызовами.
- `ReportSliceUsage` собирает usage только внутри слайса и дает diff между прогонами.

13. Интеграционные регрессии
- проверки против:
- `Illegal invocation`
- `Receiver must be an instance ...`
- `... is not a function`

14. Изоляция тестов
- каждый тест очищает подписки, состояние профилей и состояние слайсов.
