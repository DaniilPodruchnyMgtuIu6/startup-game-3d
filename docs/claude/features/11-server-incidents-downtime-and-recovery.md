# Feature 11 — серверные инциденты, простой и восстановление

## Как использовать этот файл

Передай Claude Code только этот feature-файл вместе с доступом к актуальному репозиторию.

Постоянные правила проекта должны быть подключены через корневой `CLAUDE.md`:

- `AGENTS.md`;
- `docs/claude/00-implementation-workflow.md`;
- `docs/claude/00-fixed-game-rules.md`.

Не передавай Claude Code инструкции следующих фич.

---

# Предварительные условия

Feature 01–10 должны быть завершены и приняты.

В проекте уже должны работать:

- относительное игровое время;
- спринты и единая операция завершения рабочего дня;
- бюджет и финансовый журнал;
- технический backlog OfficeFlow;
- команда и условный найм Ильи;
- security findings и assignments;
- повторные аудиты;
- скрытые actual/detected risks;
- risk domains:
  - `service-continuity`;
  - `identity-access`;
  - `sensitive-data`;
- серверные стойки GATEWAY, AUTH и DATABASE;
- серверные мини-игры;
- история успешных и неуспешных попыток;
- risk signals серверных мини-игр;
- daily report;
- whiteboard;
- система кат-сцен;
- сохранение, миграции и reset через `?intro`.

Если имена файлов, rack ids, stores или функций отличаются, используй существующую реализацию. Не создавай параллельную систему серверов.

---

# Роль Claude Code

Сначала изучи актуальный проект.

Обязательно найди:

- `AGENTS.md`;
- корневой `CLAUDE.md`;
- документы из `docs/claude/`;
- `package.json`;
- реализацию Feature 01–10;
- единый `completeWorkday`;
- порядок access-control, security, product, economy, audit и risk расчётов;
- server store;
- rack ids;
- состояния стоек;
- историю попыток мини-игр;
- способ определить успешную стабилизацию стойки;
- адаптер server → risk signals;
- team-store;
- product progress Кирилла;
- security assignments;
- вкладку `Безопасность`;
- financial transaction categories;
- Director API и registry кат-сцен;
- blocking overlays;
- persist, hydration, migrations и reset.

Перед изменением кода верни:

1. как определяется текущее состояние GATEWAY, AUTH и DATABASE;
2. как отличить ошибки после последней успешной стабилизации;
3. как результаты мини-игр сохраняются после reload;
4. как Кирилл исключается из product progress;
5. как Илья исключается из другой security work;
6. где расширить финансовые категории;
7. где подключить trigger серверных сцен;
8. какие файлы планируется создать;
9. какие файлы планируется изменить.

После анализа реализуй только Feature 11.

---

# Цель итерации

Сделать существующие серверные ошибки реальными управленческими последствиями.

Feature 11 должна:

1. детерминированно формировать угрозу инцидента из состояния стойки и actual risk;
2. давать игроку время исправить стойку до события;
3. запускать однократную сцену конкретного серверного инцидента;
4. списывать немедленные расходы на реагирование;
5. создавать продолжающийся простой до восстановления;
6. требовать назначить сотрудника на восстановление;
7. отвлекать назначенного сотрудника от продукта и другой security work;
8. ежедневно списывать стоимость простоя;
9. закрывать инцидент после нужного числа рабочих дней;
10. добавлять risk signals инцидента и восстановления;
11. корректно обрабатывать несколько pending-инцидентов;
12. не завершать игру автоматически.

Feature 12 использует накопленный ущерб, длительный простой и бюджет для поражений.

---

# 1. Поддерживаемые инциденты

Создай каталог ровно из трёх инцидентов.

Рекомендуемое имя:

`src/game/serverIncidentCatalog.ts`

## Типы

```ts
export type ServerIncidentId =
  | "gateway-outage"
  | "auth-account-incident"
  | "database-exposure-review";

export type ServerRackId =
  | "gateway"
  | "auth"
  | "database";

export type ServerIncidentDefinition = {
  id: ServerIncidentId;
  rackId: ServerRackId;
  title: string;
  description: string;
  riskDomain:
    | "service-continuity"
    | "identity-access"
    | "sensitive-data";
  immediateCostWithSecuritySpecialist: number;
  immediateCostWithoutSecuritySpecialist: number;
  downtimeCostPerDay: number;
  eligibleEmployeeIds: string[];
  recoveryEffortWithoutSecuritySpecialist: number;
  recoveryEffortWithSecuritySpecialist: number;
};
```

---

# 2. GATEWAY — отказ внешнего доступа

```ts
{
  id: "gateway-outage",
  rackId: "gateway",
  title: "Отказ внешнего шлюза",
  description:
    "Ошибочная или нестабильная конфигурация шлюза сделала OfficeFlow недоступным из офисной сети.",
  riskDomain: "service-continuity",
  immediateCostWithSecuritySpecialist: 80_000,
  immediateCostWithoutSecuritySpecialist: 120_000,
  downtimeCostPerDay: 40_000,
  eligibleEmployeeIds: ["kirill-morozov"],
  recoveryEffortWithoutSecuritySpecialist: 2,
  recoveryEffortWithSecuritySpecialist: 1,
}
```

Илья не является исполнителем восстановления GATEWAY.

При его наличии Кирилл быстрее локализует причину, поэтому трудоёмкость уменьшается с 2 до 1 дня.

---

# 3. AUTH — блокировка и подозрительные сессии

```ts
{
  id: "auth-account-incident",
  rackId: "auth",
  title: "Инцидент с учётными записями",
  description:
    "Часть сотрудников потеряла доступ, а в журнале появились подозрительные административные сессии.",
  riskDomain: "identity-access",
  immediateCostWithSecuritySpecialist: 100_000,
  immediateCostWithoutSecuritySpecialist: 170_000,
  downtimeCostPerDay: 30_000,
  eligibleEmployeeIds: [
    "kirill-morozov",
    "ilya-vlasov",
  ],
  recoveryEffortWithoutSecuritySpecialist: 2,
  recoveryEffortWithSecuritySpecialist: 1,
}
```

Если Илья нанят, восстановление может выполнять:

- Кирилл — 1 рабочий день;
- Илья — 1 рабочий день.

Без Ильи восстановление выполняет Кирилл за 2 дня.

---

# 4. DATABASE — проверка возможного раскрытия данных

```ts
{
  id: "database-exposure-review",
  rackId: "database",
  title: "Подозрение на раскрытие данных",
  description:
    "В журналах базы обнаружены запросы, которые могли вывести служебные или пользовательские данные.",
  riskDomain: "sensitive-data",
  immediateCostWithSecuritySpecialist: 160_000,
  immediateCostWithoutSecuritySpecialist: 260_000,
  downtimeCostPerDay: 50_000,
  eligibleEmployeeIds: [
    "kirill-morozov",
    "ilya-vlasov",
  ],
  recoveryEffortWithoutSecuritySpecialist: 3,
  recoveryEffortWithSecuritySpecialist: 2,
}
```

Feature 11 не утверждает, что произошла подтверждённая утечка.

Это расследование и ограничение доступа до проверки.

---

# 5. Состояние серверных инцидентов

Создай отдельный Zustand-store.

Рекомендуемое имя:

`src/game/serverIncidentStore.ts`

## Статусы угрозы

```ts
export type ServerIncidentStatus =
  | "dormant"
  | "armed"
  | "pending"
  | "running"
  | "recovery-required"
  | "recovering"
  | "resolved";
```

## Состояние одного инцидента

```ts
export type ServerIncidentState = {
  incidentId: ServerIncidentId;
  status: ServerIncidentStatus;

  armedAtWorkdayIndex?: number;
  dueWorkdayIndex?: number;

  triggeredAt?: StoryMoment;
  resolvedAt?: StoryMoment;

  hadSecuritySpecialistAtIncident?: boolean;

  assignedEmployeeId?: string;
  recoveryProgressDays: number;

  immediateCostTransactionId?: string;
  effectsApplied: boolean;
};
```

## История рабочих дней

```ts
export type ServerRecoveryWorkdayRecord = {
  id: string;
  sprintNumber: number;
  day: number;
  incidentResults: {
    incidentId: ServerIncidentId;
    employeeId?: string;
    beforeProgressDays?: number;
    afterProgressDays?: number;
    completed?: boolean;
    idleReason?: "no-assignee";
  }[];
  downtimeTransactionIds: string[];
};
```

## Store

```ts
export type ServerIncidentStore = {
  incidents: Record<
    ServerIncidentId,
    ServerIncidentState
  >;

  workdayHistory: ServerRecoveryWorkdayRecord[];

  reconcileServerIncidentThreats(
    context: ServerIncidentThreatContext
  ): ReconcileServerThreatsResult;

  markServerIncidentRunning(
    incidentId: ServerIncidentId,
    moment: StoryMoment,
    hasSecuritySpecialist: boolean
  ): StoryTransitionResult;

  resolveServerIncidentScene(
    incidentId: ServerIncidentId,
    moment: StoryMoment
  ): ResolveServerIncidentSceneResult;

  assignServerRecovery(
    incidentId: ServerIncidentId,
    employeeId: string
  ): AssignServerRecoveryResult;

  unassignServerRecovery(
    incidentId: ServerIncidentId
  ): AssignServerRecoveryResult;

  applyServerRecoveryWorkday(
    sprintNumber: number,
    day: number
  ): ApplyServerRecoveryWorkdayResult;

  markServerIncidentSceneFailed(
    incidentId: ServerIncidentId
  ): void;

  resetServerIncidents(): void;
};
```

---

# 6. Начальное состояние

Для каждого инцидента:

```ts
{
  status: "dormant",
  recoveryProgressDays: 0,
  effectsApplied: false,
}
```

Инцидент одного типа происходит максимум один раз.

`resolved` является финальным статусом.

---

# 7. Нестабильное состояние стойки

Создай чистый adapter поверх существующей истории.

Рекомендуемое имя:

`src/game/serverIncidentRules.ts`

```ts
export type RackStabilitySnapshot = {
  rackId: ServerRackId;
  failedAttemptsAfterLastSuccess: number;
  hasSuccessfulStabilization: boolean;
};

export function getRackStabilitySnapshot(
  rackId: ServerRackId,
  history: ExistingServerAttemptHistory
): RackStabilitySnapshot;
```

Стойка считается нестабильной, если:

```text
после последней успешной попытки
накоплено минимум 2 неуспешных попытки
```

Если успешной попытки ещё не было:

```text
учитываются все сохранённые ошибки
```

Третья и последующие ошибки не усиливают условие, но сохраняются в существующей истории.

Не изменяй формат истории мини-игр без необходимости.

---

# 8. Условия вооружения угрозы

Для каждого инцидента одновременно нужны:

```text
actual risk level соответствующего domain >= high
стойка нестабильна
инцидент status dormant
```

Тогда:

```ts
status = "armed";
armedAtWorkdayIndex = currentWorkdayIndex;
dueWorkdayIndex = currentWorkdayIndex + 4;
```

Зафиксированная задержка:

```ts
export const SERVER_INCIDENT_DELAY_DAYS = 4;
```

Это даёт:

- без Ильи — обычно минимум один день после обнаружения;
- с Ильёй — больше времени на реакцию;
- отсутствие случайного момента события.

---

# 9. Отмена вооружённой угрозы

Пока status `armed`, угроза возвращается в `dormant`, если до due:

- actual risk стал ниже `high`;
- стойка успешно стабилизирована;
- число ошибок после последнего успеха стало меньше 2.

При отмене очистить:

- `armedAtWorkdayIndex`;
- `dueWorkdayIndex`.

Если условия позже возникнут снова:

- угроза вооружается заново;
- начинается новый четырёхдневный срок.

---

# 10. Переход в pending

Если одновременно:

```text
status === armed
currentWorkdayIndex >= dueWorkdayIndex
actual risk >= high
стойка всё ещё нестабильна
```

то:

```ts
status = "pending";
```

Pending создаётся после результатов завершённого дня.

Сам инцидент не разрешается внутри `completeWorkday`.

---

# 11. Несколько инцидентов

Несколько угроз могут быть armed одновременно.

Несколько инцидентов могут стать pending в один день.

Сцены запускаются по фиксированному приоритету:

1. `gateway-outage`;
2. `auth-account-incident`;
3. `database-exposure-review`.

Не создавай универсальный event engine.

Добавь чистый selector:

```ts
export function getNextPendingServerIncident(
  incidents: ServerIncidentState[]
): ServerIncidentState | undefined;
```

После завершения одной сцены trigger может запустить следующую, когда UI снова свободен.

Review открывается только после разрешения всех обязательных pending-событий.

---

# 12. Приоритеты событий

После завершения рабочего дня:

1. daily report;
2. follow-up audit;
3. office intrusion;
4. server incidents по фиксированному порядку;
5. sprint review.

Если более приоритетное событие pending/running, серверная сцена ждёт.

---

# 13. Trigger серверных сцен

Создай один trigger:

```ts
ServerIncidentTrigger
```

или:

```ts
useServerIncidentTrigger
```

Условия:

- существует pending server incident;
- daily report закрыт;
- follow-up audit не pending/running;
- office intrusion не pending/running;
- другая cutscene не запущена;
- server minigame закрыта;
- blocking overlay закрыт;
- blocking dialogue закрыт;
- hydration завершена.

Trigger подключается один раз на верхнем игровом уровне.

Не подключай его внутри rack component или whiteboard.

---

# 14. Общая структура сцен

Добавь три короткие кат-сцены:

```text
server-gateway-outage
server-auth-account-incident
server-database-exposure-review
```

Используй:

- Director API;
- Соню;
- Кирилла;
- Илью, если нанят;
- существующую серверную;
- обычную диалоговую систему.

Не добавляй choices.

Не добавляй новых постоянных NPC.

---

# 15. Сцена GATEWAY

Последовательность:

1. у стойки GATEWAY включается аварийная индикация;
2. Соня сообщает, что OfficeFlow недоступен;
3. Кирилл подходит к серверной;
4. при наличии Ильи он помогает локализовать небезопасное изменение;
5. игрок получает задачу восстановления.

Без Ильи:

```text
Соня:
OfficeFlow недоступен из офисной сети.
Команда не может проверить текущую сборку.

Кирилл:
Шлюз меняли вручную несколько раз.
Теперь придётся восстанавливать рабочую конфигурацию
и проверять маршруты заново.
```

С Ильёй:

```text
Илья:
Я нашёл изменение, после которого шлюз стал нестабильным.
Кириллу всё равно нужно восстановить конфигурацию,
но причину мы уже локализовали.
```

---

# 16. Сцена AUTH

Без Ильи:

```text
Соня:
Несколько сотрудников потеряли доступ к OfficeFlow.
В журналах есть подозрительные административные сессии.

Кирилл:
Сначала придётся отозвать активные сессии
и перепроверить права всех служебных учётных записей.
```

С Ильёй:

```text
Илья:
Я ограничил подозрительные сессии
и подготовил список учётных записей для проверки.

Илья:
Теперь нужно восстановить доступ
и закрыть причину появления лишних разрешений.
```

---

# 17. Сцена DATABASE

Без Ильи:

```text
Соня:
В журналах базы есть запросы,
которые могли вывести лишние данные.

Кирилл:
Пока не закончим проверку,
часть операций придётся ограничить.
```

С Ильёй:

```text
Илья:
Я ограничил подозрительные запросы
и зафиксировал журналы для расследования.

Илья:
Подтверждённой утечки пока нет,
но базу нужно проверить до снятия ограничений.
```

Не утверждай подтверждённую утечку.

---

# 18. Немедленные расходы

При первом разрешении сцены создаётся одна transaction.

Добавь категорию:

```ts
"server-incident"
```

ID:

```text
server-incident:{incidentId}
```

Title:

- GATEWAY — `Аварийное реагирование: отказ шлюза`;
- AUTH — `Аварийное реагирование: учётные записи`;
- DATABASE — `Расследование инцидента базы данных`.

Суммы:

| Инцидент | С Ильёй | Без Ильи |
|---|---:|---:|
| GATEWAY | 80 000 ₽ | 120 000 ₽ |
| AUTH | 100 000 ₽ | 170 000 ₽ |
| DATABASE | 160 000 ₽ | 260 000 ₽ |

`hadSecuritySpecialistAtIncident` фиксируется при `pending -> running`.

Поздний найм Ильи не меняет уже выбранную сумму.

---

# 19. Переход к восстановлению

После сцены:

```ts
status = "recovery-required";
```

Создаётся department task:

## GATEWAY

```ts
{
  id: "recover-gateway-service",
  title: "Восстановить внешний шлюз OfficeFlow",
  done: false,
}
```

## AUTH

```ts
{
  id: "contain-auth-account-incident",
  title: "Восстановить доступ и проверить учётные записи",
  done: false,
}
```

## DATABASE

```ts
{
  id: "investigate-database-exposure",
  title: "Проверить базу и журналы после инцидента",
  done: false,
}
```

Tasks не дублируются.

---

# 20. Панель восстановления

Во вкладке `Безопасность` добавь раздел:

```text
Инфраструктурные инциденты
```

Карточка unresolved-инцидента показывает:

```text
Отказ внешнего шлюза
Сервис ограничен

Простой: 40 000 ₽ за рабочий день
Восстановление: 0/2

Исполнитель:
[Кирилл Морозов]
```

Для AUTH и DATABASE список может включать Илью, если он был нанят.

Не скрывай Илью из выбора только потому, что на момент инцидента его не было. Если он нанят после сцены, его можно назначить на оставшуюся работу.

Немедленная стоимость инцидента остаётся неизменной.

---

# 21. Исполнители восстановления

## GATEWAY

Только Кирилл.

Трудоёмкость:

```text
без Ильи на момент инцидента: 2 дня
с Ильёй на момент инцидента: 1 день
```

## AUTH

Кирилл или Илья.

Трудоёмкость:

```text
без Ильи на момент инцидента: 2 дня
с Ильёй на момент инцидента: 1 день
```

Если Илья появился позже, effort не пересчитывается задним числом.

## DATABASE

Кирилл или Илья.

Трудоёмкость:

```text
без Ильи на момент инцидента: 3 дня
с Ильёй на момент инцидента: 2 дня
```

---

# 22. Ограничение одной security work

Расширь существующий selector активной security work.

Сотрудник не может в один день одновременно:

- исправлять audit finding;
- внедрять СКУД;
- восстанавливать server incident.

Добавь тип:

```ts
export type SecurityWorkAssignment =
  | {
      kind: "finding";
      id: string;
    }
  | {
      kind: "access-control";
      id: "access-control";
    }
  | {
      kind: "server-recovery";
      id: ServerIncidentId;
    };
```

Не создавай универсальный ресурсный планировщик.

---

# 23. Назначение

Назначение разрешено, если:

- incident status `recovery-required` или `recovering`;
- employee входит в eligible list;
- employee нанят или является Соней;
- employee не занят другой security work;
- incident ещё не resolved;
- follow-up audit и cutscene не running.

Назначение:

- не двигает время;
- не списывает деньги;
- не создаёт progress;
- можно снять или сменить;
- progress сохраняется при смене;
- один employee не может быть назначен на два incident.

---

# 24. Простой

Пока incident status:

- `recovery-required`;
- `recovering`;

каждый завершённый рабочий день создаёт downtime transaction.

Добавь категорию:

```ts
"service-downtime"
```

ID:

```text
server-downtime:{incidentId}:sprint-{sprintNumber}:day-{day}
```

Title:

- `Простой OfficeFlow: внешний шлюз`;
- `Ограничение OfficeFlow: учётные записи`;
- `Ограничение OfficeFlow: база данных`.

Суммы за день:

```text
GATEWAY  40 000 ₽
AUTH     30 000 ₽
DATABASE 50 000 ₽
```

## Правило дня завершения

Если incident был unresolved в начале рабочего дня:

- downtime cost применяется;
- даже если recovery завершилась в конце этого дня.

Это соответствует тому, что сервис был ограничен в течение дня.

---

# 25. Ежедневный progress восстановления

ID workday history:

```text
server-recovery-work:sprint-{sprintNumber}:day-{day}
```

Для каждого incident:

1. запомнить, был ли он unresolved в начале дня;
2. создать downtime transaction, если да;
3. если назначен employee:
   - увеличить recovery progress максимум на 1;
   - status `recovering`;
4. при достижении effort:
   - status `resolved`;
   - записать resolvedAt;
   - очистить assignee;
   - выполнить department task;
   - создать mitigation signal;
5. записать record.

Повторное применение дня:

- не добавляет progress;
- не дублирует downtime cost;
- не закрывает task повторно.

---

# 26. Конкуренция с OfficeFlow

Если Кирилл назначен на server recovery:

- product progress Кирилла в этот день равен 0;
- зарплата Кирилла списывается;
- Алина продолжает product progress;
- daily report показывает причину.

Если Илья назначен:

- product progress Кирилла продолжается;
- Илья не может выполнять finding или СКУД в этот день.

Пример:

```text
Кирилл Морозов

Восстановление:
Отказ внешнего шлюза: 0/2 → 1/2

OfficeFlow:
Продуктовая задача не продвигалась —
Кирилл восстанавливал инфраструктуру.
```

---

# 27. Порядок completeWorkday

Расширь единый use-case.

Рекомендуемый порядок:

1. проверить блокеры;
2. snapshot unresolved server incidents на начало дня;
3. применить server recovery и downtime;
4. применить access-control work для свободных сотрудников;
5. применить audit findings для свободных сотрудников;
6. определить всех diverted employees;
7. применить product progress;
8. применить daily operations;
9. проверить follow-up audit;
10. продвинуть sprint-state;
11. добавить risk signals результатов дня;
12. detect due risk signals;
13. reconcile access-control intrusion;
14. reconcile server incident threats;
15. открыть daily report.

Если текущая архитектура требует другой порядок, сохрани семантику:

- downtime считается по unresolved на начало дня;
- один employee делает только одну security work;
- product учитывает diversion;
- threat создаётся после результатов дня.

---

# 28. Daily report

Добавь раздел:

```text
Инфраструктура
```

## Progress

```text
Кирилл Морозов
Восстановление внешнего шлюза: 0/2 → 1/2
```

## Завершение

```text
Внешний шлюз восстановлен.
OfficeFlow снова работает без ограничений.
```

## Нет исполнителя

```text
Инцидент AUTH не устранялся:
исполнитель не назначен.
```

## Downtime

```text
Расходы из-за простоя:
• GATEWAY — 40 000 ₽
• DATABASE — 50 000 ₽
```

Финансовые суммы должны браться из созданных transactions.

---

# 29. Risk signals инцидентов

Добавь source:

```ts
"server-incident"
```

## При возникновении

### GATEWAY

```ts
{
  id: "server-incident:gateway-outage:occurred",
  domain: "service-continuity",
  impact: 3,
  source: "server-incident",
  sourceRef: "gateway-outage",
}
```

### AUTH

```ts
{
  id: "server-incident:auth-account-incident:occurred",
  domain: "identity-access",
  impact: 3,
  source: "server-incident",
  sourceRef: "auth-account-incident",
}
```

### DATABASE

```ts
{
  id: "server-incident:database-exposure-review:occurred",
  domain: "sensitive-data",
  impact: 3,
  source: "server-incident",
  sourceRef: "database-exposure-review",
}
```

Signals создаются при первом resolve сцены.

---

# 30. Mitigation после восстановления

## GATEWAY

```ts
{
  id: "server-incident:gateway-outage:recovered",
  domain: "service-continuity",
  impact: -4,
  source: "server-incident",
  sourceRef: "gateway-outage:recovered",
}
```

## AUTH

```ts
{
  id: "server-incident:auth-account-incident:recovered",
  domain: "identity-access",
  impact: -4,
  source: "server-incident",
  sourceRef: "auth-account-incident:recovered",
}
```

## DATABASE

```ts
{
  id: "server-incident:database-exposure-review:recovered",
  domain: "sensitive-data",
  impact: -4,
  source: "server-incident",
  sourceRef: "database-exposure-review:recovered",
}
```

История старых failures и positive signals не удаляется.

---

# 31. Визуальное состояние серверной

Пока incident unresolved:

- соответствующая стойка имеет аварийный индикатор;
- используется красный или янтарный emissive/light;
- над стойкой допустим компактный marker;
- интеракция игрока с существующей мини-игрой сохраняется;
- стойка не становится невидимой;
- navmesh не меняется.

После resolved:

- аварийный индикатор исчезает;
- обычное состояние восстанавливается.

Не создавай отдельную серверную комнату.

---

# 32. Поведение мини-игры после инцидента

Существующая мини-игра остаётся доступной.

Успешная попытка после возникновения инцидента:

- продолжает обновлять существующий rack state/history;
- создаёт обычный stabilization risk signal по Feature 09;
- не закрывает recovery автоматически;
- не отменяет уже созданные расходы;
- может помочь предотвратить другой ещё armed-инцидент этого rack только если он не произошёл, но один incident per rack уже финален после возникновения.

Не заставляй игрока повторно проходить мини-игру для закрытия recovery.

Восстановление считается рабочими днями назначенного сотрудника.

---

# 33. Окно результата сцены

После каждой сцены:

```text
Инцидент зарегистрирован

Немедленные расходы: 170 000 ₽
Простой: 30 000 ₽ за каждый рабочий день до восстановления

Назначьте исполнителя на вкладке «Безопасность».
```

Кнопка:

```text
Продолжить
```

После закрытия:

- управление возвращается;
- следующий рабочий день доступен;
- если day 10, другие pending events и review следуют по приоритету;
- recovery остаётся обязательным, но не блокирует завершение дня;
- отсутствие recovery дорого обходится через downtime.

---

# 34. Блокировки

Pending/running серверная сцена блокирует следующий день:

```text
Сначала завершите текущий серверный инцидент.
```

После перехода в `recovery-required` день снова можно завершать.

Recovery само по себе не является блокирующим objective.

---

# 35. Сохранение

После reload восстанавливаются:

- armed и due;
- pending;
- branch snapshot наличия Ильи;
- immediate transaction;
- recovery assignments;
- progress;
- downtime transactions;
- workday history;
- resolved status;
- department tasks;
- аварийный визуальный state стоек.

## Running после reload

```text
running -> pending
```

Сохранять:

- triggeredAt;
- hadSecuritySpecialistAtIncident;
- effectsApplied;
- immediate transaction id.

Если effects уже применены, повторная сцена не создаёт новые расходы и signals.

---

# 36. Миграция Feature 10

В старом сохранении server incident state отсутствует.

Для каждого rack:

1. вычислить current instability;
2. вычислить actual risk;
3. если risk high и rack unstable:
   - status `armed`;
   - armedAt current workday;
   - due current + 4;
4. иначе dormant.

Не запускать incident задним числом.

Игрок получает полный новый срок.

Существующие server failures, successes и risk signals не изменять.

---

# 37. Повреждённое состояние

Безопасно обработай:

- неизвестный incident id;
- duplicate state;
- unknown status;
- due раньше armed;
- pending без due;
- running после reload;
- invalid employee;
- Илья assigned без hire record;
- progress < 0;
- progress > effort;
- fractional progress;
- resolved без resolvedAt;
- duplicate immediate transaction;
- duplicate downtime transaction;
- duplicate workday records.

Правила:

- восстановить ровно три catalog incidents;
- unknown удалить;
- running → pending;
- invalid assignment очистить;
- progress clamp до effort;
- financial journal является источником transaction truth;
- duplicate records дедуплицировать по id;
- не сбрасывать другие stores.

---

# 38. Общий reset

Существующий `?intro` должен:

- вернуть все incidents в dormant;
- удалить armed/due;
- удалить assignments и progress;
- убрать аварийные индикаторы;
- удалить department tasks Feature 11;
- удалить immediate и downtime transactions через economy reset;
- удалить risk signals Feature 11;
- сохранить существующий reset остальных подсистем.

Не добавляй второй обработчик URL.

---

# 39. Что делать нельзя

Не реализовывать:

- BACKUP-инцидент;
- подтверждённую потерю базы;
- необратимое удаление product progress;
- реальных клиентов и выручку;
- потерю клиента;
- случайный инцидент;
- повторный инцидент одного rack;
- новый универсальный incident engine;
- автоматическое восстановление Ильёй;
- увольнение;
- game over;
- победу;
- кредит;
- новое финансирование;
- DeepSeek.

---

# 40. Требования к чистой логике

Добавь или расширь:

```ts
export function getRackStabilitySnapshot(
  rackId: ServerRackId,
  history: ExistingServerAttemptHistory
): RackStabilitySnapshot;

export function isServerIncidentEligible(
  definition: ServerIncidentDefinition,
  incidentState: ServerIncidentState,
  actualRiskLevel: RiskLevel,
  rackSnapshot: RackStabilitySnapshot
): boolean;

export function reconcileServerIncidentThreatRules(
  context: ServerIncidentThreatRuleContext
): ServerIncidentThreatTransition;

export function getNextPendingServerIncident(
  incidentStates: ServerIncidentState[]
): ServerIncidentState | undefined;

export function getServerIncidentImmediateCost(
  incidentId: ServerIncidentId,
  hasSecuritySpecialistAtIncident: boolean
): number;

export function getServerRecoveryEffort(
  incidentId: ServerIncidentId,
  hasSecuritySpecialistAtIncident: boolean
): number;

export function getServerDowntimeCost(
  incidentId: ServerIncidentId
): number;
```

---

# 41. Требования к тестам

Добавь unit-тесты чистой логики, stores и use-cases.

Минимальный набор:

## Каталог

1. каталог содержит ровно 3 incidents;
2. ids уникальны;
3. каждый связан с отдельным rack;
4. costs соответствуют документу;
5. downtime costs соответствуют документу;
6. effort соответствует документу.

## Stability

7. 0–1 failure после success -> stable;
8. 2 failures -> unstable;
9. success сбрасывает отсчёт;
10. failures до последнего success не учитываются;
11. история мини-игр не изменяется adapter.

## Threat

12. risk ниже high не arm;
13. stable rack не arm;
14. high + unstable arm;
15. due current +4;
16. risk снизился -> dormant;
17. rack stabilized -> dormant;
18. due + условия -> pending;
19. resolved финален;
20. повторный риск не создаёт второй incident после resolved.

## Queue

21. gateway имеет первый приоритет;
22. auth второй;
23. database третий;
24. следующий выбирается после завершения предыдущего.

## Trigger

25. daily report блокирует;
26. audit блокирует;
27. intrusion блокирует;
28. other cutscene блокирует;
29. minigame блокирует;
30. free UI запускает;
31. rerender не запускает два instances;
32. day 10 review ждёт всех incidents.

## Incident scene

33. branch snapshot Ильи фиксируется;
34. late hire не меняет immediate cost;
35. gateway costs 80/120;
36. auth costs 100/170;
37. database costs 160/260;
38. transaction создаётся один раз;
39. tasks создаются один раз;
40. occurred risk signal один раз.

## Assignment

41. gateway только Кирилл;
42. auth Кирилл/Илья;
43. database Кирилл/Илья;
44. ненанятый Илья недоступен;
45. employee с finding недоступен;
46. employee со СКУД недоступен;
47. employee не назначается на два incidents;
48. unassign сохраняет progress.

## Recovery

49. unresolved на начало дня создаёт downtime;
50. downtime не дублируется;
51. assigned employee даёт +1;
52. no assignee даёт idle;
53. completion в конце дня всё равно имеет downtime этого дня;
54. completion закрывает task;
55. completion создаёт mitigation;
56. повторный workday идемпотентен.

## Product diversion

57. Кирилл на recovery не получает product progress;
58. Алина продолжает product progress;
59. Илья на recovery не блокирует Кирилла;
60. зарплаты продолжают списываться.

## Finance

61. immediate и downtime имеют разные categories;
62. balance уменьшается;
63. отрицательный balance допустим;
64. old operations не меняются;
65. reset удаляет server transactions.

## Reload/migration

66. running -> pending;
67. branch snapshot сохраняется;
68. recovery progress сохраняется;
69. Feature 10 high-risk save получает новый срок;
70. старый incident не запускается задним числом;
71. malformed state нормализуется;
72. reset очищает state.

Добавь integration test:

```text
AUTH unstable + actual identity high
→ arm
→ 4 completeWorkday
→ pending
→ close daily report
→ scene
→ immediate transaction
→ assign Ilya
→ next completeWorkday
→ downtime transaction
→ recovery resolved
→ mitigation signal
```

Добавь integration test без Ильи:

```text
DATABASE incident
→ immediate 260 000
→ assign Kirill
→ 3 workdays
→ Kirill product +0 каждый день
→ downtime 50 000 каждый день
→ resolved
```

---

# 42. Обязательная проверка

Выполни существующие команды проекта.

Минимально:

```bash
npm test
npm run build
```

Если существуют:

```bash
npm run lint
npm run typecheck
```

Используй только scripts из `package.json`.

---

# 43. Ручной сценарий приёмки

## Сценарий 1. GATEWAY предотвращён

1. Создать две ошибки GATEWAY.
2. Иметь high service-continuity risk.
3. Убедиться, что threat armed.
4. Успешно стабилизировать GATEWAY до due.
5. Убедиться, что threat вернулся dormant.
6. Убедиться, что сцена не запускается.

## Сценарий 2. GATEWAY без Ильи

1. Оставить GATEWAY нестабильным.
2. Дойти до due.
3. Закрыть daily report.
4. Убедиться, что сцена запускается.
5. Проверить immediate cost 120 000 ₽.
6. Назначить Кирилла.
7. Завершить 2 дня.
8. Проверить downtime 40 000 ₽ за каждый день.
9. Проверить отсутствие product progress Кирилла.
10. Убедиться, что incident resolved.

## Сценарий 3. GATEWAY с Ильёй

1. Нанять Илью до incident.
2. Дождаться GATEWAY scene.
3. Проверить immediate cost 80 000 ₽.
4. Назначить Кирилла.
5. Проверить effort 1 день.
6. Убедиться, что один downtime day всё равно списан.

## Сценарий 4. AUTH с Ильёй

1. Создать условия AUTH incident.
2. Дождаться сцены.
3. Проверить cost 100 000 ₽.
4. Назначить Илью.
5. Завершить один день.
6. Убедиться, что Кирилл продолжил product progress.
7. Проверить downtime 30 000 ₽.
8. Убедиться, что incident resolved.

## Сценарий 5. AUTH без исполнителя

1. Получить AUTH incident.
2. Не назначать сотрудника.
3. Завершить два дня.
4. Убедиться, что progress 0.
5. Убедиться, что каждый день списано 30 000 ₽.
6. Позже назначить Кирилла и восстановить.

## Сценарий 6. DATABASE без Ильи

1. Создать DATABASE incident.
2. Проверить immediate cost 260 000 ₽.
3. Назначить Кирилла.
4. Завершить 3 дня.
5. Проверить downtime 150 000 ₽ суммарно.
6. Проверить отсутствие progress Кирилла эти дни.
7. Убедиться, что утечка не утверждается как подтверждённая.

## Сценарий 7. Несколько pending

1. Подготовить GATEWAY и AUTH к одному due.
2. Завершить день.
3. Закрыть daily report.
4. Убедиться, что GATEWAY scene первая.
5. Закрыть её.
6. Убедиться, что AUTH scene следующая.
7. Убедиться, что review появляется после обеих.

## Сценарий 8. Конкуренция security work

1. Назначить Кирилла на audit finding.
2. Попытаться назначить его на server recovery.
3. Убедиться, что назначение отклонено.
4. Снять finding.
5. Назначить на recovery.
6. Убедиться, что время и деньги не изменились от назначения.

## Сценарий 9. Reload

1. Получить pending incident.
2. Перезагрузить.
3. Убедиться, что scene запускается после hydration.
4. Перезагрузить во время scene.
5. Убедиться, что status pending.
6. Убедиться, что immediate cost не дублируется.
7. Создать recovery progress.
8. Перезагрузить.
9. Убедиться, что progress и downtime history сохранены.

## Сценарий 10. Day 10 priority

1. Сделать audit, intrusion и server incident pending на day 10.
2. Проверить порядок:
   - daily report;
   - audit;
   - intrusion;
   - GATEWAY/AUTH/DATABASE;
   - review.

## Сценарий 11. Reset

1. Иметь armed, unresolved и resolved incidents.
2. Открыть игру с `?intro`.
3. Убедиться, что все incidents dormant.
4. Убедиться, что аварийные индикаторы исчезли.
5. Убедиться, что server transactions удалены.
6. Убедиться, что normal flow может повториться.

## Сценарий 12. Регрессия

1. Проверить мини-игры серверов.
2. Проверить risk signals Feature 09.
3. Проверить СКУД и intrusion.
4. Проверить audits.
5. Проверить product progress.
6. Проверить finance.
7. Убедиться, что Feature 11 не завершает игру.
8. Убедиться, что BACKUP не создаёт incident.

---

# 44. Критерии готовности

Feature 11 считается завершённой только если:

- поддерживаются ровно GATEWAY, AUTH и DATABASE;
- угрозы детерминированы actual risk и server history;
- delay равен 4 рабочим дням;
- успешная стабилизация до due отменяет угрозу;
- каждый incident происходит максимум один раз;
- несколько pending выполняются в фиксированном порядке;
- immediate costs соответствуют документу;
- downtime списывается каждый unresolved день;
- восстановление требует рабочих дней;
- один employee выполняет одну security work;
- Кирилл теряет product progress при recovery;
- Илья позволяет сохранить product progress для AUTH/DATABASE;
- аварийный state виден в серверной;
- risk signals возникновения и восстановления создаются один раз;
- reload/migration/reset работают;
- BACKUP не включён;
- подтверждённая потеря данных не реализована;
- game over не реализован;
- существующие механики не сломаны;
- тесты проходят;
- production-сборка проходит.

---

# 45. Формат финального ответа Claude Code

Верни результат строго по структуре:

```md
## Что реализовано

## Какие серверные инциденты добавлены

## Как ошибки и риски запускают угрозу

## Как работают сцены и немедленные расходы

## Как рассчитываются простой и восстановление

## Как восстановление конкурирует с разработкой

## Созданные файлы

## Изменённые файлы

## Как устроены миграция и reset

## Чем решение отличается от Feature 10

## Выполненные команды

## Результаты тестов

## Результат production-сборки

## Ручная проверка

## Ограничения текущей итерации
```

Не переходи к Feature 12.

Не добавляй game over, увольнение, победу или потерю клиента.
