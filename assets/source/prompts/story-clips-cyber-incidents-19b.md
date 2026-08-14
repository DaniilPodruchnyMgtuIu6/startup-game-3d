# story-clips-cyber-incidents-19b (три pre-choice вставки для Feature 19B)

Запрос игрока: сгенерировать реальные видео-вставки для трёх новых сюжетных
сцен кибербезопасности (Feature 19B), а не оставлять их только с in-engine
fallback.

- Tool/model: Higgsfield MCP / nano_banana_2 (кейфреймы, реально отработал как
  `nano_banana_flash`) + kling3_0_turbo (image-to-video)
- Date, session: 2026-08-02
- Cost: 3 кейфрейма + 3 видео (5с, 720p, 16:9)
- Все три клипа — только реквизит/экран, без персонажей (тот же приём, что и
  у всех остальных Feature 19 вставок): снимает риск расхождения идентичности
  персонажей, снимает необходимость identity-lock.

## 1. secret-committed-to-repository (техническая, вечерняя)

- Jobs: кейфрейм b8ee584d-2f5a-43fe-b88d-cfe9fa71bead, видео 4c9eba2f-9160-4281-9c2f-fce9372cac0a
- Сюжет: code diff с удалённой строкой (плейсхолдер-ключ, зачёркнут красным)
  над терминалом с `git log`, коммит «remove temporary key». Камера медленно
  наезжает, строка git log ненадолго попадает в фокус. Никого в кадре.
- Использование: `cyberStoryInteraction.ts` — `INSERT_CLIP['secret-committed-to-repository']`, проигрывается перед диалогом; при недоступности — откат на `playInsert`.

## 2. mfa-fatigue-attack (ночная, тревожная)

- Jobs: кейфрейм 6f1cb427-0bf2-4037-a5df-9860ea014cbc, видео fb14f8d2-b65f-49bb-b7bc-d9d4ab8dcd99
- Style: тёмное ночное освещение.
- Сюжет: стопка push-уведомлений «Подтвердить вход?» на экране телефона
  рядом с панелью активных сессий на ноутбуке, одна строка подсвечена
  красным как «неизвестное устройство». Камера медленно переходит от
  телефона к ноутбуку, строка один раз пульсирует. Никого в кадре.
- Использование: `INSERT_CLIP['mfa-fatigue-attack']`.

## 3. external-ai-data-disclosure (дневная, деловая)

- Jobs: кейфрейм de293cc0-2d4e-420a-a671-1b55ae8df907, видео f8d9f93d-84ee-4aff-9357-1b3496e321cd
- Сюжет: обобщённый (без реального бренда) интерфейс AI-чата с вставленным
  фрагментом кода рядом со вторым экраном, где часть полей лога
  запикселирована/замазана. Камера медленно наезжает на чат, затем переходит
  на лог. Никого в кадре, ни одного реального названия AI-сервиса.
- Использование: `INSERT_CLIP['external-ai-data-disclosure']`.

## Проверка

Все три клипа скачаны в `public/cutscenes/`, проверены живым браузером
против `npm run dev` через `window.__startupGameDev.scenes.play(id, { visualOnly: true })` —
`<video>` монтируется с правильным `src` для каждого из трёх id
(`readyState: 4`/`1`, `error: null`), 0 console errors.

## Result

- public/cutscenes/secret-committed-to-repository-insert.mp4
- public/cutscenes/mfa-fatigue-attack-insert.mp4
- public/cutscenes/external-ai-data-disclosure-insert.mp4
