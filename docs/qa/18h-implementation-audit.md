# Аудит Feature 18H (§1) — факт 2026-07-27

§1 требует аудит фактической реализации до изменений кода. Wave 1–4 и
до-заходы §7–§10 уже выполнены (10 коммитов `0378851..4bc4946`), поэтому этот
документ — не пред-имплементационный прогноз, а верификационная запись: каждая
область из списка §1, её фактическое состояние, первопричина исходной проблемы
и что с ней сделано. Каждая строка опирается на код/измерение, не на память.

## Аудит Feature 18H

| Область | Текущее состояние | Найденная причина | План исправления (выполнено) |
|---|---|---|---|
| Sprint kickoff / групповые диалоги | `WorkdayFlowController.tsx`: gather по `KICKOFF_SLOTS` → `beginConversationCinematic({groupIds})` → `await ready` → диалог с per-line cues | Реплики начинались, пока актёры ещё шли; участники стояли где попало | Wave 1: слоты + readiness barrier + awaited opening shot |
| Cinematic Director | `cinematicDirector.ts`: per-line coverage, §9 одиночный guard, tracking loop 450мс, safe-wide-group fallback, `applyCue` (§7), `applySafeArea` (§8) | Камера могла целиться в ушедшего NPC / пустоту | Wave 1 + §7/§8: fallback-композиция, group gaze, cue-метаданные |
| Shot catalog | `cinematicShots.ts`: 13 типов, чистая математика, unit-tested | — (существовал с 18D, пригоден) | Без изменений структуры; переиспользован |
| Camera transitions | `cameraController.ts` `flyTo` (camera-controls promise) + `withReadyTimeout(3500мс)` | P1b: convergence-check зависел от FPS — settle ~8.25с вместо ~1.1с под слабым рендером | Wave 4: bounded wait, найдено живым E2E |
| NPC planner | `Npcs.tsx` `useNpcBrain` + `npcBehavior.ts`; ambient-активности через `ambientGate` | Планировщик не знал ambient-типа; NPC однообразно стояли | Wave 3: `ambient-office-activity` как расширение, не параллельная система |
| Activity claims | `interactionRegistry.ts` + `pairActivityReservation.ts` (атомарный парный резерв) | Не было атомарного парного резерва → риск вечного ожидания второго | Wave 3: atomic reserve/release, timeout освобождает claims |
| Meeting points | `meetingSlots.ts`: 5 слотов полукругом у доски, separation-валидатор, `gatherParticipants` (tolerance 0.55м, timeout 9с → snap) | Позиции диалога не были явными; опоздавший ломал сцену | Wave 1: слоты + snap-fallback вместо вечного ожидания |
| Animation state machine | `characterMachine.ts`: `performing`-состояние несёт имя клипа | Не было generic-состояния для ambient-клипов | Wave 3: одно состояние + fallback-цепочки клипов |
| Look-at / emotion presets | `gaze.ts`, `characterEmotion.ts`, `dialoguePerformanceCue.ts` (11 реакций, 6 маппятся на emotion-позы) | Реакции слушателей отсутствовали (§7 открыт после Wave 4) | §7-заход: cue-driven реакции, nod/shake/thinking процедурно |
| Subtitle/dialogue UI | `DialoguePanel.tsx` + `--cinematic` + §8 head-projection (`dialogueSafeArea.ts`), left/right варианты | Панель могла закрывать головы; P1a: `max-height` на панели резал кнопку | Wave 1 эвристика → §8 настоящая проекция; P1a исправлен в Wave 4 |
| Transform hierarchy / scale / animation tracks | `<primitive>` без scale-обёрток; SCALE-треки вырезаны (`stripScaleTracks.mjs`); guards: `characterIdentity.test.ts` + `characterScaleInvariant.test.ts` | P1 «модель растёт в диалоге»: SCALE-треки в Meshy-клипах | Wave 2 fix + §9 живой source-guard |
| Seat/workstation anchors | Посадка целиком из baked-клипа (осознанно, без `InteractionAnchorSet`); §10-калибровка перепроверена измерением Hips | Прежняя запись о диване была оценкой на глаз (и неверной) | §10-заход: измерено, исправлено, чек-лист добавлен |
| Кофемашина | `CLICK_COFFEE_MACHINE` + mug-проп (attach/detach/dispose) — до 18H | — (работала) | Аудит пропов, без изменений |
| Пинг-понг | Процедурный свинг + paddle-проп + `pingPongMatchmaker`, стороны стола из `PING_PONG_TABLE_ANCHORS` | Стол был декорацией без интерактивности | Wave 2 anchors + Wave 3 матчмейкинг/анимация |
| Турник | `pullUp.glb` (Higgsfield) на всех 5 ригах, `liftClipToHandHeight.mjs`, contact-guard тест (±0.05м) | Сгенерированный клип не совпадал по высоте с перекладиной | Wave 3: лифт клипа + регрессионный guard |
| Higgsfield интеграция | `ambient-office-animation-library.md`, `higgsfield-ambient-motion-prompts.md`, `generated-asset-register.md` | Регистрация происхождения требовалась спекой | Wave 3: prompts/статусы/registry заполнены |
| Approved rigs / skeletons | 8 персонажей, рост 1.50–1.80м измерен FK; skeleton-compat тест | «Женщины крупнее мужчин» — устранено до 18H, подтверждено измерением | Wave 2: измерение вместо декларации |
| Tests / visual captures | 1114 vitest (161 файл), 10 E2E зелёные; visual capture — DOM-locator подход (без скриншотов, осознанно) | Полный E2E не запускался до Wave 4 → нашёл 2 реальных P1 | Wave 4: оба исправлены, задокументированы |

Остаточные открытые пункты (все — в `18h-known-issues.md` с приоритетами):
multi-resolution E2E (P2), прямой тест GS-02 (P3), неиспользуемые
`pingPongMaxRallies`/`pullUpRepetitions` (P3), сходимость `playInsert` под
низким FPS (P2), живой 20–30-мин soak (P2), cues в остальных 8+1 диалоговых
скриптах (готовый механизм, только данные), `focusTarget: 'object'`.

## Создаваемые файлы (за всю 18H, из git)

Код: `meetingSlots.ts(+test)`, `dialogueSafeArea.ts(+test)`,
`dialoguePerformanceCue.ts(+test)`, `ambientActivityHistory.ts(+test)`,
`ambientLookSpots.ts(+test)`, `pingPongMatchmaker.ts(+test)`,
`pairActivityReservation.ts(+test)`, `interactionAnchors.ts(+test)`,
`ambientOfficeBalance.ts`, `Npcs.test.ts`.
Инструменты/guards: `stripScaleTracks.mjs`, `liftClipToHandHeight.mjs`,
`ambientClipFurnitureAlignment.test.ts`, `characterScaleInvariant.test.ts`.
Ассеты: `pullUp.glb` ×5 ригов.
Документы: 4 QA-доки (`18h-*`), 2 art-доки (animation library, prompts),
scale-audit, этот файл.

## Изменяемые файлы (за всю 18H, из git)

`cinematicDirector.ts(+test)`, `CharacterModel.tsx`, `Npcs.tsx`,
`characterMachine.ts(+test)`, `characterStore.ts`, `npcBehavior.ts(+test)`,
`performanceStore.ts`, `useCharacterPerformance.ts`, `performance.test.ts`,
6 character-definitions, `heldProps.ts`, `PingPongTable.tsx(+test)`,
`PullUpBar.tsx`, `GameRoom.tsx`, `WorkdayFlowController.tsx`,
`sprintKickoff.ts(+test)`, `gameStore.ts`, `postAuditInteraction.ts`,
`storyDecisionInteraction.ts`, `interactionRegistry.ts`,
`DialoguePanel.tsx(+test)`, `ui.css`, `e2e/story-baseline.spec.ts`,
`balance/index.ts(+test)`, `characterIdentity.test.ts`, idle.glb ×4
(strip scale tracks), art/QA-доки.
