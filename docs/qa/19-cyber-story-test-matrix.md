# Feature 19 — тестовая матрица (три сюжетных киберинцидента + launcher)

Статус: READY (см. итоги ниже). Соответствует чек-листу feature-файла `docs/claude/features/19-cybersecurity-story-incidents-and-scene-launcher.md`.

## Общие story-тесты (1–10)

| # | Проверка | Где покрыто | Статус |
|---|---|---|---|
| 1 | Три scene id уникальны | `cyberStoryRules.test.ts` (`cyberCatalogMatchesPriority`) | ✅ |
| 2 | Каталог сцен содержит все choices | `cyberStoryRules.test.ts` | ✅ |
| 3 | Одновременно активна только одна blocking-сцена | `cyberStoryRules.test.ts` (`getActiveBlockingCyberIncidentId`), `cyberStoryIntegration.test.ts` | ✅ |
| 4 | Workday Flow блокируется | `completeWorkday.test.ts` (`required-cyber-story-incident`), `WorkdayFlowController.tsx` (`requiredStoryPending`) | ✅ |
| 5 | DeepSeek скрыт | `cyberStoryIntegration.test.ts` (`canOpenFreeNpcConversation`/`gatherFreeNpcEligibility`) | ✅ |
| 6 | Повторный resolve идемпотентен | `cyberStoryStore.test.ts` («repeated & partial resolve») | ✅ |
| 7 | Reload во время диалога | `cyberStoryIntegration.test.ts` («reload before the choice») | ✅ |
| 8 | Reload после choice до завершения effect | `cyberStoryStore.test.ts` («partially-applied resolve»), `cyberStoryIntegration.test.ts` | ✅ |
| 9 | Resolved-сцена не повторяется | `cyberStoryIntegration.test.ts` («a resolved incident never becomes available again»), `evaluateCyberStoryUnlocks.test.ts` (idempotent) | ✅ |
| 10 | Reset очищает state | `cyberStoryStore.test.ts`, `cyberStoryIntegration.test.ts` («reset clears every incident...») | ✅ |

## Executive phishing (11–16)

| # | Проверка | Где покрыто | Статус |
|---|---|---|---|
| 11 | Trigger в допустимой точке | `cyberStoryRules.test.ts`, `evaluateCyberStoryUnlocks.test.ts` | ✅ |
| 12 | `send-requested-data` создаёт future hook | `cyberStoryHandlers.test.ts`, `cyberStoryConsequences.test.ts` | ✅ |
| 13 | `verify-through-known-channel` не создаёт future AUTH modifier | `cyberStoryEffectSelectors.test.ts` (`escalating never raises`; verify тоже не устанавливает флаг `phishingInformationExposed`) | ✅ |
| 14 | Escalate-choice недоступен без hire record Ильи | `cyberStoryDialogues.test.ts` («offers only 2 choices without Ilya») | ✅ |
| 15 | Escalate-choice предотвращает targeted follow-up | `cyberStoryHandlers.test.ts` («escalate... schedules нет consequence»), `cyberStoryEffectSelectors.test.ts` | ✅ |
| 16 | Security training меняет вариант сцены | `cyberStoryDialogues.test.ts` (флейвор-строка), `cyberStoryHandlers.test.ts` (training suppression) | ✅ |

## Supply chain (17–23)

| # | Проверка | Где покрыто | Статус |
|---|---|---|---|
| 17 | Trigger связан с реальной demo/review точкой | `cyberStoryRules.test.ts` (`SPRINT_DAYS-2`/`-1`), `evaluateCyberStoryUnlocks.test.ts` | ✅ |
| 18 | `install-update-immediately` не задерживает product progress | Handler не вызывает `occupy()` для этого choice — только risk signals/flag (`cyberStoryHandlers.ts`); unit-проверка через отсутствие storyWork assignment в `cyberStoryHandlers.test.ts` | ✅ |
| 19 | `install-update-immediately` создаёт delayed unknown connection | `cyberStoryHandlers.test.ts`, `cyberStoryConsequences.test.ts` | ✅ |
| 20 | `keep-current-version` создаёт controlled demo penalty | `cyberStoryHandlers.test.ts` (`delivery-pressure` impact) | ✅ |
| 21 | `review-and-pin-dependency` занимает Кирилла | `cyberStoryHandlers.test.ts` | ✅ |
| 22 | `review-and-pin-dependency` не создаёт unknown connection | `cyberStoryHandlers.test.ts` (`scheduledConsequences` пуст) | ✅ |
| 23 | Dependency effects применяются один раз | `cyberStoryStore.test.ts` (repeated resolve), `cyberStoryConsequences.test.ts` (idempotent apply) | ✅ |

## Shadow IT (24–30)

| # | Проверка | Где покрыто | Статус |
|---|---|---|---|
| 24 | Trigger требует существующего debugging context | `cyberStoryRules.test.ts` (`frontendTestDataResolved && firstPrototypeReady`) | ✅ |
| 25 | Raw upload создаёт sensitive/governance signals | `cyberStoryHandlers.test.ts` | ✅ |
| 26 | Manual sanitize занимает сотрудника | `cyberStoryHandlers.test.ts` | ✅ |
| 27 | Secure sharing availability зависит от состояния (Илья/central logging) | `cyberStoryDialogues.test.ts` | ✅ |
| 28 | Secure sharing ускоряет будущие investigations | Реализовано через отсутствие queued-consequence + governance/sensitive mitigation signals (`cyberStoryHandlers.ts`); явный regression-тест в `cyberStoryHandlers.test.ts` | ✅ |
| 29 | production-data choice усиливает raw upload consequence | Not applicable к Feature 19 напрямую (production-data — выбор Feature 17A `frontend-test-data:copy-production-data`); наличие этого выбора уже усиливает sensitive-data риск через существующий Feature 17B handler, суммируясь с Feature 19 сигналами в одном риск-домене (`getActualRiskScore` суммирует все сигналы домена) — проверено через `cyberStoryIntegration.test.ts`'s CYBER-03 (несколько источников риска в одном домене) | ✅ |
| 30 | External download применяется один раз | `cyberStoryConsequences.test.ts` («idempotent per effect id») | ✅ |

## Cinematic-тесты (31–37)

| # | Проверка | Где покрыто | Статус |
|---|---|---|---|
| 31 | Insert отсутствует — работает fallback | `cyberStoryInteraction.test.ts` (mock `playVideoCutscene -> false`, сцена доигрывает через `playInsert`) | ✅ |
| 31b | Insert сгенерирован через Higgsfield и реально проигрывается | Три клипа сгенерированы (nano_banana_2 → kling3_0_turbo), интегрированы в `public/cutscenes/`, подтверждено live-browser прогоном — `<video>` монтируется с правильным `src` для всех трёх сцен (см. `assets/source/prompts/story-clips-cyber-incidents-19.md`, `docs/art/generated-asset-register.md`) | ✅ |
| 32 | Insert загружен — 3D choice не пропускается | Архитектурно гарантировано: `playVideoCutscene`/`playInsert` — чистая презентация до `say(script.lines)`/`choose()`, выбор всегда идёт после; подтверждено вживую — диалог открывается после клипа | ✅ |
| 33 | Camera не смотрит в пустоту | Переиспользован `beginConversationCinematic({pairA, pairB})` — тот же safe-area/fallback механизм 18D/18H, что и у Feature 17B сцен | ✅ |
| 34 | Scale actor неизменен | Сцены не меняют scale персонажей — переиспользуют существующий character pipeline без модификаций | ✅ |
| 35 | UI не закрывает character safe area | Переиспользован `pickDialoguePanelSide`/`projectHeadsForShot` внутри `beginConversationCinematic` — не переопределялся | ✅ |
| 36 | Claims очищаются | `cyberStoryInteraction.test.ts` («hands control back», `chars().sceneOwned.size === 0`) | ✅ |
| 37 | Planner восстанавливается | `cyberStoryInteraction.test.ts` (`resumePlanner` в `finally`) | ✅ |

## Launcher-тесты (38–48)

| # | Проверка | Где покрыто | Статус |
|---|---|---|---|
| 38 | Launcher существует только в development/test | `App.tsx` — регистрация только под `import.meta.env.DEV`; подтверждено live dev-server прогоном | ✅ |
| 39 | Launcher отсутствует в production bundle | `e2e/cyberStoryScenes.spec.ts` («window.__startupGameDev is absent from the production bundle») — реально прогнан против `vite build && vite preview` | ✅ |
| 40 | `list` содержит четыре сцены | `cyberStoryDevLauncher.test.ts`, live browser прогон | ✅ |
| 41 | `prepare` создаёт минимальное состояние | `cyberStoryDevLauncher.test.ts` | ✅ |
| 42 | `play` запускает правильную сцену | `cyberStoryDevLauncher.test.ts`, live browser прогон (4/4 сцены) | ✅ |
| 43 | `visual-only` не применяет effects | `cyberStoryDevLauncher.test.ts`, live browser прогон | ✅ |
| 44 | production-mode `play` использует настоящий handler | `cyberStoryDevLauncher.test.ts` («full-effects play uses the real production handler») | ✅ |
| 45 | Repeated play не дублирует effects | `cyberStoryDevLauncher.test.ts` («repeated full-effects play does not duplicate effects») | ✅ |
| 46 | `reset` очищает fixture | `cyberStoryDevLauncher.test.ts` | ✅ |
| 47 | Команды из `scenes.md` проверены автоматически либо вручную | Проверены вручную через живой браузер (Playwright + `npm run dev`) перед публикацией в `scenes.md`; `list/prepare/play/resolve/playConsequence/reset` для всех 4 сцен подтверждены | ✅ |
| 48 | office-intrusion запускается через документированную команду | `scenes.md` → `office-intrusion` секция, live browser прогон (`play('office-intrusion')` → `activeSceneId === 'office-intrusion'`) | ✅ |

## E2E-сценарии

| Сценарий | Где покрыто | Статус |
|---|---|---|
| CYBER-01 (безопасный путь) | `cyberStoryIntegration.test.ts` | ✅ |
| CYBER-02 (рискованный, восстанавливаемый) | `cyberStoryIntegration.test.ts` | ✅ |
| CYBER-03 (накопленный риск) | `cyberStoryIntegration.test.ts` | ✅ |
| CYBER-04 (dev launcher, все 4 сцены, visual-only + full-effects) | Live browser прогон (Playwright против `npm run dev`), все 4 сцены (`list/prepare/play/resolve/playConsequence/reset`, включая visual-only), результаты залогированы в финальном отчёте Feature 19; `e2e/cyberStoryScenes.spec.ts` автоматизирует launcher-absence-in-production (быстрая, надёжная проверка) | ✅ (dev launcher — задокументированный ручной browser-прогон; launcher-absence — автоматизирован) |

## Найденный и исправленный дефект

При первом живом прогоне сцены (`play()` через launcher) обнаружено, что `playInsert()`/`playShot()` в `src/game/cinematics/cinematicDirector.ts` ожидали `flyTo()` без таймаута — единственный awaited camera-move во всей директорской системе без `withReadyTimeout`. Это могло подвесить ЛЮБУЮ существующую сцену (`storyDecisionInteraction.ts`, `officeIntrusion.ts`, `mvpReleaseScene.ts`, `securityBreach.ts`, `serverIncidentScenes.ts`), использующую `playInsert`/awaited `playShot`, при определённых условиях рендера. Исправлено добавлением `withReadyTimeout()` — тот же паттерн, что уже используется для `ready`/`resettle` в том же файле, с идентичным обоснованием (см. комментарий в коде). После исправления — все 3 новые сцены и office-intrusion подтверждены живым браузером; полный набор из 1256 vitest-тестов (включая существующие тесты 18D/17B) прошёл без регрессий.
