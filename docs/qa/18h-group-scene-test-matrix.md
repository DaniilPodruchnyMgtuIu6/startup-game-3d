# 18H — Group scene test matrix (факт 2026-07-27)

## GS-сценарии (§23)

| # | Сценарий | Покрытие | Статус |
|---|---|---|---|
| GS-01 | Планёрка: сбор → камера settled → реплики → никто не уходит рано → камера возвращается → planner резюмируется | `meetingSlots.test.ts` (readiness barrier, unit) + `e2e/workday.spec.ts` («a sprint starts with a kickoff dialogue at the board», live) | ✓ |
| GS-02 | Camera fallback: невалидный speaker → safe-wide-group-shot, не пустой кадр | `aimSafeWideGroup()` реализация в `cinematicDirector.ts` (§6) — вызывается для group-сцен при `!subjectOf(speakerId)`; отдельного unit-теста на САМ fallback-путь нет (требует мокать несуществующего спикера в живом diалоге) | частично — код есть, прямого regression-теста нет (см. known-issues #1) |
| GS-03 | Scale invariant: planner → group dialogue → close-up → ambient → planner, масштаб не меняется | `tools/art/characterIdentity.test.ts` (нет SCALE-треков ни в одном клипе, все 8 персонажей) + структурный аудит `docs/art/18h-character-environment-scale-audit.md` (ни один компонент `src/character/**` не пишет в `.scale`) | ✓ (двухуровневая защита: asset-level + архитектурная) |
| GS-04 | Reload во время gather: без дубликатов NPC, слоты восстанавливаются или сцена рестартует один раз | Архитектурный анализ: `markSprintKickoffShown` вызывается ТОЛЬКО после успешного `cinematic.ready` (`WorkdayFlowController.tsx`), значит reload до этого момента просто перезапускает gather; спавн NPC отделён от диалога (`<Npc>` mount effects, не gather), поэтому дублирование структурно невозможно. `docs/game/workdayFlow.test.ts`'s «reload does not replay the kickoff» тест покрывает persistence-часть (существовал до 18H, актуален и для новой логики) | ✓ (по коду, без отдельного live reload-теста) |

## AO-сценарии (§23)

| # | Сценарий | Покрытие | Статус |
|---|---|---|---|
| AO-01 | Кофе: полный цикл | Существовал до 18H (Feature 04/16), не тронут в 18H | вне скоупа |
| AO-02 | Пинг-понг: атомарный резерв → оба приходят → rally → реакция → cleanup → оба возвращаются | `pingPongMatchmaker.test.ts` (5 тестов: reserve+release, refuse-half-claimed, self-pairing refused, arrival barrier, phase-gating) | ✓ |
| AO-03 | Турник: резерв → руки достигают перекладины → повторы → safe release → navmesh | `characterMachine.test.ts` (CLICK_PERFORM_ACTIVITY), `ambientClipFurnitureAlignment.test.ts` (контакт руки с баром, допуск 0.05м, все 5 ригов), `Npcs.test.ts` (полный live-цикл walk→perform→hold→end→replan) | ✓ |
| AO-04 | Priority interruption: ambient активность прервана обязательной сценой, без утечек | `Npcs.test.ts` («a scene claiming the NPC mid-hold cancels the pending PERFORM_END») — подтверждает: `sceneOwned` останавливает hold-таймер через React effect cleanup, персонаж не завершается принудительно и не зависает | ✓ |
| AO-05 | Soak: много дней, без накопления claims/props, без scale drift | `Npcs.test.ts` (детерминированный симулятор 40 «рабочих дней» × 8 «биений» = 320 циклов через `ambientGate`+`ambientActivityHistory`: дневной лимит никогда не превышен, нет мгновенных повторов, история ограничена) — логический soak, не живой 20-минутный прогон (см. known-issues) | частично |

## Регрессия существующего E2E-набора (10 спеков, живой прогон)

Полный `npm run test:e2e` прогнан дважды в конце Wave 4 (production preview, headless SwiftShader). Первый прогон нашёл реальный P1: `story-baseline.spec.ts` зависал на 180с — не флуктуация окружения, а два настоящих бага, оба найдены и исправлены (подробности и код — `18h-known-issues.md` #P1a/#P1b). После исправлений: **10/10 зелёные**.

| Спек | Результат до Wave 4 фикса | Результат после |
|---|---|---|
| outcome.spec.ts ×2 | не запускался в рамках 18H до этого прогона | ✓ |
| persistence.spec.ts ×2 | — | ✓ |
| pm-transition.spec.ts | — | ✓ |
| smoke.spec.ts ×2 | — | ✓ |
| story-baseline.spec.ts | ✗ (180с timeout, дважды воспроизведено) | ✓ (60-70с) |
| workday.spec.ts ×2 (включая live-прогон 18H kickoff) | — | ✓ |

## Не выполнено честно

- Multi-resolution E2E (1366×768/1920×1080/2560×1440, §24 п.13-15): `playwright.config.ts` не имеет `projects` для разных вьюпортов — вся E2E-инфраструктура проекта работает с одним фиксированным 1280×800. Добавление — отдельная инфраструктурная задача, не блокирует 18H по остальным критериям.
- Скриншот/визуальный regression (§24): в проекте НЕТ `page.screenshot()` ни в одном существующем E2E-спеке (проверено) — весь набор намеренно DOM-locator-based (см. `e2e/helpers.ts` комментарий про нестабильность software-рендера для `page.evaluate()`). Не добавлял новый паттерн в этой волне — сохраняю согласованность с решением, принятым до 18H.
- GS-02 (camera fallback) не имеет ПРЯМОГО regression-теста на сам fallback-путь — только код-ревью подтверждает логику.
