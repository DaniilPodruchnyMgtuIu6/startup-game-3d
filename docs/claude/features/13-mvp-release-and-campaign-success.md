# Feature 13 — выпуск MVP OfficeFlow и успешный финал кампании

## Как использовать этот файл

Передай Claude Code только этот feature-файл вместе с доступом к актуальному репозиторию.

Постоянные правила проекта должны быть подключены через корневой `CLAUDE.md`:

- `AGENTS.md`;
- `docs/claude/00-implementation-workflow.md`;
- `docs/claude/00-fixed-game-rules.md`.

Не передавай Claude Code инструкции Feature 14.

---

# Предварительные условия

Feature 01–12 должны быть завершены и приняты.

В проекте уже должны работать:

- относительное игровое время;
- спринты и planning через whiteboard;
- 14 фиксированных задач OfficeFlow;
- ежедневный продуктовый прогресс;
- бюджет и финансовый журнал;
- команда и условный найм Ильи;
- замечания и повторные аудиты;
- скрытые actual/detected risks;
- СКУД и однократное проникновение;
- серверные инциденты, простой и восстановление;
- четыре детерминированных условия поражения;
- `gameOutcomeStore` или эквивалент;
- `campaignDeadline.status` со значениями `active`, `met`, `missed`;
- блокирующий экран поражения;
- общий reset через `?intro`.

Если фактические имена файлов, stores, типов или функций отличаются, используй актуальную реализацию. Не создавай параллельную outcome-систему.

---

# Роль Claude Code

Ты работаешь с существующим проектом Startup Office.

Сначала изучи актуальный код. Не предполагай структуру файлов только по этому документу.

Обязательно прочитай и найди:

- `AGENTS.md`;
- корневой `CLAUDE.md`;
- постоянные документы из `docs/claude/`;
- `package.json`;
- реализацию Feature 01–12;
- product task catalog и все 14 task states;
- вычисление product progress;
- `campaignDeadline`;
- `gameOutcomeStore`;
- coordinator экрана поражения;
- balance и финансовый journal;
- security findings;
- follow-up audit state и records;
- leadership review Feature 12;
- access-control state;
- office intrusion state;
- server incident states;
- risk selectors;
- whiteboard и mock-прототип OfficeFlow;
- registry кат-сцен и Director API;
- текущую систему блокирующих overlays;
- способ остановить player input и NPC planner;
- persist, hydration, migrations и reset;
- тесты Feature 04, 08, 11 и 12.

Перед изменением кода верни:

1. как определяется завершённость всех 14 задач;
2. как Feature 12 помечает campaign deadline met;
3. как failure-state блокирует игру;
4. какие обязательные события могут оставаться pending/running;
5. как вычислить unresolved server incidents;
6. где безопаснее разместить release readiness rules;
7. как расширить outcome-store успешным состоянием;
8. как запустить финальную сцену без конфликта с outcome overlay;
9. какие файлы планируется создать;
10. какие файлы планируется изменить.

После анализа реализуй только Feature 13.

---

# Цель итерации

Добавить успешное завершение первого этапа кампании.

Игрок должен:

1. завершить все 14 задач OfficeFlow до дедлайна;
2. открыть секцию выпуска на whiteboard;
3. провести итоговую проверку готовности;
4. увидеть конкретные блокеры и предупреждения;
5. устранить обязательные блокеры;
6. самостоятельно подтвердить выпуск MVP;
7. увидеть финальную сцену команды;
8. получить детерминированную оценку качества запуска;
9. увидеть итоговый экран кампании;
10. иметь возможность начать новое прохождение.

Победа не должна возникать автоматически при достижении 100% продукта.

Feature 13 не подключает DeepSeek и не создаёт продолжение кампании после выпуска.

---

# 1. Ранний выпуск и дедлайн

Дедлайн первого этапа остаётся:

```text
Конец шестого спринта
```

Но игрок может выпустить MVP раньше.

## Правила

Выпуск допускается, если:

- все 14 задач завершены;
- campaign deadline не `missed`;
- текущий номер спринта не превышает 6, если deadline ещё `active`;
- остальные обязательные условия готовности выполнены.

Если выпуск произошёл до review шестого спринта:

```ts
campaignDeadline.status = "met";
campaignDeadline.metAt = releaseMoment;
```

Используй существующий метод `markCampaignDeadlineMet`.

Не создавай второй deadline-state.

## Важно

Если Feature 12 уже пометила deadline `met` в review шестого спринта, выпуск остаётся доступен после устранения оставшихся блокеров.

Если deadline `missed`, победа невозможна: прохождение должно быть или уже завершено поражением, или ожидать экран поражения.

---

# 2. Задача выпуска

Когда все 14 product tasks впервые становятся `done`, добавь department task:

```ts
{
  id: "release-officeflow-mvp",
  title: "Выпустить MVP OfficeFlow",
  done: false,
}
```

Требования:

- task создаётся ровно один раз;
- не завершает игру автоматически;
- отображается во вкладке `Задачи отдела`;
- после успешного выпуска получает `done: true`;
- failed save не получает активную задачу выпуска;
- reset удаляет task;
- reload сохраняет state.

Не добавляй пятнадцатую продуктовую задачу.

---

# 3. Секция релиза на whiteboard

После завершения всех 14 задач на вкладке `Разработка OfficeFlow` появляется раздел:

```text
Выпуск MVP
```

До завершения задач допустимо показывать компактный заблокированный блок:

```text
Выпуск станет доступен после завершения всех задач OfficeFlow.
```

После завершения:

```text
OfficeFlow готов к итоговой проверке

Продуктовые задачи: 14 из 14
Дедлайн: выполнен / осталось N спринтов

[Проверить готовность к выпуску]
```

Проверка:

- не двигает игровой день;
- не списывает деньги;
- не создаёт risk signals;
- не меняет состояния других подсистем;
- вычисляется по актуальному snapshot;
- может запускаться повторно.

---

# 4. Чистая модель release readiness

Создай отдельный чистый модуль.

Рекомендуемое имя:

`src/game/mvpReleaseRules.ts`

## Типы

```ts
export type MvpReleaseBlockingReason =
  | "game-not-playing"
  | "release-already-running"
  | "release-already-completed"
  | "deadline-missed"
  | "product-incomplete"
  | "budget-exhausted"
  | "leadership-review-active"
  | "security-findings-open"
  | "follow-up-audit-pending"
  | "access-control-in-progress"
  | "office-intrusion-unresolved"
  | "server-threat-unresolved"
  | "server-incident-unresolved"
  | "cutscene-running"
  | "server-minigame-open"
  | "blocking-overlay-open"
  | "blocking-dialogue-open";

export type MvpReleaseWarning =
  | "security-specialist-not-hired"
  | "access-control-not-active"
  | "future-audit-scheduled"
  | "audit-fines-paid"
  | "leadership-complaint-exists"
  | "shutdown-recommendation-recovered"
  | "office-intrusion-occurred"
  | "server-incidents-occurred"
  | "detected-security-risks"
  | "low-remaining-budget";

export type MvpReleaseReadiness = {
  ready: boolean;
  blockingReasons: MvpReleaseBlockingReason[];
  warnings: MvpReleaseWarning[];
};
```

## Функция

```ts
export function evaluateMvpReleaseReadiness(
  snapshot: MvpReleaseReadinessSnapshot
): MvpReleaseReadiness;
```

Функция:

- не читает Zustand напрямую;
- не меняет state;
- не запускает UI;
- возвращает детерминированный результат;
- покрывается unit-тестами.

---

# 5. Обязательные блокеры выпуска

## Outcome

Выпуск запрещён, если:

- outcome status не `playing`;
- уже есть pending/finished failure;
- release уже running или completed.

## Продукт

Обязательно:

```text
14 из 14 задач done
```

Не использовать только процент, потому что округление не является источником истины.

## Дедлайн

Запрещено:

```text
campaignDeadline.status === missed
```

Разрешено:

- `active`, если текущий sprint <= 6;
- `met`.

## Бюджет

Обязательно:

```text
balance > 0
```

Нулевой или отрицательный баланс должен привести к Feature 12, а не к победе.

## Руководство

Запрещено при:

```text
leadershipReview.status === grace-period
```

`recovered` разрешён.

`failed` уже должен приводить к поражению.

## Замечания безопасности

Все четыре finding должны быть `closed`.

```text
Открытых замечаний: 0
```

## Follow-up audit

Запрещено при:

- `pending`;
- `running`.

Разрешено с warning при будущем status `scheduled`, если все findings уже closed.

Разрешено при:

- `passed`;
- `not-scheduled`;
- `critical-escalation`, только если leadership review уже `recovered` и findings закрыты.

## СКУД

Если proposal status:

- `approved`;
- `in-progress`;

выпуск блокируется, потому что уже оплаченная обязательная работа не закончена.

Разрешено при:

- `locked`;
- `available`;
- `postponed`;
- `active`.

Неактивная СКУД создаёт warning, но не является обязательным условием победы.

## Проникновение

Блокируют:

- `armed`;
- `pending`;
- `running`.

Разрешены:

- `dormant`;
- `prevented`;
- `resolved`.

Resolved создаёт warning.

## Серверные угрозы и инциденты

Каждый из трёх server incidents должен иметь финальное безопасное состояние:

- `dormant`;
- `resolved`.

Блокируют:

- `armed`;
- `pending`;
- `running`;
- `recovery-required`;
- `recovering`.

Это не позволяет выпустить продукт непосредственно перед уже подготовленным инцидентом.

## UI и сцены

В момент запуска запрещены:

- другая cutscene;
- server minigame;
- blocking overlay;
- blocking dialogue.

---

# 6. Предупреждения, не блокирующие выпуск

Покажи предупреждения, если:

- Илья не нанят;
- СКУД не active;
- запланирован будущий follow-up audit;
- были audit fines;
- существует leadership complaint;
- shutdown recommendation была получена, но leadership review восстановлен;
- произошло office intrusion;
- произошёл хотя бы один server incident;
- существует detected risk уровня `elevated`, `high` или `critical`;
- текущий баланс меньше 300 000 ₽.

Предупреждения:

- не запрещают release;
- влияют на итоговую оценку;
- должны быть понятны игроку;
- не показывают точные risk points.

---

# 7. Интерфейс итоговой проверки

После нажатия `Проверить готовность к выпуску` открой overlay.

## Готово

```text
Итоговая проверка OfficeFlow

✓ Продуктовые задачи: 14 из 14
✓ Дедлайн первого этапа не пропущен
✓ Замечания аудита закрыты
✓ Серверные инциденты восстановлены
✓ Обязательные события завершены
✓ Бюджет положительный

Предупреждения:
• СКУД не внедрена.
• На проект было наложено 120 000 ₽ штрафов.

[Выпустить MVP]
[Вернуться в офис]
```

## Есть блокеры

```text
OfficeFlow пока нельзя выпускать

✕ Не закрыто замечаний: 1
✕ Инцидент AUTH не восстановлен
✕ Внедрение СКУД оплачено, но не завершено

[Вернуться к работе]
```

Не добавляй ручные checkbox.

Каждый пункт вычисляется из store.

---

# 8. Подтверждение выпуска

Перед запуском финальной сцены покажи отдельное подтверждение:

```text
Выпустить MVP OfficeFlow?

Продуктовые задачи: 14 из 14
Замечания аудита: закрыты
Бюджет: 642 000 ₽

После выпуска текущий этап кампании завершится.
Продолжить это прохождение будет нельзя.
```

Кнопки:

- `Выпустить MVP`;
- `Отмена`.

После `Отмена`:

- состояние не меняется;
- день не двигается;
- деньги не списываются;
- сцена не запускается.

---

# 9. Расширение outcome-state

Расширь существующий `gameOutcomeStore`.

Не создавай второй final-outcome store.

## GameOutcomeStatus

```ts
export type GameOutcomeStatus =
  | "playing"
  | "failure-pending"
  | "failed"
  | "success-pending"
  | "succeeded";
```

## Результат запуска

```ts
export type CampaignSuccessTier =
  | "secure-launch"
  | "stable-launch"
  | "fragile-launch";

export type CampaignSuccessSnapshot = {
  releasedAt: {
    sprintNumber: number;
    day: number;
  };

  releaseWorkdayIndex: number;
  resultTier: CampaignSuccessTier;
  campaignScore: number;

  balance: number;
  completedProductTasks: number;
  totalProductTasks: number;
  productProgressPercent: number;

  completedSprints: number;
  metDeadlineEarly: boolean;

  teamEmployeeIds: string[];
  securitySpecialistHired: boolean;
  accessControlActive: boolean;

  auditRecords: number;
  failedAuditRecords: number;
  totalAuditFines: number;
  leadershipComplaint: boolean;
  shutdownRecommendation: boolean;

  officeIntrusionOutcome:
    | "not-triggered"
    | "prevented"
    | "contained-with-specialist"
    | "reached-work-area";

  occurredServerIncidentIds: string[];
  totalServerDowntimeCost: number;
  totalServerIncidentCost: number;

  actualRiskLevels: Record<RiskDomain, RiskLevel>;
  detectedRiskLevels: Record<RiskDomain, RiskLevel>;

  warningsAtRelease: MvpReleaseWarning[];
};
```

## Release-state

Добавь в outcome-store:

```ts
export type MvpReleaseStatus =
  | "not-started"
  | "running"
  | "released";

campaignRelease: {
  status: MvpReleaseStatus;
  startedAt?: StoryMoment;
  releasedAt?: StoryMoment;
};

pendingSuccess?: CampaignSuccessSnapshot;
success?: CampaignSuccessSnapshot;
```

## Actions

```ts
markMvpReleaseRunning(
  moment: StoryMoment
): StoryTransitionResult;

registerPendingSuccess(
  snapshot: CampaignSuccessSnapshot
): RegisterSuccessResult;

markSuccessScreenOpened(): void;

markMvpReleaseFailed(): void;
```

`resetGameOutcome` должен очищать success-state.

---

# 10. Use-case выпуска

Создай отдельную узкую операцию.

Рекомендуемое имя:

`src/game/releaseOfficeFlowMvp.ts`

```ts
export async function releaseOfficeFlowMvp(
  context: ReleaseOfficeFlowMvpContext
): Promise<ReleaseOfficeFlowMvpResult>;
```

## Правильный порядок

1. получить актуальный snapshot;
2. повторно вычислить readiness;
3. если есть blocker — вернуть controlled failure;
4. отметить release `running`;
5. если campaign deadline `active`, пометить его `met` текущим моментом;
6. запустить кат-сцену `officeflow-mvp-release`;
7. после успешной сцены собрать immutable success snapshot;
8. выполнить department task выпуска;
9. зарегистрировать `success-pending`;
10. outcome coordinator открывает итоговый экран;
11. отметить release `released` и outcome `succeeded` при открытии экрана.

## Ошибка сцены

Если scene runner завершился ошибкой:

- release status возвращается в `not-started`;
- success snapshot не создаётся;
- task не завершается;
- deadline met, уже записанный при раннем выпуске, допустимо сохранить;
- ошибка логируется;
- игрок может повторить выпуск.

Не проглатывай ошибку.

---

# 11. Результат use-case

```ts
export type ReleaseOfficeFlowMvpResult =
  | {
      released: true;
      snapshot: CampaignSuccessSnapshot;
    }
  | {
      released: false;
      reason:
        | "not-ready"
        | "already-running"
        | "already-released"
        | "game-not-playing"
        | "scene-failed";
      readiness?: MvpReleaseReadiness;
    };
```

Повторный вызов после released не запускает сцену второй раз.

---

# 12. Финальная кат-сцена

Добавь сцену:

```text
officeflow-mvp-release
```

Используй:

- существующий Director API;
- переговорную или текущую презентационную зону;
- игрока;
- Соню;
- Кирилла;
- Алину;
- Илью, только если реально нанят;
- существующий mock-прототип OfficeFlow;
- обычную систему диалогов.

Не добавляй нового CEO-NPC.

---

# 13. Последовательность сцены

## Начало

1. команда собирается у whiteboard или экрана;
2. показывается существующий mock OfficeFlow;
3. персонажи занимают проверенные точки;
4. управление игрока блокируется;
5. autonomous planner участников временно ставится на паузу.

## Соня

```text
Соня:
Все задачи первого этапа завершены.
Команда подготовила OfficeFlow к выпуску.
```

Если были штрафы или инциденты:

```text
Соня:
До этого момента мы дошли не без ошибок,
но обязательные проблемы устранены и сервис готов к запуску.
```

Если серьёзных проблем не было:

```text
Соня:
Мы сохранили управляемый темп и не оставили
критических проблем перед запуском.
```

## Кирилл

```text
Кирилл:
Серверная часть готова.
Авторизация, переговорные, пропуска, события
и уведомления собраны в одну систему.
```

## Алина

```text
Алина:
Основные пользовательские сценарии проверены.
Сотрудники смогут войти, найти переговорную
и оформить бронирование без дополнительного обучения.
```

## Илья — если нанят

```text
Илья:
Обязательные замечания закрыты.
Это не означает, что рисков больше нет,
но сейчас они не блокируют выпуск.
```

## Без Ильи

Соня произносит нейтральную реплику:

```text
Соня:
Обязательные замечания закрыты.
Дальнейший контроль безопасности останется ответственностью команды.
```

## Сообщение CEO за кадром

Покажи сообщение, письмо или экран:

```text
Руководство:
Первый этап OfficeFlow принят.
MVP разрешён к внутреннему запуску.
```

CEO не появляется в 3D.

## Завершение

```text
OfficeFlow MVP выпущен
```

После этого сцена заканчивается, и outcome coordinator открывает итог кампании.

---

# 14. Статический сценарий

Все реплики статические.

Не использовать DeepSeek.

Не генерировать финальную речь через LLM.

Не менять математический результат по тексту диалога.

---

# 15. Итоговая оценка кампании

Добавь чистый расчёт.

```ts
export function calculateCampaignSuccessScore(
  snapshot: CampaignSuccessScoreSnapshot
): CampaignSuccessScoreResult;
```

## Начальное значение

```text
100 баллов
```

## Штрафы оценки

### Проваленные аудиты

По audit records:

```text
первый failed audit  -> −5
второй failed audit  -> −10
третий failed audit  -> −20
```

### Проникновение

```text
prevented / not-triggered       -> 0
contained-with-specialist       -> −5
reached-work-area               -> −12
```

### Серверные инциденты

```text
каждый произошедший incident -> −6
```

Максимум три инцидента.

### Руководство

```text
leadershipComplaint     -> −8
shutdownRecommendation -> −15
```

### СКУД

```text
СКУД active -> 0
СКУД не active -> −5
```

### Фактические риски на момент выпуска

Для каждого из шести domains:

```text
controlled / low / elevated -> 0
high                        -> −3
critical                    -> −6
```

### Остаток бюджета

```text
balance >= 500 000 ₽ -> 0
250 000–499 999 ₽    -> −3
1–249 999 ₽          -> −7
```

Неположительный баланс release readiness не допускает.

## Итог

```ts
score = clamp(score, 0, 100);
```

Не добавляй случайность.

---

# 16. Уровни успешного финала

```ts
export function getCampaignSuccessTier(
  score: number
): CampaignSuccessTier;
```

Пороги:

```text
85–100 -> secure-launch
60–84  -> stable-launch
0–59   -> fragile-launch
```

## secure-launch

Название:

```text
Устойчивый запуск
```

Описание:

> OfficeFlow выпущен с управляемыми рисками и достаточным запасом для следующего этапа.

## stable-launch

Название:

```text
MVP успешно запущен
```

Описание:

> Команда выпустила рабочий MVP. Проекту ещё потребуются улучшения процессов и инфраструктуры.

## fragile-launch

Название:

```text
Запуск под давлением
```

Описание:

> MVP выпущен, но прошлые инциденты, штрафы и накопленные риски оставили проекту небольшой запас устойчивости.

Все три уровня являются победой.

Не превращай `fragile-launch` в поражение.

---

# 17. Итоговый экран победы

Создай блокирующий полноэкранный overlay.

## Заголовок

Зависит от result tier:

```text
Устойчивый запуск
```

или:

```text
MVP успешно запущен
```

или:

```text
Запуск под давлением
```

## Основные данные

```text
OfficeFlow MVP выпущен

Результат: 82/100
Выпуск: спринт 4, день 7
Задачи: 14 из 14
Готовность продукта: 100%
Итоговый бюджет: 642 000 ₽
Команда: 4 сотрудника
```

## Управление и безопасность

```text
Штрафы аудитов: 120 000 ₽
Повторных аудитов: 2
СКУД: активна
Проникновение: предотвращено
Серверные инциденты: 1
Расходы из-за простоев: 80 000 ₽
```

## Итоговые наблюдения

Покажи не более трёх понятных выводов.

Примеры:

- `Илья позволил устранять технические риски, не останавливая разработку.`
- `Перегруженные спринты увеличили давление на качество.`
- `Своевременная СКУД предотвратила проникновение.`
- `Серверный простой уменьшил финансовый запас.`
- `Команда выпустила MVP раньше крайнего срока.`

Выводы выбираются детерминированно из snapshot.

## Кнопка

```text
Начать новую игру
```

Кнопка вызывает существующий полный reset.

Не добавляй кнопку продолжения после финала.

---

# 18. Outcome coordinator

Расширь существующий coordinator Feature 12.

Приоритет:

1. если status `failed` — показывать failure screen;
2. если status `failure-pending` — открыть failure screen при свободном UI;
3. если status `succeeded` — показывать success screen;
4. если status `success-pending` — открыть success screen при свободном UI.

Одновременно failure и success существовать не должны.

## Guards

- `registerPendingSuccess` отклоняется, если failure уже pending/failed;
- `registerPendingFailure` отклоняется, если success pending/succeeded;
- first final outcome wins;
- release readiness не позволяет запуск успеха при pending failure.

---

# 19. Блокировка игры после успеха

После `succeeded`:

- player input заблокирован;
- NPC autonomous planners остановлены;
- `completeWorkday` запрещён;
- `startSprintWithPlan` запрещён;
- нельзя нанимать;
- нельзя менять product plan;
- нельзя назначать security work;
- нельзя открывать server mini-games;
- нельзя запускать новые cutscenes;
- нельзя создавать financial transactions;
- итоговый overlay нельзя закрыть обычной кнопкой Escape.

Используй тот же общий принцип, что и после failure.

Не дублируй блокировку в каждом React-компоненте, если есть общий selector.

---

# 20. Поведение при reload

## Release running

Если persist содержит:

```ts
campaignRelease.status === "running"
```

нормализуй в:

```ts
campaignRelease.status = "not-started"
```

Игрок может повторно запустить финальную сцену.

Success snapshot ещё не создан.

## Success pending

После hydration outcome coordinator открывает success screen и переводит status в `succeeded`.

## Succeeded

После reload:

- снова показывается итоговый экран;
- игровой мир остаётся заблокирован;
- snapshot не пересчитывается;
- score и tier не меняются из-за изменений кода каталогов;
- новая игра доступна через reset.

---

# 21. Immutable snapshot

После регистрации success итоговый экран использует сохранённый `CampaignSuccessSnapshot`.

Не пересчитывай после победы:

- баланс;
- score;
- tier;
- risk levels;
- число инцидентов;
- статистику штрафов;
- состав команды.

Это защищает итог от изменений persisted stores и будущих миграций.

---

# 22. Миграция Feature 12

В старом сохранении отсутствуют:

- campaign release state;
- pendingSuccess;
- success.

Добавь:

```ts
campaignRelease: {
  status: "not-started",
}
```

## Failed saves

- остаются failed;
- release UI не показывается;
- victory не создаётся.

## Playing + 14 задач done

- task выпуска создаётся;
- release section доступна;
- победа не запускается автоматически;
- текущий бюджет, risks, incidents и deadline сохраняются.

## Deadline met

- release доступен при выполнении blockers;
- не создавать новый sprint автоматически.

## Deadline active и ранняя готовность

- release разрешён до шестого спринта;
- deadline становится met только после подтверждённого запуска release use-case.

---

# 23. Повреждённое состояние

Безопасно обработай:

- неизвестный outcome status;
- `succeeded` без success snapshot;
- `success-pending` без snapshot;
- `released` без success;
- `running` после reload;
- unknown result tier;
- campaign score < 0 или > 100;
- неполный snapshot;
- failure и success одновременно;
- releasedAt с invalid sprint/day;
- duplicated release task.

Рекомендуемые правила:

- running → not-started;
- success-pending без валидного snapshot → playing;
- succeeded без snapshot → playing;
- score clamp 0–100 только при нормализации legacy malformed snapshot;
- unknown tier пересчитать из валидного score;
- при валидных failure и success сохранить первое зафиксированное final outcome по моменту;
- если момент сравнить невозможно, failure имеет приоритет;
- release task дедуплицировать по id;
- не сбрасывать остальные stores.

---

# 24. Общий reset

Существующий `?intro` и кнопка `Начать новую игру` должны:

- вернуть outcome status `playing`;
- удалить pendingSuccess и success;
- вернуть release status `not-started`;
- удалить releasedAt и startedAt;
- вернуть campaign deadline в начальное состояние Feature 12;
- удалить task выпуска;
- сбросить все остальные stores существующим общим reset;
- запустить пролог как раньше.

Не добавляй второй reset pipeline.

---

# 25. Взаимодействие с существующими механиками

Feature 13 не должна ломать:

- ранний product progress;
- review спринтов;
- дедлайн и поражения Feature 12;
- budget failure;
- leadership failure;
- downtime failure;
- audits;
- СКУД;
- intrusion;
- server incidents;
- risk observations;
- mock OfficeFlow;
- NPC navigation до финала;
- общий reset.

Выпуск:

- не двигает рабочий день;
- не списывает деньги;
- не создаёт product progress;
- не создаёт security progress;
- не создаёт новый audit;
- не запускает новые incidents;
- не отменяет уже pending failure.

---

# 26. Что делать нельзя

Не реализовывать:

- второй этап кампании;
- свободную игру после победы;
- доход или выручку от OfficeFlow;
- реальных клиентов;
- рынок;
- подписки;
- новое финансирование;
- продолжение после release;
- отдельный epilogue с новыми механиками;
- достижения;
- leaderboard;
- облачное сохранение;
- генеративную финальную речь;
- DeepSeek;
- универсальную campaign scripting system;
- универсальную scoring DSL.

Feature 13 завершает только первый детерминированный этап кампании.

---

# 27. Требования к чистой логике

Добавь или расширь:

```ts
export function evaluateMvpReleaseReadiness(
  snapshot: MvpReleaseReadinessSnapshot
): MvpReleaseReadiness;

export function calculateCampaignSuccessScore(
  snapshot: CampaignSuccessScoreSnapshot
): CampaignSuccessScoreResult;

export function getCampaignSuccessTier(
  score: number
): CampaignSuccessTier;

export function buildCampaignSuccessHighlights(
  snapshot: CampaignSuccessSnapshot
): string[];

export function canRegisterSuccess(
  outcomeState: GameOutcomeState
): boolean;
```

`buildCampaignSuccessHighlights` возвращает максимум три строки в стабильном порядке приоритетов.

---

# 28. Требования к тестам

Добавь unit-тесты чистой логики, store, use-case и coordinator.

Минимальный набор:

## Unlock и deadline

1. 13 задач не открывают release;
2. 14 задач открывают release;
3. release не запускается автоматически;
4. ранний release при sprint <=6 разрешён;
5. ранний release помечает deadline met;
6. deadline met сохраняется;
7. deadline missed блокирует;
8. sprint >6 с active deadline блокируется как invalid state.

## Readiness — product/outcome/budget

9. product incomplete блокирует;
10. outcome failure-pending блокирует;
11. failed блокирует;
12. balance 0 блокирует;
13. negative balance блокирует;
14. positive balance разрешает при остальных условиях;
15. release running блокирует;
16. release released блокирует повторный запуск.

## Readiness — security

17. open finding блокирует;
18. все findings closed разрешают;
19. audit pending блокирует;
20. audit running блокирует;
21. scheduled audit создаёт warning;
22. leadership grace period блокирует;
23. leadership recovered разрешает;
24. access-control approved блокирует;
25. access-control in-progress блокирует;
26. access-control active разрешает;
27. access-control postponed создаёт warning.

## Readiness — incidents

28. intrusion armed блокирует;
29. intrusion pending/running блокирует;
30. intrusion resolved разрешает с warning;
31. intrusion prevented разрешает;
32. server armed блокирует;
33. server recovery-required блокирует;
34. server recovering блокирует;
35. все resolved/dormant разрешают;
36. occurred server incidents создают warning.

## Readiness — UI

37. cutscene блокирует;
38. minigame блокирует;
39. blocking overlay блокирует;
40. blocking dialogue блокирует;
41. free state разрешает.

## Score

42. clean snapshot даёт 100 или ожидаемое значение с учётом отсутствующей СКУД;
43. first failed audit −5;
44. second failed audit −10;
45. third failed audit −20;
46. contained intrusion −5;
47. reached work area −12;
48. каждый server incident −6;
49. complaint −8;
50. shutdown recommendation −15;
51. inactive СКУД −5;
52. high risk −3 за domain;
53. critical risk −6 за domain;
54. balance 250–499k −3;
55. balance 1–249k −7;
56. score clamp 0–100.

## Tier

57. 85 -> secure;
58. 84 -> stable;
59. 60 -> stable;
60. 59 -> fragile;
61. все tiers являются success.

## Use-case

62. cancel не меняет state;
63. not-ready возвращает blockers;
64. ready запускает сцену один раз;
65. scene success создаёт immutable snapshot;
66. scene failure возвращает release not-started;
67. task выпуска выполняется после успешной сцены;
68. повторный вызов после release не запускает сцену;
69. release не двигает день;
70. release не создаёт transaction.

## Outcome coordinator

71. success-pending открывает success screen;
72. open screen переводит в succeeded;
73. failure имеет приоритет при malformed concurrent state;
74. pending failure блокирует register success;
75. pending success блокирует register failure;
76. succeeded сохраняется после reload;
77. failed save не показывает release UI.

## Final blocking

78. completeWorkday запрещён после succeeded;
79. startSprint запрещён;
80. hire запрещён;
81. server minigame запрещена;
82. NPC planner остановлен;
83. reset снова разрешает игру.

## Migration/reset

84. Feature 12 save получает release not-started;
85. playing + 14 done получает task выпуска;
86. running после reload становится not-started;
87. succeeded without snapshot нормализуется безопасно;
88. reset очищает success;
89. release task не дублируется.

Добавь integration test раннего успеха:

```text
14 tasks done в sprint 4
→ blockers отсутствуют
→ проверить readiness
→ подтвердить release
→ release cutscene
→ deadline met
→ success-pending
→ success screen
→ succeeded
```

Добавь integration test блокера:

```text
14 tasks done
→ AUTH recovering
→ readiness false
→ восстановить AUTH
→ readiness true
→ release success
```

Добавь integration test reload:

```text
succeeded snapshot
→ reload
→ тот же score/tier
→ мир заблокирован
→ reset
→ новая игра
```

---

# 29. Обязательная проверка

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

# 30. Ручной сценарий приёмки

## Сценарий 1. Раннее завершение задач

1. Завершить все 14 задач до шестого спринта.
2. Убедиться, что победа не открылась автоматически.
3. Открыть whiteboard.
4. Убедиться, что появилась секция выпуска.
5. Убедиться, что появилась department task выпуска.

## Сценарий 2. Product blocker

1. Оставить одну задачу незавершённой.
2. Убедиться, что кнопка выпуска недоступна.
3. Завершить задачу.
4. Убедиться, что секция разблокировалась.

## Сценарий 3. Security finding blocker

1. Иметь 14 готовых задач и одно открытое замечание.
2. Запустить итоговую проверку.
3. Убедиться, что release запрещён.
4. Закрыть finding рабочими днями.
5. Повторить проверку.
6. Убедиться, что blocker исчез.

## Сценарий 4. Server recovery blocker

1. Иметь AUTH в `recovering`.
2. Проверить readiness.
3. Убедиться, что release запрещён.
4. Восстановить AUTH.
5. Убедиться, что release разрешён.

## Сценарий 5. Armed threat blocker

1. Создать armed office intrusion или server threat.
2. Проверить readiness.
3. Убедиться, что выпуск заблокирован финальной проверкой.
4. Снизить risk или стабилизировать rack.
5. Убедиться, что blocker исчез.

## Сценарий 6. Предупреждения

1. Не нанимать Илью.
2. Не устанавливать СКУД.
3. Иметь один прошлый audit fine.
4. Закрыть все обязательные blockers.
5. Проверить readiness.
6. Убедиться, что release разрешён, но показаны warnings.

## Сценарий 7. Отмена

1. Дойти до финального подтверждения.
2. Нажать `Отмена`.
3. Убедиться, что день и бюджет не изменились.
4. Убедиться, что release status not-started.
5. Убедиться, что можно вернуться к игре.

## Сценарий 8. Финальная сцена с Ильёй

1. Нанять Илью.
2. Подтвердить выпуск.
3. Убедиться, что команда собралась.
4. Убедиться, что Илья присутствует и произносит свою реплику.
5. Убедиться, что CEO показан только сообщением.
6. Убедиться, что DeepSeek не вызывается.

## Сценарий 9. Финальная сцена без Ильи

1. Пройти ветку без безопасника.
2. Выпустить MVP.
3. Убедиться, что Илья не появляется.
4. Убедиться, что Соня произносит fallback-реплику.
5. Убедиться, что победа остаётся возможной.

## Сценарий 10. Secure launch

1. Избежать штрафов и инцидентов.
2. Закрыть замечания.
3. Внедрить СКУД.
4. Сохранить достаточный бюджет.
5. Выпустить MVP.
6. Убедиться, что tier `secure-launch` при выполнении порога.

## Сценарий 11. Fragile launch

1. Пережить несколько штрафов и инцидентов.
2. Восстановить обязательные blockers.
3. Сохранить положительный бюджет.
4. Выпустить MVP.
5. Убедиться, что tier может быть `fragile-launch`.
6. Убедиться, что это победа, а не поражение.

## Сценарий 12. Ранний deadline met

1. Выпустить в sprint 4.
2. Убедиться, что campaign deadline помечен met.
3. Убедиться, что releasedAt соответствует sprint 4/day.
4. Убедиться, что игра не требует ждать sprint 6.

## Сценарий 13. Review шестого спринта

1. Завершить задачи только к review sprint 6.
2. Убедиться, что Feature 12 ставит deadline met.
3. Устранить остальные blockers, если они есть.
4. Выпустить MVP.
5. Убедиться, что победа работает.

## Сценарий 14. Финальный экран

1. Завершить release scene.
2. Убедиться, что показан success overlay.
3. Проверить score, tier, бюджет, incidents и fines.
4. Убедиться, что итоговые highlights соответствуют прохождению.
5. Убедиться, что overlay нельзя закрыть Escape.
6. Убедиться, что игра под ним заблокирована.

## Сценарий 15. Reload

1. Перезагрузить страницу после победы.
2. Убедиться, что показывается тот же success screen.
3. Убедиться, что score и tier не пересчитались.
4. Убедиться, что NPC и ввод остаются заблокированы.

## Сценарий 16. Новая игра

1. Нажать `Начать новую игру`.
2. Убедиться, что выполнен общий reset.
3. Убедиться, что success snapshot удалён.
4. Убедиться, что пролог начинается заново.
5. Убедиться, что release UI отсутствует до выполнения задач.

## Сценарий 17. Регрессия поражений

1. Проверить budget failure.
2. Проверить deadline missed.
3. Убедиться, что failed save не может выпустить MVP.
4. Убедиться, что success и failure не появляются одновременно.

---

# 31. Критерии готовности

Feature 13 считается завершённой только если:

- все 14 задач открывают release section;
- победа не запускается автоматически;
- ранний выпуск до шестого спринта разрешён;
- ранний выпуск помечает deadline met;
- release readiness вычисляется чистой функцией;
- все обязательные blockers работают;
- warnings не блокируют выпуск;
- pending threats нельзя обойти выпуском;
- выпуск запускается только явным подтверждением игрока;
- финальная сцена использует существующую команду;
- Илья присутствует только при реальном найме;
- CEO остаётся за кадром;
- outcome-store поддерживает success-pending/succeeded;
- success snapshot immutable;
- score рассчитывается детерминированно;
- существуют три успешных tier;
- fragile launch остаётся победой;
- итоговый экран показывает статистику;
- после победы игра полностью заблокирована;
- reload восстанавливает победу;
- reset запускает новое прохождение;
- поражения Feature 12 продолжают работать;
- доход, клиенты и второй этап не реализованы;
- DeepSeek не подключён;
- тесты проходят;
- production-сборка проходит.

---

# 32. Формат финального ответа Claude Code

Верни результат строго по структуре:

```md
## Что реализовано

## Как открывается выпуск MVP

## Какие условия блокируют выпуск

## Как работает итоговая сцена

## Как рассчитываются score и уровень финала

## Как устроен успешный outcome

## Созданные файлы

## Изменённые файлы

## Как устроены миграция и reset

## Чем решение отличается от Feature 12

## Выполненные команды

## Результаты тестов

## Результат production-сборки

## Ручная проверка

## Ограничения текущей итерации
```

Не переходи к Feature 14.

Не подключай DeepSeek и не создавай второй этап кампании.
