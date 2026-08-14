# story-clips-cyber-incidents-19b-consequences (delayed-consequence вставки для Feature 19A)

Запрос игрока: сгенерировать реальные видео-вставки для отложенных последствий,
для которых уже были подготовлены (но не выполнены) промпты в
`docs/art/cinematics/{supply-chain-update,shadow-it-log-upload}/higgsfield-prompts.md`.

- Tool/model: Higgsfield MCP / nano_banana_2 (кейфреймы, реально отработал как
  `nano_banana_flash`) + kling3_0_turbo (image-to-video)
- Date, session: 2026-08-01
- Cost: 2 кейфрейма + 2 видео (5с, 720p, 16:9)
- Оба клипа — только реквизит/экран, без персонажей (тот же приём, что и у
  соответствующих pre-choice вставок и у `security-breach-unlocked-monitor`/
  `server-gateway-outage`/`mvp-release-launch`/`data-loss-aftermath`).

## 1. supply-chain-unknown-connection (delayed consequence, supply-chain-update)

- Jobs: кейфрейм 55593b1f-5224-434b-8ec0-fbac4441a46e, видео 52ab4486-25ff-46e1-a881-1c8a4745e78c
- Style: холодный вечерний синий свет — прямое продолжение pre-choice
  вставки той же сцены (тот же тёмный монитор разработчика).
- Preset note: первая попытка предложила preset «IN THE DARK» — отклонена
  (`declined_preset_id`), т.к. тёмная сцена и так буквально соответствует
  сценарию (в отличие от shadow-it-log-upload, где preset менял бы дневную
  сцену на ночную нежелательно).
- Сюжет: тот же тёмный монитор, что и в pre-choice вставке, но теперь с
  янтарным индикатором исходящего соединения, которое разработчик не
  инициировал, и терминалом, продолжающим прокручивать незнакомые строки
  лога. Камера медленно наезжает, индикатор пульсирует. Никого в кадре.
- Использование: `cyberStoryInteraction.ts` — новая карта
  `CONSEQUENCE_INSERT_CLIP['supply-chain-unknown-connection']`, проигрывается
  перед диалогом последствия; при недоступности файла — сцена остаётся
  dialogue-only (как и было в Feature 19A до этой генерации, без отдельного
  fallback prop-shot для последствий).

## 2. shadow-it-external-download (delayed consequence, shadow-it-log-upload)

- Jobs: кейфрейм 62af54c8-d482-4e3c-a267-6f3c3b651291, видео 1c5ebd02-ebf4-4e3a-9c7b-7bee7b64c09e
- Style: тёплый дневной свет — прямое продолжение pre-choice вставки той же
  сцены.
- Сюжет: панель `Public Share-Link` с архивом логов, счётчик скачиваний
  увеличивается ещё на одно — визуальное подтверждение, что ссылка была
  открыта повторно, пока была активна. Камера медленно наезжает. Никого в
  кадре.
- Использование: `CONSEQUENCE_INSERT_CLIP['shadow-it-external-download']`.

## Проверка

Оба клипа скачаны в `public/cutscenes/`, проверены живым браузером против
`npm run dev` через `window.__startupGameDev.scenes.playConsequenceNow(id)` —
`<video>` монтируется с правильным `src` для обоих id, диалог последствия
проигрывается после клипа, сцена корректно завершается (см.
`docs/qa/19b-additional-cyber-story-test-matrix.md`).

## Result

- public/cutscenes/supply-chain-update-consequence-insert.mp4
- public/cutscenes/shadow-it-log-upload-consequence-insert.mp4
