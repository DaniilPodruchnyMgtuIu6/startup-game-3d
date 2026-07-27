# 18H Wave 3 — Higgsfield motion prompts (ambient office activities)

Как и `assets/source/prompts/gesture-clips-18c.md`: источник движения —
Meshy `3d_rigging` action-каталог через Higgsfield MCP (`animation_actions`
→ выбор action id → `3d_rigging` на загруженную модель, 8 кредитов за
экшен), не свободный text-to-video prompt. Ретаргет тем же
`tools/art/retargetMeshyClip.mjs`, guard тот же
`tools/art/characterIdentity.test.ts`.

## Турник (`pullUp`) — выполнено

Каталог `animation_actions` не содержит буквального «pull up»/«chin up» —
искали `pull up`, `chin up`, `bar`, `pullup`. Ближайшая по смыслу и телесной
механике категория — `HangingfromLedge` (руки на перекладине, тело висит):

- id 478 `Bar_Hang_Idle` — статичный вис;
- id 485 **`Jump_and_Hang_on_Bar`** — прыжок + хват (выбран: даёт узнаваемое
  начало активности, а не телепорт в вис);
- id 491 `Fall_from_Bar` — рассматривался на dismount, отклонён (читается
  как падение/авария, не контролируемое завершение).

Источник: `business_man/idle.glb`, загружен как `media_upload` (type=file) →
`https://d2ol7oe51mr4n9.cloudfront.net/.../fc081c94-b1c4-4163-b2a3-87e63b84d6a6.glb`.
Job `664fdf80-0890-4c5c-b4ad-6b76ead705ea` (`3d_rigging`, height_meters=1.778,
animation_action_id=485, 8 кредитов). Ретаргет на все 5 hero-ригов
(`retargetMeshyClip.mjs`), guard `characterIdentity.test.ts` (0 scale-треков
на всех 5) — прошёл.

**Найдено при контакт-проверке**: последний кадр клипа кладёт руки заметно
ниже нашей реальной перекладины (`PullUpBar.tsx` `BAR_Y=2.0`) — от 0.18м
(Кирилл/Илья) до 0.50м (Соня/Алина), т.к. исходная сцена action-каталога
подразумевала бар другой высоты. Исправлено константным вертикальным
сдвигом hips-трека на разницу для каждого персонажа отдельно
(`tools/art/liftClipToHandHeight.mjs`, НЕ scale — см. §11/§27), закреплено
`tools/art/ambientClipFurnitureAlignment.test.ts`. Подробности —
`ambient-office-animation-library.md`.

Для Сони/Алины (рост ~1.50м) итоговый подъём тела до уровня хвата заметно
больше, чем у более высоких персонажей — физически корректно (тот же бар,
меньший рост), визуально более «прыжковая» посадка. Зафиксировано как
ожидаемое поведение, не баг.

## Пинг-понг (`pingPongRally`) — решение: без Higgsfield-клипа

Проверенные запросы каталога: `tennis` (0 результатов), `swing` (кухонные
гири/канат/дэнс — не подходит), `wave` (приветствия — не подходит),
категории `Punching`/`AttackingwithWeapon` (боксёрская стойка/джебы, сабли,
лук — все читаются как «бой», тонально сломают офисную сцену). Каталог
Meshy — action-game/паркур-ориентированный набор, ракеточного вида спорта в
нём нет ни в одной категории (`categories` ответа `animation_actions` не
содержит «Sports» вовсе).

Решение: не тянуть несовместимый combat-клип ради видимости прогресса —
пинг-понг получил процедурный взмах руки (bone-pose техника, как
`characterEmotion.ts`, direction проверено FK-расчётом на rest-pose
скелета, не на глаз) + держащаяся в руке ракетка (техника `buildHeldMug`),
без Higgsfield-генерации. **Выполнено** — см.
`ambient-office-animation-library.md` и `pingPongMatchmaker.ts`.

## Дополнительные бытовые активности (§14 «минимум 3»)

`window-look`/`phone-check`/`whiteboard-glance` — переиспользование
существующего клипа `look` + опциональный held-prop, без Higgsfield. Ещё не
реализовано.

## Оставшийся порядок действий

1. Дополнительные бытовые активности (§14, минимум 3 — planner + look-clip + props).
2. Wave 4 (QA/performance/docs).
