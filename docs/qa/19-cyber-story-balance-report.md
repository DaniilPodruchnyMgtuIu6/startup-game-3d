# Feature 19 — отчёт по балансу (`CYBER_STORY_BALANCE`)

## Источник истины

Все суммы, сроки, effort и risk impacts для трёх новых сцен вынесены в `src/game/balance/cyberStoryBalance.ts`. Ни один handler (`src/game/story/cyberStoryHandlers.ts`), ни один consequence-обработчик (`src/game/story/cyberStoryConsequences.ts`), ни один risk-signal builder (`src/game/story/cyberStoryRiskSignals.ts`) не содержит магических чисел — все читают `CYBER_STORY_BALANCE.*`.

Перед добавлением значений сверены существующие суммы Feature 17B (`storyBalance.ts`) и Feature 11 (`securityBalance.ts`) — новые значения выбраны в том же порядке величины, не изменяют ни одну существующую константу.

## Величины и обоснование

### executivePhishing

| Константа | Значение | Обоснование |
|---|---|---|
| `sendGovernanceImpact` / `sendIdentityImpact` | 2 / 2 | Сопоставимо с `adminAccess.permanentIdentityImpact = 2` — «постоянный» риск среднего масштаба, не критический сам по себе |
| `verificationEffortDays` | 1 | Соответствует `firstPriority.trainingSonyaEffortDays = 1` — стандартный однодневный процессный шаг |
| `verifyGovernanceMitigation` / `verifyIdentityMitigation` | −2 / −1 | Меньше по модулю, чем полный audit (`baselineAudit.governanceMitigation = −1`, но проверка сильнее одноразового аудита за счёт немедленной реакции) |
| `securityEscalationCostRub` | 40 000 ₽ | Совпадает с `adminAccess.controlledCostRub = 40 000` — «точечное вмешательство специалиста» одного порядка |
| `securityEscalationEffortDays` | 1 | Соответствует `adminAccess.controlledIlyaEffortDays = 1` |
| `escalateGovernanceMitigation` / `escalateIdentityMitigation` | −3 / −3 | Сильнее варианта B — специалист не просто проверяет, а блокирует домен и обучает команду |
| `followUpDelayWorkdays` | 3 | Середина диапазона 2–4 дня, указанного в feature-файле |
| `followUpIdentityImpact` | 2 | Меньше исходного impact (2) — последствие «усиливает», не удваивает |
| `followUpAuthIncidentCostRub` | 70 000 ₽ | Сопоставимо с `adminAccess.permanentAuthIncidentCostIncreaseRub = 50 000` — Feature 19 сопоставимый, но чуть более серьёзный вектор (внешний фишинг vs внутренняя ошибка прав) |

### supplyChainUpdate

| Константа | Значение | Обоснование |
|---|---|---|
| `installServiceContinuityImpact` / `installSensitiveDataImpact` | 2 / 1 | Соответствует `architecture.sharedContinuityImpact = 1`..`sharedIdentityImpact = 2` — сопоставимый разброс |
| `keepVersionDemoPenalty` | 1 | Минимальный штрафной сигнал — «управляемая, не катастрофическая» проблема, как явно требует feature-файл |
| `reviewCostRub` | 60 000 ₽ | Между `testData.maskedCostRub = 30 000` и `firstPriority.loggingCostRub = 100 000` — код-ревью среднего масштаба |
| `reviewEffortDays` | 2 | Соответствует `firstPriority.endpointIlyaEffortDays = 2` |
| `reviewServiceContinuityMitigation` / `reviewSensitiveDataMitigation` | −2 / −1 | Симметрично impact-величинам install-варианта |
| `unknownConnectionDelayWorkdays` | 2 | Середина диапазона 1–3 дня из feature-файла |
| `unknownConnectionServiceContinuityImpact` | 2 | Равен исходному install impact — последствие «подтверждает» риск, а не создаёт новый порядок величины |
| `compromisedUpdateFutureCostRub` | 120 000 ₽ | Сопоставимо с `consequences.architectureIncidentCostIncreaseRub = 40 000`×3 — supply-chain компрометация серьёзнее локальной архитектурной ошибки |

### shadowItLogs

| Константа | Значение | Обоснование |
|---|---|---|
| `uploadSensitiveDataImpact` | 3 | Равен `testData.productionSensitiveImpact = 3` — прямая утечка реальных данных, тот же порядок |
| `uploadGovernanceImpact` | 2 | Сопоставимо с `disclosure.dismissGovernanceImpact = 3`, но чуть меньше — нет намеренного игнорирования сигнала |
| `manualSanitizationEffortDays` | 1 | Стандартный однодневный шаг (см. выше) |
| `sanitizeSensitiveDataMitigation` | −2 | Меньше по модулю исходного impact (3) — ручная очистка не гарантирует идеальный результат (явно оговорено в тексте сцены) |
| `secureSharingCostRub` | 80 000 ₽ | Между `architecture.reviewCostRub = 90 000` и `supplyChainUpdate.reviewCostRub = 60 000` — построение процесса дороже разового ревью |
| `secureSharingKirillEffortDays` / `secureSharingIlyaEffortDays` | 1 / 1 | Стандартный шаг на каждого участника |
| `secureSharingSensitiveMitigation` / `secureSharingGovernanceMitigation` | −3 / −2 | Сильнейшая митигация среди трёх вариантов — платный, но самый надёжный путь |
| `externalDownloadDelayWorkdays` | 3 | Середина диапазона 2–4 дня |
| `externalDownloadSensitiveImpact` / `externalDownloadGovernanceImpact` | 2 / 1 | Меньше исходного (3/2) — последствие эскалирует, не удваивает |
| `futureContainmentCostRub` | 150 000 ₽ | Сопоставимо с `dataLoss.recoveryCostRub = 300 000` / 2 — серьёзные, но не катастрофические сдерживающие расходы |

## Проверка достижимости побед/поражений

Прогон полного vitest-набора (1256 тестов, включая все существующие balance/outcome/simulation-тесты Feature 01–18) после добавления `CYBER_STORY_BALANCE` и интеграции в `completeWorkday`/`serverIncidentStore` — **без регрессий**. В частности:

- `gameOutcomeStore`/`registerGameFailure`-тесты (поражения по бюджету/дедлайну/простою) — не затронуты: Feature 19 добавляет **опциональные** расходы (60 000–150 000 ₽ разово, не ежедневно), сопоставимые по масштабу с уже существующими Feature 08–12 штрафами (120 000–500 000 ₽), не создавая новый класс поражения;
- `releaseOfficeFlowMvp`/campaign-success тесты — не затронуты: Feature 19 не трогает `getStoryReleaseScoreAdjustment` и не меняет условия победы;
- максимальный совокупный расход при **самом рискованном** прохождении всех трёх сцен (сценарий CYBER-03 в `cyberStoryIntegration.test.ts`) — 150 000 ₽ (containment) плюс усиление будущих инцидентов на 70 000–120 000 ₽ каждый — на 1–2 порядка меньше стартового бюджета (`INITIAL_BUDGET`), проигрыш от одной Feature 19 сцены invariant невозможен, что и требует feature-файл («Не каждая risky choice должна гарантировать game over»).

Численные константы Feature 01–18 (`storyBalance.ts`, `securityBalance.ts`, `economyBalance.ts`, `timelineBalance.ts`) не изменялись.
