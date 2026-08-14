# Shot list — external-ai-data-disclosure

Реализация: `src/game/story/cyberStoryInteraction.ts::runCyberStoryConversation` (та же генерическая реализация, что и у остальных пяти инцидентов).

| # | Тип | Источник | Триггер | Длительность |
|---|---|---|---|---|
| 1 | two-shot (игрок ↔ Алина) | `beginConversationCinematic({pairA, pairB})` | начало сцены, ожидание `cinematic.ready` | ~1100 мс |
| 2 | insert (генерируемый клип ИЛИ fallback) | Higgsfield-вставка ИЛИ `playInsert(SCREEN_INSERT_POINT)` | сразу после (1) | 4–8 сек (клип) / 1300 мс (fallback) |
| 3 | medium/OTS чередование по реплике | `beginConversationCinematic`'s `aimAtLine` (автоматически) | на каждую строку диалога | 850 мс/реплика |
| 4 | held frame на выборе | камера держит последний кадр | во время `activeChoice` | до выбора игрока |
| 5 | reaction OTS | продолжение (3) на реплике-реакции | после выбора | 850 мс |

Fallback без Higgsfield: шаг 2 заменяется на `playInsert` того же экрана рабочей станции (`[-1.9, 0.75, 4.75]`), уже используемого всеми Feature 19 сценами.

Это первая cyber-story сцена, которую **ведёт Алина** (а не Кирилл/Соня) — `getSceneLeadCharacterId('external-ai-data-disclosure')` уже возвращает её character id, никаких изменений camera-примитивов не потребовалось.
