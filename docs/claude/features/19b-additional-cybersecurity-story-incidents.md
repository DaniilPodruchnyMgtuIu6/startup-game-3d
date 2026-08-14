# Feature 19B — дополнительные сюжетные киберинциденты

## Как использовать этот файл

Передай Claude Code:

- `CLAUDE.md`;
- `AGENTS.md`;
- `docs/claude/00-fixed-game-rules.md`;
- `docs/claude/00-implementation-workflow.md`;
- актуальные документы из `docs/qa/` и `docs/art/`;
- реализованную и принятую Feature 19A;
- этот файл как единственную текущую feature-итерацию.

Feature 19A должна быть завершена, проверена и принята до начала Feature 19B.

Feature 19B не переписывает первые три киберинцидента. Она добавляет ещё три сцены по другим аспектам безопасности и расширяет существующий `scenes.md`.

Новые сцены:

1. `secret-committed-to-repository` — секрет в истории Git;
2. `mfa-fatigue-attack` — MFA fatigue и активная чужая сессия;
3. `external-ai-data-disclosure` — передача кода и логов внешнему ИИ-сервису.

После Feature 19B в игре должно существовать шесть разных сюжетных киберинцидентов, не считая `office-intrusion`.

---

# Главная цель

Добавить три интересные и поучительные сюжетные сцены, которые:

- не связаны с физическим проникновением;
- не повторяют фишинг из Feature 19A;
- не повторяют supply-chain-сцену Feature 19A;
- не повторяют загрузку логов в личное облако;
- показывают разные реальные аспекты кибербезопасности;
- дают игроку конфликт между сроками, удобством, бюджетом и безопасностью;
- имеют немедленную выгоду или цену;
- создают понятные отложенные последствия;
- используют уже существующие story, Workday Flow, risk, economy и cinematic systems;
- получают короткие сюжетные вставки через фактически подключённый Higgsfield;
- полностью работают без generated video через внутриигровой fallback.

Игрок не должен получать лекцию или очевидную кнопку «сделать правильно бесплатно».

Каждая сцена должна показывать, почему небезопасное решение может казаться разумным в момент выбора.

---

# Зависимости

Перед реализацией Claude должен проверить фактическое состояние:

- Feature 17 Story Decision Core;
- Feature 19A и её три сцены;
- существующий `scenes.md`;
- dev-only scene launcher;
- Workday Flow;
- event coordinator;
- economy ledger;
- risk domains;
- AUTH, DATABASE и server consequences;
- sprint/release score;
- persist/migrations/reset;
- Cinematic Director;
- animation state machine;
- group scene synchronization;
- Higgsfield workflow и asset register.

Не создавать:

- новую параллельную систему story events;
- новую систему рисков;
- отдельный ledger;
- отдельный dialogue runner;
- второй dev launcher;
- универсальный cyber-event DSL.

---

# Общие правила трёх сцен

Каждая сцена обязана иметь:

- стабильный scene id;
- детерминированный trigger;
- story objective;
- отдельный сюжетный marker;
- статический диалог;
- 3 варианта выбора;
- role-aware реплики;
- immediate reaction;
- typed handler;
- idempotent operation id;
- balance constants;
- delayed consequence hook;
- persist;
- migration;
- reset;
- cinematic shot list;
- Higgsfield insert;
- fallback без Higgsfield;
- unit, integration и E2E-тесты;
- команды запуска в `scenes.md`.

DeepSeek не определяет:

- trigger;
- обязательные реплики;
- choices;
- последствия;
- суммы;
- effort;
- risk modifiers.

После завершения сцены DeepSeek может использоваться только для необязательного разговора, не меняющего игровую математику.

---

# Новые scene ids и choice ids

Рекомендуемые стабильные ids:

```ts
export type AdditionalCyberStoryIncidentId =
  | "secret-committed-to-repository"
  | "mfa-fatigue-attack"
  | "external-ai-data-disclosure";

export type AdditionalCyberStoryChoiceId =
  | "remove-secret-in-new-commit"
  | "rewrite-repository-history"
  | "rotate-and-secure-secret"
  | "change-password-only"
  | "revoke-sessions-and-investigate"
  | "enable-phishing-resistant-auth"
  | "allow-unrestricted-ai-tools"
  | "ban-external-ai-tools"
  | "configure-controlled-ai-gateway";
```

Если текущий проект использует другой naming style, внутренние имена можно адаптировать, но scene ids должны остаться неизменными для `scenes.md`, тестов и миграций.

---

# Balance config

Все числа добавить в существующий `src/game/balance/`.

Не хранить суммы, effort и modifiers в React, dialogue catalog или cinematic files.

Рекомендуемая исходная конфигурация:

```ts
export const ADDITIONAL_CYBER_STORY_BALANCE = {
  repositorySecret: {
    rewriteKirillEffortDays: 1,
    rewriteAlinaEffortDays: 1,
    rotationAndVaultCostRub: 90_000,
    rotationKirillEffortDays: 1,
    rotationIlyaEffortDays: 1,
    rotationWithoutIlyaExtraDays: 1,
    exposedCredentialIncidentCostRub: 140_000,
    exposedCredentialExternalUsagePenalty: 8,
  },
  mfaFatigue: {
    passwordChangeKirillEffortDays: 1,
    investigationCostRub: 50_000,
    investigationKirillEffortDays: 1,
    investigationIlyaEffortDays: 1,
    investigationWithoutIlyaSonyaEffortDays: 1,
    phishingResistantAuthCostRub: 140_000,
    phishingResistantAuthEffortDays: 2,
    hijackedSessionIncidentCostRub: 180_000,
    hijackedSessionReleasePenalty: 10,
  },
  externalAi: {
    unrestrictedAccelerationDays: 1,
    unrestrictedAccelerationUses: 2,
    banExtraEffortDays: 1,
    banAffectedTaskCount: 2,
    controlledGatewayCostRub: 120_000,
    controlledGatewayKirillEffortDays: 1,
    controlledGatewayIlyaEffortDays: 1,
    controlledGatewayWithoutIlyaExtraDays: 1,
    shadowAiAuditCostRub: 160_000,
    shadowAiReleasePenalty: 8,
  },
} as const;
```

Claude обязан проверить эти значения через существующий campaign/balance simulator.

Допустимы минимальные корректировки, если значения ломают достижимость кампании. Каждое изменение должно быть объяснено в balance report.

---

# Сцена 4 — «Ключ уже в истории»

## Scene id

```text
secret-committed-to-repository
```

## Тематика

- API-ключи и токены;
- секреты в исходном коде;
- Git history;
- credential rotation;
- secrets vault;
- secret scanning.

## Trigger

Сцена может запускаться, когда:

- Кирилл нанят;
- существует рабочая внешняя интеграция или CI credential;
- завершена минимум одна backend-задача;
- репозиторий и сборка уже участвуют в геймплее;
- сцена ещё не resolved;
- нет другого blocking event;
- не наступил финальный outcome.

Предпочтительный сюжетный момент:

- перед важной демонстрацией;
- после сбоя интеграции;
- либо после появления срочной backend-задачи.

Сцена не должна запускаться в тот же день, что `supply-chain-update`, чтобы игрок не получал два похожих технических события подряд.

## Завязка

Кирилл временно добавил API-ключ в конфигурационный файл, чтобы восстановить интеграцию.

Затем он удалил строку новым коммитом и считает проблему решённой.

Пример обязательного диалога:

```text
Кирилл:
Интеграция снова работает.
Я временно добавил ключ в конфиг, а потом удалил его новым коммитом.

Соня:
Сейчас ключа в файле уже нет?

Кирилл:
В актуальной версии — нет.
Репозиторий закрытый, доступ есть только у команды и сборки.

Алина:
Но старые версии файла всё ещё можно открыть через историю.

Илья, если нанят:
Даже если переписать историю, ключ уже нужно считать раскрытым.
Его могли сохранить сборка, кэш, fork или локальная копия.

Кирилл:
Если менять ключ и переподключать всё сейчас,
интеграция остановится перед демонстрацией.

Соня:
Тогда выбираем: быстро убрать следы или считать ключ скомпрометированным.
```

Диалог должен быть живым конфликтом, а не лекцией про Git.

## Choice A — удалить ключ новым коммитом

Choice id:

```text
remove-secret-in-new-commit
```

Немедленная выгода:

- нет задержки;
- интеграция продолжает работать;
- Кирилл возвращается к product work;
- демонстрация не переносится.

Immediate effects:

- сцена resolved;
- сохраняется `credentialExposure = "history-retained"`;
- identity-access risk увеличивается;
- governance risk увеличивается;
- создаётся delayed consequence hook;
- daily report не сообщает, что инцидент уже произошёл.

Delayed consequence:

Через несколько завершённых рабочих дней старый ключ используется из неизвестной сети.

Последствие:

- расход из balance config;
- интеграция временно ограничивается;
- Кирилл занят containment;
- release score снижается;
- следующий AUTH/server incident может получить дополнительную стоимость;
- персонажи прямо связывают событие с прошлым выбором.

## Choice B — переписать историю репозитория

Choice id:

```text
rewrite-repository-history
```

Цена:

- Кирилл теряет один рабочий день;
- Алина теряет один рабочий день на повторную синхронизацию;
- открытые ветки требуют исправления;
- product work задерживается.

Плюсы:

- секрет удаляется из доступной истории;
- снижается вероятность случайной повторной публикации;
- governance risk немного уменьшается.

Ограничение:

- ключ всё равно считается потенциально раскрытым;
- delayed consequence не исчезает полностью, но становится менее вероятным/тяжёлым детерминированным вариантом;
- не использовать случайный шанс.

Рекомендуемый consequence:

- старый credential обнаруживается в CI-cache;
- команда выполняет позднюю rotation;
- расход и downtime меньше, чем у Choice A.

## Choice C — отозвать ключ и настроить secrets management

Choice id:

```text
rotate-and-secure-secret
```

Цена:

- расход из balance config;
- Кирилл занят переподключением интеграции;
- Илья, если нанят, занят secrets workflow;
- без Ильи настройка занимает дополнительный рабочий день;
- интеграция временно недоступна.

Плюсы:

- старый ключ отзывается;
- новый ключ хранится вне репозитория;
- добавляется secret scanning;
- следующие commit attempts с secret блокируются;
- delayed incident блокируется;
- identity-access и governance risks уменьшаются.

Без Ильи вариант остаётся доступным, но стоит больше времени.

## Higgsfield-вставка

### Основная

Короткий insert:

1. крупный план редактора;
2. в конфигурации появляется замаскированный credential;
3. Кирилл делает commit;
4. следующим commit строка удаляется;
5. камера показывает timeline/history, где значение осталось в старой версии;
6. переход обратно в 3D-диалог.

Запрещено:

- показывать реальный API-key;
- использовать настоящий GitHub/GitLab branding, если нет лицензированного интерфейса;
- показывать эксплуатационные инструкции.

### Delayed consequence

- ночной график запросов;
- неизвестный клиент использует старый credential;
- растёт счёт внешней интеграции;
- затем утренний разговор команды.

## Внутриигровой fallback

Без Higgsfield использовать:

- insert shot на монитор;
- стилизованную историю коммитов;
- замаскированный credential;
- реакцию Кирилла и Ильи;
- subtitles;
- экранный индикатор неизвестного использования ключа.

## Чему учит сцена

- удаление строки новым коммитом не удаляет её из истории;
- закрытый репозиторий не является vault;
- потенциально раскрытый ключ нужно отозвать;
- secret scanning предотвращает повторение проблемы.

---

# Сцена 5 — «Подтверждение среди ночи»

## Scene id

```text
mfa-fatigue-attack
```

## Тематика

- MFA fatigue;
- credential stuffing;
- активные сессии;
- refresh tokens;
- session revocation;
- phishing-resistant authentication.

## Trigger

Сцена доступна, когда:

- Кирилл нанят;
- у команды существуют рабочие аккаунты и удалённый доступ;
- identity-access risk не находится в полностью защищённом состоянии;
- сцена `executive-phishing-request` уже resolved либо прошло достаточно игровых дней после неё;
- нет другого blocking event;
- сцена ещё не resolved.

Если игрок ранее выбрал сильную identity-защиту, сцена всё равно может произойти как более слабая попытка и положительная проверка процесса.

## Завязка

Ночью телефон Кирилла много раз просил подтвердить вход.

Утром он признаётся, что мог случайно принять одно уведомление.

Пример диалога:

```text
Кирилл:
Телефон всю ночь просил подтвердить вход.
Я несколько раз нажал «Отклонить».

Соня:
Несколько раз — это сколько?

Кирилл:
Не знаю. Уведомления шли одно за другим.
Кажется, один раз я мог нажать не туда.

Алина:
Но ты сейчас нормально вошёл в систему?

Кирилл:
Да. Я уже сменил пароль в голове раз пять,
но пока ничего не трогал.

Илья, если нанят:
Если кто-то получил активную сессию,
одной смены пароля может быть недостаточно.

Соня:
На аккаунте уже видна новая сессия с неизвестного устройства.
Решаем сейчас.
```

## Choice A — только сменить пароль

Choice id:

```text
change-password-only
```

Немедленная выгода:

- минимальная потеря времени;
- Кирилл быстро возвращается к работе;
- остальные сотрудники не выходят из систем.

Immediate effects:

- пароль считается изменённым;
- активная неизвестная сессия не отзывается;
- identity-access risk растёт;
- сохраняется `unknownSessionState = "active"`;
- создаётся delayed consequence.

Delayed consequence:

Через несколько рабочих дней неизвестная сессия:

- создаёт новый CI token;
- меняет настройку сборки;
- либо скачивает внутренний артефакт.

Не добавлять реальный вредоносный код.

Последствие:

- расход из balance config;
- расследование;
- задержка сборки;
- release score penalty;
- возможная связь с реализованной supply-chain scene.

Связь должна быть явной и ограниченной: не создавать универсальный комбинирующий engine.

## Choice B — завершить все сессии и расследовать

Choice id:

```text
revoke-sessions-and-investigate
```

Цена:

- Кирилл занят один рабочий день;
- Илья занят расследованием, если нанят;
- без Ильи Соня участвует в координации;
- часть команды временно выходит из рабочих систем;
- расход из balance config.

Плюсы:

- активные sessions и refresh tokens отзываются;
- проверяются новые credentials и изменения;
- определяется область возможного доступа;
- delayed consequence блокируется или сильно уменьшается;
- governance risk снижается.

## Choice C — внедрить устойчивую аутентификацию

Choice id:

```text
enable-phishing-resistant-auth
```

Цена:

- расход на passkeys/security keys или соответствующую инфраструктуру;
- настройка занимает несколько рабочих дней;
- сотрудникам требуется обучение;
- часть product work задерживается.

Плюсы:

- текущая неизвестная session отзывается;
- push fatigue больше не работает тем же способом;
- новые входы требуют более устойчивого подтверждения;
- identity-access risk существенно снижается;
- будущие phishing/MFA последствия ослабляются.

Без Ильи разрешён внешний или самостоятельный setup, но он медленнее. Не блокировать безопасный вариант только отсутствием роли.

## Higgsfield-вставка

### Основная

Короткая ночная вставка:

1. тёмная комната;
2. телефон Кирилла несколько раз загорается;
3. уведомления о подтверждении входа;
4. сонная рука тянется к экрану;
5. один tap остаётся визуально неоднозначным;
6. утренний переход в офис.

Не показывать реальный интерфейс конкретного поставщика MFA.

Сохранить утверждённую внешность Кирилла.

### Delayed consequence

- неизвестная активная сессия;
- создание нового CI credential;
- изменение безопасной настройки;
- затем тревожный диалог в офисе.

## Внутриигровой fallback

Без generated video:

- показать телефон и серию стилизованных уведомлений;
- использовать ночное lighting state;
- затем insert на список активных сессий;
- показать реакцию Кирилла;
- перейти к выбору.

## Чему учит сцена

- MFA можно атаковать через усталость и давление;
- смена пароля не гарантирует отзыв активной сессии;
- необходимо проверять журналы действий;
- устойчивые методы MFA сильнее простого push-confirmation.

---

# Сцена 6 — «ИИ уже нашёл ошибку»

## Scene id

```text
external-ai-data-disclosure
```

## Тематика

- Shadow AI;
- передача исходного кода внешнему сервису;
- персональные данные и секреты в prompts;
- AI usage policy;
- controlled AI gateway;
- logging и masking.

## Trigger

Сцена доступна, когда:

- Алина нанята;
- существует сложная frontend-задача или воспроизводимый UI defect;
- команда уже использует внешние инструменты разработки;
- сцена ещё не resolved;
- нет другого blocking event;
- до финального release остаётся достаточно времени для выбора и последствия.

Если ранее настроено автоматическое masking/secure log sharing, это должно повлиять на реплики и стоимость безопасного решения, но не полностью скрывать сцену.

## Завязка

Алина быстро исправляет сложный дефект с помощью личного AI assistant.

В prompt попали:

- фрагмент внутреннего компонента;
- внутренний URL;
- часть логов;
- идентификаторы сотрудников или sessions.

Пример диалога:

```text
Алина:
Я нашла ошибку.
Отправила компонент ИИ-помощнику, и он сразу показал проблему со state.

Кирилл:
Отлично. Мы бы ещё полдня это разбирали.

Илья, если нанят:
Это личный аккаунт или корпоративный?

Алина:
Личный. В рабочем инструменте слишком маленький лимит.
Я отправила только нужный компонент и часть логов.

Илья:
В этих логах есть session ids,
а в компоненте — внутренние адреса.

Соня:
Ошибка исправлена, но теперь нужен общий порядок.
Полностью запрещаем такие инструменты или делаем безопасный способ?
```

Не использовать название реального AI-провайдера.

## Choice A — разрешить внешние AI tools без ограничений

Choice id:

```text
allow-unrestricted-ai-tools
```

Немедленная выгода:

- следующие несколько задач получают небольшое ускорение;
- не требуется бюджет;
- команда довольна удобством;
- текущий дефект закрывается без задержки.

Immediate effects:

- sensitive-data risk растёт;
- governance risk растёт;
- сохраняется `shadowAiPolicy = "unrestricted"`;
- создаётся delayed consequence;
- ускорение ограничено числом применений из balance config.

Delayed consequence:

Через несколько рабочих дней внешний assistant показывает suggestion, содержащий знакомый внутренний URL или фрагмент ранее отправленного кода.

Последствие:

- расход на containment/audit;
- приостановка использования инструмента;
- release score penalty;
- дополнительный разговор о происхождении данных;
- связь с secure logging/masking, если они ранее были или не были настроены.

Не утверждать технически, что модель обязательно обучилась на данных. Формулировать корректно: команда не может подтвердить, где сохранились данные и как они были повторно использованы.

## Choice B — полностью запретить внешние AI tools

Choice id:

```text
ban-external-ai-tools
```

Плюсы:

- неконтролируемая передача прекращается;
- sensitive-data risk снижается;
- не требуется немедленный инфраструктурный расход.

Цена:

- следующие несколько задач требуют дополнительный effort;
- команда теряет удобный инструмент;
- morale показывается только качественно, без новой отдельной системы;
- остаётся hook скрытого обхода политики, если игрок не предложит альтернативу.

Отложенное последствие:

Кирилл или Алина признаются, что использовали помощника на личном устройстве для маленького фрагмента.

Это не должно автоматически создавать катастрофу. Последствие показывает, что слишком жёсткая политика без рабочего инструмента может уйти в тень.

## Choice C — настроить контролируемый AI gateway

Choice id:

```text
configure-controlled-ai-gateway
```

Цена:

- расход из balance config;
- Кирилл занят интеграцией;
- Илья, если нанят, занят правилами и masking;
- без Ильи настройка занимает дополнительный день;
- внедрение не происходит мгновенно.

Плюсы:

- секреты и персональные данные блокируются или маскируются;
- доступны только утверждённые модели;
- появляется журнал использования;
- команда сохраняет ограниченное ускорение;
- delayed consequence блокируется;
- governance и sensitive-data risks снижаются.

Если secure log sharing уже реализован, переиспользовать существующий masking use-case вместо дублирования.

## Higgsfield-вставка

### Основная

1. крупный план рабочего экрана Алины;
2. код копируется в вымышленный AI assistant;
3. вместе с кодом незаметно попадают строки логов;
4. assistant быстро выделяет ошибку;
5. камера показывает довольную Алину;
6. затем реакцию Ильи или Сони, заметивших содержимое prompt;
7. возврат к 3D-выбору.

Не показывать:

- реальный бренд;
- настоящий код проекта;
- реальные данные;
- API-key;
- эксплуатационные инструкции.

### Delayed consequence

- assistant предлагает знакомый внутренний фрагмент;
- Алина узнаёт URL/структуру;
- команда не может определить источник повторного появления;
- затем обязательный 3D-диалог.

## Внутриигровой fallback

- стилизованный вымышленный AI UI;
- замаскированные строки;
- camera insert;
- реакция Алины;
- worried reaction Ильи/Сони;
- subtitles;
- дальнейший выбор в 3D.

## Чему учит сцена

- полезный AI tool может создавать риск передачи данных;
- prompts могут содержать код, secrets, PII и внутреннюю архитектуру;
- полный запрет без альтернативы может породить скрытое использование;
- controlled gateway позволяет сохранить пользу и управляемость.

---

# Связи с Feature 19A

Связи должны быть явными, но ограниченными.

Разрешённые связи:

## `secret-committed-to-repository`

- централизованные логи помогают быстрее обнаружить использование старого ключа;
- supply-chain incident может стать дороже при существующем раскрытом credential;
- `suspicious-activity-disclosure` влияет на скорость реакции.

## `mfa-fatigue-attack`

- результат `executive-phishing-request` может усиливать персонализацию атаки;
- сильная identity-защита ослабляет consequence;
- захваченная session может добавить ограниченный modifier к CI/supply-chain incident.

## `external-ai-data-disclosure`

- secure log sharing уменьшает объём чувствительных данных в prompt;
- security training улучшает реакцию персонажей;
- controlled gateway переиспользует masking, а не создаёт второй механизм.

Запрещено создавать универсальную матрицу всех возможных сочетаний.

Каждая связь должна быть реализована явным selector/handler и покрыта тестом.

---

# Event priority

Не запускать более одной blocking scene одновременно.

Сохранить принятый coordinator order.

Feature 19B должна находиться рядом с Feature 19A story incidents и не обходить:

- обязательные Feature 17 consequences;
- server incident;
- sprint review;
- terminal outcome.

Рекомендуемое правило выбора внутри киберинцидентов:

```text
готовая delayed consequence
→ unresolved earlier Feature 19A scene
→ unresolved Feature 19B scene
→ optional ambient beat
```

Не запускать две новые сцены в один рабочий день.

Между крупными security scenes должен существовать хотя бы один обычный завершённый рабочий день, если иной порядок не требуется существующим coordinator.

---

# Workday Flow

Когда активна обязательная сцена:

- создаётся одна главная objective;
- появляется сюжетный marker;
- DeepSeek interaction скрывается для ведущего NPC;
- automatic day completion блокируется;
- ambient activity прерывается;
- участники занимают cinematic slots;
- камера ждёт готовности actors;
- после resolve сцена освобождает claims;
- planner восстанавливается;
- день продолжается по существующим правилам.

Не завершать рабочий день автоматически сразу после выбора, если в текущем Workday Flow остаются другие обязательные действия.

---

# Cinematic production

Для каждой сцены создать:

```text
docs/art/cinematics/{scene-id}/
  scene-brief.md
  shot-list.md
  storyboard/
  approved-keyframes/
  higgsfield-prompts.md
  implementation-notes.md
  acceptance.md
```

## Правила

- video insert короткий;
- выбор всегда происходит в интерактивной 3D-сцене;
- персонажи сохраняют approved identity;
- scale персонажей не изменяется;
- камера не смотрит в пустоту;
- лица не перекрываются dialogue UI;
- generated asset не является единственным носителем важной информации;
- каждый insert имеет fallback;
- повторное воспроизведение использует готовый asset и не вызывает Higgsfield снова.

## Shot language

### Secret in history

- monitor insert;
- medium shot Кирилла;
- over-the-shoulder на историю commit;
- reaction Ильи/Алины;
- group shot перед выбором.

### MFA fatigue

- ночной phone insert;
- утренний medium close-up Кирилла;
- screen insert активной session;
- reaction shot;
- two-shot или group shot перед выбором.

### External AI

- monitor insert;
- close-up Алины;
- reaction Ильи/Сони;
- over-the-shoulder на prompt;
- group shot перед выбором.

---

# Расширение scenes.md

Обновить существующий корневой файл:

```text
scenes.md
```

Не создавать второй документ с командами.

После Feature 19B он обязан содержать семь сцен:

```text
executive-phishing-request
supply-chain-update
shadow-it-log-upload
secret-committed-to-repository
mfa-fatigue-attack
external-ai-data-disclosure
office-intrusion
```

Для каждой новой сцены документировать:

1. prerequisites;
2. prepare state;
3. full-effects запуск;
4. visual-only запуск;
5. запуск каждого choice;
6. запуск delayed consequence;
7. reset;
8. ожидаемый результат;
9. manual visual checks;
10. persist/reload check.

## Команды должны быть настоящими

Claude обязан сначала найти существующий launcher из Feature 19A и расширить его.

Не создавать новый launcher.

Допустимые формы зависят от фактического проекта:

- debug panel;
- console API;
- URL command;
- npm script;
- Playwright fixture runner.

`scenes.md` должен содержать буквальные проверенные команды проекта, а не псевдокод.

## Обязательные launcher capabilities

Для новых сцен:

- `list`;
- `prepare`;
- `play`;
- `play --visual-only` или эквивалент;
- `choose`;
- `consequence`;
- `reset`;
- optional `status`.

Launcher:

- существует только в development/test;
- отсутствует в production bundle;
- использует production handlers;
- не дублирует effects;
- не обходит ledger;
- не обходит risk store;
- поддерживает reset;
- не вызывает Higgsfield при playback готового asset.

## Обновление list

После Feature 19B команда списка должна возвращать семь сцен, включая `office-intrusion`.

---

# Persist и migration

Добавить migration только для новых полей.

Старые сохранения Feature 19A:

- продолжают загружаться;
- не получают retroactive immediate effects;
- не получают внезапные delayed consequences без trigger;
- могут получить новые сцены только если их игровой момент ещё не прошёл и trigger остаётся корректным.

Для сохранений позднее финального окна:

- не запускать обязательные новые сцены задним числом;
- отметить их как migration-skipped или equivalent state;
- не блокировать release/outcome.

Сохранять:

- scene status;
- selected choice;
- immediate effects applied;
- delayed consequence state;
- consequence applied;
- relevant bounded modifier;
- cinematic watched/skipped только если это уже принято в проекте.

Не сохранять:

- camera transforms;
- animation actions;
- temporary actor claims;
- raw Higgsfield state.

---

# Идемпотентность

Для каждой сцены использовать стабильные operation ids:

```text
cyber-story:{sceneId}:{choiceId}
cyber-consequence:{sceneId}:{consequenceId}
```

Повторный вызов не должен создавать:

- вторую transaction;
- второй risk signal;
- вторую task;
- дополнительный effort;
- повторный modifier;
- вторую delayed consequence;
- другой selected choice.

Проверить:

- double click;
- repeated console command;
- reload до handler completion;
- reload после effects;
- repeated consequence command;
- reset;
- запуск visual-only после full-effects;
- запуск full-effects после visual-only.

---

# Unit tests

Минимум:

## Catalog и triggers

1. три новых scene ids зарегистрированы;
2. trigger каждой сцены достижим;
3. trigger не срабатывает повторно после resolve;
4. одновременно активно не более одной blocking scene;
5. сцены не запускаются после terminal outcome;
6. соблюдается минимальный интервал между крупными cyber scenes.

## Choices

7. все девять choices зарегистрированы;
8. repeated resolve идемпотентен;
9. balance constants используются handlers;
10. role-aware effort корректен с Ильёй и без него;
11. risky choice создаёт delayed hook;
12. safe choice блокирует или уменьшает hook;
13. partial choice не ошибочно считается полным устранением риска.

## Secrets scene

14. remove-only сохраняет credential exposure;
15. rewrite-history уменьшает, но не обнуляет exposure;
16. rotate-and-secure отзывает credential;
17. secret scanning modifier добавляется один раз;
18. delayed external use применяет расход один раз.

## MFA scene

19. password-only не отзывает unknown session;
20. revoke-and-investigate очищает session;
21. phishing-resistant auth создаёт mitigation;
22. repeated session consequence не создаёт второй CI token/effect;
23. связь с supply-chain ограничена одним modifier.

## External AI scene

24. unrestricted создаёт bounded acceleration;
25. acceleration не применяется бесконечно;
26. ban добавляет только заданный bounded effort;
27. controlled gateway переиспользует masking;
28. delayed disclosure не утверждает неподтверждённое обучение модели;
29. audit cost применяется один раз.

---

# Integration tests

30. Workday Flow блокируется активной сценой;
31. marker указывает на правильного NPC;
32. DeepSeek скрыт во время обязательной сцены;
33. planner освобождает activity claims;
34. camera ждёт actor readiness;
35. safe fallback включается при invalid target;
36. scale actor не меняется;
37. dialogue UI не закрывает лица;
38. после scene planner восстанавливается;
39. daily report отражает immediate result;
40. delayed consequence отражается в будущем report;
41. persist сохраняет choice и hook;
42. reset очищает новые состояния;
43. миграция Feature 19A работает.

---

# Launcher tests

44. launcher из Feature 19A переиспользован;
45. второй launcher не создан;
46. `list` содержит семь scene ids;
47. prepare создаёт минимальное состояние;
48. visual-only не применяет деньги/риски/tasks;
49. full-effects использует production handler;
50. choose поддерживает все девять новых choices;
51. consequence запускает правильный delayed event;
52. repeated commands идемпотентны;
53. reset очищает fixture;
54. production build не содержит launcher;
55. все команды из `scenes.md` выполнены буквально.

---

# Cinematic tests

56. каждая сцена работает без video insert;
57. video insert не пропускает choice;
58. camera target валиден;
59. fallback group shot существует;
60. character scale неизменен;
61. subtitles/choices не перекрывают лица;
62. planner и claims очищаются;
63. asset register содержит generated assets;
64. rejected assets не импортируются.

---

# E2E-сценарии

## CYBER-B-01 — зрелая защита

```text
rotate and secure secret
→ revoke sessions and investigate
→ configure controlled AI gateway
→ delayed incidents blocked
→ normal release
```

## CYBER-B-02 — быстрые решения

```text
remove secret in new commit
→ change password only
→ allow unrestricted AI tools
→ three delayed consequences
→ campaign remains playable but budget and release score worsen
```

## CYBER-B-03 — частичные меры

```text
rewrite repository history
→ revoke sessions and investigate
→ ban external AI tools
→ reduced credential consequence
→ no session hijack
→ later shadow-use dialogue
```

## CYBER-B-04 — связи с Feature 19A

```text
phishing data sent in 19A
→ MFA fatigue becomes more targeted
→ immediate dependency update in 19A
→ unknown session adds one bounded CI modifier
→ consequence applies once
```

## CYBER-B-05 — scenes.md

Выполнить документированные команды для всех семи сцен:

1. `executive-phishing-request`;
2. `supply-chain-update`;
3. `shadow-it-log-upload`;
4. `secret-committed-to-repository`;
5. `mfa-fatigue-attack`;
6. `external-ai-data-disclosure`;
7. `office-intrusion`.

Для новых сцен проверить:

- visual-only;
- full-effects;
- каждый choice;
- delayed consequence;
- reset.

---

# Ручная приёмка

Для каждой новой сцены:

1. trigger понятен по сюжету;
2. сцена не появляется одновременно с другой blocking scene;
3. objective приводит к правильному NPC;
4. marker отличается от DeepSeek;
5. Higgsfield insert короткий;
6. fallback передаёт ту же информацию;
7. персонажи находятся в согласованных позициях;
8. камера показывает говорящего;
9. listeners реагируют;
10. лица не закрыты UI;
11. scale не меняется;
12. choices имеют понятный компромисс;
13. немедленная реакция соответствует выбору;
14. delayed consequence происходит позже;
15. персонажи связывают consequence с прошлым решением;
16. reload не дублирует effects;
17. reset очищает сцену;
18. после сцены NPC возвращаются к офисной жизни.

Для `scenes.md`:

1. выполнить команды без исправления вручную;
2. проверить семь scene ids;
3. проверить visual-only;
4. проверить full-effects;
5. проверить choices;
6. проверить consequences;
7. проверить reset;
8. убедиться, что launcher отсутствует в production.

---

# Обязательные документы

Создать:

```text
docs/qa/19b-additional-cyber-story-test-matrix.md
docs/qa/19b-additional-cyber-story-balance-report.md
docs/art/cinematics/secret-committed-to-repository/
docs/art/cinematics/mfa-fatigue-attack/
docs/art/cinematics/external-ai-data-disclosure/
```

Обновить:

```text
scenes.md
docs/art/generated-asset-register.md
docs/art/animation-library.md          # только если добавлены clips
docs/qa/visual-known-issues.md
campaign simulator / QA scenario catalog
persist migration documentation
```

Не создавать `scenes-19b.md` или второй launcher-document.

---

# Что запрещено

Не добавлять:

- новые физические проникновения;
- новый intruder;
- случайные вероятности consequences;
- реальный вредоносный код;
- реальные credentials;
- реальные данные сотрудников;
- реальный бренд AI-сервиса;
- инструкции по обходу MFA;
- универсальный cyber-event engine;
- новый risk store;
- новый economy store;
- второй scene launcher;
- launcher в production;
- обязательную зависимость прохождения от Higgsfield;
- generated choices через DeepSeek;
- бесконечное ускорение разработки от AI;
- бесконечный effort penalty от запрета AI.

Не менять:

- положение whiteboard;
- существующие сцены Feature 19A, кроме минимальной интеграции и исправления воспроизводимых ошибок;
- `office-intrusion`, кроме сохранения совместимости launcher;
- условия победы и поражения;
- базовый баланс Feature 01–19A без отчёта.

---

# Порядок реализации

Работать волнами.

## Wave 1 — архитектура и launcher extension

- проверить Feature 19A;
- проверить `scenes.md`;
- проверить dev launcher;
- зарегистрировать три ids;
- добавить balance constants;
- добавить persist schema/migration;
- добавить catalog/handlers/selectors;
- не реализовывать cinematic assets до прохождения core tests.

## Wave 2 — secret scene

- trigger;
- dialogue;
- choices;
- immediate effects;
- delayed consequence;
- cinematic fallback;
- Higgsfield insert;
- tests;
- commands в `scenes.md`.

## Wave 3 — MFA scene

- trigger;
- dialogue;
- choices;
- session state;
- delayed consequence;
- cinematic fallback;
- Higgsfield insert;
- tests;
- commands в `scenes.md`.

## Wave 4 — external AI scene

- trigger;
- dialogue;
- choices;
- bounded acceleration/penalty;
- delayed consequence;
- masking reuse;
- cinematic fallback;
- Higgsfield insert;
- tests;
- commands в `scenes.md`.

## Wave 5 — full QA

- seven-scene launcher list;
- all literal commands;
- E2E paths;
- balance simulator;
- migration;
- reset;
- two full runs;
- production build;
- secret scan.

Не переходить к следующей wave, пока исправимые ошибки текущей wave не устранены.

---

# Команды проверки

Использовать scripts из фактического `package.json`.

Выполнить доступные аналоги:

```bash
npm test
npm run test:e2e
npm run lint
npm run typecheck
npm run build
```

Также:

```bash
git diff --check
git status --short
```

Проверить production bundle на отсутствие:

- dev launcher;
- Higgsfield API-key;
- других secrets;
- local env values.

Не выполнять `git push`.

---

# Критерии готовности

Feature 19B завершена только если:

- Feature 19A не сломана;
- добавлены три разные по смыслу сцены;
- каждая сцена имеет 3 choices;
- безопасные choices имеют цену;
- risky choices дают немедленную выгоду;
- delayed consequences детерминированы;
- связи с Feature 19A ограничены и протестированы;
- balance constants вынесены;
- Higgsfield inserts соответствуют art bible;
- каждый insert имеет fallback;
- персонажи не меняют scale;
- камера не показывает пустые кадры;
- Workday Flow восстанавливается;
- persist/migration/reset работают;
- `scenes.md` расширен до семи сцен;
- команды `scenes.md` реально проверены;
- visual-only не применяет effects;
- full-effects идемпотентен;
- launcher отсутствует в production;
- unit/integration/E2E проходят;
- два полных прогона проходят;
- production build проходит.

---

# Формат ответа Claude Code

```md
## Итог Feature 19B

## Проверка Feature 19A

## Реализованные сцены

### secret-committed-to-repository
- trigger
- dialogue
- choices
- immediate effects
- delayed consequence
- Higgsfield insert
- fallback
- tests

### mfa-fatigue-attack
- trigger
- dialogue
- choices
- immediate effects
- delayed consequence
- Higgsfield insert
- fallback
- tests

### external-ai-data-disclosure
- trigger
- dialogue
- choices
- immediate effects
- delayed consequence
- Higgsfield insert
- fallback
- tests

## Связи с Feature 19A

## Story Decision и coordinator integration

## Workday Flow

## Balance changes

## Persist, migration и reset

## Higgsfield assets

| Scene | Asset | Tool/model | Production path | Fallback |
|---|---|---|---|---|

## Обновлённый scenes.md

### Семь доступных сцен

### Проверенные команды

## Dev launcher

## Unit tests

## Integration tests

## E2E

## Visual QA

## Balance simulator

## Первый полный прогон

## Второй полный прогон

## Production build

## Созданные файлы

## Изменённые файлы

## Исправленные проблемы Feature 19A

## Оставшиеся ограничения

## Git status
```

Не переходить к следующей Feature.
