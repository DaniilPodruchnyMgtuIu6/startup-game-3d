# Shot list — shadow-it-log-upload

Реализация: `src/game/story/cyberStoryInteraction.ts::runCyberStoryConversation`.

| # | Тип | Источник | Триггер | Длительность |
|---|---|---|---|---|
| 1 | two-shot (игрок ↔ Кирилл) | `beginConversationCinematic({pairA, pairB})` | начало сцены | ~1100 мс |
| 2 | insert pre-choice (генерируемый клип ИЛИ fallback) | Higgsfield-вставка ИЛИ `playInsert(SCREEN_INSERT_POINT)` | сразу после (1) | 4–8 сек (клип) / 1300 мс (fallback) |
| 3 | medium/OTS чередование по реплике | автоматически (`aimAtLine`) | на каждую строку | 850 мс/реплика |
| 4 | held frame на выборе | камера держит кадр | во время `activeChoice` | до выбора |
| 5 | reaction OTS | продолжение (3) | после выбора | 850 мс |
| 6 | (опционально, delayed) вставка «ночное скачивание» | планируется отдельным Higgsfield-клипом — не реализован в этой итерации | due-day последствия (`shadow-it-external-download`) | — |

Единый `SCREEN_INSERT_POINT` со всеми тремя сценами — согласованный визуальный язык.
