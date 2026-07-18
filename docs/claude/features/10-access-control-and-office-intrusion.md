# Feature 10 — СКУД и проникновение постороннего в офис

## Как использовать этот файл

Передай Claude Code только этот feature-файл вместе с доступом к актуальному репозиторию.

Постоянные правила проекта должны быть подключены через корневой `CLAUDE.md`:

- `AGENTS.md`;
- `docs/claude/00-implementation-workflow.md`;
- `docs/claude/00-fixed-game-rules.md`.

Не передавай Claude Code инструкции следующих фич.

---

# Предварительные условия

Feature 01–09 должны быть завершены и приняты.

В проекте уже должны работать:

- относительное игровое время;
- спринты по 10 условных рабочих дней;
- единая операция запуска спринта;
- единая операция завершения рабочего дня;
- бюджет и финансовый журнал;
- команда и условный найм Ильи;
- технический backlog OfficeFlow;
- первый рабочий прототип;
- замечания и повторные аудиты;
- штрафы и эскалация;
- скрытые risk signals;
- разделение actual и detected risk;
- домен `office-access`;
- задержка обнаружения с Ильёй и без него;
- вкладка `Безопасность` на whiteboard;
- daily report;
- существующая система кат-сцен;
- временные актёры;
- сохранение, миграции и общий reset.

Если фактические имена файлов, stores, типов или функций отличаются, используй актуальную реализацию. Не создавай параллельные системы времени, рисков, финансов или кат-сцен.

---

# Роль Claude Code

Ты работаешь с существующим проектом Startup Office.

Сначала изучи актуальный код. Не предполагай структуру файлов только по этому документу.

Обязательно прочитай и найди:

- `AGENTS.md`;
- корневой `CLAUDE.md`;
- постоянные документы из `docs/claude/`;
- `package.json`;
- реализацию Feature 01–09;
- `riskStore`;
- selectors actual/detected risk;
- `getRiskLevelReachedAt`;
- вкладку `Безопасность`;
- единый `completeWorkday`;
- порядок security-, product-, economy- и risk-расчётов;
- financial transaction types;
- department tasks;
- team-store и hire record Ильи;
- security finding assignments;
- NPC activity planner;
- вход в офис, двери, navmesh и waypoints;
- существующие модели временных офисных персонажей;
- Director API;
- registry кат-сцен;
- blocking overlays;
- hydration, migrations и reset;
- тесты Feature 08–09.

Перед изменением кода верни:

1. где определяется actual office-access risk;
2. где detected risk становится видимым игроку;
3. где безопаснее разблокировать предложение СКУД;
4. как один сотрудник сейчас блокируется от нескольких security assignments;
5. как добавить однократный финансовый расход вне завершения дня;
6. какая модель подходит временному нарушителю;
7. какие точки входа и Open Space подходят для сцены;
8. где подключить trigger проникновения ровно один раз;
9. какие файлы планируется создать;
10. какие файлы планируется изменить.

После анализа реализуй только Feature 10.

---

# Цель итерации

Добавить сюжетную цепочку физической безопасности:

1. обнаруженный риск физического доступа открывает предложение установить СКУД;
2. игрок может одобрить инвестицию или отложить решение;
3. установка требует денег и рабочих дней сотрудника;
4. активная СКУД снижает риск и предотвращает проникновение;
5. высокий фактический риск без работающей СКУД запускает скрытый детерминированный срок;
6. если риск не снижен и СКУД не запущена, в офис проникает посторонний;
7. последствия отличаются в зависимости от наличия Ильи;
8. инцидент создаёт финансовые расходы, задачи и новые risk signals;
9. событие не повторяется бесконечно;
10. игра остаётся проходимой без Ильи и без автоматического game over.

Feature 10 не добавляет серверный простой, потерю данных как подтверждённый факт, увольнение игрока или завершение кампании.

---

# 1. Терминология

СКУД — система контроля и управления доступом.

В рамках игры она включает:

- персональный доступ сотрудников;
- контроль входа;
- базовый учёт проходов;
- визуальный считыватель у входа;
- правило, что посторонний не должен свободно пройти в Open Space.

Не реализовывай настоящий backend пропускной системы.

СКУД является игровой инициативой, состоянием офиса и условием сюжетных событий.

---

# 2. Состояние Feature 10

Создай отдельный небольшой Zustand-store.

Рекомендуемое имя:

`src/game/accessControlStore.ts`

## Типы СКУД

```ts
export type AccessControlProposalStatus =
  | "locked"
  | "available"
  | "postponed"
  | "approved"
  | "in-progress"
  | "active";

export type AccessControlAssigneeId =
  | "sonya-sokolova"
  | "ilya-vlasov";

export type AccessControlState = {
  proposalStatus: AccessControlProposalStatus;
  approvedAt?: StoryMoment;
  completedAt?: StoryMoment;
  assignedEmployeeId?: AccessControlAssigneeId;
  progressDays: number;
  purchaseTransactionId?: string;
  effectsApplied: boolean;
};
```

## Типы угрозы проникновения

```ts
export type OfficeIntrusionStatus =
  | "dormant"
  | "armed"
  | "pending"
  | "running"
  | "resolved"
  | "prevented";

export type OfficeIntrusionState = {
  status: OfficeIntrusionStatus;
  armedAtWorkdayIndex?: number;
  dueWorkdayIndex?: number;
  triggeredAt?: StoryMoment;
  resolvedAt?: StoryMoment;
  hadSecuritySpecialistAtIncident?: boolean;
  responseTransactionId?: string;
  effectsApplied: boolean;
};
```

## Store

```ts
export type AccessControlStore = {
  accessControl: AccessControlState;
  intrusion: OfficeIntrusionState;

  unlockProposal(): void;

  postponeAccessControl(
    moment: StoryMoment
  ): AccessControlDecisionResult;

  approveAccessControl(
    moment: StoryMoment
  ): AccessControlDecisionResult;

  assignAccessControlImplementation(
    employeeId: AccessControlAssigneeId
  ): AccessControlAssignmentResult;

  unassignAccessControlImplementation(): void;

  applyAccessControlWorkday(
    sprintNumber: number,
    day: number
  ): ApplyAccessControlWorkdayResult;

  reconcileIntrusionThreat(
    context: IntrusionThreatContext
  ): IntrusionThreatResult;

  markIntrusionRunning(
    moment: StoryMoment
  ): StoryTransitionResult;

  resolveIntrusion(
    moment: StoryMoment,
    hadSecuritySpecialist: boolean
  ): ResolveOfficeIntrusionResult;

  markIntrusionFailed(): void;

  resetAccessControl(): void;
};
```

Названия можно адаптировать к существующему стилю.

---

# 3. Начальное состояние

Новая игра:

```ts
{
  accessControl: {
    proposalStatus: "locked",
    progressDays: 0,
    effectsApplied: false,
  },
  intrusion: {
    status: "dormant",
    effectsApplied: false,
  },
}
```

До появления detected office-access risk игрок не видит предложение СКУД.

---

# 4. Разблокировка предложения

Предложение становится доступным, когда:

```text
detected office-access level >= elevated
```

Используй detected, а не actual risk.

Причина:

- игрок должен сначала получить наблюдаемое предупреждение;
- скрытая проблема не должна создавать доступный UI без объяснения;
- будущий инцидент всё равно использует actual risk.

## Интеграция

После `detectDueSignals` в `completeWorkday`:

1. вычислить detected office-access level;
2. если он не ниже `elevated`;
3. если proposalStatus `locked`;
4. вызвать `unlockProposal()`.

Разблокировка идемпотентна.

Не создавай глобальный subscriber, который сканирует risk-store на каждом render.

---

# 5. Задача отдела

После разблокировки добавь одну department task:

```ts
{
  id: "review-office-access-control",
  title: "Рассмотреть внедрение СКУД",
  done: false,
}
```

После первого явного решения:

- approve;
- postpone;

задача становится `done: true`.

Если игрок отложил решение, новая task установки не создаётся.

Если одобрил, добавь:

```ts
{
  id: "implement-office-access-control",
  title: "Внедрить систему контроля доступа",
  done: false,
}
```

После активации СКУД:

```ts
done: true
```

Требования:

- tasks не дублируются;
- reset очищает их;
- reload сохраняет состояние.

---

# 6. Предложение во вкладке «Безопасность»

После разблокировки на whiteboard появляется карточка:

```text
Система контроля и управления доступом

Наблюдения показывают, что сотрудники и посетители
могут проходить в рабочие зоны без достаточного контроля.

Стоимость оборудования и настройки: 180 000 ₽
Срок внедрения:
• 2 рабочих дня с Ильёй;
• 3 рабочих дня силами Сони.

[Одобрить внедрение]
[Отложить решение]
```

Если Илья не нанят, строка про два дня может показываться как справочная польза роли, но недоступным исполнителем.

Не добавляй внешнего консультанта.

---

# 7. Решение «Отложить»

Choice id:

```ts
"postpone-access-control"
```

После решения:

- proposalStatus становится `postponed`;
- деньги не списываются;
- progress не начинается;
- задача рассмотрения становится done;
- СКУД не появляется;
- игрок может вернуться к предложению позднее;
- добавляются risk signals.

## Signals

```ts
{
  id: "access-control:postponed:office-access",
  domain: "office-access",
  impact: 1,
  source: "staffing-decision",
  sourceRef: "postpone-access-control",
}
```

```ts
{
  id: "access-control:postponed:governance",
  domain: "governance",
  impact: 1,
  source: "staffing-decision",
  sourceRef: "postpone-access-control",
}
```

Если `staffing-decision` слишком узкий source type для текущего каталога, добавь:

```ts
"access-control-decision"
```

Предпочтительно добавить новый явный source type.

## Возврат к решению

При status `postponed` карточка остаётся:

```text
Внедрение СКУД отложено.

[Вернуться к внедрению]
```

Игрок может позднее одобрить проект.

Повторное нажатие postpone не создаёт новые signals.

---

# 8. Решение «Одобрить»

Choice id:

```ts
"approve-access-control"
```

После подтверждения:

- proposalStatus становится `approved`;
- создаётся финансовая транзакция 180 000 ₽;
- добавляется task внедрения;
- игрок выбирает исполнителя;
- день не двигается;
- product progress не меняется.

## Финансовая транзакция

Добавь категорию:

```ts
"security-investment"
```

Пример:

```ts
{
  id: "security-investment:access-control",
  kind: "expense",
  category: "security-investment",
  title: "Внедрение системы контроля доступа",
  amount: 180_000,
  sprintNumber: currentSprintNumber,
  day: currentDay,
}
```

Требования:

- сумма списывается сразу при approve;
- повторное approve не создаёт вторую transaction;
- баланс может стать отрицательным;
- отмена подтверждения не создаёт transaction;
- старые transactions не меняются.

---

# 9. Подтверждение инвестиции

Перед approve покажи:

```text
Одобрить внедрение СКУД?

Стоимость: 180 000 ₽
Текущий бюджет: 1 540 000 ₽
После оплаты останется: 1 360 000 ₽

После оплаты потребуется назначить Соню или Илью
на внедрение системы.
```

Кнопки:

- `Одобрить`;
- `Отмена`.

Не блокируй approve из-за недостаточного бюджета.

Game over относится к Feature 12.

---

# 10. Исполнители внедрения

## Соня

Всегда доступна.

Трудоёмкость:

```ts
3
```

## Илья

Доступен только при реальном hire record.

Трудоёмкость:

```ts
2
```

Добавь чистую функцию:

```ts
export function getAccessControlEffortDays(
  employeeId: AccessControlAssigneeId
): number;
```

Ожидаемо:

```text
sonya-sokolova -> 3
ilya-vlasov    -> 2
```

## Ограничение занятости

Исполнитель не может одновременно:

- работать над security finding Feature 08;
- внедрять СКУД.

Расширь существующее правило активной security work.

Рекомендуемый selector:

```ts
export function getEmployeeActiveSecurityWork(
  employeeId: string,
  findingStates: SecurityFindingState[],
  accessControlState: AccessControlState
): SecurityWorkAssignment | undefined;
```

Не создавать универсальный resource scheduler.

---

# 11. Назначение на внедрение

После approve карточка показывает:

```text
Внедрение СКУД
Прогресс: 0/3

Исполнитель:
[Соня Соколова]
[Илья Власов]
```

Недоступные причины:

- Илья не нанят;
- сотрудник занят замечанием;
- СКУД уже active;
- audit pending/running;
- другая blocking операция.

Назначение:

- не двигает день;
- не списывает деньги;
- можно изменить до следующего завершения дня;
- после появления progress смена исполнителя разрешена;
- уже выполненный progress сохраняется;
- новый required effort определяется текущим исполнителем.

## Смена с Сони на Илью

Пример:

```text
Соня выполнила 1/3.
После назначения Ильи требуется 2 дня.
Progress остаётся 1.
Остаётся 1 рабочий день.
```

## Смена с Ильи на Соню

```text
Илья выполнил 1/2.
После назначения Сони требуется 3 дня.
Progress остаётся 1.
Остаётся 2 рабочих дня.
```

Progress ограничивается новым effort при расчёте.

---

# 12. Ежедневный прогресс СКУД

Добавь идемпотентный расчёт.

ID:

```text
access-control-work:sprint-{sprintNumber}:day-{day}
```

При завершении дня:

1. если proposalStatus `approved` или `in-progress`;
2. если assignedEmployeeId существует;
3. увеличить progressDays максимум на 1;
4. установить `in-progress`;
5. если progress достиг effort текущего исполнителя:
   - proposalStatus `active`;
   - записать completedAt;
   - очистить assignedEmployeeId;
   - выполнить task внедрения;
   - применить mitigation signals;
6. записать workday result.

Повторный расчёт дня не увеличивает progress.

---

# 13. Mitigation после активации

При первом переходе в `active` добавь:

```ts
{
  id: "access-control:active:office-access",
  domain: "office-access",
  impact: -4,
  source: "security-finding",
  sourceRef: "access-control-active",
}
```

```ts
{
  id: "access-control:active:governance",
  domain: "governance",
  impact: -1,
  source: "security-finding",
  sourceRef: "access-control-active",
}
```

Если source `security-finding` неточен, добавь:

```ts
"access-control-implementation"
```

Предпочтительно использовать новый явный source.

Signals создаются один раз.

Не удаляй signal postpone: история решения сохраняется.

---

# 14. Порядок completeWorkday

Расширь единый use-case.

Рекомендуемый порядок:

1. проверить блокеры;
2. применить workday внедрения СКУД;
3. определить сотрудника, занятого СКУД;
4. применить security findings для остальных сотрудников;
5. определить всех сотрудников, занятых security work;
6. применить product progress;
7. применить daily operations;
8. проверить срок follow-up audit;
9. продвинуть sprint-state;
10. добавить risk signals результатов дня;
11. detect due signals;
12. разблокировать предложение СКУД при необходимости;
13. reconcile intrusion threat;
14. открыть daily report.

Соня и Илья не создают product progress, но правило единственной security work должно оставаться согласованным.

---

# 15. Daily report внедрения

Если был progress:

```text
Система контроля доступа

Соня Соколова
Внедрение СКУД: 1/3 → 2/3
```

При завершении:

```text
Система контроля доступа

Илья Власов
Внедрение СКУД: 1/2 → 2/2

СКУД введена в эксплуатацию.
Риск физического доступа снижен.
```

Если одобрено, но исполнитель не назначен:

```text
Внедрение СКУД сегодня не продвигалось:
исполнитель не назначен.
```

Не показывай раздел до approve.

---

# 16. Визуальное состояние входа

После `proposalStatus === "active"` у входа появляется визуальный элемент СКУД.

Минимально допустимо:

- считыватель пропуска;
- зелёный индикатор;
- компактная стойка или панель у двери;
- стиль соответствует текущему low-poly офису.

Требования:

- это не временная dev-заглушка;
- элемент не мешает navmesh;
- не блокирует игрока;
- не перекрывает дверь;
- сохраняется после reload;
- исчезает после reset;
- не требует внешнего ассета, если его можно аккуратно собрать из существующих примитивов окружения.

Допустимо добавить короткую подпись при наведении:

```text
СКУД активна
```

Не реализовывай реальную систему карт доступа.

---

# 17. Угроза проникновения

Инцидент использует actual office-access risk.

## Порог

Угроза может быть вооружена, если:

```text
actual office-access level >= high
```

То есть score не меньше 5.

## Задержка

```ts
export const OFFICE_INTRUSION_DELAY_DAYS = 4;
```

При первом переходе в eligible state:

```ts
armedAtWorkdayIndex = currentWorkdayIndex;
dueWorkdayIndex = currentWorkdayIndex + 4;
status = "armed";
```

## Почему 4 дня

- без Ильи risk обнаруживается через 3 дня;
- игрок получает хотя бы один завершённый день предупреждения;
- с Ильёй предупреждение появляется раньше;
- событие не происходит немедленно.

---

# 18. Reconcile threat

Создай чистое правило:

```ts
export type IntrusionThreatContext = {
  currentWorkdayIndex: number;
  actualOfficeAccessLevel: RiskLevel;
  accessControlActive: boolean;
  intrusionStatus: OfficeIntrusionStatus;
};

export function reconcileIntrusionThreatRules(
  context: IntrusionThreatContext
): IntrusionThreatTransition;
```

## Правила

### СКУД active

Если intrusion ещё не resolved:

- status становится `prevented`;
- событие больше не запускается.

### Risk ниже high до due

Если status `armed`:

- status возвращается в `dormant`;
- armedAt и due очищаются.

Если риск позже снова достигнет high:

- угроза вооружается заново от нового текущего workday index.

### Due достигнут

Если:

```text
status === armed
currentWorkdayIndex >= dueWorkdayIndex
actual risk >= high
СКУД не active
```

то:

```text
status = pending
```

### Final states

`resolved` и `prevented` являются финальными.

Проникновение происходит максимум один раз за прохождение.

---

# 19. Предотвращение инцидента

Если СКУД активирована до due:

```text
intrusion.status = prevented
```

В daily report покажи один раз:

```text
Критический риск физического доступа устранён до инцидента.

СКУД введена в эксплуатацию вовремя.
```

Не утверждай, что конкретный человек пытался проникнуть.

Финансового вознаграждения нет.

Дополнительный risk signal не нужен сверх mitigation активации.

---

# 20. Pending intrusion

Если threat становится pending:

- daily report имеет приоритет;
- review имеет приоритет только после разрешения intrusion;
- следующий рабочий день блокируется;
- assignment и обычные панели могут быть доступны до сцены только если trigger ещё ждёт освобождения UI;
- сама сцена не применяется внутри `completeWorkday`.

Причина блокировки:

```text
Сначала завершите инцидент с доступом в офис.
```

---

# 21. Trigger сцены

Создай один trigger:

```ts
OfficeIntrusionTrigger
```

или:

```ts
useOfficeIntrusionTrigger
```

Условия:

- intrusion status `pending`;
- daily report закрыт;
- follow-up audit не pending/running;
- другая cutscene не запущена;
- server minigame закрыта;
- blocking overlay закрыт;
- blocking dialogue закрыт;
- hydration завершена.

## Приоритеты

После day 10:

1. daily report;
2. follow-up audit, если due;
3. office intrusion;
4. review.

Если одновременно pending audit и intrusion:

- audit запускается первым;
- intrusion ждёт завершения audit;
- оба эффекта применяются отдельно;
- review открывается последним.

Trigger подключается один раз на верхнем игровом уровне.

---

# 22. Кат-сцена `office-intrusion`

Добавь одну новую кат-сцену.

ID:

```text
office-intrusion
```

Используй:

- существующий Director API;
- временного актёра нарушителя;
- Соню;
- Илью, если нанят;
- существующую систему диалогов.

## Нарушитель

Это временный actor:

- появляется у входа;
- не добавляется в persistent NPC roster;
- удаляется после сцены;
- не остаётся на карте после reload;
- использует существующую совместимую модель офисного посетителя.

Если подходящей модели нет:

- перечислить отсутствующие ассеты;
- не использовать куб или невидимого actor;
- визуальную часть считать блокером полного принятия.

---

# 23. Ветка с Ильёй

Если Илья нанят на момент инцидента:

1. нарушитель проходит через вход;
2. Илья замечает его в зоне входа или до рабочего места;
3. Илья останавливает посетителя;
4. Соня подходит;
5. выясняется, что посетитель не зарегистрирован;
6. рабочая станция не была использована;
7. проводится ограниченная внутренняя проверка.

Реплики:

```text
Илья:
У этого посетителя нет согласованного доступа.
Я остановил его до входа в рабочую зону.

Соня:
Значит, даже без формальной СКУД мы уже зависим
от того, заметит ли проблему конкретный человек.

Илья:
Да. На этот раз мы успели.
Но наблюдение сотрудника не заменяет контроль входа.
```

## Последствия с Ильёй

- response cost: 60 000 ₽;
- office-access risk +2;
- governance risk +1;
- sensitive-data risk не добавляется;
- создаётся задача внедрить СКУД, если она ещё не active;
- incident status resolved.

---

# 24. Ветка без Ильи

Если Илья не нанят:

1. нарушитель проходит в Open Space;
2. подходит к свободной или оставленной рабочей станции;
3. Соня замечает его после того, как он уже оказался в рабочей зоне;
4. неизвестно, успел ли он увидеть данные;
5. приходится проводить расширенную проверку доступов и журналов.

Реплики:

```text
Соня:
Этот человек не должен был попасть в рабочую зону.
Он успел подойти к компьютеру до того, как его остановили.

Соня:
Мы не можем подтвердить утечку,
но теперь придётся проверять доступы и журналы.

Соня:
Ручного контроля недостаточно.
Нам нужна работающая система доступа.
```

## Последствия без Ильи

- response cost: 140 000 ₽;
- office-access risk +3;
- governance risk +1;
- sensitive-data risk +2;
- создаётся задача внедрить СКУД, если она ещё не active;
- incident status resolved.

Не утверждай, что данные точно украдены.

Это остаётся риском и условием будущих фич.

---

# 25. Финансовый ущерб инцидента

Добавь категорию:

```ts
"security-incident"
```

## С Ильёй

```ts
{
  id: "security-incident:office-intrusion",
  kind: "expense",
  category: "security-incident",
  title: "Проверка после попытки проникновения",
  amount: 60_000,
  sprintNumber: incidentSprint,
  day: incidentDay,
}
```

## Без Ильи

Та же id и title:

```ts
amount: 140_000
```

Требования:

- вариант определяется один раз при запуске/разрешении;
- transaction создаётся один раз;
- reload не меняет amount;
- повторная сцена не списывает деньги;
- transaction не является daily operations;
- отрицательный баланс допустим.

---

# 26. Risk signals инцидента

## С Ильёй

```ts
{
  id: "incident:office-intrusion:office-access",
  domain: "office-access",
  impact: 2,
  source: "access-control-incident",
  sourceRef: "office-intrusion:contained-early",
}
```

```ts
{
  id: "incident:office-intrusion:governance",
  domain: "governance",
  impact: 1,
  source: "access-control-incident",
  sourceRef: "office-intrusion:contained-early",
}
```

## Без Ильи

```ts
{
  id: "incident:office-intrusion:office-access",
  domain: "office-access",
  impact: 3,
  source: "access-control-incident",
  sourceRef: "office-intrusion:workstation-reached",
}
```

```ts
{
  id: "incident:office-intrusion:governance",
  domain: "governance",
  impact: 1,
  source: "access-control-incident",
  sourceRef: "office-intrusion:workstation-reached",
}
```

```ts
{
  id: "incident:office-intrusion:sensitive-data",
  domain: "sensitive-data",
  impact: 2,
  source: "access-control-incident",
  sourceRef: "office-intrusion:possible-data-exposure",
}
```

Добавь `access-control-incident` в `RiskSignalSource`.

Signals создаются при идемпотентном resolve.

---

# 27. Задачи после инцидента

Если СКУД не active, добавь или сохрани:

```ts
{
  id: "implement-office-access-control",
  title: "Внедрить систему контроля доступа",
  done: false,
}
```

Также добавь:

```ts
{
  id: "review-access-logs-after-intrusion",
  title: "Проверить доступы и журналы после проникновения",
  done: false,
}
```

## Закрытие второй задачи

Не добавляй отдельный новый work engine.

Задача становится done, когда после инцидента выполнены оба условия:

- finding `account-access-review` closed;
- finding `sensitive-data-logging-review` closed.

Если они были закрыты ещё до инцидента:

- задача создаётся сразу как done;
- не переоткрывай findings;
- не создавай новую работу задним числом.

Feature 11 может использовать sensitive-data risk, но не должна требовать эту task.

---

# 28. Окно результата

После сцены покажи блок.

## С Ильёй

```text
Попытка проникновения остановлена

Илья остановил посетителя до доступа к рабочему месту.

Расходы на внутреннюю проверку: 60 000 ₽
Новые задачи добавлены на доску.
```

## Без Ильи

```text
Посторонний проник в рабочую зону

Неизвестно, успел ли посетитель получить доступ к данным.

Расходы на проверку доступов и журналов: 140 000 ₽
Новые задачи добавлены на доску.
```

Кнопка:

```text
Продолжить
```

После закрытия:

- управление возвращается;
- следующий рабочий день разблокируется;
- если был day 10, открывается review;
- эффекты не применяются повторно.

---

# 29. Поведение после инцидента

После resolved:

- проникновение не повторяется;
- СКУД всё ещё можно одобрить и внедрить;
- task установки остаётся;
- риски можно снижать;
- игра не завершается;
- Илья не нанимается автоматически;
- внешняя охрана не появляется;
- нарушитель не становится постоянным NPC.

---

# 30. Reload во время сцены

Если persisted intrusion status:

```ts
running
```

нормализовать в:

```ts
pending
```

Сохранять:

- armedAt;
- due;
- triggeredAt;
- hadSecuritySpecialistAtIncident;
- effectsApplied;
- responseTransactionId.

## Важное решение

`hadSecuritySpecialistAtIncident` фиксируется при первом переходе `pending -> running`.

Если Илья нанят или уволен позже, ветка сцены не меняется.

Увольнение пока не реализовано, но snapshot всё равно должен быть стабильным.

Если effects уже applied:

- повторный trigger не создаёт transaction/signals/tasks;
- сцена может завершить визуальную часть и перейти в resolved.

---

# 31. Миграция Feature 09

В старом сохранении access-control state отсутствует.

## Proposal

Если detected office-access level >= elevated:

```ts
proposalStatus = "available"
```

Иначе:

```ts
proposalStatus = "locked"
```

Не списывать деньги задним числом.

## Threat

Не запускать проникновение задним числом.

Если actual office-access level >= high и СКУД не active:

```ts
status = "armed"
armedAtWorkdayIndex = currentWorkdayIndex
dueWorkdayIndex = currentWorkdayIndex + 4
```

Игрок получает полный новый срок.

Если risk ниже high:

```ts
status = "dormant"
```

---

# 32. Повреждённое состояние

Безопасно обработай:

- неизвестный proposal status;
- active без completedAt;
- approved без purchase transaction;
- progress < 0;
- дробный progress;
- неизвестный assignee;
- Илья assigned без hire record;
- duplicate workday records;
- unknown intrusion status;
- due раньше armed;
- pending без due;
- running после reload;
- resolved без effectsApplied;
- duplicate incident transaction;
- prevented при неактивной СКУД.

Рекомендуемые правила:

- unknown proposal -> locked/available по detected risk;
- negative/fraction progress -> 0;
- invalid assignee -> undefined;
- active требует completedAt, иначе in-progress;
- running -> pending;
- invalid due -> current + 4;
- prevented допустим только при active СКУД;
- financial journal является источником transaction truth;
- не сбрасывать другие stores.

---

# 33. Общий reset

Существующий `?intro` должен:

- сбросить proposalStatus в locked;
- удалить progress;
- удалить purchase transaction через economy reset;
- убрать визуальную СКУД;
- сбросить intrusion в dormant;
- удалить incident transaction;
- удалить tasks Feature 10;
- удалить risk signals Feature 10;
- сохранить существующий reset остальных подсистем.

Не добавляй второй обработчик URL.

---

# 34. Что делать нельзя

Не реализовывать:

- повторные проникновения;
- случайный выбор дня;
- вероятность прохода;
- охранника как нового сотрудника;
- внешнего security consultant;
- настоящий backend СКУД;
- отдельные пропуска каждого NPC;
- блокировку двери для игрока;
- подтверждённую кражу данных;
- удаление product progress;
- серверный простой;
- потерю клиента;
- автоматический game over;
- увольнение игрока;
- физическое насилие;
- полицейскую мини-игру;
- DeepSeek;
- универсальный event engine;
- универсальный project-work engine;
- универсальный building-access simulator.

---

# 35. Требования к чистой логике

Добавь или расширь:

```ts
export function canUnlockAccessControlProposal(
  detectedOfficeAccessLevel: RiskLevel
): boolean;

export function getAccessControlEffortDays(
  employeeId: AccessControlAssigneeId
): number;

export function canAssignAccessControlEmployee(
  context: AccessControlAssignmentContext
): AccessControlAssignmentValidation;

export function reconcileIntrusionThreatRules(
  context: IntrusionThreatContext
): IntrusionThreatTransition;

export function canTriggerOfficeIntrusion(
  context: OfficeIntrusionTriggerContext
): boolean;

export function getOfficeIntrusionResponseCost(
  hasSecuritySpecialist: boolean
): number;

export function getOfficeIntrusionRiskSignals(
  hasSecuritySpecialist: boolean,
  moment: StoryMoment
): RiskSignal[];
```

Ожидаемые расходы:

```text
с Ильёй  -> 60 000 ₽
без Ильи -> 140 000 ₽
```

---

# 36. Требования к тестам

Добавь unit-тесты чистой логики, stores и use-cases.

Минимальный набор:

## Proposal

1. controlled/low не unlock;
2. elevated/high/critical unlock;
3. unlock идемпотентен;
4. postpone не списывает деньги;
5. postpone создаёт два signals;
6. повторный postpone не дублирует;
7. postponed можно перевести в approve;
8. approve создаёт одну transaction;
9. cancel approve не создаёт transaction;
10. approve не двигает день.

## Effort и assignments

11. Соня требует 3 дня;
12. Илья требует 2 дня;
13. ненанятый Илья недоступен;
14. сотрудник с finding недоступен;
15. assignee можно сменить;
16. progress сохраняется при смене;
17. один employee не выполняет finding и СКУД одновременно;
18. unassign не сбрасывает progress.

## Workday

19. assigned employee создаёт +1;
20. no assignee не создаёт progress;
21. один день не применяется дважды;
22. завершение активирует СКУД;
23. activation закрывает task;
24. activation создаёт mitigation signals;
25. activation не меняет прошлые transactions;
26. daily operations продолжают применяться.

## Visual state

27. active state показывает entrance reader;
28. inactive не показывает;
29. reload сохраняет;
30. reset удаляет.

## Threat

31. risk ниже high не arm;
32. high arm;
33. due равен current +4;
34. risk снижается до due -> dormant;
35. повторный high arm заново;
36. active СКУД -> prevented;
37. due + high + no СКУД -> pending;
38. resolved/prevented финальны;
39. intrusion максимум один раз.

## Trigger priority

40. daily report блокирует;
41. follow-up audit блокирует;
42. other cutscene блокирует;
43. minigame блокирует;
44. free UI запускает;
45. day 10 review ждёт;
46. audit выполняется раньше intrusion;
47. rerender не запускает два instance.

## Incident branch

48. Илья snapshot фиксируется при start;
49. с Ильёй cost 60 000;
50. без Ильи cost 140 000;
51. с Ильёй нет sensitive-data signal;
52. без Ильи есть sensitive-data +2;
53. office-access impact различается;
54. governance +1 в обеих ветках;
55. tasks создаются;
56. effects идемпотентны;
57. transaction не дублируется.

## Reload и migration

58. running -> pending;
59. saved branch не меняется;
60. Feature 09 save с high risk получает новый срок;
61. старый risk не вызывает incident сразу;
62. detected elevated показывает proposal;
63. malformed state нормализуется;
64. reset очищает всё.

## Task после инцидента

65. review task открыта при незакрытых findings;
66. оба findings closed -> task done;
67. already closed findings создают done task;
68. findings не переоткрываются.

Добавь integration test:

```text
detected elevated
→ approve
→ transaction -180 000
→ назначить Илью
→ два completeWorkday
→ СКУД active
→ intrusion prevented
```

Добавь integration test без СКУД:

```text
actual office-access high
→ arm
→ четыре дня
→ pending
→ close daily report
→ scene
→ no Ilya branch
→ -140 000
→ sensitive-data signal
→ resolved
```

---

# 37. Обязательная проверка

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

# 38. Ручной сценарий приёмки

## Сценарий 1. Предложение не видно заранее

1. Иметь controlled/low office-access.
2. Открыть security tab.
3. Убедиться, что карточки СКУД нет.
4. Создать и обнаружить elevated risk.
5. Завершить день.
6. Убедиться, что карточка появилась.

## Сценарий 2. Postpone

1. Открыть предложение.
2. Нажать `Отложить`.
3. Убедиться, что бюджет не изменился.
4. Убедиться, что задача рассмотрения done.
5. Убедиться, что предложение можно открыть снова.
6. Дождаться detection signals решения.

## Сценарий 3. Approve

1. Вернуться к предложению.
2. Проверить подтверждение 180 000 ₽.
3. Нажать `Отмена`.
4. Убедиться, что денег не списано.
5. Повторно approve.
6. Убедиться, что transaction одна.
7. Убедиться, что task внедрения появилась.

## Сценарий 4. Соня внедряет

1. Назначить Соню.
2. Завершить три дня.
3. Проверять progress 1/3, 2/3, 3/3.
4. Убедиться, что СКУД active.
5. Убедиться, что считыватель появился у входа.
6. Убедиться, что task done.

## Сценарий 5. Илья внедряет

1. В другом прохождении нанять Илью.
2. Назначить его.
3. Завершить два дня.
4. Убедиться, что СКУД active быстрее.
5. Убедиться, что Илья не выполнял finding в те же дни.

## Сценарий 6. Предотвращение

1. Иметь high actual office-access.
2. Убедиться, что threat armed.
3. Активировать СКУД до due.
4. Убедиться, что status prevented.
5. Убедиться, что intrusion scene не запускается.
6. Убедиться, что сообщение о предотвращении показано один раз.

## Сценарий 7. Risk снижен без СКУД

1. Вооружить threat.
2. До due снизить actual office-access ниже high.
3. Убедиться, что status вернулся в dormant.
4. Убедиться, что scene не запускается.
5. Снова поднять risk до high.
6. Убедиться, что появился новый четырёхдневный срок.

## Сценарий 8. Проникновение с Ильёй

1. Нанять Илью, но не внедрять СКУД.
2. Держать actual office-access high до due.
3. Закрыть daily report.
4. Убедиться, что сцена запускается.
5. Убедиться, что Илья останавливает посетителя до рабочего места.
6. Убедиться, что расход 60 000 ₽.
7. Убедиться, что sensitive-data signal не создан.
8. Убедиться, что incident resolved.

## Сценарий 9. Проникновение без Ильи

1. Отказаться от Ильи.
2. Не устанавливать СКУД.
3. Держать risk high.
4. Дождаться сцены.
5. Убедиться, что посетитель достигает рабочей зоны.
6. Убедиться, что расход 140 000 ₽.
7. Убедиться, что sensitive-data risk +2.
8. Убедиться, что task проверки доступов создана.

## Сценарий 10. Приоритет day 10

1. Сделать intrusion due на day 10.
2. Одновременно сделать follow-up audit due.
3. Завершить день.
4. Убедиться: daily report первый.
5. Закрыть report.
6. Убедиться: audit второй.
7. Закрыть audit.
8. Убедиться: intrusion третий.
9. Закрыть intrusion.
10. Убедиться: review последний.

## Сценарий 11. Reload при pending/running

1. Получить pending intrusion.
2. Перезагрузить до сцены.
3. Убедиться, что сцена запускается после hydration.
4. Перезагрузить во время сцены.
5. Убедиться, что status вернулся pending.
6. Убедиться, что transaction/signals не дублируются.
7. Завершить сцену.

## Сценарий 12. Установка после инцидента

1. Пережить intrusion.
2. Одобрить СКУД.
3. Внедрить её.
4. Убедиться, что risk снижается.
5. Убедиться, что intrusion не повторяется.

## Сценарий 13. Reset

1. Иметь active СКУД или resolved intrusion.
2. Открыть игру с `?intro`.
3. Убедиться, что reader исчез.
4. Убедиться, что transactions Feature 10 удалены.
5. Убедиться, что tasks и signals удалены.
6. Убедиться, что normal flow может повториться.

## Сценарий 14. Регрессия

1. Проверить product planning.
2. Проверить findings.
3. Проверить follow-up audit.
4. Проверить risks.
5. Проверить finance.
6. Проверить team.
7. Проверить server mini-games.
8. Убедиться, что Feature 10 не создаёт server downtime.
9. Убедиться, что Feature 10 не завершает игру.
10. Убедиться, что временный нарушитель исчезает после сцены.

---

# 39. Критерии готовности

Feature 10 считается завершённой только если:

- предложение СКУД открывается по detected elevated risk;
- postpone и approve работают;
- approve списывает ровно 180 000 ₽;
- внедрение требует 3 дня Сони или 2 дня Ильи;
- сотрудник не выполняет одновременно finding и СКУД;
- active СКУД визуально отображается у входа;
- active СКУД создаёт mitigation;
- actual high risk вооружает угрозу;
- delay равен 4 рабочим дням;
- снижение риска отменяет текущую угрозу;
- СКУД предотвращает инцидент;
- без СКУД intrusion запускается детерминированно;
- сцена использует временного actor;
- с Ильёй расход 60 000 ₽;
- без Ильи расход 140 000 ₽;
- sensitive-data signal создаётся только без Ильи;
- incident происходит максимум один раз;
- day 10 priority соблюдён;
- reload и migration работают;
- reset очищает state;
- server downtime и game over не реализованы;
- существующие механики не сломаны;
- тесты проходят;
- production-сборка проходит.

---

# 40. Формат финального ответа Claude Code

Верни результат строго по структуре:

```md
## Что реализовано

## Как разблокируется предложение СКУД

## Как работают инвестиция и внедрение

## Как СКУД отображается в офисе

## Как рассчитывается угроза проникновения

## Чем отличаются последствия с Ильёй и без него

## Созданные файлы

## Изменённые файлы

## Как устроены миграция и reset

## Чем решение отличается от Feature 09

## Выполненные команды

## Результаты тестов

## Результат production-сборки

## Ручная проверка

## Ограничения текущей итерации
```

Не переходи к Feature 11.

Не добавляй серверный простой, потерю клиента или game over.
