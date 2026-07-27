# Библиотека анимаций (Feature 18C §1/§2)

Данные: `node tools/art/auditCharacterModels.mjs` (duration, rootXZ), 2026-07-26.
Все клипы — in-place (root motion = 0): перемещение делает код
(`useCharacterTransform`), клип отвечает только за позу. Скелеты — Mixamo с
пер-персонажным префиксом (`mixamorig7:` и т.д.).

Два инструмента переноса:

- `tools/art/retargetClip.mjs` — между риг-копиями одной топологии
  (переименование префикса + масштаб Hips);
- `tools/art/retargetMeshyClip.mjs` — из Higgsfield `3d_rigging`
  (Meshy-скелет, другие bind-позы и сантиметры) в наши риги: world-space
  перенос дельт вращений с коррекцией rest-поз, Hips — как мировая дельта.

Совместимость каждого клипа со скелетом базы гарантирует guard-тест
`tools/art/characterIdentity.test.ts`; качество ретаргета проверено
покадровыми рендерами (viewer в scratchpad QA).

## Клипы команды (Соня / Кирилл / Алина / Илья / игрок)

| Clip | Назначение (state) | Duration | Loop | Статус |
|---|---|---|---|---|
| idle | стояние (`idle`) | 2.9–16.6s | loop | ok, базовый файл с мешем |
| walk | ходьба (`walking`), скорость подгоняется `WALK_SPEED/walkPace` | 0.96–1.33s | loop | ok |
| sit | посадка (`sittingDown`) | 4.29s | **one-shot** (LoopOnce + clamp) | **new 18C**: ретаргет `business_man/sit` на всех; settle по длительности клипа (`sitSettleMs`) |
| sitIdle | сидение (`sittingIdle`) | 2.96–6.38s | loop | ok |
| type | работа за столом (`working`) | 16.46s | loop | ok |
| sofaSit | диван (`sofaSitting`) | 5.92–9.54s | loop | **replaced 18C**: у игрока и Ильи были 0-секундные статичные позы — заменены ретаргетом клипа Кирилла |
| drink | кофе (`drinkingCoffee`) | 8.83s | loop | ok, кружка в левой руке (`heldProps`) |
| talk | разговор (`talking`) | 3.75–5.92s | loop | ok |
| look | осмотр (`looking`) | 4.75s | loop, авто-LOOK_END через `LOOK_CLIP_MS` | **new 18C**: ретаргет `security_1/look` на всю команду; Илья играет его в конце патруля |
| agree | слушатель кивает/соглашается (`performing`) | 13.0s | loop | **new 18C (Higgsfield)**: Meshy action Agree_Gesture (id 25); слушатель в NPC↔NPC разговорах |
| celebrate | празднование (`performing`) | 1.9s | loop | **new 18C (Higgsfield)**: Meshy action Cheer_with_Both_Hands_Up (id 298); финал MVP-релиза |
| explain | объясняющий жест (`performing`) | 3.97s | loop | **new 18C (Higgsfield)**: Meshy action Talk_with_Hands_Open (id 313); Соня в post-audit разговоре |
| angryTalk | сердитый разбор (`performing`) | 20.8s | loop | **new 18D (Higgsfield)**: Meshy action Stand_Talking_Angry (id 311); guard1 в конфронтации security-breach (риги охраны) |
| facepalm | плохие новости (`performing`) | 3.73s | loop | **new 18D (Higgsfield)**: Meshy action Head_Hold_in_Pain (id 391); игрок на sad-бите security-breach (есть и у Сони) |

Охрана (`security_1/2`): idle, walk, talk, look. Нарушитель (`intruder`): idle,
walk. Для сцен этого достаточно.

## Приоритет анимационных состояний (§3)

Единственная машина состояний — `characterMachine.ts`; клип выбирает
`resolveClip` с fallback-цепочками (перекрывающиеся клипы невозможны: у mixer
один активный action + crossfade 0.3s):

1. блокирующая сцена (`sceneOwned` — planner молчит, командует director);
2. обязательный диалог / свободный чат (`TALK_START/END`);
3. интеракции (sit → settle → work; brew → drink; repair);
4. офисная активность planner'а;
5. locomotion (`walking`);
6. `idle`.

Поверх любого состояния — additive performance-слой (18C §5/§6:
`useCharacterPerformance`): дыхание, look-at, кивки слушателя, эмоциональные
bone-позы. Mixer каждый кадр перезаписывает позу, поэтому слой самоочищается.

## Пробелы библиотеки (§2, честный статус)

Канал пополнения найден и проверен: каталог Higgsfield `animation_actions`
(678 пресетов, 8 кредитов за экшен) + `retargetMeshyClip.mjs` переносит один
купленный экшен на ВСЕ риги проекта. В каталоге есть кандидаты на будущие
пробелы: Phone_Conversation (312), Sitting_Answering_Questions (307),
Stand_Talking_Angry (311), Listening_Gesture (47), Head_Hold_in_Pain (391).

Остаются без исходника: fast walk, turn L/R, stand up, mouse, reading
document, notes, whiteboard. Закрываются существующими поведениями: turn —
процедурный поворот `stepTowards`; stand up — обратный crossfade из сидячей
позы; whiteboard/reading — `idle`+`look`. Статус: missing, закрываются
покупкой пресетов по мере надобности.

## Story-биты (§2 Story)

- enter room / gather / urgent walk — director.walk + setSpeed (security-breach
  использует 2.4×);
- stop near player / inspect computer — walk + face + look (security-breach);
- bad news reaction — emotion `surprised`→`sad` игрока в security-breach;
- security inspection — патруль Ильи с `look` на точке обхода;
- celebration / release moment — mvp-release: `confident`/`relieved` у команды.
