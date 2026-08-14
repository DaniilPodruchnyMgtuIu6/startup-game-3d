# Acceptance — secret-committed-to-repository

| Критерий | Статус |
|---|---|
| Сцена интересна как сюжет, объясняет security через рабочую ситуацию | ✅ (диалог/выборы см. `cyberStoryDialogues.ts::secretScene`) |
| 2–3 разумных варианта, нет одной бесплатной очевидно правильной кнопки | ✅ (remove/rewrite/rotate; remove бесплатен но не решает проблему, rewrite стоит 2 рабочих дня, rotate стоит деньги+время) |
| Удаление ≠ переписывание истории ≠ ротация (три разных состояния, не boolean) | ✅ (`CredentialExposureState`: `history-retained` / `reduced` / `rotated`, `cyberStoryHandlers.ts::resolveSecretChoice`) |
| Риск choice сохраняет скорость, но создаёт отложенное последствие с реальным credential | ✅ (`external-credential-usage` / `credential-found-in-ci-cache`, `cyberStoryConsequences.ts`) |
| Безопасный choice реально отзывает ключ, переносит в защищённое хранилище, добавляет secret scanning | ✅ (`rotate-and-secure-secret`, стоит деньги+время) |
| Fallback без Higgsfield работает | ✅ проверено vitest + живой браузер |
| Не физическое проникновение, не дублирует office-intrusion и другие сцены Feature 19 | ✅ |
| Generated video asset | ✅ сгенерирован (nano_banana_2 → kling3_0_turbo) и проверен живым браузером — `public/cutscenes/secret-committed-to-repository-insert.mp4` |
| Character identity/scale unchanged | ✅ (insert — только реквизит/экран, без персонажей) |

**Итог: approved (video integrated + fallback verified).**
