# Feature 15 — Manual Test Matrix

Статусы: **AUTO** — доказано автоматическим тестом; **PROTOCOL** — сценарий описан, ручное исполнение ожидается перед публичным релизом; **PARTIAL** — частично автоматизировано.

Ссылки на автотесты: `tools/balance/campaignScenarios.test.ts`, `src/game/gameOutcomeIntegration.test.ts`, `src/game/mvpReleaseIntegration.test.ts`, `src/game/serverIncidentIntegration.test.ts`, `src/game/eventPriority.test.ts`, `src/game/persistMigration.test.ts`, `src/game/ledgerReconciliation.test.ts`, `server/npcChatServer.test.ts`, `server/secretGuards.test.ts`.

## Кампании (RUN)

| ID | Категория | Предусловия | Шаги | Ожидаемый результат | Факт | Статус | Комментарий |
|---|---|---|---|---|---|---|---|
| RUN-01 | Победа с Ильёй | Новая игра | intro → найм → спринты → закрыть замечания → СКУД → выпуск | success outcome, положительный бюджет | win, 1 442 000 ₽ (sim) | PARTIAL (AUTO BAL-01) | Полный UI-проход — PROTOCOL |
| RUN-02 | Победа без Ильи | Новая игра, отказ от Ильи | Соня/Кирилл закрывают замечания → выпуск | win достижима | win, 1 649 000 ₽ (sim) | PARTIAL (AUTO BAL-02) | UI-проход — PROTOCOL |
| RUN-03 | Восстановление | — | 1 штраф/инцидент → исправить → выпуск | win, бюджет ниже | win, 1 266 000 ₽ (sim) | PARTIAL (AUTO BAL-03) | UI-проход — PROTOCOL |
| RUN-04 | Банкротство | Бюджет < дневного расхода | завершить день | loss `budget-exhausted` после отчёта | AUTO | AUTO (BAL-09) | |
| RUN-05 | Остановка руководством | 3-й провал аудита | grace 5 дней, оставить замечание | loss `leadership-suspension` | AUTO | AUTO (F12 integ.) | |
| RUN-06 | Критический простой | инцидент, не восстанавливать | 5 дней простоя | loss `service-collapse`; восстановление в 5-й день спасает | AUTO | AUTO (F12 integ.) | |
| RUN-07 | Срыв MVP | 13/14 к review S6 | «Посмотреть итог» | loss `delivery-deadline-missed`, нет спринта 7 | AUTO | AUTO (BAL-12) | |
| RUN-08 | Ранний устойчивый запуск | 14/14 до S6, без штрафов | выпуск | win, tier secure/высокий score | win, score 89 (sim) | PARTIAL (AUTO BAL-13) | |
| RUN-09 | Запуск под давлением | штрафы/инциденты, blockers сняты | выпуск | win, низкий tier | fragile/stable | PROTOCOL | Автопроверка tier — F13 unit |
| RUN-10 | DeepSeek disabled | нет ключа/сети | пройти кампанию, открыть чат | статический fallback, кампания проходима | AUTO fallback | PARTIAL (AUTO F14) | Полный проход — PROTOCOL |

## Браузерные E2E

| ID | Проверка | Статус | Комментарий |
|---|---|---|---|
| E2E-01 | Старт новой игры, нет console errors | PROTOCOL | Playwright не в devDeps; headless smoke использовался при F11–14 |
| E2E-02 | Save/reload восстанавливает sprint/budget/team/product; `?intro` → чистая игра | PARTIAL | Логика — AUTO (persistMigration); браузер — PROTOCOL |
| E2E-03 | Успешный путь через публичный UI (release checklist → confirm → scene → outcome → reload) | PROTOCOL | Ядро — AUTO (mvpReleaseIntegration); F13 headless smoke пройден |
| E2E-04 | Поражение: последняя операция → экран → reload → reset | PROTOCOL | Ядро — AUTO; F12 headless smoke пройден |
| E2E-05 | Event priority: audit+intrusion+incident+review, порядок | PARTIAL | Инварианты — AUTO (eventPriority); браузер — PROTOCOL |
| E2E-06 | NPC подход: клик издалека → подход → диалог → закрыть → planner/claims восстановлены | PROTOCOL | Подход/priority — AUTO (freeNpcConversation/F14) |
| E2E-07 | DeepSeek timeout/500 → fallback, state не меняется, нет секрета в console | PARTIAL | Ошибки/fallback — AUTO (F14); браузер — PROTOCOL |
| E2E-08 | Responsive 1366×768 / 1920×1080 / 2560×1440 | PROTOCOL | Не исполнялось в этом прогоне |

## Опасные reload-точки (§14) — PROTOCOL/AUTO

`?intro` и нормализаторы: daily report, pending/running breach, pending post-audit, pending/running audit, armed/pending/running intrusion, armed/несколько server incidents, recovery partial, leadership grace, pending/completed loss, release checklist, completed win, прерванный DeepSeek reload.
- Нормализация `running → not-started/pending`, отсутствие дублей, идемпотентность — **AUTO** (`persistMigration.test.ts` + per-store тесты + F12/F13/F14 нормализаторы).
- Живой браузерный reload в каждой точке — **PROTOCOL**.

## DeepSeek quality/resilience (§23) — provider cases

| Кейс | Статус |
|---|---|
| timeout / 401 / 429 / 500 → безопасный код, без raw body/секрета | AUTO (`npcChatServer.test.ts`) |
| валидация npcId/message/history/ненанятый Илья/клиентский model | AUTO |
| скрытые actual risks не в context; only-detected | AUTO (`npcPublicContext.test.ts`) |
| mandatory dialogue приоритетнее free chat | AUTO (`freeNpcConversation` + F14) |
| нормальный ответ на русском / markdown / длинный / injection | PROTOCOL (live smoke, отдельно, ≤1 запрос на NPC, без секретов в логе) |

## Reset (§26) — PARTIAL/AUTO
`?intro` после частичной кампании / audit / intrusion / incidents / negative budget / loss / win / СКУД / Ильи / рисков / DeepSeek history: **AUTO** для стора-логики (`?intro` → initial, конверсации очищаются, гонка «reset → поздний response» не влияет, т.к. reload — полная перезагрузка). Браузерный прогон каждого пункта — **PROTOCOL**.

## Перенос whiteboard (стабилизационная итерация)

| ID | Проверка | Ожидаемый результат | Факт | Статус |
|---|---|---|---|---|
| WB-01 | Доска висит на open-space стороне стены серверной (x=−6, z=3.7), лицом к камере | Позиция/поворот из `scene/whiteboardSpot.ts` | AUTO (`whiteboardSpot.test.ts`, `OpenSpace.test.tsx`: ровно одна доска в нужной точке) | AUTO |
| WB-02 | Пролёт двери серверной и межкомнатная перегородка свободны | Просветы > 0.4 м | AUTO (геометрический тест) | AUTO |
| WB-03 | Клик издалека → подход → панель открывается на дистанции | Не телепорт; `isWithinMeetDistance` | **Проверено вживую**: headless-клик по canvas (рейкаст в доску), игрок дошёл, панель открылась со всеми вкладками | PASS |
| WB-04 | Точка подхода walkable, в зоне взаимодействия | `isBlockedAt` false; ≤ MEET_DISTANCE | AUTO | AUTO |
| WB-05 | Старая стена переговорной чистая (нет креплений/хитбокса/дубля доски) | Один экземпляр доски в сцене | AUTO (OpenSpace: ровно 1; MeetingRoom без доски) | AUTO |
| WB-06 | Материал стены — тот же общий `wallPaint` (стена уже была белой paint-стеной) | Без нового оттенка/свечения | По конструкции (стена не менялась) | PASS |
| WB-07 | Маркер планирования над новым местом | PlanningMarker в OpenSpace | AUTO (рендер) + код | AUTO |
| WB-08 | Финальная сцена MVP собирает команду у новой доски | Марки из whiteboardSpot | Код обновлён; сцена использует `WHITEBOARD_POSITION` | PARTIAL |
| WB-09 | Reload/reset: доска на месте, без второго экземпляра | Статика сцены | По конструкции (позиция — константа, не state) | PASS |
| WB-10 | Визуальный вид стены/доски на реальном GPU; 1366×768/1920×1080/2560×1440 | Без мерцания/швов, читаемый UI | Headless canvas-захват в этой среде пуст (SwiftShader) — сцена жива (рейкаст работает), но кадр не снят | PROTOCOL |

Подсказки UI обновлены: «Подойдите к доске задач у входа в серверную…» (SprintHud, SprintPhaseOverlay).

## NPC/3D soak (§20–21) — PROTOCOL
30-минутный soak, дубли NPC, утечки claims, застревание в дверях, рост heap/scene objects, эмиссия после множественных reload — **не исполнялось автоматически**; протокол для ручного прогона перед публичным релизом.
