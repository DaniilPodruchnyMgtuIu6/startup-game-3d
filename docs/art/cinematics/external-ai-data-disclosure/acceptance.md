# Acceptance — external-ai-data-disclosure

| Критерий | Статус |
|---|---|
| Сцена интересна как сюжет, объясняет security через рабочую ситуацию | ✅ (диалог/выборы см. `cyberStoryDialogues.ts::externalAiScene`) |
| 2–3 разумных варианта, нет одной бесплатной очевидно правильной кнопки | ✅ (unrestricted/ban/controlled-gateway; ban стоит время команды, controlled-gateway стоит деньги+время) |
| Неограниченный доступ даёт ОГРАНИЧЕННОЕ ускорение и повышает риск | ✅ (`applyStoryEffortReduction` разово, не бесконечно; sensitive-data/governance риск растёт) |
| Полный запрет создаёт мягкий "shadow use" beat, не катастрофу | ✅ (`shadow-ai-personal-use` — без расхода и риск-сигнала, намеренно) |
| Контролируемый gateway сохраняет частичную пользу через маскирование/allowlist | ✅ (`configure-controlled-ai-gateway`) |
| Не утверждает, что внешняя модель точно обучилась на данных команды | ✅ (реплики "не можем точно сказать" / "не знаем точно", покрыто тестом) |
| Не использует реальные названия AI-сервисов | ✅ (только "ИИ-помощник", покрыто тестом на отсутствие брендов) |
| Fallback без Higgsfield работает | ✅ проверено vitest + живой браузер |
| Не физическое проникновение, не дублирует office-intrusion и другие сцены Feature 19 | ✅ |
| Generated video asset | ✅ сгенерирован (nano_banana_2 → kling3_0_turbo) и проверен живым браузером — `public/cutscenes/external-ai-data-disclosure-insert.mp4`, без реального AI-бренда в кадре |
| Character identity/scale unchanged | ✅ (insert — только реквизит/экран, без персонажей) |

**Итог: approved (video integrated + fallback verified).**
