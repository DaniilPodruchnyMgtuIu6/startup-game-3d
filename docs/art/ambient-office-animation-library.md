# 18H Wave 3 — библиотека анимаций ambient office activities

Статусы (как в `generated-asset-register.md`): draft / review / approved /
rejected / integrated / deprecated. Дополнительно здесь: **procedural** —
живёт в игре, но не через Higgsfield-клип, а через bone-pose код
(`useCharacterPerformance.ts`), тот же класс техники, что emotion presets.

Оба обязательных Wave 3-активности теперь **живые**: `pullUp` через
`WEIGHTS`/`WORK_BIASED_WEIGHTS` (сольный picker, `npcBehavior.ts`),
`pingPongRally` через отдельный paired-координатор
(`pingPongMatchmaker.ts`) — двухместная активность не укладывается в
одиночный weighted picker, поэтому не участвует в `ActivityKind`/`WEIGHTS`
вовсе, а напрямую диспетчерит `CLICK_PERFORM_ACTIVITY` для обоих участников
после атомарного резервирования (`tryReservePairActivity`).

| Activity id | PerformClip | Tool/model | Job id | Production clip | Skeleton | Duration | Loop/one-shot | Status |
|---|---|---|---|---|---|---|---|---|
| pull-up-bar | pullUp | Higgsfield MCP / `3d_rigging` (Meshy, action 485 `Jump_and_Hang_on_Bar`) + `retargetMeshyClip.mjs` | 664fdf80-0890-4c5c-b4ad-6b76ead705ea | `public/character/{business_man,female_pm,kirill_morozov,alina_belova,cybersecurity}/pullUp.glb` | все 5 hero-ригов (`TEAM` в retargetMeshyClip.mjs) | 1.73s, one-shot (mount + clamp on the hang pose) | one-shot, clamped (не loop — см. CharacterModel.tsx) | **integrated** |
| ping-pong-rally | pingPongRally | — (нет подходящего action в каталоге, см. ниже) | — | нет .glb — процедурный swing поверх `idle` (`useCharacterPerformance.ts`) + paddle-проп (`heldProps.ts` → `buildHeldPaddle`) | все риги (bone-pose код, не asset) | длительность держит `pingPongMatchmaker.ts` (`AMBIENT_OFFICE_BALANCE.socialActivityDurationSeconds`, 15–35с) | continuous procedural loop, останавливается на `PERFORM_END` | **procedural, integrated** |

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

## Ping-pong — почему нет Higgsfield-клипа, и что сделано вместо

Каталог `animation_actions` (678 действий) не содержит ракеточного/теннисного
жеста ни под одним естественным запросом (`tennis`, `swing`, `wave`,
категория `Punching`/`AttackingwithWeapon` — всё боевые стойки/удары,
тонально неверные для офисного перерыва). Решение: не тянуть несовместимый
combat-клип ради видимости прогресса.

Вместо этого:

- **Проп**: `buildHeldPaddle()` (`src/character/heldProps.ts`) — та же
  imperative-geometry техника, что кофейная кружка, прикреплена к
  `RightHand` пока `state.kind==='performing' && clip==='pingPongRally'`
  (`CharacterModel.tsx`).
- **Взмах**: процедурный bone-pose поверх идущего `idle`-клипа
  (`useCharacterPerformance.ts`) — синусоидальное вращение `RightArm`/
  `RightForeArm`, аддитивно, тем же способом, что дыхание и emotion pitch.
  Направление вращения (не назад через торс, не вверх мимо головы)
  подтверждено НЕ на глаз, а FK-расчётом на реальном rest-pose скелета
  (`kirill_morozov/idle.glb`): поворот `RightArm`/`RightForeArm` на
  локальную -X сдвигает кисть вперёд-вверх на этом риге — так и
  используется в коде.
- **Координация пары**: `pingPongMatchmaker.ts` — раз в 5с проверяет,
  свободны ли ≥2 idle NPC и обе стороны стола, атомарно резервирует пару
  (`tryReservePairActivity`), диспетчерит обоих, ждёт реального прибытия
  (readiness barrier, тот же принцип что и meeting-slot barrier из Wave 1),
  затем держит `socialActivityDurationSeconds` и отпускает обоих разом.

Это не единственно возможная точная имитация обмена ударами (мяч не
рассчитывается физически, оба участника качают рукой на собственной,
не синхронизированной фазе) — соответствует явному §14 требованию «это не
мини-игра и не спортивный симулятор».

## Дополнительные бытовые активности (§14 «минимум 3»)

Решение не изменилось: `window-look`, `phone-check`, `whiteboard-glance` —
переиспользование существующего клипа `look` + опциональный held-prop, без
новой Higgsfield-генерации. Ещё не реализовано.

## Следующий шаг

Дополнительные бытовые активности (§14, минимум 3 — window-look/phone-check/
whiteboard-glance), затем Wave 4 (QA/performance/docs).
