# Implementation notes — executive-phishing-request

- Insert clip path: `public/cutscenes/executive-phishing-request-insert.mp4` — **сгенерирован и интегрирован**. Кейфрейм 7b1ece88-9dfd-416c-bf7d-0d9f9e1536d2 (nano_banana_2) → видео e93c0f0f-9968-4c1a-9851-e708146da172 (kling3_0_turbo), детали в `assets/source/prompts/story-clips-cyber-incidents-19.md`.
- Fallback (`playInsert`) остаётся полностью функциональным и покрыт тестами (`cyberStoryInteraction.test.ts`, mock `playVideoCutscene`) — используется при недоступности файла/кодека.
- Проверено живым браузером: `<video>` монтируется с правильным `src`, диалог не пропускается, сцена корректно возвращается в 3D после клипа.
- Камера/covering: переиспользован `beginConversationCinematic({pairA: PLAYER_ID, pairB: characterId})` — тот же примитив, что и у всех Feature 17B decision-сцен, никаких новых camera-примитивов не создано.
- Найденный и исправленный по ходу баг: `playInsert`/`playShot` в `cinematicDirector.ts` ожидали `flyTo()` без таймаута — единственные awaited camera-moves без `withReadyTimeout` во всей системе. Исправлено для всех вызывающих сцен (не только Feature 19), см. `docs/qa/19-cyber-story-test-matrix.md`.
- Известное косметическое ограничение: к последнему кадру ролика надпись «Срочно» слегка теряет чёткость (типичный дрейф текста у video-моделей) — красная подсветка тревожного письма остаётся читаемой.
