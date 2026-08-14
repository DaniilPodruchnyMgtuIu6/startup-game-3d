# Shot list — executive-phishing-request

Реализация: `src/game/story/cyberStoryInteraction.ts::runCyberStoryConversation`.

| # | Тип | Источник | Триггер | Длительность |
|---|---|---|---|---|
| 1 | two-shot (игрок ↔ Соня) | `beginConversationCinematic({pairA, pairB})` | начало сцены, ожидание `cinematic.ready` | ~1100 мс |
| 2 | insert (генерируемый клип ИЛИ fallback) | Higgsfield-вставка ИЛИ `playInsert(SCREEN_INSERT_POINT)` | сразу после (1) | 4–8 сек (клип) / 1300 мс (fallback) |
| 3 | medium/OTS чередование по реплике | `beginConversationCinematic`'s `aimAtLine` (автоматически) | на каждую строку диалога | 850 мс/реплика |
| 4 | held frame на выборе | камера держит последний кадр | во время `activeChoice` | до выбора игрока |
| 5 | reaction OTS | продолжение (3) на реплике-реакции | после выбора | 850 мс |

Fallback без Higgsfield: шаг 2 заменяется на `playInsert` того же экрана рабочей станции (`[-1.9, 0.75, 4.75]`), уже используемого Feature 17B decision-сценами — визуально согласован со стилем существующих inserts.
