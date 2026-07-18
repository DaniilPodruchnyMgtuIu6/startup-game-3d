# Feature 12 — срыв проекта, закрытие и увольнение игрока

## Как использовать этот файл

Передай Claude Code только этот feature-файл вместе с доступом к актуальному репозиторию.

Постоянные правила проекта должны быть подключены через корневой `CLAUDE.md`:

- `AGENTS.md`;
- `docs/claude/00-implementation-workflow.md`;
- `docs/claude/00-fixed-game-rules.md`.

Не передавай Claude Code инструкции следующих фич.

---

# Предварительные условия

Feature 01–11 должны быть завершены и приняты.

В проекте уже должны работать:

- относительное игровое время;
- спринты по 10 условных рабочих дней;
- planning, active и review;
- единая операция запуска спринта;
- единая операция завершения рабочего дня;
- бюджет и финансовый журнал;
- product backlog OfficeFlow;
- ежедневный progress;
- найм команды;
- замечания и повторные аудиты;
- `leadershipComplaint`;
- `shutdownRecommendation` после третьего провала аудита;
- скрытые actual/detected risks;
- СКУД и однократное проникновение;
- серверные инциденты;
- немедленные расходы и ежедневный простой;
- восстановление серверных инцидентов;
- department tasks;
- daily report;
- sprint review;
- сохранение, миграции и общий reset через `?intro`.

Если фактические имена файлов, stores, типов или функций отличаются, используй актуальную реализацию. Не создавай параллельные системы бюджета, времени, продукта, аудитов или инцидентов.

---

# Роль Claude Code

Ты работаешь с существующим проектом Startup Office.

Сначала изучи актуальный код. Не предполагай структуру проекта только по этому документу.

Обязательно прочитай и найди:

- `AGENTS.md`;
- корневой `CLAUDE.md`;
- постоянные документы из `docs/claude/`;
- `package.json`;
- реализацию Feature 01–11;
- источник истины финансового баланса;
- все use-case, создающие финансовые транзакции;
- единый `completeWorkday`;
- переход из review в следующий planning;
- product task catalog и состояние всех 14 задач;
- текущий progress OfficeFlow;
- `shutdownRecommendation`;
- security findings;
- audit records;
- server incident states;
- downtime transactions;
- порядок обязательных оверлеев и кат-сцен;
- общий механизм блокировки управления;
- persist, hydration, migrations и reset;
- главное меню или существующий стартовый экран;
- тесты Feature 08–11.

Перед изменением кода верни:

1. где вычисляется текущий баланс;
2. какие операции могут сделать баланс неположительным;
3. где хранится `shutdownRecommendation`;
4. как определить количество дней простоя конкретного серверного инцидента;
5. где review переводит игру в следующий спринт;
6. как определяется завершённость всех задач OfficeFlow;
7. как сейчас приостанавливаются ввод игрока и автономная жизнь NPC;
8. где безопаснее подключить единый outcome coordinator;
9. какие файлы планируется создать;
10. какие файлы планируется изменить.

После анализа реализуй только Feature 12.

---

# Цель итерации

Добавить реальные, но справедливые условия поражения.

Игра должна завершаться поражением по одной из четырёх причин:

1. бюджет исчерпан;
2. проект приостановлен руководством после систематического невыполнения требований безопасности;
3. длительный серверный простой сделал продолжение проекта невозможным;
4. команда не подготовила MVP к окончанию шестого спринта.

Feature 12 должна:

- заранее предупреждать об угрозе каждого поражения;
- давать последний шанс исправить управляемые причины;
- не использовать случайность;
- не запускать поражение от реального времени;
- не завершать игру под другим обязательным окном;
- сохранять итог и причину;
- показывать полноценный экран результатов;
- позволять начать новое прохождение через общий reset;
- предоставить Feature 13 стабильное состояние `deadlineMet` для успешного финала.

Feature 12 не добавляет выпуск MVP и победу. Это Feature 13.

---

# 1. Общий outcome-state

Создай отдельный Zustand-store.

Рекомендуемое имя:

`src/game/gameOutcomeStore.ts`

## Типы

```ts
export type GameOutcomeStatus =
  | "playing"
  | "failure-pending"
  | "failed";

export type GameFailureReason =
  | "budget-exhausted"
  | "leadership-suspension"
  | "service-collapse"
  | "delivery-deadline-missed";

export type LeadershipReviewStatus =
  | "inactive"
  | "grace-period"
  | "recovered"
  | "failed";

export type CampaignDeadlineStatus =
  | "active"
  | "met"
  | "missed";
```

## Snapshot поражения

```ts
export type GameFailureSnapshot = {
  reason: GameFailureReason;
  contributingReasons: GameFailureReason[];

  failedAt: {
    sprintNumber: number;
    day: number;
  };

  balance: number;
  productProgressPercent: number;
  completedProductTasks: number;
  totalProductTasks: number;

  completedSprints: number;
  totalAuditFines: number;
  unresolvedSecurityFindings: number;
  unresolvedServerIncidentIds: string[];

  primarySourceRef: string;
};
```

## Store

```ts
export type GameOutcomeState = {
  status: GameOutcomeStatus;

  pendingFailure?: GameFailureSnapshot;
  failure?: GameFailureSnapshot;

  leadershipReview: {
    status: LeadershipReviewStatus;
    startedAtWorkdayIndex?: number;
    dueWorkdayIndex?: number;
    recoveredAt?: StoryMoment;
  };

  campaignDeadline: {
    deadlineSprintNumber: number;
    status: CampaignDeadlineStatus;
    metAt?: StoryMoment;
  };

  registerPendingFailure(
    snapshot: GameFailureSnapshot
  ): RegisterFailureResult;

  markFailureScreenOpened(): void;

  startLeadershipGracePeriod(
    currentWorkdayIndex: number
  ): StoryTransitionResult;

  resolveLeadershipReview(
    context: LeadershipReviewResolutionContext
  ): LeadershipReviewResolutionResult;

  markCampaignDeadlineMet(
    moment: StoryMoment
  ): StoryTransitionResult;

  resetGameOutcome(): void;
};
```

Названия могут быть адаптированы к стилю проекта.

---

# 2. Начальное состояние

```ts
{
  status: "playing",
  pendingFailure: undefined,
  failure: undefined,

  leadershipReview: {
    status: "inactive",
  },

  campaignDeadline: {
    deadlineSprintNumber: 6,
    status: "active",
  },
}
```

Зафиксированная длительность первого этапа кампании:

```ts
export const CAMPAIGN_DEADLINE_SPRINT = 6;
```

Не делать deadline настраиваемым через production UI.

---

# 3. Общие правила поражения

Поражение:

- не зависит от случайного числа;
- не зависит от реального времени;
- не возникает во время ходьбы;
- не возникает при чтении диалога;
- не возникает просто от открытого браузера;
- вычисляется только в явных игровых use-case;
- регистрируется ровно один раз;
- после регистрации блокирует новые игровые действия;
- ждёт освобождения обязательного UI;
- затем показывает экран результатов.

`failed` является финальным состоянием текущего прохождения.

После `failed` нельзя:

- завершать день;
- начинать спринт;
- менять план;
- нанимать сотрудников;
- назначать security work;
- открывать мини-игры;
- запускать новые сюжетные события.

Разрешено только:

- просмотреть итог;
- начать новую игру;
- использовать dev-inspector в dev-режиме.

---

# 4. Чистая оценка условий

Создай чистый модуль.

Рекомендуемое имя:

`src/game/gameOutcomeRules.ts`

## Snapshot входных данных

```ts
export type GameOutcomeEvaluationSnapshot = {
  sprintNumber: number;
  day: number;
  completedSprints: number;

  balance: number;

  productProgressPercent: number;
  completedProductTasks: number;
  totalProductTasks: number;

  shutdownRecommendation: boolean;
  leadershipReviewStatus: LeadershipReviewStatus;
  leadershipReviewDueWorkdayIndex?: number;
  currentWorkdayIndex: number;
  unresolvedSecurityFindings: number;

  unresolvedServerIncidents: {
    incidentId: string;
    downtimeDays: number;
    status: string;
  }[];

  campaignDeadlineSprint: number;
  campaignDeadlineStatus: CampaignDeadlineStatus;
};
```

## Результат

```ts
export type GameOutcomeEvaluation = {
  primaryReason?: GameFailureReason;
  contributingReasons: GameFailureReason[];
};

export function evaluateGameFailureConditions(
  snapshot: GameOutcomeEvaluationSnapshot
): GameOutcomeEvaluation;
```

Функция:

- не читает stores;
- не изменяет state;
- не открывает UI;
- использует фиксированный приоритет причин;
- покрывается unit-тестами.

---

# 5. Приоритет причин

Если одновременно выполнено несколько условий, primary reason выбирается в порядке:

1. `budget-exhausted`;
2. `leadership-suspension`;
3. `service-collapse`;
4. `delivery-deadline-missed`.

Остальные причины сохраняются в `contributingReasons`.

Пример:

```ts
{
  primaryReason: "budget-exhausted",
  contributingReasons: [
    "leadership-suspension",
    "service-collapse",
  ],
}
```

Экран показывает primary reason крупно, а дополнительные факторы — отдельным списком.

---

# 6. Поражение: бюджет исчерпан

Условие:

```text
balance <= 0
```

Источник истины — финансовый journal Feature 02–11.

Не хранить отдельную изменяемую копию баланса.

## Где проверять

Проверку необходимо выполнять после успешного создания любого набора транзакций:

- ежедневные operations;
- зарплаты внутри operations;
- штраф аудита;
- инвестиция в СКУД;
- расходы проникновения;
- немедленные расходы серверного инцидента;
- ежедневный server downtime;
- будущие явные расходы через общий финансовый use-case.

Не добавляй React-effect, который постоянно следит за balance.

## Семантика

Если optional-решение заранее ведёт к неположительному балансу:

- разрешить отменить подтверждение;
- показать красное предупреждение;
- после подтверждения применить transaction;
- зарегистрировать pending failure.

Если обязательные расходы дня ведут к неположительному балансу:

- показать это в confirmation завершения дня;
- игрок может вернуться и изучить состояние;
- после подтверждения дня расходы применяются;
- сначала показывается daily report;
- затем обязательные события этого дня;
- затем экран поражения;
- новый день уже нельзя начать.

## Предупреждение

```text
После этой операции бюджет будет исчерпан.
Проект будет закрыт из-за невозможности оплачивать работу команды.
```

Не добавляй кредит, экстренное финансирование и продажу активов.

---

# 7. Поражение: приостановка руководством

Третья неуспешная повторная проверка уже создаёт:

```ts
shutdownRecommendation === true
```

Feature 12 не завершает игру немедленно в момент третьего штрафа.

Игрок получает последний срок на устранение всех четырёх замечаний.

## Срок

```ts
export const LEADERSHIP_GRACE_PERIOD_DAYS = 5;
```

При первом появлении `shutdownRecommendation`:

```ts
leadershipReview.status = "grace-period";
leadershipReview.startedAtWorkdayIndex = currentWorkdayIndex;
leadershipReview.dueWorkdayIndex = currentWorkdayIndex + 5;
```

Это пять будущих завершённых рабочих дней.

Пример:

```text
Рекомендация появилась после дня 31.
Финальная проверка руководства — после дня 36.
```

## Что должен сделать игрок

До due необходимо закрыть все security findings.

Не требуется новый аудит.

Проверяется фактическое состояние finding store.

## Успешное исправление

Если все findings закрыты до или в due-day:

```ts
leadershipReview.status = "recovered";
```

Добавь risk signal:

```ts
{
  id: "leadership-review:recovered:governance",
  domain: "governance",
  impact: -2,
  source: "security-audit",
  sourceRef: "leadership-review:recovered",
}
```

Исторические audit records, fines, complaint и recommendation не удаляются.

В интерфейсе показывается:

```text
Руководство сняло требование о приостановке проекта,
поскольку критические замечания устранены.
```

## Поражение

Если после завершения due-day остаётся хотя бы один open/in-progress finding:

```text
leadership-suspension
```

Не проводить четвёртый аудит.

CEO остаётся off-screen.

---

# 8. UI финального срока руководства

Во вкладке `Безопасность` после третьего провала показывай:

```text
Финальное требование руководства

До приостановки проекта: 5 рабочих дней
Открытых замечаний: 2

Закройте все замечания до окончания срока.
```

При остатке двух дней или меньше:

```text
Критический срок: 2 рабочих дня
```

В daily report:

```text
До решения руководства: 3 рабочих дня
```

В день due:

```text
Сегодня руководство принимает решение по проекту.
```

Не добавляй нового 3D-персонажа CEO.

---

# 9. Поражение: длительный серверный простой

Каждый unresolved server incident уже создаёт ежедневные downtime transactions.

Поражение наступает, если один конкретный инцидент:

- остаётся `recovery-required` или `recovering`;
- после завершения дня имеет не менее пяти downtime-days;
- не был resolved в конце этого же дня.

Зафиксировано:

```ts
export const MAX_SERVER_DOWNTIME_DAYS = 5;
```

## Источник количества дней

Предпочтительно считать по уникальным transaction ids:

```text
server-downtime:{incidentId}:sprint-{n}:day-{d}
```

Допустимо использовать идемпотентную workday history, если финансовый journal остаётся источником денежных сумм.

Не считать реальное время.

## Последний шанс

Если recovery завершается в пятый downtime-day:

- стоимость пятого дня списывается;
- incident становится resolved;
- поражение не наступает.

Если после расчёта дня incident всё ещё unresolved:

```text
service-collapse
```

## Несколько инцидентов

Достаточно одного просроченного incident.

Все unresolved incident ids сохраняются в failure snapshot.

---

# 10. Предупреждения простоя

В карточке server incident показывай:

```text
До остановки проекта: 5 рабочих дней
```

После каждого дня значение уменьшается.

При двух днях:

```text
Критический простой: осталось 2 рабочих дня
```

В daily report:

```text
AUTH ограничен третий рабочий день.
Если восстановление не завершится за 2 дня,
проект будет остановлен.
```

Если исполнитель отсутствует, дополнительно:

```text
Исполнитель восстановления не назначен.
```

---

# 11. Поражение: пропущен дедлайн MVP

Первый этап кампании должен подготовить OfficeFlow к выпуску к окончанию шестого спринта.

## Базовое условие готовности

Feature 12 считает базовый MVP готовым, если:

```text
все 14 product tasks имеют status done
```

Добавь чистый selector:

```ts
export function hasCompletedCoreMvp(
  taskStates: ProductTaskState[]
): boolean;
```

Feature 13 расширит release readiness дополнительными условиями безопасности и фактической кнопкой выпуска.

## Проверка deadline

Deadline проверяется при завершении review шестого спринта.

Не проверять его:

- во время дня 10;
- под daily report;
- под аудитом;
- под проникновением;
- под серверными сценами.

## Если все задачи завершены

```ts
campaignDeadline.status = "met";
```

Записать `metAt`.

Игрок может продолжить игру.

Feature 13 позднее покажет выпуск MVP.

## Если есть незавершённые задачи

```text
delivery-deadline-missed
```

Не переводить игру в sprint 7.

## Важно

Нельзя завершить задачи уже после шестого спринта и считать deadline выполненным.

---

# 12. Предупреждение о дедлайне

## Спринты 1–4

Не показывать постоянный критический banner.

В planning можно показывать обычную строку:

```text
Дедлайн первого этапа: конец спринта 6
```

## Спринт 5

```text
До дедлайна MVP осталось 2 спринта.
Готовность OfficeFlow: 64%
```

## Спринт 6

```text
Финальный спринт первого этапа

Незавершённых задач: 4
После этого спринта проект должен быть готов к выпуску.
```

Перегруженный план по-прежнему разрешён с существующим предупреждением.

Не выдавай автоматическую победу при 100% задач — это Feature 13.

---

# 13. Review шестого спринта

Расширь review.

После обычной статистики покажи:

```text
Дедлайн первого этапа
```

## MVP готов

```text
Все задачи OfficeFlow завершены.
Основной объём MVP подготовлен в срок.
```

Кнопка:

```text
Продолжить подготовку к выпуску
```

Она:

- помечает campaign deadline met;
- не создаёт победу;
- переводит игру дальше существующим способом;
- Feature 13 позднее заменит или расширит этот flow.

## MVP не готов

```text
MVP не подготовлен к дедлайну

Завершено задач: 11 из 14
Готовность OfficeFlow: 82%
```

Кнопка:

```text
Посмотреть итог проекта
```

Она регистрирует deadline failure и открывает экран поражения.

Не показывать обычную кнопку перехода в sprint 7.

---

# 14. Регистрация pending failure

Создай узкую операцию:

```ts
export function registerGameFailureIfNeeded(
  sourceRef: string,
  context: RegisterGameFailureContext
): RegisterFailureResult;
```

Она должна:

1. собрать актуальный evaluation snapshot;
2. вызвать чистое правило;
3. если причины отсутствуют — ничего не делать;
4. построить immutable failure snapshot;
5. вызвать `registerPendingFailure`;
6. не открывать UI напрямую;
7. не перезаписывать уже зарегистрированное поражение.

`sourceRef` примеры:

```text
complete-workday:sprint-4:day-7
security-audit:3
server-recovery:sprint-5:day-2
campaign-review:sprint-6
security-investment:access-control
```

---

# 15. Точки интеграции

Вызывай регистрацию в конкретных use-case.

## После финансовых операций

- daily workday batch;
- audit fine;
- access-control investment;
- office intrusion response;
- server incident immediate cost;
- server downtime batch.

## После завершения рабочего дня

После:

- security progress;
- server recovery;
- leadership grace evaluation;
- product progress;
- economy;
- risk detection;
- threat reconciliation.

## После third audit

Запустить leadership grace period, но не поражение немедленно.

## При завершении review sprint 6

Проверить deadline.

Не добавляй глобальный store-subscriber, который вычисляет поражение на каждом render.

---

# 16. Outcome coordinator

Создай один верхнеуровневый компонент или hook:

```ts
GameOutcomeCoordinator
```

или:

```ts
useGameOutcomeCoordinator
```

Он не вычисляет причины поражения.

Он только:

1. видит `failure-pending`;
2. ждёт безопасного момента;
3. открывает итоговый экран;
4. переводит status в `failed`.

## Безопасный момент

- daily report закрыт;
- follow-up audit не pending/running;
- office intrusion не pending/running;
- server incident scene не pending/running;
- другая cutscene не запущена;
- blocking result overlay закрыт;
- hydration завершена.

## Приоритет относительно review

### Hard failure

Для причин:

- budget-exhausted;
- leadership-suspension;
- service-collapse;

экран поражения открывается до sprint review.

### Deadline failure

Review шестого спринта показывается первым.

Поражение регистрируется из действия review.

Coordinator подключается ровно один раз.

---

# 17. Блокировка игровых действий при pending failure

С момента `failure-pending` запрещено:

- начать новый день;
- начать новый спринт;
- перейти из review в planning;
- подтверждать найм;
- подтверждать инвестицию;
- запускать мини-игру;
- назначать работу;
- вручную запускать production-события.

Если более приоритетная обязательная сцена уже идёт, она может корректно закончиться.

Use-case должны возвращать контролируемую причину:

```ts
"game-outcome-pending"
```

или эквивалент текущего стиля.

Запрещённая попытка не создаёт side effects.

---

# 18. Экран поражения

Добавь полноэкранный UI-оверлей.

Рекомендуемое имя:

`GameOverOverlay.tsx`

Он должен:

- блокировать ввод в 3D-сцену;
- приостанавливать autonomous NPC planner;
- не быть cutscene;
- использовать snapshot из outcome store;
- переживать reload;
- не пересчитывать причину после открытия.

---

# 19. Тексты поражений

## Бюджет исчерпан

Заголовок:

```text
Проект закрыт: бюджет исчерпан
```

Описание:

```text
Компания больше не может оплачивать работу команды,
инфраструктуру и обязательные расходы проекта.

Руководство остановило OfficeFlow,
а вы освобождены от роли руководителя проекта.
```

## Приостановка руководством

```text
Проект приостановлен руководством
```

```text
Критические замечания безопасности не были устранены
даже после финального срока.

Руководство остановило OfficeFlow
и сняло вас с управления проектом.
```

## Длительный простой

```text
OfficeFlow не удалось восстановить
```

```text
Критичный инфраструктурный инцидент
оставался нерешённым слишком долго.

Затраты и остановка работы сделали продолжение проекта невозможным.
```

## Пропущен дедлайн

```text
MVP не подготовлен в срок
```

```text
Шесть спринтов завершены,
но ключевые задачи OfficeFlow остались незавершёнными.

Руководство закрыло первый этап проекта
и назначило другого руководителя.
```

CEO не появляется как 3D-персонаж.

---

# 20. Статистика итогового экрана

Покажи:

```text
Спринтов завершено: 4
Готовность OfficeFlow: 71%
Завершено задач: 10 из 14
Итоговый бюджет: −45 000 ₽
Штрафы аудитов: 370 000 ₽
Открытых замечаний: 2
Активных серверных инцидентов: 1
```

Показывай только данные snapshot.

Дополнительные факторы:

```text
Дополнительные причины:
• проект получил рекомендацию о приостановке;
• AUTH оставался недоступен пять рабочих дней.
```

Не показывай raw risk scores.

---

# 21. Кнопки итогового экрана

Обязательная кнопка:

```text
Начать заново
```

Она должна:

1. использовать существующий общий reset;
2. сбросить все stores Feature 01–12;
3. очистить outcome state;
4. вернуть стартовый бюджет;
5. удалить transactions текущего прохождения;
6. удалить NPC, tasks, risks и incidents;
7. запустить существующий intro-flow.

Допустима кнопка:

```text
Остаться на экране итогов
```

если она не меняет state.

Не добавляй:

- загрузку ручного checkpoint;
- продолжение после поражения;
- рекламу за восстановление;
- скрытый dev-resume в production.

---

# 22. Состояние после reload

Если сохранено:

```ts
status: "failure-pending"
```

после hydration Coordinator открывает итоговый экран при свободном UI.

Если сохранено:

```ts
status: "failed"
```

экран поражения открывается сразу после hydration.

Не запускать заново:

- аудит;
- проникновение;
- server scene;
- финансовые операции;
- progress дня.

Failure snapshot является источником результата.

---

# 23. Dev-инструменты

Если проект уже использует dev-команды, добавь:

```js
window.__getGameOutcome()
```

Read-only результат:

- status;
- pending failure;
- failure;
- leadership review;
- campaign deadline.

Допустима dev-команда:

```js
window.__triggerGameFailure("budget-exhausted")
```

только если она явно доступна только в dev и использует normal outcome flow.

Она не должна попадать в production UI.

---

# 24. Миграция Feature 11

В старом сохранении outcome-state отсутствует.

## Общие правила

Не применять поражение задним числом сразу при hydration.

Игрок должен получить понятное состояние и минимум одну безопасную точку продолжения.

## Старый неположительный бюджет

Если:

```text
balance <= 0
```

создать `failure-pending` после hydration.

Это единственное поражение, которое регистрируется сразу, поскольку финансовое состояние уже необратимо и явно отображается.

## Старая shutdownRecommendation

Если recommendation true:

- создать leadership grace period от текущего workday index;
- дать полные пять будущих рабочих дней;
- не завершать игру немедленно.

## Старый длительный простой

Если unresolved incident уже имеет 5 или более downtime transactions:

- не проигрывать сразу;
- установить migration grace;
- считать, что осталось 1 рабочее завершение дня;
- если incident не восстановлен в этот день — service collapse.

Допустимо хранить:

```ts
migrationGraceUntilWorkdayIndex
```

в outcome store или нормализованном incident state.

## Старый sprint > 6

Если игра уже находится после шестого спринта:

- если все 14 задач done — campaign deadline met;
- иначе не проигрывать сразу;
- зарегистрировать deadline failure при следующем завершении review или попытке начать новый спринт;
- показать предупреждение до действия.

---

# 25. Нормализация повреждённого outcome-state

Безопасно обработай:

- неизвестный status;
- неизвестную failure reason;
- pending без snapshot;
- failed без snapshot;
- duplicate contributing reasons;
- отрицательные sprint/day;
- day вне 1–10;
- NaN в статистике;
- deadline sprint меньше 1;
- leadership due раньше start;
- recovered без recoveredAt;
- met deadline без metAt.

Правила:

- invalid status → playing;
- pending/failed без валидного snapshot → playing и повторная оценка в следующем use-case;
- contributing reasons дедуплицировать;
- числа ограничить допустимыми диапазонами;
- deadline sprint нормализовать к 6;
- leadership grace с invalid due → current + 5;
- не сбрасывать другие stores.

---

# 26. Общий reset

Существующий `?intro` должен также:

- вернуть outcome status `playing`;
- удалить pendingFailure;
- удалить failure;
- сбросить leadership review;
- вернуть campaign deadline active и sprint 6;
- снять блокировку ввода;
- возобновить NPC planner;
- сохранить существующий reset всех остальных подсистем.

Не добавляй второй обработчик URL.

---

# 27. Взаимодействие с существующей игрой

Feature 12 не должна ломать:

- sprint planning;
- product progress;
- team;
- finance;
- security findings;
- audits;
- risks;
- СКУД;
- intrusion;
- server incidents;
- daily report;
- review;
- dev-команды;
- reset.

До фактического outcome игра продолжает работать как раньше.

Предупреждения не должны блокировать обычные действия, кроме уже описанных mandatory states.

---

# 28. Что в этой итерации делать нельзя

Не реализовывать:

- победу;
- выпуск MVP;
- релизную кнопку;
- клиентов и выручку;
- новое финансирование;
- кредит;
- продажу доли;
- загрузку checkpoint;
- продолжение после поражения;
- случайную причину увольнения;
- game over от real-time idle;
- 3D-модель CEO;
- DeepSeek;
- универсальный achievements engine;
- универсальную campaign scripting system.

Feature 12 добавляет только поражения и состояние deadline met для Feature 13.

---

# 29. Чистые функции

Добавь или расширь:

```ts
export function hasCompletedCoreMvp(
  taskStates: ProductTaskState[]
): boolean;

export function countServerDowntimeDays(
  transactions: MoneyTransaction[],
  incidentId: string
): number;

export function isLeadershipSuspensionDue(
  currentWorkdayIndex: number,
  dueWorkdayIndex: number
): boolean;

export function evaluateGameFailureConditions(
  snapshot: GameOutcomeEvaluationSnapshot
): GameOutcomeEvaluation;

export function getGameFailurePriority(
  reason: GameFailureReason
): number;

export function buildGameFailureSnapshot(
  reason: GameFailureReason,
  contributingReasons: GameFailureReason[],
  context: GameFailureSnapshotContext
): GameFailureSnapshot;
```

---

# 30. Требования к тестам

Добавь unit-тесты чистой логики, stores, use-cases и coordinator.

Минимальный набор:

## Начальное состояние

1. status playing;
2. leadership review inactive;
3. deadline sprint равен 6;
4. reset возвращает initial state.

## Бюджет

5. balance 1 не проигрывает;
6. balance 0 создаёт budget failure;
7. balance −1 создаёт budget failure;
8. transaction cancel не создаёт failure;
9. optional transaction после подтверждения создаёт pending;
10. daily operations failure ждёт daily report;
11. повторная evaluation не дублирует failure.

## Leadership grace

12. third audit запускает grace;
13. due current +5;
14. повторный third audit не переносит due;
15. все findings closed до due → recovered;
16. все findings closed в due-day → recovered;
17. open finding после due → leadership failure;
18. recovered больше не проигрывает;
19. recovery signal создаётся один раз.

## Server downtime

20. 4 unresolved days не проигрывают;
21. 5 unresolved days создают service failure;
22. recovery в пятый день предотвращает failure;
23. resolved incident не учитывается;
24. один просроченный incident достаточен;
25. duplicate downtime transactions не увеличивают count;
26. failure snapshot содержит unresolved ids.

## Deadline

27. sprint 5 не проверяет failure;
28. sprint 6 day 10 до review не проверяет deadline;
29. review 6 + 14 done → deadline met;
30. review 6 + 13 done → deadline failure;
31. deadline failure блокирует sprint 7;
32. met deadline позволяет продолжить;
33. completed after deadline не исправляет missed state.

## Приоритет

34. budget выше leadership;
35. leadership выше service;
36. service выше deadline;
37. contributing reasons сохраняются и дедуплицируются.

## Coordinator

38. pending ждёт daily report;
39. pending ждёт audit;
40. pending ждёт intrusion;
41. pending ждёт server scene;
42. free UI открывает game-over;
43. hard failure открывается до review;
44. deadline failure возникает после review action;
45. coordinator подключает overlay один раз;
46. rerender не меняет snapshot.

## Блокировки

47. pending блокирует completeWorkday;
48. pending блокирует startSprint;
49. pending блокирует hire;
50. failed блокирует mini-game;
51. blocked action не создаёт side effects.

## Snapshot и UI

52. snapshot фиксирует balance;
53. snapshot фиксирует product stats;
54. snapshot фиксирует fines;
55. snapshot не меняется после reload;
56. UI не показывает raw risk score;
57. correct title выбирается по reason.

## Reload и migration

58. failed reload открывает overlay;
59. pending reload ждёт safe UI;
60. old negative budget создаёт pending;
61. old shutdown recommendation получает 5 дней;
62. old prolonged downtime получает 1 migration grace day;
63. old sprint >6 + complete tasks → met;
64. malformed state нормализуется;
65. reset очищает outcome.

Добавь integration test бюджета:

```text
balance 20 000
→ completeWorkday с расходом 37 000
→ daily report
→ close report
→ outcome overlay
→ reason budget-exhausted
```

Добавь integration test leadership:

```text
third failed audit
→ grace 5 days
→ оставить finding open
→ complete due day
→ pending failure
→ leadership-suspension
```

Добавь integration test recovery:

```text
server incident unresolved 4 days
→ assign employee
→ fifth day completes recovery
→ no failure
```

Добавь integration test deadline:

```text
sprint 6 review
→ 13/14 tasks
→ обычный next-sprint недоступен
→ view outcome
→ delivery-deadline-missed
```

---

# 31. Обязательная проверка

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

# 32. Ручной сценарий приёмки

## Сценарий 1. Бюджет почти исчерпан

1. Довести баланс до суммы меньше следующего дневного расхода.
2. Нажать завершение дня.
3. Убедиться, что confirmation предупреждает о закрытии проекта.
4. Нажать отмену.
5. Убедиться, что день и баланс не изменились.
6. Повторить и подтвердить.
7. Убедиться, что daily report показывается первым.
8. Закрыть обязательные события.
9. Убедиться, что открывается экран budget failure.

## Сценарий 2. Инвестиция уводит бюджет в минус

1. Иметь меньше 180 000 ₽.
2. Открыть approve СКУД.
3. Убедиться, что предупреждение показывает отрицательный остаток.
4. Отменить — failure отсутствует.
5. Подтвердить — transaction создаётся.
6. Убедиться, что outcome появляется после закрытия confirmation/result UI.

## Сценарий 3. Третий аудит и исправление

1. Провалить третий audit.
2. Убедиться, что игра не заканчивается сразу.
3. Проверить срок 5 дней.
4. Закрыть все findings до due.
5. Убедиться, что leadership status recovered.
6. Убедиться, что проект продолжается.
7. Убедиться, что historical fines не удалены.

## Сценарий 4. Приостановка руководством

1. Провалить третий audit.
2. Оставить один finding open.
3. Завершить пять будущих дней.
4. Убедиться, что daily report due-day показан.
5. Убедиться, что после него открывается leadership failure.
6. Убедиться, что CEO не появляется как NPC.

## Сценарий 5. Простой четыре дня

1. Получить server incident.
2. Не восстанавливать его четыре дня.
3. Убедиться, что предупреждения усиливаются.
4. Убедиться, что failure ещё нет.

## Сценарий 6. Восстановление в последний день

1. Иметь incident с четырьмя downtime days.
2. Назначить сотрудника так, чтобы recovery завершилась на пятом.
3. Завершить день.
4. Убедиться, что пятый downtime cost списан.
5. Убедиться, что incident resolved.
6. Убедиться, что game over не открылся.

## Сценарий 7. Длительный простой

1. Иметь четыре downtime days.
2. Не завершить recovery на пятом.
3. Завершить день.
4. Закрыть daily report.
5. Убедиться, что service-collapse открывается до review.

## Сценарий 8. Дедлайн выполнен

1. Завершить все 14 product tasks до review sprint 6.
2. Открыть review.
3. Убедиться, что показано выполнение deadline.
4. Нажать продолжение.
5. Убедиться, что game over отсутствует.
6. Убедиться, что campaign deadline status met.
7. Убедиться, что победа пока не показывается.

## Сценарий 9. Дедлайн пропущен

1. Дойти до review sprint 6 с незавершённой задачей.
2. Убедиться, что кнопки перехода в sprint 7 нет.
3. Проверить число завершённых задач.
4. Нажать `Посмотреть итог проекта`.
5. Убедиться, что reason delivery-deadline-missed.

## Сценарий 10. Несколько причин

1. Сделать баланс неположительным.
2. Одновременно иметь просроченный server incident.
3. Убедиться, что primary reason — budget.
4. Убедиться, что service collapse показан как дополнительный фактор.

## Сценарий 11. Reload

1. Получить failure-pending под daily report.
2. Перезагрузить страницу.
3. Убедиться, что финансовые операции не повторились.
4. Закрыть/восстановить UI.
5. Убедиться, что outcome открывается.
6. Перезагрузить на failed screen.
7. Убедиться, что тот же snapshot сохранился.

## Сценарий 12. Новая игра

1. На экране поражения нажать `Начать заново`.
2. Убедиться, что запускается intro.
3. Убедиться, что бюджет 2 500 000 ₽.
4. Убедиться, что tasks, team, risks, audits и incidents сброшены.
5. Убедиться, что outcome status playing.

## Сценарий 13. Регрессия

1. Проверить обычный спринт до угрозы поражения.
2. Проверить product progress.
3. Проверить audits.
4. Проверить СКУД.
5. Проверить intrusion.
6. Проверить server incidents.
7. Проверить finance.
8. Убедиться, что idle не вызывает failure.
9. Убедиться, что Feature 12 не показывает победу.
10. Убедиться, что DeepSeek не подключён.

---

# 33. Критерии готовности

Feature 12 считается завершённой только если:

- существуют ровно четыре причины поражения;
- причины детерминированы;
- budget failure срабатывает при balance <= 0;
- third audit даёт 5 дней последнего срока;
- закрытие findings спасает проект;
- незакрытые findings приводят к suspension;
- unresolved server incident получает максимум 5 downtime-days;
- восстановление в пятый день спасает проект;
- шестой спринт является deadline;
- все 14 задач помечают deadline met;
- незавершённые задачи создают deadline failure;
- причины имеют фиксированный приоритет;
- snapshot сохраняется;
- hard failure ждёт обязательные UI и открывается до review;
- deadline failure показывается после review;
- pending/failed блокируют игровые действия;
- экран поражения отображает статистику;
- `Начать заново` использует общий reset;
- reload и migration работают;
- CEO не является 3D-персонажем;
- победа не реализована;
- существующие механики не сломаны;
- тесты проходят;
- production-сборка проходит.

---

# 34. Формат финального ответа Claude Code

Верни результат строго по структуре:

```md
## Что реализовано

## Какие условия поражения добавлены

## Какие предупреждения получает игрок

## Как работает последний срок руководства

## Как учитывается длительный простой

## Как проверяется дедлайн шестого спринта

## Как устроен экран результатов

## Созданные файлы

## Изменённые файлы

## Как устроены миграция и reset

## Чем решение отличается от Feature 11

## Выполненные команды

## Результаты тестов

## Результат production-сборки

## Ручная проверка

## Ограничения текущей итерации
```

Не переходи к Feature 13.

Не добавляй выпуск MVP, победу, клиентов или выручку.
