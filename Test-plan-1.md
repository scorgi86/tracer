# Тест-план-1

1. Базовые события вызовов функций  
Проверить `createProxyFn` и `trace`: генерируются `beforeCallMethod`/`afterCallMethod`, корректны `eventType`, `place`, `fnKey`, `className`, `fullName`, `args`, `value`.

2. Трассировка свойств (descriptor)  
Проверить `observeProperty`: чтение дает `propertyGet`, запись дает `propertySet`, события содержат `propName`, `className`, текущий/новый value.

3. Трассировка свойств (proxy) и вложенность  
Проверить `wrapValueWithProxy` и `observe`: доступ к `obj.a.b` и запись в глубину генерируют события с корректным `propPath`; вложенные объекты оборачиваются автоматически.

4. `observePropertyAll` и покрытие "всех наблюдаемых"  
Проверить, что все нефункциональные поля наблюдаемы; функции не попадают в property-trace.

5. `observeAll` и `observePrototypeAll`  
Отдельно проверить входы как массив и как объект-словарь; убедиться, что методы реально оборачиваются и вызывают события.

6. Слайсы "От/До" (`defineSlice`)  
Проверить сценарий start/stop: `beforeCall => true`, `afterCall => false`; `traceSlice` получает события только при активном слайсе.

7. Последовательности слайсов (`traceSliceSeq`)  
Проверить, что callback вызывается только когда все слайсы из последовательности активны одновременно.

8. Слайсы из функции/вызова и async  
Проверить `defineSliceFromFn` и `defineSliceFromCall` для sync/async/throw: состояние слайса корректно сбрасывается в `finally` и не "залипает".

9. API подписок по типу событий  
Проверить `traceCalls`, `traceProperties`, `traceCallsClear`, `tracePropertiesClear`: подписки точечно работают и корректно снимаются.

10. Импорт/экспорт сценариев  
Проверить `exportScenarios`/`importScenarios`: структура payload, восстановление конфигов, поведение `overwrite`/`activate`, корректный список `getRegistredSlices`.

11. Негативные кейсы и валидация  
Проверить ошибки на пустые аргументы (`trace`, `traceSlice`, `defineSliceOnCall`, `importScenarios` с невалидным payload).

12. Изоляция и очистка состояния между тестами  
В `beforeEach/afterEach` сбрасывать подписки (`traceClear`, `stopTraceSlice`, `stopObserveSlice`) и состояние `tracerState`, чтобы тесты не влияли друг на друга.
