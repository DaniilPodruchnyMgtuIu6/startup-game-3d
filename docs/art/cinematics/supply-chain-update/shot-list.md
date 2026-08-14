# Shot list — supply-chain-update

Реализация: `src/game/story/cyberStoryInteraction.ts::runCyberStoryConversation` (pre-choice); `src/game/story/cyberStoryInteraction.ts::runCyberConsequenceScene` (delayed consequence — на данный момент без отдельной видео-вставки, только диалог).

| # | Тип | Источник | Триггер | Длительность |
|---|---|---|---|---|
| 1 | two-shot (игрок ↔ Кирилл) | `beginConversationCinematic({pairA, pairB})` | начало сцены | ~1100 мс |
| 2 | insert pre-choice (генерируемый клип ИЛИ fallback) | Higgsfield-вставка ИЛИ `playInsert(SCREEN_INSERT_POINT)` | сразу после (1) | 5–9 сек (клип) / 1300 мс (fallback) |
| 3 | medium/OTS чередование по реплике | автоматически (`aimAtLine`) | на каждую строку | 850 мс/реплика |
| 4 | held frame на выборе | камера держит кадр | во время `activeChoice` | до выбора |
| 5 | reaction OTS | продолжение (3) | после выбора | 850 мс |
| 6 | (опционально, delayed) отдельная вставка «неизвестное соединение» | планируется отдельным Higgsfield-клипом — не реализован в этой итерации, consequence-сцена сейчас работает только через диалог (`buildCyberConsequenceScript('supply-chain-unknown-connection')`) | due-day последствия | — |

Fallback: шаг 2 использует тот же `SCREEN_INSERT_POINT`, что и executive-phishing-request/shadow-it-log-upload — единый визуальный язык «монитор разработчика» для всех трёх сцен.
