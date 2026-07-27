# 18H Wave 3 — библиотека анимаций ambient office activities

Статусы (как в `generated-asset-register.md`): draft / review / approved /
rejected / integrated / deprecated. Дополнительно здесь: **planned** — клип
спроектирован, но Higgsfield ещё не вызывался.

`pullUp` теперь integrated и живёт в `WEIGHTS`/`WORK_BIASED_WEIGHTS`
(`src/character/npcBehavior.ts`) — NPC реально ходят к турнику. `pingPongRally`
остаётся planned: подходящего действия в каталоге Higgsfield не нашлось (см.
ниже), поэтому он всё ещё деградирует на `idle`
(`CharacterModel.tsx` → `CLIP_FALLBACKS`) и не включён в живые веса — NPC не
идёт изображать активность, которой нет.

| Activity id | PerformClip | Tool/model | Job id | Production clip | Skeleton | Duration | Loop/one-shot | Status |
|---|---|---|---|---|---|---|---|---|
| pull-up-bar | pullUp | Higgsfield MCP / `3d_rigging` (Meshy, action 485 `Jump_and_Hang_on_Bar`) + `retargetMeshyClip.mjs` | 664fdf80-0890-4c5c-b4ad-6b76ead705ea | `public/character/{business_man,female_pm,kirill_morozov,alina_belova,cybersecurity}/pullUp.glb` | все 5 hero-ригов (`TEAM` в retargetMeshyClip.mjs) | 1.73s, one-shot (mount + clamp on the hang pose) | one-shot, clamped (не loop — см. CharacterModel.tsx) | **integrated** |
| ping-pong-rally | pingPongRally | — (нет подходящего action в каталоге) | — | не создан | — | — | — | planned (см. «Ping-pong» ниже) |

## Турник — что было исправлено

Исходный клип (`Jump_and_Hang_on_Bar`) авторски рассчитан на бар другой
высоты: рука на последнем кадре ретаргета оказывалась на 0.18–0.50 м НИЖЕ
реальной перекладины проекта (`PullUpBar.tsx` `BAR_Y=2.0`) — разброс зависит
от роста персонажа (у Сони/Алины больше, у Кирилла/Ильи меньше, полностью
согласуется с замерами `docs/art/18h-character-environment-scale-audit.md`).
Это не «сломанная генерация», а несовпадение авторского масштаба сцены с
нашей мебелью — обычный случай, когда motion reference и final placement
не совпадают без ручной калибровки (§12 фичи).

Исправлено `tools/art/liftClipToHandHeight.mjs`: постоянное вертикальное
смещение hips translation-трека (не scale — запрещено §11/§27) на величину,
выравнивающую руки ровно на `y=2.0` для КАЖДОГО персонажа отдельно (0.18–0.50м
в зависимости от роста). Инвариант закреплён регрессионным тестом
`tools/art/ambientClipFurnitureAlignment.test.ts` (проверяет все 5 ригов,
допуск 0.05м) — защищает от повторного рассинхрона при будущей регенерации.

Побочный эффект найденной причины: инструмент `liftClipToHandHeight.mjs`
сначала применял смещение в мировых метрах напрямую к raw-трансляции —
для 4 из 5 ригов (все, кроме `business_man`) трек хранится в единицах с
собственным масштабом узла-предка (~0.009, тот же фактор, что путал
`measureCharacterHeight.mjs` ранее в 18H). Найдено и исправлено делением на
`hipsParentScale`, посчитанный тем же FK-проходом, что и мировая высота руки.

## Ping-pong — почему нет Higgsfield-клипа

Каталог `animation_actions` (678 действий) не содержит ракеточного/теннисного
жеста ни под одним естественным запросом (`tennis`, `swing`, `wave`,
категория `Punching`/`AttackingwithWeapon` — всё боевые стойки/удары,
тонально неверные для офисного перерыва). Решение: не тянуть несовместимый
combat-клип ради экономии на процедурной анимации — вместо этого пинг-понг
получит процедурный взмах руки (по образцу `characterEmotion.ts`'s bone-pose
техники) + держащаяся в руке ракетка (по образцу `buildHeldMug`), без новой
Higgsfield-генерации. Это следующий шаг Wave 3, не asset-задача.

## Дополнительные бытовые активности (§14 «минимум 3»)

Решение не изменилось: `window-look`, `phone-check`, `whiteboard-glance` —
переиспользование существующего клипа `look` + опциональный held-prop, без
новой Higgsfield-генерации.

## Следующий шаг

Процедурный arm-swing + paddle prop для `ping-pong`, затем включение в
`AMBIENT_WEIGHTS`/`WEIGHTS`.
