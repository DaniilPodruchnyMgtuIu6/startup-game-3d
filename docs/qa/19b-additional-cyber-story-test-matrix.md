# Feature 19B — тестовая матрица (три дополнительных киберинцидента)

Статус: READY (см. итоги ниже). Соответствует чек-листу feature-файла `docs/claude/features/19b-additional-cybersecurity-story-incidents.md`. Расширяет `docs/qa/19-cyber-story-test-matrix.md` (Feature 19A) — тот же launcher, тот же `scenes.md`, ноль изменений в трёх сценах 19A кроме минимальной интеграции (см. «Найденные и исправленные проблемы 19A» ниже).

Полный прогон: `npx tsc --noEmit && npx vitest run && npm run build && npx playwright test` — 179 vitest test files / 1336 тестов, 11/11 e2e тестов, 0 failing, production build проходит.

## Аудит Feature 19A перед началом 19B

| Область | Статус | Найденная проблема | Исправление |
|---|---|---|---|
| Три сцены работают end-to-end | ✅ | — | — |
| `scenes.md` существует и команды реально проверены | ✅ | — | — |
| Launcher поддерживает visual-only/full-effects | ✅ | — | — |
| Launcher отсутствует в production | ✅ (`e2e/cyberStoryScenes.spec.ts`) | — | — |
| Reset существует и работает | ✅ | — | — |
| Effects не дублируются (idempotent) | ✅ | — | — |
| Persist/reload работает | ✅ | — | — |
| Higgsfield fallback работает | ✅ | — | — |
| MVP release gating учитывает pending cyber-story инцидент/последствие | ❌ | `gatherReleaseReadinessSnapshot()` никогда не проверял `isCyberStoryBlockingNow()`/`isCyberConsequencePending()` — игрок мог выпустить MVP с непрочитанным обязательным маркером сцены на карте | Добавлен `MvpReleaseBlockingReason: 'cyber-story-incident-pending'` + поле снапшота, проверка в `evaluateMvpReleaseReadiness`, реальное значение в `releaseOfficeFlowMvp.ts::gatherReleaseReadinessSnapshot`. Regression-тесты: `mvpReleaseRules.test.ts` («readiness — cyber story (Feature 19)»), `mvpReleaseIntegration.test.ts` (4 новых теста: pending available, resolved-снова-ready, pending consequence, completed-consequence-снова-ready) | ✅ исправлено |
| Полный e2e-регресс (`npx playwright test`) против уже принятой Feature 19A | ❌ | Общий e2e seed-хелпер `e2e/helpers.ts::seedCampaign` (используется ВСЕМИ e2e-спеками, не только cyber-story) никогда не учитывал появление Feature 19A: `executive-phishing-request` становится доступна, как только оба разработчика наняты и день > 1 — ровно то состояние, что сидируют существующие Feature 16 тесты `e2e/workday.spec.ts` (`sprintNumber: 2, day: 1` и `day: 2`). Сцена требует физического клика по маркеру (по дизайну — как и все Feature 17/19 blocking-сцены), поэтому `completeWorkday()` бессрочно отказывал в завершении дня в тестах без единого клика — «Планёрка спринта 2» и «Итоги дня» никогда не появлялись, оба теста падали по таймауту | `seedCampaign` теперь сидирует `startup-office-cyber-story` со всеми шестью инцидентами (19A + 19B) уже `resolved` — тот же паттерн, что уже используется для `securityBreach`/`postAuditConversation` (сидируются `completed` по той же причине). Загруженная из storage `resolved`-запись не переприменяет эффекты выбора (`normalizeRecord` восстанавливает только статус), поэтому бюджет/риски в других e2e-тестах не затронуты. Подтверждено полным прогоном `npx playwright test` — 11/11 зелёных (было 9/11 до исправления) | ✅ исправлено |

Ещё три дефекта найдены и исправлены уже в процессе реализации 19B — см. «Найденные и исправленные проблемы 19B» ниже.

## Общая архитектура (1–8)

| # | Проверка | Где покрыто | Статус |
|---|---|---|---|
| 1 | 6 incident id уникальны, каталог покрывает priority list | `cyberStoryRules.test.ts` (`cyberCatalogMatchesPriority`, size 6) | ✅ |
| 2 | Каталог содержит все 18 choices (9 старых + 9 новых) | `cyberStoryRules.test.ts` | ✅ |
| 3 | 8 consequence id распознаются (`isCyberConsequenceId`) | `cyberStoryRules.test.ts` | ✅ |
| 4 | Одна сцена→несколько возможных последствий (secret, external-ai) корректно планируется/сбрасывается | `cyberStoryStore.test.ts` («clears BOTH possible consequences...») | ✅ |
| 5 | Не-boolean флаги (`CredentialExposureState`/`UnknownSessionState`/`ShadowAiPolicy`) сохраняются/загружаются/сбрасываются корректно | `cyberStoryStore.test.ts` (save/load round-trip, corrupt-value rejection, `resetIncident` generic reset) | ✅ |
| 6 | `CYBER_STORY_INCIDENT_PRIORITY`/store/launcher/controller не потребовали структурных изменений | Подтверждено диффом: `cyberStoryStore.ts`, `cyberStoryDevLauncher.ts`, `CyberStoryController.tsx` — только новые catalog/dialogue/handler/rule записи, ноль новых сторов/движков | ✅ |
| 7 | Отсутствие циклического импорта handlers↔linkedEffects↔store | `CyberStoryFlags`/`initialCyberStoryFlags` вынесены в leaf-модуль `cyberStoryTypes.ts`; `cyberStoryLinkedEffects.ts` принимает `flags` параметром, не читает store сам | ✅ (структурная проверка + `npx tsc --noEmit` подтверждает отсутствие циклов) |
| 8 | Event priority: два крупных cyber-story сцены не открываются в один день | `evaluateCyberStoryUnlocks.test.ts` («event spacing», 2 теста) | ✅ |

## secret-committed-to-repository (9–17)

| # | Проверка | Где покрыто | Статус |
|---|---|---|---|
| 9 | Trigger: Кирилл нанят + реальный завершённый backend-таск, spacing | `cyberStoryRules.test.ts`, `evaluateCyberStoryUnlocks.test.ts` | ✅ |
| 10 | `remove-secret-in-new-commit` НЕ считается удалением из истории | `cyberStoryHandlers.test.ts` (`credentialExposureState === 'history-retained'`) | ✅ |
| 11 | `rewrite-repository-history` снижает, но не обнуляет риск (`'reduced'`, не `'rotated'`) | `cyberStoryHandlers.test.ts` | ✅ |
| 12 | `rotate-and-secure-secret` — настоящая ротация, без последствия | `cyberStoryHandlers.test.ts` (`scheduledConsequences` пуст для обоих id) | ✅ |
| 13 | remove/rewrite планируют РАЗНЫЕ последствия с разным сроком | `cyberStoryHandlers.test.ts` (`external-credential-usage` за 3 дня, `credential-found-in-ci-cache` за 5 дней) | ✅ |
| 14 | Central logging сокращает срок до последствия | `cyberStoryHandlers.test.ts` («central logging shortens... by one workday») | ✅ |
| 15 | Unrotated credential дорожает будущий AUTH-инцидент | `cyberStoryEffectSelectors.test.ts` | ✅ |
| 16 | Диалог различает три состояния текстом (не просто "удалить/не удалить") | `cyberStoryDialogues.test.ts` (regex на ключевые слова hint) | ✅ |
| 17 | Dev launcher + live browser | `cyberStoryDevLauncher.test.ts`, `cyberStoryInteraction.test.ts`, живой браузер (`rotate-and-secure-secret` → resolved, 0 console errors) | ✅ |

## mfa-fatigue-attack (18–26)

| # | Проверка | Где покрыто | Статус |
|---|---|---|---|
| 18 | Trigger: Кирилл нанят + реальный первый прототип + не kickoff-день + phishing resolved ИЛИ спринт ≥ 2, spacing | `cyberStoryRules.test.ts`, `evaluateCyberStoryUnlocks.test.ts` | ✅ |
| 19 | `change-password-only` НЕ отзывает неизвестную сессию автоматически | `cyberStoryHandlers.test.ts` (`unknownSessionState === 'active'`) | ✅ |
| 20 | `revoke-sessions-and-investigate` отзывает сессию, без Ильи — Кирилл+Соня | `cyberStoryHandlers.test.ts` | ✅ |
| 21 | `enable-phishing-resistant-auth` отзывает сессию, без Ильи — Кирилл дольше (одно назначение) | `cyberStoryHandlers.test.ts` | ✅ |
| 22 | Связь с 19A: сильная phishing-защита (`escalate-phishing-to-security`) снижает impact вдвое | `cyberStoryHandlers.test.ts`, `cyberStoryLinkedEffects.test.ts` | ✅ |
| 23 | Отложенное последствие может создать ограниченный modifier к CI/supply-chain (без вредоносного кода) | `cyberStoryEffectSelectors.test.ts` (`hijackedSessionSupplyChainCostRub` → GATEWAY/DATABASE), никакого исполняемого кода нигде в реализации | ✅ |
| 24 | Диалог явно предупреждает, что сессия не отозвана автоматически | `cyberStoryDialogues.test.ts` (hint regex `/не отзыва/`) | ✅ |
| 25 | Никаких реальных инструкций обхода MFA в тексте | Ручная проверка диалога (`cyberStoryDialogues.ts::mfaFatigueScene`) — только последствия описаны, ни одного шага атаки | ✅ |
| 26 | Dev launcher + live browser | `cyberStoryDevLauncher.test.ts`, `cyberStoryInteraction.test.ts`, живой браузер (`revoke-sessions-and-investigate` → resolved, 0 console errors) | ✅ |

## external-ai-data-disclosure (27–36)

| # | Проверка | Где покрыто | Статус |
|---|---|---|---|
| 27 | Trigger: Алина нанята + реальный завершённый frontend-таск, спринт ≤ 5, spacing | `cyberStoryRules.test.ts`, `evaluateCyberStoryUnlocks.test.ts` | ✅ |
| 28 | `allow-unrestricted-ai-tools` — ограниченное одноразовое ускорение (не бесконечное) | `cyberStoryHandlers.test.ts` (точная сумма `days*uses`, единственный вызов `applyStoryEffortReduction`) | ✅ |
| 29 | `ban-external-ai-tools` — ограниченный effort penalty, не блокирует прохождение | `cyberStoryHandlers.test.ts` | ✅ |
| 30 | `configure-controlled-ai-gateway` — маскирование + allowlist, сохраняет частичную пользу | `cyberStoryHandlers.test.ts` | ✅ |
| 31 | Shadow-use beat после ban — наблюдение, НЕ вторая кара (без cost/risk) | `cyberStoryConsequences.test.ts` («deliberate no-op») | ✅ |
| 32 | Связь с 19A: secure log masking снижает sensitive-data impact | `cyberStoryHandlers.test.ts`, `cyberStoryLinkedEffects.test.ts` | ✅ |
| 33 | Ни одного реального названия AI-сервиса в диалоге/hints/последствиях | `cyberStoryDialogues.test.ts` (brand-name regex), `cyberStoryConsequences.ts` — ручной аудит текста | ✅ |
| 34 | `unrestricted-ai-recurrence` НЕ утверждает обучение модели на данных команды | `cyberStoryConsequences.test.ts` (regex «не можем точно сказать\|не знаем точно») | ✅ |
| 35 | Security training (17A) добавляет флейвор-строку, переиспользуя существующий контекст (не дублирующий селектор) | `cyberStoryDialogues.test.ts` | ✅ |
| 36 | Dev launcher + live browser | `cyberStoryDevLauncher.test.ts`, `cyberStoryInteraction.test.ts`, живой браузер (`configure-controlled-ai-gateway` → resolved, 0 console errors) | ✅ |

## MVP release gating (37)

| # | Проверка | Где покрыто | Статус |
|---|---|---|---|
| 37 | Pending/available cyber-story инцидент или незавершённое последствие блокирует выпуск MVP; release score учитывает 19B-штрафы | `mvpReleaseRules.test.ts`, `mvpReleaseIntegration.test.ts`, `cyberStoryEffectSelectors.test.ts` (`getCyberStoryReleaseScoreAdjustment`) | ✅ |

## Launcher-тесты (38–43)

| # | Проверка | Где покрыто | Статус |
|---|---|---|---|
| 38 | `list()` содержит все 7 сцен (6 cyber + office-intrusion) | `cyberStoryDevLauncher.test.ts`, живой браузер | ✅ |
| 39 | `play()` работает для 19B-сцены через тот же production handler | `cyberStoryDevLauncher.test.ts` («Feature 19B scene... through the same real handler») | ✅ |
| 40 | `resolve()` работает для 19B-сцены без 3D-прогулки | `cyberStoryDevLauncher.test.ts` | ✅ |
| 41 | `reset()` сбрасывает не-boolean флаги 19B-сцены до initial | `cyberStoryDevLauncher.test.ts` | ✅ |
| 42 | `playConsequence()` работает для 19B-последствия | `cyberStoryDevLauncher.test.ts` | ✅ |
| 43 | Второй launcher НЕ создан — тот же `window.__startupGameDev.scenes`, тот же `scenes.md` | Диф подтверждает: `cyberStoryDevLauncher.ts` не создан заново, только `DEV_SCENE_IDS` автоматически расширился через `CYBER_STORY_INCIDENT_PRIORITY`; `scenes.md` обновлён (не заменён) | ✅ |

## Найденные и исправленные проблемы Feature 19B (в процессе реализации)

1. **Дублирующийся `occupy()` вызов молча терялся.** `resolveSecretChoice`'s `rotate-and-secure-secret` (без Ильи) и `resolveExternalAiChoice`'s `configure-controlled-ai-gateway` (без Ильи) изначально вызывали `occupy(ctx, 'kirill-morozov', ...)` дважды в одной ветке — оба раза с одинаковым `id: "${operationId}:kirill-morozov"`. `storyWorkStore.addAssignmentOnce` дедуплицирует строго по `id`, поэтому второй вызов тихо возвращал `added: false`, и Кирилл получал только базовые дни без "без-Ильи" надбавки. Исправлено объединением в один вызов `occupy` с суммой дней — тот же паттерн, что уже использовался в `enable-phishing-resistant-auth`. Оба места покрыты явными тестами, проверяющими `assignments.filter(...).toHaveLength(1)` с суммарным `remainingDays`.
2. **Same-call staleness в `evaluateCyberStoryUnlocks`.** Функция читала `useCyberStoryStore.getState()` один раз в начале и переиспользовала этот снапшот для дневного spacing-чека (`anyOtherIncidentTriggeredToday`) даже ПОСЛЕ того, как более ранний `tryUnlock` в том же вызове уже разблокировал другую сцену через `cyber.unlockIncident(...)`. Из-за этого две крупные cyber-story сцены могли открыться в один и тот же вызов/день, нарушая явное правило «Event priority». Исправлено: `tryUnlock` и все три новых spacing-чека теперь читают `useCyberStoryStore.getState()` заново при каждом обращении. Regression-тест: `evaluateCyberStoryUnlocks.test.ts` («event spacing: two otherwise-eligible cyber scenes never both unlock on the same relative workday»).
3. **`mfa-fatigue-attack` trigger слишком ранний — сломал два существующих Feature 16 e2e-теста.** Первая версия `canUnlockMfaFatigueAttack` требовала только `kirillHired && (phishingResolved || sprintNumber >= 2)`, без привязки к реальному игровому прогрессу и без защиты от kickoff-дня. Полный прогон `npx playwright test` вскрыл, что это заставляло сцену открываться уже на спринте 2 дне 1 при одном найме Кирилла — то есть ровно в состоянии, которое сидируют `e2e/workday.spec.ts`'s `seedCampaign(page, { sprintNumber: 2, day: 1|2 })` — и новая обязательная сцена перехватывала кадр у планёрки спринта/автозавершения дня («Планёрка спринта 2» и «Итоги дня» переставали появляться, оба теста падали по таймауту). Исправлено: добавлено требование `hasFirstPrototype` (реальная рабочая система входа — без неё MFA-усталость атаковать нечего) и `day > 1` (та же защита от kickoff-дня, что уже есть у `executive-phishing-request`). Regression обнаружен и исправлен ДО передачи фичи — оба e2e-теста Feature 16 подтверждены зелёными повторным прогоном `npx playwright test` (см. «E2E / live browser» ниже). Unit-тесты обновлены (`cyberStoryRules.test.ts`, `evaluateCyberStoryUnlocks.test.ts` — добавлены 2 новых negative-теста на отсутствие прототипа и на kickoff-день).

## E2E / live browser

Как и в Feature 19A, полный walk-based E2E (marker→walk→dialogue) для новых сцен не добавлен — та же задокументированная причина (медленно/нестабильно под headless SwiftShader в этой песочнице). Вместо этого:
- `cyberStoryInteraction.test.ts` прогоняет реальные `runCyberStoryConversation`/`runCyberStoryConversationVisualOnly` для всех трёх новых сцен (полный диалог + выбор + resolve + Ilya-gating);
- живая браузерная сессия (Playwright + `npm run dev`, вне репозитория) прогнала все 7 сцен через `window.__startupGameDev.scenes` — `list()` вернул корректные 7 записей, все три новые сцены дошли до `status: 'resolved'` с ожидаемыми флагами, **0 console errors**;
- `e2e/cyberStoryScenes.spec.ts` (production-bundle launcher-absence) не требует изменений — новые сцены не меняют, что регистрируется под `import.meta.env.DEV`;
- полный прогон `npx playwright test` (весь существующий e2e-набор, не только Feature 19) — **11/11 зелёных** после исправления `seedCampaign` (см. аудит выше). Дважды прогнан: первый прогон вскрыл 2 падения в `workday.spec.ts` (регрессия, найденная и исправленная в процессе — см. «Найденные и исправленные проблемы» в обеих таблицах), второй прогон после исправлений — чисто.
