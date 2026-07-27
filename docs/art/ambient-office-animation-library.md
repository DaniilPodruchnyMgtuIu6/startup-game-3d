# 18H Wave 3 — библиотека анимаций ambient office activities

Статусы (как в `generated-asset-register.md`): draft / review / approved /
rejected / integrated / deprecated. Дополнительно здесь: **planned** — клип
спроектирован (activity id, PerformClip name, ожидаемая длительность), но
Higgsfield ещё не вызывался.

Production-код уже принимает оба новых `PerformClip` (`pullUp`,
`pingPongRally`, `src/character/characters/definition.ts`) и деградирует их
на `idle`, пока ни один персонаж не поставляет файл
(`CharacterModel.tsx` → `CLIP_FALLBACKS`). Это осознанное решение: до
появления реального клипа ни `ping-pong`, ни `pull-up-bar` не включены в
`AMBIENT_WEIGHTS` (`src/character/npcBehavior.ts`), поэтому NPC не идёт
изображать активность, которой нет — деградация never fires в живой игре.

| Activity id | PerformClip | Tool/model | Prompt | Approved reference | Production clip | Skeleton | Duration | Loop/one-shot | Status |
|---|---|---|---|---|---|---|---|---|---|
| pull-up-bar | pullUp | Higgsfield MCP / `3d_rigging` (Meshy action TBD) + `retargetMeshyClip.mjs` | см. `higgsfield-ambient-motion-prompts.md` | — | `public/character/*/pullUp.glb` (не создан) | все 8 ригов (rescale по `docs/art/18h-character-environment-scale-audit.md`) | ≈2–4s на повтор × 2–5 повторов (`AMBIENT_OFFICE_BALANCE.pullUpRepetitions`) | loop (повтор) + one-shot mount/dismount | planned |
| ping-pong-rally | pingPongRally | Higgsfield MCP / `3d_rigging` + `retargetMeshyClip.mjs` | см. `higgsfield-ambient-motion-prompts.md` | — | `public/character/*/pingPongRally.glb` (не создан) | все 8 ригов | ≈1–2s на обмен × до `AMBIENT_OFFICE_BALANCE.pingPongMaxRallies`=6 | loop (rally) + serve one-shot | planned |

## Дополнительные бытовые активности (§14 «минимум 3»)

Решение: не создавать новые локомоции. `window-look`, `phone-check` и
`whiteboard-glance` спроектированы как переиспользование существующего клипа
`look` (уже в каждом риге, используется патрулём безопасника) плюс, где
уместно, держащийся в руке проп той же техникой, что и кофейная кружка
(`CharacterModel.tsx` — `buildHeldMug`). Отдельных Higgsfield-генераций для
них не требуется; они не входят в эту таблицу, так как не производят новый
production-клип — это Wave 3 продолжение (планировщик + проп), не asset-задача.

## Следующий шаг

Сгенерировать `pullUp` и `pingPongRally` через `3d_rigging`, ретаргетировать
`retargetMeshyClip.mjs` (проверить hand/foot contact на турнике и столе
относительно anchors в `src/interaction/interactionAnchors.ts`), затем
включить `ping-pong`/`pull-up-bar` в `AMBIENT_WEIGHTS`.
