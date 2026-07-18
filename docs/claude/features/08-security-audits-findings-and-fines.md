# Feature 08 — замечания аудита, исправления, повторные проверки и штрафы

## Как использовать этот файл

Передай Claude Code только этот feature-файл вместе с доступом к актуальному репозиторию.

Постоянные правила проекта должны быть подключены через корневой `CLAUDE.md`:

- `AGENTS.md`;
- `docs/claude/00-implementation-workflow.md`;
- `docs/claude/00-fixed-game-rules.md`.

Не передавай Claude Code инструкции следующих фич.

---

# Предварительные условия

Feature 01–07 должны быть завершены и приняты.

В проекте уже должны работать:

- относительное время;
- спринты по 10 условных рабочих дней;
- единая операция завершения рабочего дня;
- бюджет и финансовый журнал;
- команда из Сони, Кирилла и Алины;
- условный найм Ильи Власова в ветке одобрения;
- технический backlog OfficeFlow;
- ежедневный продуктовый прогресс;
- первый рабочий прототип;
- автоматическая сцена `security-breach`;
- разговор с Соней после аудита;
- кадровое решение:
  - `approve-security-hire`;
  - `decline-security-hire`;
- department tasks из Feature 05–07;
- сохранение, миграции и общий reset.

Если фактические имена файлов, stores, choice ids или функций отличаются, используй актуальную реализацию. Не создавай параллельные sprint-, economy-, product-, team- или story-системы.

---

# Роль Claude Code

Ты работаешь с существующим проектом Startup Office.

Сначала изучи актуальный код. Не предполагай структуру файлов только по этому документу.

Обязательно прочитай и найди:

- `AGENTS.md`;
- корневой `CLAUDE.md`;
- постоянные документы из `docs/claude/`;
- `package.json`;
- реализацию Feature 01–07;
- use-case завершения рабочего дня;
- порядок продуктового и финансового расчёта;
- daily report;
- whiteboard и его вкладки;
- department tasks;
- product board;
- team-store;
- team catalog;
- текущий active NPC roster;
- activity planner;
- `securityStoryStore`;
- решение о найме;
- hire record Ильи;
- существующую сцену `security-breach`;
- временных актёров аудиторов и их модели;
- Director API;
- registry кат-сцен;
- blocking overlays;
- financial transaction types;
- persist, hydration, миграции и reset;
- тесты Feature 04–07.

Перед изменением кода верни:

1. как сейчас единая операция завершения дня вызывает product и economy;
2. как Кирилл получает ежедневный продуктовый прогресс;
3. как устроены вкладки whiteboard;
4. где хранятся department tasks;
5. как можно добавить новую финансовую категорию без поломки старых сохранений;
6. как повторно использовать актёров аудиторов;
7. где безопаснее подключить dedicated trigger повторного аудита;
8. какие файлы планируется создать;
9. какие файлы планируется изменить.

После анализа реализуй только Feature 08.

---

# Цель итерации

Превратить последствия первого аудита в полноценную управленческую систему.

Игрок должен:

1. получить конкретные замечания;
2. увидеть срок повторной проверки;
3. назначить исполнителей;
4. выбирать между разработкой продукта и исправлением безопасности;
5. закрывать замечания рабочими днями;
6. проходить повторный аудит;
7. получать штрафы за незакрытые нарушения;
8. видеть усиление давления при повторном игнорировании;
9. иметь возможность пройти аудит как со штатным безопасником, так и без него.

Безопасник помогает, но не является автоматической кнопкой победы.

Feature 08 не добавляет скрытые риски, случайные инциденты, СКУД, проникновение в офис и фактический game over.

---

# 1. Общая структура механики

```text
Post-audit разговор завершён
        ↓
Создаётся план исправления замечаний
        ↓
Через 10 рабочих дней назначена повторная проверка
        ↓
Игрок назначает сотрудников на замечания
        ↓
При завершении дня сотрудники делают исправления
        ↓
Технический сотрудник не может одновременно делать продукт и безопасность
        ↓
В день проверки создаётся pending audit
        ↓
После daily report приходят аудиторы
        ↓
Все замечания закрыты:
аудит пройден
        ↓
Есть открытые замечания:
штраф + новый срок
        ↓
Повторное игнорирование:
более крупный штраф + жалоба руководству
```

---

# 2. Относительная шкала рабочих дней

Не использовать календарные даты.

Добавь чистые функции:

```ts
export const SPRINT_DAYS = 10;

export function toWorkdayIndex(
  sprintNumber: number,
  day: number
): number;

export function fromWorkdayIndex(
  workdayIndex: number
): {
  sprintNumber: number;
  day: number;
};
```

Формула:

```ts
workdayIndex = (sprintNumber - 1) * 10 + day;
```

Примеры:

```text
Спринт 1, день 1  -> 1
Спринт 1, день 10 -> 10
Спринт 2, день 1  -> 11
Спринт 3, день 4  -> 24
```

Требования:

- sprintNumber начинается с 1;
- day находится в диапазоне 1–10;
- workdayIndex начинается с 1;
- не использовать реальное время;
- не использовать `Date`;
- не использовать таймер браузера.

---

# 3. Каталог замечаний

Создай чистый каталог.

Рекомендуемое имя:

`src/game/securityFindingCatalog.ts`

## Типы

```ts
export type SecurityFindingSeverity =
  | "medium"
  | "high";

export type SecurityFindingKind =
  | "process"
  | "technical";

export type SecurityFindingDefinition = {
  id: string;
  title: string;
  description: string;
  severity: SecurityFindingSeverity;
  kind: SecurityFindingKind;
  effortDays: number;
  eligibleEmployeeIds: string[];
};
```

Каталог содержит ровно четыре замечания.

## Замечание 1 — блокировка рабочих станций

```ts
{
  id: "workstation-locking-training",
  title: "Обучить сотрудников блокировать рабочие станции",
  description:
    "Провести обязательный инструктаж и зафиксировать правило блокировки компьютера при уходе с рабочего места.",
  severity: "high",
  kind: "process",
  effortDays: 2,
  eligibleEmployeeIds: [
    "sonya-sokolova",
    "ilya-vlasov",
  ],
}
```

## Замечание 2 — проверка прав доступа

```ts
{
  id: "account-access-review",
  title: "Проверить учётные записи и права доступа",
  description:
    "Проверить персональные учётные записи, удалить лишние права и исключить использование общих административных доступов.",
  severity: "high",
  kind: "technical",
  effortDays: 3,
  eligibleEmployeeIds: [
    "kirill-morozov",
    "ilya-vlasov",
  ],
}
```

## Замечание 3 — порядок обработки инцидентов

```ts
{
  id: "incident-response-procedure",
  title: "Описать порядок обработки инцидентов",
  description:
    "Определить, кому сотрудники сообщают о нарушениях, кто фиксирует инцидент и кто принимает решение об эскалации.",
  severity: "medium",
  kind: "process",
  effortDays: 2,
  eligibleEmployeeIds: [
    "sonya-sokolova",
    "ilya-vlasov",
  ],
}
```

## Замечание 4 — проверка журналирования

```ts
{
  id: "sensitive-data-logging-review",
  title: "Проверить журналирование чувствительных данных",
  description:
    "Проверить, что пароли, токены и другие чувствительные данные не попадают в технические логи OfficeFlow.",
  severity: "high",
  kind: "technical",
  effortDays: 3,
  eligibleEmployeeIds: [
    "kirill-morozov",
    "ilya-vlasov",
  ],
}
```

## Общая трудоёмкость

```text
Процессные замечания: 4 рабочих дня
Технические замечания: 6 рабочих дней
Всего:                10 рабочих дней
```

Не добавляй СКУД, физический контроль входа и резервное копирование в этот каталог.

Они относятся к отдельным будущим сюжетам.

---

# 4. Состояние исправлений

Создай отдельный Zustand-store.

Рекомендуемое имя:

`src/game/securityAuditStore.ts`

## Статусы замечаний

```ts
export type SecurityFindingStatus =
  | "open"
  | "in-progress"
  | "closed";
```

Не хранить `overdue` как независимый изменяемый статус.

Просрочка вычисляется по:

- текущему workday index;
- следующей дате аудита;
- факту, что finding не closed.

## Состояние finding

```ts
export type SecurityFindingState = {
  findingId: string;
  status: SecurityFindingStatus;
  progressDays: number;
  assignedEmployeeId?: string;
  closedAt?: {
    sprintNumber: number;
    day: number;
  };
};
```

## Состояние проверки

```ts
export type FollowUpAuditStatus =
  | "not-scheduled"
  | "scheduled"
  | "pending"
  | "running"
  | "passed"
  | "critical-escalation";

export type FollowUpAuditRecord = {
  auditNumber: number;
  evaluatedAt: {
    sprintNumber: number;
    day: number;
  };
  result: "passed" | "failed";
  unresolvedFindingIds: string[];
  fineAmount: number;
  fineTransactionId?: string;
};
```

## Состояние store

```ts
export type SecurityAuditState = {
  initialized: boolean;
  findings: SecurityFindingState[];

  followUpAudit: {
    status: FollowUpAuditStatus;
    nextAuditWorkdayIndex?: number;
    pendingAuditNumber?: number;
    records: FollowUpAuditRecord[];
  };

  leadershipComplaint: boolean;
  shutdownRecommendation: boolean;

  workdayHistory: SecurityWorkdayRecord[];

  initializeCorrectiveActionPlan(
    context: InitializeCorrectiveActionContext
  ): InitializeCorrectiveActionResult;

  assignFinding(
    findingId: string,
    employeeId: string
  ): AssignFindingResult;

  unassignFinding(
    findingId: string
  ): AssignFindingResult;

  applySecurityWorkday(
    sprintNumber: number,
    day: number
  ): ApplySecurityWorkdayResult;

  schedulePendingAuditIfDue(
    sprintNumber: number,
    completedDay: number
  ): ScheduleAuditResult;

  resolvePendingAudit(
    moment: StoryMoment
  ): ResolveFollowUpAuditResult;

  markAuditRunning(): void;

  markAuditFailed(): void;

  resetSecurityAudit(): void;
};
```

Названия можно адаптировать к стилю проекта.

---

# 5. Инициализация плана исправлений

План создаётся после завершения post-audit conversation Feature 06.

Неважно, какое кадровое решение выбрал игрок.

## Начальное состояние

- все четыре finding существуют;
- status `open`;
- progressDays `0`;
- assignedEmployeeId отсутствует;
- follow-up audit status `scheduled`;
- records пуст;
- leadershipComplaint false;
- shutdownRecommendation false.

## Срок

Игрок получает 10 завершаемых рабочих дней, включая текущий день, если разговор закончен до завершения дня.

Расчёт:

```ts
nextAuditWorkdayIndex =
  currentWorkdayIndex + 9;
```

Пример:

```text
Разговор завершён:
Спринт 2, день 2
workdayIndex = 12

Повторный аудит:
Спринт 3, день 1
workdayIndex = 21
```

Дни 12–21 включительно дают 10 рабочих дней.

## Идемпотентность

Повторный вызов инициализации:

- не сбрасывает progress;
- не меняет assignments;
- не переносит срок;
- не очищает records;
- возвращает `initialized: false` или эквивалент.

---

# 6. Миграция Feature 07

В старом сохранении Feature 07 отсутствует security-audit state.

## Если post-audit conversation не completed

- audit state остаётся `initialized: false`;
- findings не создаются;
- audit не планируется.

## Если conversation completed

- создать план исправлений;
- использовать conversation `completedAt`;
- если `completedAt` отсутствует, использовать текущий sprint/day;
- staffingDecision сохраняется;
- hire record Ильи сохраняется;
- budget, product progress и team не сбрасываются.

## Уже прошедший срок

Если вычисленный старый срок находится в прошлом:

- не применять штрафы задним числом;
- назначить повторный аудит на конец текущего рабочего дня;
- status `scheduled`;
- nextAuditWorkdayIndex равен текущему workday index;
- audit возникнет после следующего завершения дня.

Это явное миграционное правило.

---

# 7. Вкладка «Безопасность» на whiteboard

После инициализации плана на физическом whiteboard появляется третья вкладка:

```text
[Разработка OfficeFlow] [Задачи отдела] [Безопасность]
```

До инициализации вкладка скрыта.

## Заголовок

```text
Безопасность проекта
```

Покажи:

```text
Следующая проверка:
Спринт 3 · День 1
Осталось рабочих дней: 7
```

Если день проверки уже наступил:

```text
Повторная проверка назначена на конец текущего дня
```

Если audit pending/running:

```text
Проверка проводится
```

Если passed:

```text
Замечания закрыты. Повторная проверка пройдена.
```

Если critical escalation:

```text
Аудиторы рекомендуют приостановить проект.
```

---

# 8. Карточка замечания

Каждая карточка показывает:

- название;
- описание;
- severity;
- progress;
- исполнитель;
- статус;
- оставшиеся рабочие дни.

Пример:

```text
Проверить учётные записи и права доступа
Высокая серьёзность
Прогресс: 1/3

Исполнитель: Кирилл Морозов

[Снять назначение]
```

Закрытое замечание:

```text
Проверить учётные записи и права доступа
Закрыто
Спринт 2 · День 7
```

---

# 9. Назначение исполнителей

Назначение доступно:

- во время `planning`;
- во время `active`;
- пока audit status не `pending` и не `running`;
- только для open/in-progress finding.

Назначение:

- не двигает время;
- не списывает деньги;
- не создаёт progress сразу;
- можно изменить до завершения дня.

## Доступные сотрудники

### Соня

Всегда доступна для process findings:

- workstation locking training;
- incident response procedure.

### Кирилл

Доступен, если нанят, для technical findings:

- account access review;
- sensitive data logging review.

### Илья

Доступен только если реально нанят.

Может выполнять все четыре finding.

### Алина

В Feature 08 не назначается на замечания.

Причина:

- текущие finding не относятся к frontend;
- не добавлять искусственную универсальность.

---

# 10. Ограничение одного задания на сотрудника

Один сотрудник может быть назначен максимум на одно незакрытое security finding одновременно.

Один finding имеет максимум одного исполнителя.

Если сотрудник уже назначен:

- не назначать его на второе finding;
- показать:
  `Сотрудник уже занимается другим замечанием`;
- предложить сначала снять текущее назначение.

Не переназначать автоматически.

После закрытия finding назначение очищается, и сотрудник становится доступен.

---

# 11. Чистые правила назначения

Добавь функции:

```ts
export function getEligibleEmployeesForFinding(
  findingId: string,
  context: SecurityStaffContext
): SecurityEmployeeOption[];

export function canAssignEmployeeToFinding(
  findingStates: SecurityFindingState[],
  findingId: string,
  employeeId: string,
  context: SecurityStaffContext
): AssignmentValidation;

export function getEmployeeActiveSecurityFinding(
  findingStates: SecurityFindingState[],
  employeeId: string
): SecurityFindingState | undefined;
```

`SecurityStaffContext` должен учитывать:

- Соню как постоянного PM;
- hire record Кирилла;
- hire record Ильи;
- staffingDecision;
- каталог.

Не считать Илью нанятым только по решению approve.

Нужен реальный hire record.

---

# 12. Ежедневный прогресс исправлений

При подтверждении завершения рабочего дня каждый назначенный сотрудник делает максимум один день progress по своему finding.

## Алгоритм

Для каждого уникального assigned employee:

1. найти assigned finding;
2. убедиться, что finding не closed;
3. увеличить progressDays на 1;
4. ограничить progressDays значением effortDays;
5. при достижении effortDays:
   - status `closed`;
   - записать closedAt;
   - очистить assignedEmployeeId;
6. записать результат в security workday history.

## Идемпотентный id

```text
security-work:sprint-{sprintNumber}:day-{day}
```

Повторный вызов одного дня:

- не увеличивает progress;
- не закрывает finding повторно;
- возвращает существующий record;
- `applied: false`.

---

# 13. Конкуренция с продуктовой разработкой

Кирилл не может в один день:

- продвигать техническое замечание;
- и одновременно продвигать задачу OfficeFlow.

Security assignment имеет приоритет.

## Если Кирилл назначен на finding

В этот день:

- security progress +1;
- product progress Кирилла отсутствует;
- зарплата Кирилла списывается;
- daily report показывает причину.

Пример:

```text
Кирилл Морозов

Безопасность:
Проверка прав доступа: 1/3 → 2/3

OfficeFlow:
Продуктовая задача не продвигалась —
Кирилл был занят замечанием аудита.
```

## Если Кирилл не назначен

Работает обычная продуктовая логика Feature 04.

## Соня

У Сони нет продуктового progress.

Назначение на process finding не требует отдельного product skip.

## Илья

Илья не выполняет задачи OfficeFlow.

Назначение на finding использует его рабочий день.

## Алина

Её продуктовый progress не меняется.

---

# 14. Изменение единого workday use-case

Расширь существующую операцию завершения дня.

Правильный порядок:

1. проверить общие блокеры;
2. прочитать текущие sprint/day;
3. применить security workday;
4. определить employees, отвлечённых на security;
5. применить product progress с учётом отвлечённых employees;
6. применить ежедневные финансовые расходы;
7. проверить, наступил ли срок follow-up audit;
8. при необходимости создать pending audit;
9. продвинуть sprint-state;
10. открыть daily report;
11. вернуть единый результат.

Псевдокод:

```ts
function completeWorkday(): CompleteWorkdayResult {
  const sprint = getSprintState();

  if (!canCompleteWorkday()) {
    return controlledFailure;
  }

  const securityResult = applySecurityWorkday(
    sprint.sprintNumber,
    sprint.day
  );

  const divertedEmployeeIds =
    getEmployeesWithSecurityProgress(securityResult);

  const productResult = applyWorkdayProgress({
    sprintNumber: sprint.sprintNumber,
    day: sprint.day,
    excludedEmployeeIds: divertedEmployeeIds,
  });

  const economyResult = applyDailyOperatingExpense(
    sprint.sprintNumber,
    sprint.day
  );

  const auditScheduleResult =
    schedulePendingAuditIfDue(
      sprint.sprintNumber,
      sprint.day
    );

  confirmSprintDay();

  return {
    completed: true,
    securityResult,
    productResult,
    economyResult,
    auditScheduleResult,
  };
}
```

Не размещай эту координацию в React-компоненте.

Не создавай универсальный workflow engine.

---

# 15. Daily report

Расширь ежедневный отчёт.

## Раздел «Разработка»

Сохрани существующий product result.

Если сотрудник diverted:

```text
Кирилл Морозов
Задача OfficeFlow не продвигалась:
работал над замечанием аудита.
```

## Раздел «Безопасность»

Покажи каждого работавшего сотрудника:

```text
Соня Соколова
Обучение блокировке рабочих станций: 0/2 → 1/2
```

```text
Илья Власов
Проверка журналирования: 2/3 → 3/3
Замечание закрыто
```

Если никто не назначен:

```text
Замечания аудита сегодня не исправлялись.
```

## Срок

Покажи:

```text
До повторной проверки: 4 рабочих дня
```

Если текущий завершённый день создаёт pending audit:

```text
Сегодня проводится повторная проверка.
```

## Финансы

Сохрани расходы дня.

Штраф в этот момент ещё не применяется.

---

# 16. Pending follow-up audit

В день, когда:

```ts
completedWorkdayIndex >= nextAuditWorkdayIndex
```

после security progress создаётся:

```ts
followUpAudit.status = "pending";
pendingAuditNumber = records.length + 1;
```

## Важно

- audit не разрешается прямо внутри `completeWorkday`;
- daily report имеет приоритет;
- review имеет приоритет только после разрешения pending audit;
- следующий рабочий день нельзя завершить до результата audit;
- assignment changes блокируются до результата audit.

Если audit due на day 10:

1. daily report показывается;
2. после него запускается audit;
3. после audit показывается review.

Не открывать review под audit.

---

# 17. Dedicated trigger повторного аудита

Создай один узкий trigger:

```ts
SecurityFollowUpAuditTrigger
```

или:

```ts
useSecurityFollowUpAuditTrigger
```

Он должен запускаться, если:

- followUpAudit status `pending`;
- daily report закрыт;
- другая cutscene не запущена;
- server minigame закрыта;
- blocking overlay закрыт;
- blocking dialogue закрыт;
- hydration завершена.

Trigger подключается один раз на верхнем игровом уровне.

Не подключать его:

- внутри whiteboard;
- внутри finding card;
- внутри NPC;
- внутри daily report.

---

# 18. Короткая сцена повторного аудита

Добавь одну новую кат-сцену:

```text
security-follow-up-audit
```

Используй:

- существующий Director API;
- существующие модели аудиторов;
- временных актёров;
- текущую систему диалогов.

Не добавляй новых постоянных NPC.

## Последовательность

1. временные аудиторы появляются у входа;
2. проходят в переговорную или к руководителю;
3. один аудитор сообщает, что срок исправлений закончился;
4. игра рассчитывает результат;
5. показывается соответствующая ветка;
6. временные актёры уходят;
7. управление возвращается игроку.

Не делать длинную сцену.

Не добавлять choices.

---

# 19. Разрешение повторного аудита

Создай чистую функцию:

```ts
export function evaluateFollowUpAudit(
  findingStates: SecurityFindingState[],
  auditNumber: number
): FollowUpAuditEvaluation;
```

Рекомендуемый результат:

```ts
export type FollowUpAuditEvaluation = {
  passed: boolean;
  unresolvedFindingIds: string[];
  fineAmount: number;
  leadershipComplaint: boolean;
  shutdownRecommendation: boolean;
};
```

## Если все finding закрыты

```ts
{
  passed: true,
  unresolvedFindingIds: [],
  fineAmount: 0,
  leadershipComplaint: false,
  shutdownRecommendation: false,
}
```

## Шкала штрафов

```ts
export const SECURITY_AUDIT_FINE_BY_NUMBER = {
  1: 120_000,
  2: 250_000,
  3: 500_000,
} as const;
```

Для auditNumber больше 3 не создавать новые проверки в Feature 08.

---

# 20. Первый неуспешный аудит

Если auditNumber = 1 и есть unresolved findings:

- результат failed;
- штраф 120 000 ₽;
- leadershipComplaint false;
- shutdownRecommendation false;
- назначить следующий audit через 10 будущих рабочих дней;
- status снова `scheduled`.

Новый срок:

```ts
nextAuditWorkdayIndex =
  evaluatedWorkdayIndex + 10;
```

Пример:

```text
Проверка прошла после завершения дня 21.
Следующая проверка — после завершения дня 31.
```

Реплика:

```text
Аудитор:
Часть замечаний не устранена.
Компания получает штраф 120 000 рублей.

Аудитор:
Мы назначаем повторную проверку через десять рабочих дней.
```

---

# 21. Второй неуспешный аудит

Если auditNumber = 2 и есть unresolved findings:

- штраф 250 000 ₽;
- leadershipComplaint true;
- shutdownRecommendation false;
- новый срок через 10 дней;
- status `scheduled`.

Реплика:

```text
Аудитор:
Те же нарушения повторяются.
Штраф увеличен до 250 000 рублей.

Аудитор:
Информация о систематическом невыполнении требований
будет передана высшему руководству.
```

В HUD не добавлять нового постоянного индикатора жалобы.

Состояние сохраняется для будущей Feature 12.

CEO не появляется как 3D-персонаж.

---

# 22. Третий неуспешный аудит

Если auditNumber = 3 и есть unresolved findings:

- штраф 500 000 ₽;
- leadershipComplaint true;
- shutdownRecommendation true;
- status `critical-escalation`;
- следующая проверка не назначается.

Реплика:

```text
Аудитор:
Требования безопасности систематически игнорируются.
Штраф составляет 500 000 рублей.

Аудитор:
Мы направляем рекомендацию приостановить проект
до устранения критических нарушений.
```

## Важно

Feature 08 не завершает игру.

После critical escalation:

- игра остаётся управляемой;
- новый рабочий день можно завершать;
- замечания можно продолжать закрывать;
- в HUD или security tab показывается критическое предупреждение;
- фактическое увольнение, закрытие проекта или game over появятся в Feature 12.

---

# 23. Успешный аудит

Если все finding закрыты:

- fineAmount 0;
- status `passed`;
- новая проверка не назначается;
- leadershipComplaint не создаётся заново;
- shutdownRecommendation не создаётся;
- branch task закрытия замечаний становится done.

Реплика:

```text
Аудитор:
Все замечания предыдущей проверки устранены.

Аудитор:
Повторный аудит пройден.
На этом корректирующий план закрыт.
```

## Задачи отдела

### Ветка approve

Добавь или используй task:

```ts
{
  id: "close-security-audit-findings",
  title: "Закрыть замечания внутреннего аудита",
  done: false,
}
```

После passed:

```ts
done: true
```

### Ветка decline

Используй существующую task:

```ts
close-security-findings-without-specialist
```

После passed:

```ts
done: true
```

Не создавать две одинаковые задачи.

---

# 24. Финансовый штраф

Расширь финансовые типы.

## Категория

```ts
MoneyTransactionCategory =
  | "funding"
  | "operations"
  | "audit-fine";
```

## Транзакция

Пример первого штрафа:

```ts
{
  id: "security-audit-fine:1",
  kind: "expense",
  category: "audit-fine",
  title: "Штраф по результатам повторного аудита",
  amount: 120_000,
  sprintNumber: 3,
  day: 1,
}
```

## Идемпотентность

Для auditNumber N используется:

```text
security-audit-fine:{N}
```

Повторное разрешение одной проверки:

- не создаёт второй штраф;
- не уменьшает баланс повторно;
- возвращает существующую transaction;
- record хранит transaction id.

Штраф применяется при разрешении audit-сцены, а не при создании pending state.

---

# 25. Окно результата аудита

После реплик аудитора покажи итоговый блок.

## Успех

```text
Повторный аудит пройден

Закрыто замечаний: 4 из 4
Штраф: 0 ₽
```

## Первый провал

```text
Повторный аудит не пройден

Открыто замечаний: 2
Штраф: 120 000 ₽
Следующая проверка: через 10 рабочих дней
```

## Второй провал

```text
Повторный аудит не пройден

Открыто замечаний: 2
Штраф: 250 000 ₽
Жалоба передана высшему руководству
Следующая проверка: через 10 рабочих дней
```

## Третий провал

```text
Критическое нарушение требований

Открыто замечаний: 1
Штраф: 500 000 ₽
Аудиторы рекомендуют приостановить проект
```

Кнопка:

```text
Продолжить
```

После закрытия:

- управление возвращается;
- если завершался day 10, открывается review;
- результат не применяется повторно.

---

# 26. Блокировка следующего дня

Пока followUpAudit status:

```text
pending
```

или:

```text
running
```

нельзя завершить следующий рабочий день.

Причина:

```text
Сначала завершите повторный аудит.
```

Попытка через use-case:

- не двигает день;
- не списывает деньги;
- не создаёт product progress;
- не создаёт security progress.

После разрешения audit блокировка снимается.

---

# 27. Влияние Ильи

Илья не закрывает замечания автоматически.

Преимущество Ильи:

- может выполнять любое из четырёх замечаний;
- не забирает продуктовый день Кирилла;
- позволяет параллельно исправлять process и technical findings;
- визуально участвует в security work.

Без Ильи:

- process findings выполняет Соня;
- technical findings выполняет Кирилл;
- Кирилл теряет product progress в эти дни.

Это ключевое обучающее сравнение Feature 08.

Не добавляй числовой security bonus.

---

# 28. Визуальное поведение NPC

Если сотрудник назначен на security finding:

## Соня

- повышает приоритет `work` или `meeting`;
- может работать у whiteboard или рабочего места;
- product progress отсутствует по определению.

## Кирилл

- повышает приоритет `work`;
- status может показывать название finding;
- продуктовая задача не продвигается.

## Илья

- повышает приоритет `work` или `security-round`;
- status показывает finding;
- не исправляет finding по реальному времени анимации.

Игровая математика остаётся привязана только к завершению дня.

Не создавать отдельный scheduler.

---

# 29. Сохранение и reload

После reload восстанавливаются:

- finding states;
- progress;
- assignments;
- next audit date;
- pending audit;
- records;
- fines;
- leadershipComplaint;
- shutdownRecommendation;
- workday history;
- department task state.

## Reload при pending audit

- audit остаётся pending;
- следующий день заблокирован;
- trigger запускает сцену после освобождения UI.

## Reload при running audit

Нормализовать:

```ts
running -> pending
```

Штраф не дублировать.

## Reload после применённого штрафа

- record содержит transaction id;
- balance вычисляется из journal;
- повторная сцена не создаёт второй штраф.

---

# 30. Нормализация повреждённого состояния

Безопасно обработай:

- неизвестные finding ids;
- отсутствующие catalog findings;
- дубликаты;
- progress < 0;
- progress > effort;
- closed без closedAt;
- invalid assigned employee;
- один employee назначен на несколько finding;
- unknown audit status;
- pending без pendingAuditNumber;
- running после reload;
- duplicate audit records;
- duplicate fine transaction ids;
- nextAuditWorkdayIndex < 1;
- auditNumber > 3;
- critical escalation без third failed record.

Рекомендуемые правила:

- восстановить недостающие catalog findings;
- неизвестные findings удалить;
- progress ограничить;
- closed finding unassign;
- invalid assignment очистить;
- при нескольких assignments сохранить первое по catalog order;
- running → pending;
- invalid pending → scheduled на текущий день;
- records дедуплицировать по auditNumber;
- fine transactions остаются источником финансовой истины;
- не сбрасывать другие stores.

---

# 31. Общий reset

Существующий `?intro` должен:

- удалить security audit state;
- убрать findings;
- убрать assignments;
- удалить audit records;
- убрать leadershipComplaint;
- убрать shutdownRecommendation;
- убрать audit fine transactions через reset economy;
- убрать branch tasks Feature 08;
- сбросить story, team, product, economy и sprint как раньше.

Не добавляй второй обработчик URL.

---

# 32. Взаимодействие с существующей игрой

Feature 08 не должна ломать:

- `security-breach`;
- post-audit conversation;
- найм Ильи;
- whiteboard;
- product backlog;
- daily report;
- review;
- finance;
- team panel;
- NPC navigation;
- claims;
- server mini-games;
- mock OfficeFlow;
- manual dev commands.

Повторный аудит:

- не тратит дополнительный рабочий день;
- не создаёт ежедневные operations;
- не создаёт product progress;
- не создаёт security progress;
- применяет только audit result и возможный fine.

---

# 33. Что в этой итерации делать нельзя

Не реализовывать:

- скрытые risk flags;
- случайные события;
- вероятность инцидентов;
- СКУД;
- физическое проникновение;
- поломку серверов посторонними;
- резервное копирование;
- серверные финансовые последствия;
- технический долг;
- мораль;
- отношения;
- увольнение Ильи;
- автоматическое game over;
- фактическое закрытие проекта;
- увольнение игрока;
- кредит;
- новое финансирование;
- DeepSeek;
- универсальный event engine;
- универсальный compliance engine;
- универсальный resource scheduler.

Feature 08 ограничена первым corrective action plan и максимум тремя follow-up audits.

---

# 34. Требования к чистой логике

Добавь или расширь функции:

```ts
export function initializeSecurityFindings(): SecurityFindingState[];

export function getRemainingSecurityEffort(
  findingState: SecurityFindingState
): number;

export function getDaysUntilAudit(
  currentWorkdayIndex: number,
  nextAuditWorkdayIndex: number
): number;

export function getEmployeesAssignedToSecurity(
  findingStates: SecurityFindingState[]
): string[];

export function applySecurityWorkdayRules(
  findingStates: SecurityFindingState[],
  context: SecurityWorkdayContext
): SecurityWorkdayCalculation;

export function evaluateFollowUpAudit(
  findingStates: SecurityFindingState[],
  auditNumber: number
): FollowUpAuditEvaluation;

export function getSecurityAuditFine(
  auditNumber: number
): number;
```

Ожидаемые fine values:

```text
1 -> 120 000 ₽
2 -> 250 000 ₽
3 -> 500 000 ₽
4 -> 0 ₽ / unsupported
```

---

# 35. Требования к тестам

Добавь unit-тесты чистой логики, stores и use-cases.

Минимальный набор:

## Каталог

1. каталог содержит ровно 4 finding;
2. ids уникальны;
3. общая трудоёмкость равна 10;
4. process effort равен 4;
5. technical effort равен 6;
6. Илья eligible для всех;
7. Соня только process;
8. Кирилл только technical;
9. Алина ни для одного.

## Workday index

10. sprint 1 day 1 -> 1;
11. sprint 1 day 10 -> 10;
12. sprint 2 day 1 -> 11;
13. обратное преобразование корректно;
14. invalid values обрабатываются выбранным способом.

## Инициализация

15. conversation completed создаёт findings;
16. срок равен current index + 9;
17. повторная инициализация не сбрасывает progress;
18. conversation not completed не инициализирует;
19. old overdue save переносит audit на текущий день без штрафа задним числом.

## Назначения

20. Соня назначается на process;
21. Соня не назначается на technical;
22. Кирилл назначается на technical;
23. Кирилл не назначается на process;
24. ненанятый Илья недоступен;
25. нанятый Илья доступен для всех;
26. Алина недоступна;
27. один employee не назначается дважды;
28. один finding не имеет двух assignees;
29. unassign работает;
30. closed finding нельзя назначить.

## Security progress

31. assigned employee создаёт +1 progress;
32. неassigned finding не меняется;
33. один employee делает максимум один finding;
34. completion закрывает finding;
35. closedAt записывается;
36. assignment очищается;
37. повторный день идемпотентен;
38. разные дни применяются отдельно.

## Product diversion

39. assigned Кирилл не получает product progress;
40. unassigned Кирилл получает product progress;
41. Алина продолжает product progress;
42. Соня не влияет на product;
43. Илья не влияет на product;
44. зарплата Кирилла списывается независимо от diversion.

## Audit scheduling

45. до срока pending не создаётся;
46. на сроке pending создаётся;
47. daily report имеет приоритет;
48. pending блокирует следующий день;
49. day 10 audit имеет приоритет над review;
50. after audit review открывается.

## Audit evaluation

51. все closed -> passed;
52. один open -> failed;
53. audit 1 fine 120 000;
54. audit 2 fine 250 000;
55. audit 3 fine 500 000;
56. audit 1 не создаёт complaint;
57. audit 2 создаёт complaint;
58. audit 3 создаёт shutdown recommendation;
59. после audit 1/2 новый срок +10;
60. после audit 3 новой проверки нет;
61. passed новой проверки не создаёт.

## Finance

62. failed audit создаёт одну fine transaction;
63. повторное resolve не дублирует fine;
64. passed audit не создаёт transaction;
65. fine уменьшает balance;
66. negative balance разрешён;
67. operations transaction не меняется;
68. reset удаляет fines.

## Scene trigger

69. pending запускает follow-up scene;
70. open daily report блокирует;
71. other cutscene блокирует;
72. minigame блокирует;
73. rerender не запускает два instance;
74. running reload становится pending;
75. completed record не запускает сцену снова.

## Department tasks

76. approve branch получает close-security-audit-findings;
77. decline использует существующую task;
78. passed закрывает правильную task;
79. failed task не закрывает;
80. tasks не дублируются.

## Миграция и reset

81. old Feature 07 save мигрируется;
82. malformed finding state нормализуется;
83. duplicate assignment очищается;
84. duplicate records удаляются;
85. reset очищает audit state.

Не поднимать полную Three.js-сцену для чистых расчётов.

Добавь один integration test:

```text
assign Кирилла на technical finding
→ завершить день
→ security +1
→ product Кирилла +0
→ finance применяется
→ daily report содержит diversion
```

Добавь один integration test follow-up audit:

```text
deadline day
→ completeWorkday
→ pending
→ close daily report
→ scene runner
→ failed evaluation
→ fine transaction
→ next deadline
```

---

# 36. Обязательная проверка после реализации

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

# 37. Ручной сценарий приёмки

## Сценарий 1. Появление замечаний

1. Завершить post-audit conversation.
2. Убедиться, что на whiteboard появилась вкладка `Безопасность`.
3. Открыть её.
4. Убедиться, что есть ровно 4 finding.
5. Убедиться, что показан срок через 10 рабочих дней.
6. Убедиться, что immediate fine отсутствует.

## Сценарий 2. Ветка без Ильи

1. Отказаться от найма.
2. Открыть security tab.
3. Убедиться, что Илья отсутствует в assignee options.
4. Назначить Соню на process finding.
5. Назначить Кирилла на technical finding.
6. Завершить день.
7. Убедиться:
   - Соня получила security progress;
   - Кирилл получил security progress;
   - Кирилл не получил product progress;
   - Алина получила product progress;
   - расходы остались 37 000 ₽.

## Сценарий 3. Ветка с Ильёй

1. Одобрить и нанять Илью.
2. Открыть security tab.
3. Убедиться, что Илья доступен для каждого finding.
4. Назначить Илью на technical finding.
5. Назначить Соню на process finding.
6. Завершить день.
7. Убедиться:
   - Илья получил security progress;
   - Соня получила security progress;
   - Кирилл продолжил product progress;
   - расходы равны 46 000 ₽.

## Сценарий 4. Ограничение назначения

1. Назначить Илью на finding.
2. Попытаться назначить его на второе.
3. Убедиться, что назначение отклонено.
4. Снять первое назначение.
5. Назначить второе.
6. Убедиться, что время и бюджет не изменились.

## Сценарий 5. Закрытие finding

1. Назначить сотрудника.
2. Завершить нужное количество дней.
3. Убедиться, что progress достиг effort.
4. Убедиться, что status closed.
5. Убедиться, что записан момент закрытия.
6. Убедиться, что assignee освободился.
7. Убедиться, что finding нельзя назначить повторно.

## Сценарий 6. Успешный аудит

1. Закрыть все 4 finding до срока.
2. Завершить день проверки.
3. Убедиться, что daily report появился первым.
4. Закрыть daily report.
5. Убедиться, что пришли аудиторы.
6. Убедиться, что audit passed.
7. Убедиться, что fine 0 ₽.
8. Убедиться, что branch department task done.
9. Убедиться, что следующий audit не назначен.

## Сценарий 7. Первый штраф

1. Оставить хотя бы один finding открытым.
2. Дойти до срока.
3. Закрыть daily report.
4. Убедиться, что follow-up scene запустилась.
5. Убедиться, что показан штраф 120 000 ₽.
6. Открыть financial journal.
7. Убедиться, что есть одна audit-fine transaction.
8. Убедиться, что следующий срок через 10 дней.
9. Перезагрузить страницу.
10. Убедиться, что штраф не применился второй раз.

## Сценарий 8. Второй штраф

1. Не закрывать finding.
2. Дойти до второго срока.
3. Убедиться, что штраф 250 000 ₽.
4. Убедиться, что leadershipComplaint true.
5. Убедиться, что CEO не появился как NPC.
6. Убедиться, что новый срок назначен.

## Сценарий 9. Критическая эскалация

1. Продолжить игнорировать finding.
2. Дойти до третьего срока.
3. Убедиться, что штраф 500 000 ₽.
4. Убедиться, что shutdownRecommendation true.
5. Убедиться, что нового audit нет.
6. Убедиться, что игра не завершилась автоматически.
7. Убедиться, что finding всё ещё можно закрывать.

## Сценарий 10. Audit на day 10

1. Добиться, чтобы срок выпал на day 10.
2. Завершить день.
3. Убедиться, что daily report открывается первым.
4. Закрыть report.
5. Убедиться, что audit запускается до review.
6. Закрыть audit result.
7. Убедиться, что только после этого показывается review.

## Сценарий 11. Reload при pending

1. Дойти до срока.
2. Закрыть страницу после создания pending, но до scene.
3. Перезагрузить.
4. Убедиться, что следующий день заблокирован.
5. Убедиться, что scene запускается при свободном UI.
6. Убедиться, что fine применяется один раз.

## Сценарий 12. Reset

1. Создать progress, штрафы и records.
2. Открыть игру с `?intro`.
3. Убедиться, что findings отсутствуют до story unlock.
4. Убедиться, что fines удалены.
5. Убедиться, что complaint и recommendation очищены.
6. Убедиться, что обычный story flow снова работает.

## Сценарий 13. Регрессия

1. Проверить whiteboard product tab.
2. Проверить department tasks.
3. Проверить product progress.
4. Проверить daily report.
5. Проверить finance.
6. Проверить team panel.
7. Проверить NPC.
8. Проверить server minigames.
9. Проверить `security-breach`.
10. Проверить post-audit conversation.
11. Убедиться, что follow-up audit не двигает время.
12. Убедиться, что auditors не остаются persistent NPC.

---

# 38. Критерии готовности

Feature 08 считается завершённой только если:

- создаются ровно 4 явных finding;
- срок равен 10 относительным рабочим дням;
- whiteboard имеет security tab;
- findings имеют progress и assignee;
- Илья доступен только при реальном найме;
- без Ильи система остаётся проходимой;
- Кирилл теряет product progress при security assignment;
- Алина продолжает product progress;
- security work применяется только при завершении дня;
- расчёт идемпотентен;
- due audit создаёт pending;
- daily report имеет приоритет;
- audit имеет приоритет над review;
- повторная сцена использует существующих аудиторов;
- первый fine равен 120 000 ₽;
- второй fine равен 250 000 ₽;
- третий fine равен 500 000 ₽;
- fines не дублируются;
- второй провал создаёт leadership complaint;
- третий создаёт shutdown recommendation;
- Feature 08 не запускает game over;
- passed audit закрывает branch task;
- reload и migration работают;
- reset очищает audit state и fines;
- скрытые риски и СКУД не реализованы;
- существующие механики не сломаны;
- тесты проходят;
- production-сборка проходит.

---

# 39. Формат финального ответа Claude Code

Верни результат строго по структуре:

```md
## Что реализовано

## Какие замечания создаются

## Как назначаются сотрудники

## Как безопасность конкурирует с продуктовой разработкой

## Как рассчитываются повторные аудиты

## Как применяются штрафы и эскалация

## Созданные файлы

## Изменённые файлы

## Как устроена миграция и reset

## Чем решение отличается от Feature 07

## Выполненные команды

## Результаты тестов

## Результат production-сборки

## Ручная проверка

## Ограничения текущей итерации
```

Не переходи к Feature 09.

Не добавляй скрытые риски, СКУД, проникновение или game over.
