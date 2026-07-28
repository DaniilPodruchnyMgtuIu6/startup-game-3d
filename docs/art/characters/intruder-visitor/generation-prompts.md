# Нарушитель (intruder-visitor) — generation prompts (18H+ identity replacement)

Причина замены: старая модель была Mixamo-конверсией (126 костей, 7 текстур
1024², другое лицо и телосложение) — визуально не совпадала с персонажем в
сгенерированных сюжетных видео-клипах проникновения (см.
`story-clips-office-intrusion.md`). Живой отзыв игрока также указал, что
курьер в САМИХ видео получился полнее эталонной модели — обе стороны
(модель и видео) пересобраны с одного эталона, чтобы совпадать друг с другом.

## Эталонный портрет (identity reference)

Higgsfield MCP / nano_banana_2, 2026-07-28. Identity-референс: курьер из
кейфрейма `office-intrusion-stopped` (job `d2a1a479`, кадр с Ильёй у входа).

> Extract and recreate ONLY the delivery courier character from the reference image (ignore the other man): same face, same beige/khaki uniform with cap, same brown shoes, same body proportions, same soft Pixar-like 3D animated movie style. Full body, standing alone, neutral relaxed A-pose (arms slightly away from body, palms forward), facing camera directly, on a flat plain light-grey studio background, soft even lighting, no props, no box in hands, no other characters, no text, no watermark.

Job `cd10a57b-be3e-442d-b189-3cc1be40c582`. Результат: слегка стройнее
исходного видео-кадра — этот портрет и стал каноном телосложения для ВСЕХ
последующих генераций (3D-модель и пересборка видео).

## Turnaround (front/side/back, отдельные изображения)

Тот же промпт-шаблон на каждый ракурс, identity-референс — портрет выше:

> The EXACT SAME delivery courier as in the reference image (same face, same beige/khaki uniform with cap, same brown shoes, same 3D animated movie style) - now shown from a three-quarter angle view / in exact side profile view (90 degrees) / from directly BEHIND (back view, cap visible from behind, no face visible), same neutral relaxed A-pose, standing alone on the identical flat plain light-grey studio background, same soft even lighting, same scale/proportions, no props, no text, no watermark.

- side: job `8c74161e-164c-477a-9276-bf9065b66323` (completed)
- back: job `b5512d42-d967-4ae3-bc16-b2be4a8eb894` (completed)
- three-quarter: job `9551d8f7-18cb-41f3-8d8a-18ccf0592ac0` (queued
  unusually long, never completed within the session — proceeded with
  front+side+back, 3 views; multi_image_to_3d accepts 1-4)

## 3D-реконструкция

Higgsfield MCP / `multi_image_to_3d` (Meshy), job
`9f4f18fb-4003-4dc9-8455-5ca6c19f56c9`, 38 кредитов. Входы: front (identity
portrait) + side + back. Параметры: `should_texture: true`, `enable_pbr:
true`, `enable_rigging: true`, `enable_animation: true` (`animation_action_id:
0` — idle), `pose_mode: a-pose`, `rigging_height_meters: 1.72` (рост
взят вровень с Кириллом/Ильёй — мужской канон роста 1.71–1.72 м),
`target_polycount: 45000`.

Результат: 1 меш, 46 337 tris, 1 материал, 1 текстура 2048², скелет
24 кости — та же форма, что у остальных пяти персонажей.

## Интеграция

`node tools/art/importHiggsfieldModel.mjs <glb> intruder` — старый
Mixamo-набор забэкаплен в `assets/source/models-mixamo-backup/intruder/`,
новый GLB стал `idle.glb`, `walk.glb` пересобран ретаргетом старого клипа
на новый скелет (heightRatio ×0.968 — скелеты почти идентичны по
пропорциям).

Пост-обработка:
- `stripScaleTracks.mjs` — сырой Meshy-экспорт нёс scale-треки на всех
  24 костях (тот же баг, что чинили для остальных персонажей в 18H §9;
  без этого шага guard-тест `characterIdentity.test.ts` падает) — сняты.
- `optimizeGlbTextures.mjs` — embedded-текстура 6.3 МБ → 2.2 МБ (JPEG q85).

Замер (`measureRigHeight.mjs`): 1.704 м (кирилл 1.720, илья 1.715 — в
пределах канона). `measureWalkPace.mjs`: geometric stride pace 1.482 →
`walkPace: 1.48` в `src/character/characters/intruder.ts` (было 1.4,
оценка на глаз); `walkLift: 0.015` — как у Кирилла (ближайший по
пропорциям риг, heightRatio ретаргета почти 1).

## Пересборка видео-клипов под тот же эталон

После того как игрок заметил рассинхрон телосложения, оба сюжетных клипа
(`office-intrusion-stopped.mp4`, `office-intrusion-reached.mp4`)
пересобраны с новыми кейфреймами, сгенерированными от ТОГО ЖЕ портрета
(`cd10a57b`), а не от исходных кадров ролика:

- keyframe stopped v2: job `3d060163-397e-464b-ab17-3e0776211fef`
  (courier identity ref `cd10a57b` + Ilya identity ref `f4db2c39`)
- keyframe reached v2: job `f9a856dd-1064-4e82-a744-390365635b5d`
  (courier identity ref `cd10a57b` only)
- video stopped v2: job `9529f9c2-6237-4a98-bded-bc48392bff3d`
  (kling3_0_turbo, image-to-video от keyframe stopped v2)
- video reached v2: job `b64d3991-b534-435f-ac36-cb13ed973811`
  (kling3_0_turbo, image-to-video от keyframe reached v2)

Оба клипа проверены покадрово (0.2с/2.5с/4.6с через Edge) — телосложение
курьера стабильно совпадает с эталонным портретом на всей длительности
ролика. Старые файлы (job `70e72aa3`/`58134dcd`, кейфреймы `d2a1a479`/
`7a8f91c5`) заменены, не используются в production.
