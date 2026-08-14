# Implementation notes — supply-chain-update

- Insert clip path: `public/cutscenes/supply-chain-update-insert.mp4` — **сгенерирован и интегрирован**. Кейфрейм 9c865f14-6862-4376-8f74-3ac6700a9e68 (nano_banana_2) → видео c593b969-7b6f-4318-89ed-0006d15e919c (kling3_0_turbo), детали в `assets/source/prompts/story-clips-cyber-incidents-19.md`.
- Fallback (`playInsert`) остаётся функциональным на случай недоступности файла/кодека.
- Проверено живым браузером: `<video>` монтируется с правильным `src`.
- Delayed-consequence сцена (`supply-chain-unknown-connection`) теперь тоже имеет сгенерированный insert: `public/cutscenes/supply-chain-update-consequence-insert.mp4` — кейфрейм 55593b1f-5224-434b-8ec0-fbac4441a46e → видео 52ab4486-25ff-46e1-a881-1c8a4745e78c, детали в `assets/source/prompts/story-clips-cyber-incidents-19b-consequences.md`. Проигрывается через новую (Feature 19B) карту `CONSEQUENCE_INSERT_CLIP` в `cyberStoryInteraction.ts::runCyberConsequenceScene` — при отсутствии файла сцена остаётся dialogue-only, как и раньше (тот же паттерн, что у Feature 17C-сцен без insert). Проверено живым браузером через `window.__startupGameDev.scenes.playConsequenceNow('supply-chain-unknown-connection')`.
- Camera/covering: тот же `beginConversationCinematic` примитив, что у всех decision-сцен.
