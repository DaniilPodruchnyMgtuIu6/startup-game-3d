# Feature 19B — отчёт по балансу (`ADDITIONAL_CYBER_STORY_BALANCE`)

## Источник истины

Все суммы, сроки, effort и risk impacts трёх новых сцен вынесены в `src/game/balance/additionalCyberStoryBalance.ts` — отдельный файл от Feature 19A's `cyberStoryBalance.ts` (та же организация, что у Feature 17A/17B: базовый balance-файл не редактируется, новая фича добавляет свой). Ни один handler (`cyberStoryHandlers.ts`'s `resolveSecretChoice`/`resolveMfaFatigueChoice`/`resolveExternalAiChoice`), ни один consequence-обработчик (`cyberStoryConsequences.ts`), ни один risk-signal builder (`cyberStoryRiskSignals.ts`) не содержит магических чисел для 19B — все читают `ADDITIONAL_CYBER_STORY_BALANCE.*`.

Перед добавлением значений сверены существующие суммы Feature 19A (`cyberStoryBalance.ts`) — новые значения выбраны в том же порядке величины, не изменяют ни одну существующую 19A/17A/17B/11 константу.

## Величины и обоснование

### repositorySecret

| Константа | Значение | Обоснование |
|---|---|---|
| `removeIdentityAccessImpact` / `removeGovernanceImpact` | 2 / 2 | Равно `executivePhishing.sendGovernanceImpact/sendIdentityImpact` — ключ формально «удалён», но не устранён, тот же порядок неустранённого риска |
| `rewriteKirillEffortDays` / `rewriteAlinaEffortDays` | 1 / 1 | Стандартный однодневный шаг на каждого участника (пересинхронизация веток — реальная, но небольшая работа) |
| `rewriteGovernanceMitigation` / `rewriteIdentityAccessImpact` | −1 / 1 | Rewrite снижает риск (небольшая митигация governance), но НЕ обнуляет identity-access impact — ключ мог остаться в fork/кэше, явно требуется feature-файлом |
| `rotationAndVaultCostRub` | 90 000 ₽ | Между `shadowItLogs.secureSharingCostRub = 80 000` и `mfaFatigue.investigationCostRub` (ниже) — построение secrets management сопоставимо по стоимости с построением защищённого процесса передачи логов |
| `rotationKirillEffortDays` / `rotationIlyaEffortDays` / `rotationWithoutIlyaExtraDays` | 1 / 1 / 1 | Стандартный шаг; без Ильи Кирилл тратит на 1 день больше на самостоятельную настройку scanning |
| `rotationIdentityAccessMitigation` / `rotationGovernanceMitigation` | −3 / −2 | Сильнейшая митигация среди трёх вариантов — единственный choice, реально отзывающий ключ |
| `exposedUseDelayWorkdaysAfterRemove` | 3 | Короче, чем after-rewrite — ключ полностью доступен в истории, найдут быстрее |
| `exposedUseDelayWorkdaysAfterRewrite` | 5 | Дольше — переписанная история усложняет обнаружение оставшейся копии (fork/кэш), но не отменяет риск |
| `exposedCredentialIncidentCostRub` | 140 000 ₽ | Равно `mfaFatigue`-класса инцидентов среднего масштаба (см. ниже); внешнее использование живого ключа — серьёзный, но управляемый инцидент |
| `exposedCredentialIncidentCostRubAfterRewrite` | 60 000 ₽ | Меньше — найден в CI-кэше ДО реального внешнего использования, дешевле сдержать |
| `exposedCredentialExternalUsagePenalty` | 8 | Сопоставимо с `mfaFatigue.hijackedSessionReleasePenalty` (10) — оба «ключ/сессия реально использованы кем-то посторонним» |
| `exposedCredentialIdentityAccessImpact` | 2 | Consequence подтверждает исходный impact, не удваивает |
| `unrotatedCredentialAuthIncidentCostRub` | 60 000 ₽ | Сопоставимо с `executivePhishing.followUpAuthIncidentCostRub = 70 000` — тот же класс «неустранённый риск дорожает будущий AUTH-инцидент» |

### mfaFatigue

| Константа | Значение | Обоснование |
|---|---|---|
| `passwordChangeKirillEffortDays` | 1 | Стандартный однодневный шаг |
| `passwordOnlyIdentityAccessImpact` | 3 | Равно `shadowItLogs.uploadSensitiveDataImpact = 3` — «минимальная реакция» оставляет риск того же серьёзного порядка, что и полный игнор в других сценах |
| `investigationCostRub` | 50 000 ₽ | Меньше `rotationAndVaultCostRub` (90 000) — расследование дешевле полной инфраструктурной замены |
| `investigationKirillEffortDays` / `investigationIlyaEffortDays` / `investigationWithoutIlyaSonyaEffortDays` | 1 / 1 / 1 | Стандартный шаг на каждого участника |
| `investigationGovernanceMitigation` / `investigationIdentityAccessMitigation` | −2 / −2 | Средняя митигация — расследование снижает риск, но не так сильно, как постоянная mitigation-мера |
| `phishingResistantAuthCostRub` | 140 000 ₽ | Равно `repositorySecret.exposedCredentialIncidentCostRub` — постоянная инфраструктурная мера того же масштаба, что серьёзный инцидент |
| `phishingResistantAuthEffortDays` / `phishingResistantAuthWithoutIlyaExtraDays` | 2 / 1 | Соответствует `supplyChainUpdate.reviewEffortDays = 2`; без Ильи — на день больше |
| `phishingResistantAuthIdentityAccessMitigation` | −4 | Сильнейшая митигация среди трёх вариантов — единственный choice, реально устраняющий класс атаки |
| `hijackedSessionDelayWorkdays` | 3 | Середина диапазона 2–4 дня (тот же диапазон, что у Feature 19A consequences) |
| `hijackedSessionIncidentCostRub` | 180 000 ₽ | Выше `repositorySecret.exposedCredentialIncidentCostRub` (140 000) — захваченная сессия внутри CI/деплоя серьёзнее одного внешнего ключа |
| `hijackedSessionReleasePenalty` | 10 | Наибольший release-score штраф среди 19B-последствий — самый серьёзный из трёх сценариев |
| `hijackedSessionServiceContinuityImpact` | 2 | Сопоставимо с `supplyChainUpdate.installServiceContinuityImpact = 2` — деплой/CI задет тем же порядком |
| `hijackedSessionSupplyChainCostRub` | 50 000 ₽ | Ограниченный (не катастрофический) modifier к будущему GATEWAY/DATABASE инциденту — меньше основного инцидентного расхода |

### externalAi

| Константа | Значение | Обоснование |
|---|---|---|
| `unrestrictedAccelerationDays` / `unrestrictedAccelerationUses` | 1 / 2 | Суммарно 2 дня ускорения — заметно, но ограничено; тот же порядок, что `keep-shared-architecture`'s разовая экономия в Feature 17B |
| `unrestrictedSensitiveDataImpact` | 3 | Равно `shadowItLogs.uploadSensitiveDataImpact = 3` — прямая утечка компонента/логов внешнему сервису, тот же класс риска |
| `unrestrictedGovernanceImpact` | 2 | Сопоставимо с `shadowItLogs.uploadGovernanceImpact = 2` |
| `banExtraEffortDays` | 1 | Стандартный однодневный шаг адаптации без инструмента |
| `banAffectedTaskCount` | 2 | Документирует масштаб трения (flavour/reporting), не отдельный множитель — feature-файл явно запрещает «второй множитель на задачу» |
| `banSensitiveDataMitigation` | −1 | Небольшая митигация — запрет прекращает НОВУЮ утечку, но не отменяет уже произошедшую |
| `controlledGatewayCostRub` | 120 000 ₽ | Между `repositorySecret.rotationAndVaultCostRub` (90 000) и `mfaFatigue.phishingResistantAuthCostRub` (140 000) — сопоставимая по масштабу постоянная инфраструктурная мера |
| `controlledGatewayKirillEffortDays` / `controlledGatewayIlyaEffortDays` / `controlledGatewayWithoutIlyaExtraDays` | 1 / 1 / 1 | Стандартный шаг на каждого участника |
| `controlledGatewaySensitiveDataMitigation` / `controlledGatewayGovernanceMitigation` | −3 / −2 | Сильнейшая митигация среди трёх вариантов |
| `unrestrictedRecurrenceDelayWorkdays` | 3 | Середина диапазона 2–4 дня |
| `shadowUseDelayWorkdaysAfterBan` | 5 | Дольше — переход в тень занимает время, это НЕ мгновенное следствие запрета |
| `shadowAiAuditCostRub` | 160 000 ₽ | Наибольший разовый расход среди 19B-последствий — аудит и приостановка неограниченного использования требует пересмотра всей истории использования, не одного инцидента |
| `shadowAiReleasePenalty` | 8 | Сопоставимо с `repositorySecret.exposedCredentialExternalUsagePenalty` (8) |
| `shadowAiGovernanceImpact` | 2 | Сопоставимо с другими governance-последствиями того же масштаба |

## Проверка достижимости побед/поражений

Полный vitest-набор (1331 тест, включая все существующие balance/outcome/simulation-тесты Feature 01–19A) после добавления `ADDITIONAL_CYBER_STORY_BALANCE` и интеграции в `cyberStoryHandlers.ts`/`cyberStoryConsequences.ts`/`cyberStoryEffectSelectors.ts` — **без регрессий**. В частности:

- `gameOutcomeStore`/`registerGameFailure`-тесты (поражения по бюджету/дедлайну/простою) — не затронуты: Feature 19B добавляет **опциональные** расходы (50 000–180 000 ₽ разово, не ежедневно), того же порядка, что уже существующие Feature 19A (60 000–150 000 ₽) и Feature 08–12 штрафы (120 000–500 000 ₽);
- `releaseOfficeFlowMvp`/campaign-success тесты — новая функция `getCyberStoryReleaseScoreAdjustment()` суммируется с существующей `getStoryReleaseScoreAdjustment()` в единственной точке вызова (`buildCampaignSuccessSnapshot`); максимальный совокупный штраф от всех трёх 19B-последствий (8+10+8=26) не превышает существующий диапазон штрафов Feature 13 (0–100 нормировано через `clampScore`);
- максимальный совокупный расход при **самом рискованном** прохождении всех трёх новых сцен (все risky-варианты + все последствия) — 140 000 (credential usage) + 180 000 (hijacked session) + 160 000 (AI recurrence) = 480 000 ₽ разово — на порядок меньше стартового бюджета (`INITIAL_BUDGET = 2 500 000 ₽`), проигрыш от одних Feature 19B сцен невозможен, что и требует feature-файл;
- `allow-unrestricted-ai-tools`'s ускорение (`applyStoryEffortReduction`, максимум 2 дня за прохождение) не может создать «бесконечное ускорение» — вызывается РОВНО один раз при resolve, идемпотентно (повторный resolve не переприменяет), покрыто `cyberStoryStore.test.ts`'s repeated-resolve тестами и `cyberStoryHandlers.test.ts`.

Численные константы Feature 01–19A (`cyberStoryBalance.ts`, `storyBalance.ts`, `securityBalance.ts`, `economyBalance.ts`, `timelineBalance.ts`) не изменялись.

Детерминированный сценарный симулятор Feature 15 (`tools/balance/campaignSimulator.ts`, `tools/balance/campaignScenarios.test.ts`) прогнан после всех изменений 19B — 6/6 сценариев проходят без регрессий (симулятор не драйвит cyber-story сцены — они опциональный сюжетный контент вне детерминированного ядра бюджета/продукта/аудитов, тот же статус, что у Feature 19A).
