# 18H Wave 3 — Higgsfield motion prompts (ambient office activities)

Как и `assets/source/prompts/gesture-clips-18c.md`: источник движения —
Meshy `3d_rigging` action-каталог через Higgsfield MCP (`animation_actions`
→ выбор action id → `3d_rigging` на загруженную модель, 8 кредитов за
экшен), не свободный text-to-video prompt. Ретаргет тем же
`tools/art/retargetMeshyClip.mjs`, guard тот же
`tools/art/characterIdentity.test.ts`.

**Ничего из таблицы ниже ещё не выполнено** — `animation_actions` каталог не
запрашивался для турника/пинг-понга. Это план поиска на следующий заход, не
отчёт о готовых генерациях (см. `ambient-office-animation-library.md`,
статус planned).

## Турник (`pullUp`)

Поиск в каталоге: `pull up`, `chin up`, `hang`, `bar`. Нужен один экшен,
который реально даёт цикл подтягивания (руки на уровне ≈2.0 м —
`PULL_UP_BAR_ANCHORS` в `src/interaction/interactionAnchors.ts`), а не общий
«exercise» жест. Для персонажей ростом ~1.50 м (Соня/Алина —
`docs/art/18h-character-environment-scale-audit.md`) отдельно проверить, не
требует ли выбранный экшен viewport reach выше overhead reach этих моделей —
если да, взять предпочтительно действие с выраженным подскоком/запрыгиванием
к перекладине, а не вытягиванием руки от пола.

## Пинг-понг (`pingPongRally`)

Поиск: `table tennis`, `ping pong`, `paddle swing`, `forehand`, `backhand`.
Достаточно ОДНОГО экшена с чистым циклом замаха (единая rally-петля), не
восьми гранулярных поз из §19 фичи — компромисс ради бюджета кредитов
(баланс 320cr на момент проверки, `mcp__higgsfield__balance`), решение
явно документируется здесь, а не молчаливое урезание. Serve/miss/celebrate
как отдельные клипы — по остатку бюджета после проверки качества rally-клипа.

## Проп (ракетка)

Реализуется как держащийся в руке проп той же техникой, что кофейная кружка
(`CharacterModel.tsx` → `buildHeldMug`), а не отдельной геометрией/анимацией
события attach/detach — ракетка не требует Higgsfield-генерации, только
простую box/plane-геометрию, прикреплённую к `RightHand`/`LeftHand` бону на
время `playingPingPong`.

## Порядок действий на следующем заходе

1. `animation_actions` с ключевыми словами выше → выбрать 1 экшен на
   активность.
2. `media_upload`/`media_confirm` референсной модели (или переиспользовать
   уже загруженный media id, если такой остался с 18C/18D).
3. `3d_rigging` → `job_status` до готовности.
4. `retargetMeshyClip.mjs` на все 8 ригов, calibration теми же rest-pose
   инструментами, что и в 18B/18C.
5. Покадровая проверка hand/foot contact против anchors из
   `interactionAnchors.ts`.
6. `tools/art/stripScaleTracks.mjs` на новый клип (тот же класс бага, что
   решался в Wave 1 — новый Meshy-экспорт не гарантированно чист).
7. Обновить `ambient-office-animation-library.md` (statuses), включить
   `ping-pong`/`pull-up-bar` в `AMBIENT_WEIGHTS`.
