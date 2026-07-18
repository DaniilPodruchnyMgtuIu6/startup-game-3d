# Feature 09 — скрытые риски и отложенные последствия решений

## Как использовать этот файл

Передай Claude Code только этот feature-файл вместе с доступом к актуальному репозиторию.

Постоянные правила проекта должны быть подключены через корневой `CLAUDE.md`:

- `AGENTS.md`;
- `docs/claude/00-implementation-workflow.md`;
- `docs/claude/00-fixed-game-rules.md`.

Не передавай Claude Code инструкции следующих фич.

---

# Предварительные условия

Feature 01–08 должны быть завершены и приняты.

В проекте уже должны работать:

- относительное игровое время;
- спринты по 10 условных рабочих дней;
- единая операция запуска спринта;
- единая операция завершения рабочего дня;
- бюджет и финансовый журнал;
- команда и найм;
- технический backlog OfficeFlow;
- ежедневный продуктовый прогресс;
- первый рабочий прототип;
- сцена `security-breach`;
- кадровое решение о безопаснике;
- условный найм Ильи;
- четыре замечания внутреннего аудита;
- назначения сотрудников на замечания;
- повторные аудиты;
- штрафы и эскалация;
- состояния серверных стоек и история попыток мини-игр;
- сохранение, миграции и общий reset.

Если фактические имена файлов, stores или методов отличаются, используй актуальную реализацию. Не создавай параллельные системы времени, продукта, аудитов, серверов или NPC.

---

# Роль Claude Code

Ты работаешь с существующим проектом Startup Office.

Сначала изучи актуальный код. Не предполагай структуру файлов только по этому документу.

Обязательно прочитай и найди:

- `AGENTS.md`;
- корневой `CLAUDE.md`;
- постоянные документы из `docs/claude/`;
- `package.json`;
- реализацию Feature 01–08;
- `startSprintWithPlan` или эквивалент;
- `completeWorkday` или эквивалент;
- product sprint plan и planned load;
- staffing decision;
- hire record Ильи;
- security findings и момент их закрытия;
- follow-up audit records;
- leadership complaint;
- shutdown recommendation;
- состояния SERVER_GATEWAY, SERVER_AUTH и SERVER_DATABASE;
- историю failures и успешного решения серверных мини-игр;
- whiteboard и вкладку `Безопасность`;
- daily report;
- NPC status;
- Zustand persist, hydration, migrations и reset;
- существующие dev-команды;
- тесты Feature 04, 07 и 08.

Перед изменением кода верни:

1. где фиксируется перегруженный план спринта;
2. где сохраняются результаты серверных мини-игр;
3. как определяется успешное решение каждой стойки;
4. где сохраняется решение о безопаснике;
5. где создаются записи повторных аудитов;
6. где фиксируется закрытие security finding;
7. как daily report получает результаты подсистем;
8. какие файлы планируется создать;
9. какие файлы планируется изменить.

После анализа реализуй только Feature 09.

---

# Цель итерации

Добавить детерминированную систему скрытых рисков.

Риски должны:

- появляться только из конкретных игровых решений и результатов;
- не зависеть от случайных чисел;
- не отображаться игроку немедленно;
- раскрываться через несколько завершённых рабочих дней;
- обнаруживаться быстрее при наличии Ильи;
- уменьшаться после реальных исправлений;
- объяснять игроку связь между решением и будущей проблемой;
- сохраняться и корректно мигрироваться;
- предоставить стабильные selectors для Feature 10–12.

Feature 09 не запускает новые крупные инциденты.

Она формирует причины и предупреждения, которые будут использованы:

- Feature 10 — СКУД и проникновение;
- Feature 11 — последствия серверных инцидентов;
- Feature 12 — поражения и закрытие проекта.

---

# 1. Основной принцип

Игрок не должен видеть скрытую формулу и точные очки риска.

Внутри игры хранится детерминированное состояние:

```text
решение или ошибка
        ↓
risk signal
        ↓
скрытый фактический уровень риска
        ↓
задержка обнаружения
        ↓
наблюдение в интерфейсе
        ↓
будущее событие использует фактический риск
```

## Важно

Илья:

- не удаляет риски автоматически;
- не предотвращает будущие события одним фактом найма;
- быстрее обнаруживает новые риски;
- точнее показывает причины;
- может снижать риски только через уже существующие исправления.

---

# 2. Домены риска

Создай фиксированный каталог из шести доменов.

Рекомендуемое имя:

`src/game/riskCatalog.ts`

## Тип

```ts
export type RiskDomain =
  | "office-access"
  | "identity-access"
  | "sensitive-data"
  | "service-continuity"
  | "governance"
  | "delivery-pressure";
```

## Описания

### office-access

Название:

```text
Физический доступ и дисциплина рабочих мест
```

Смысл:

- незаблокированные рабочие станции;
- слабая дисциплина доступа;
- будущие проблемы со СКУД;
- возможность проникновения постороннего.

Используется Feature 10.

### identity-access

Название:

```text
Учётные записи и права доступа
```

Смысл:

- лишние права;
- общие административные учётные записи;
- ошибки AUTH;
- риск компрометации аккаунта.

Используется Feature 11.

### sensitive-data

Название:

```text
Чувствительные данные и журналирование
```

Смысл:

- токены и пароли в логах;
- подозрительные запросы;
- ошибки DATABASE;
- риск утечки данных.

Используется Feature 11.

### service-continuity

Название:

```text
Устойчивость инфраструктуры
```

Смысл:

- ошибки GATEWAY;
- неустойчивые ручные исправления;
- отсутствие формального порядка реакции;
- будущие простои.

Используется Feature 11.

### governance

Название:

```text
Исполнение требований безопасности
```

Смысл:

- отказ от владельца безопасности;
- повторное игнорирование аудитов;
- жалоба высшему руководству;
- рекомендация приостановить проект.

Используется Feature 12.

### delivery-pressure

Название:

```text
Давление сроков и качество изменений
```

Смысл:

- перегруженные спринты;
- хроническая работа сверх вместимости;
- сокращение времени на проверку изменений;
- риск срыва проекта и релиза.

Используется Feature 12–13.

Не добавляй другие домены в этой итерации.

---

# 3. Уровни риска

```ts
export type RiskLevel =
  | "controlled"
  | "low"
  | "elevated"
  | "high"
  | "critical";
```

Чистая функция:

```ts
export function getRiskLevel(score: number): RiskLevel;
```

Зафиксированные пороги:

```text
score <= 0  -> controlled
score 1–2   -> low
score 3–4   -> elevated
score 5–6   -> high
score >= 7  -> critical
```

Требования:

- итоговый score не может быть меньше 0;
- отрицательные mitigation signals допустимы;
- UI не показывает числовой score;
- production UI показывает только словесный уровень;
- точный score доступен только чистым selectors и dev-инструментам.

---

# 4. Risk signal

Создай отдельный Zustand-store.

Рекомендуемое имя:

`src/game/riskStore.ts`

## Типы

```ts
export type RiskSignalSource =
  | "staffing-decision"
  | "security-hire"
  | "security-finding"
  | "security-audit"
  | "server-minigame"
  | "sprint-plan";

export type RiskSignal = {
  id: string;
  domain: RiskDomain;
  impact: number;
  source: RiskSignalSource;
  sourceRef: string;
  createdAt: {
    sprintNumber: number;
    day: number;
  };
  createdAtWorkdayIndex: number;
  detectionDelayOverride?: number;
  detectedAtWorkdayIndex?: number;
  acknowledgedAtWorkdayIndex?: number;
};
```

## Store

```ts
export type RiskState = {
  signals: RiskSignal[];

  addSignalsOnce(
    signals: RiskSignal[]
  ): AddRiskSignalsResult;

  detectDueSignals(
    currentWorkdayIndex: number,
    hasSecuritySpecialist: boolean
  ): DetectRiskSignalsResult;

  acknowledgeDetectedSignals(
    currentWorkdayIndex: number
  ): void;

  resetRisks(): void;
};
```

Названия могут быть адаптированы к стилю проекта.

## Правила

- signal id стабилен;
- signal id уникален;
- impact является ненулевым целым числом;
- повторное добавление не меняет state;
- существующий signal не перезаписывается;
- сигнал не удаляется после mitigation;
- история решений сохраняется;
- итоговый уровень рассчитывается суммой signals;
- mitigation представлен отдельным отрицательным signal;
- не менять старые signals задним числом.

---

# 5. Фактический и обнаруженный риск

Добавь selectors:

```ts
export function getActualRiskScore(
  signals: RiskSignal[],
  domain: RiskDomain
): number;

export function getDetectedRiskScore(
  signals: RiskSignal[],
  domain: RiskDomain
): number;

export function getActualRiskLevel(
  signals: RiskSignal[],
  domain: RiskDomain
): RiskLevel;

export function getDetectedRiskLevel(
  signals: RiskSignal[],
  domain: RiskDomain
): RiskLevel;
```

## Actual

Учитывает все signals домена.

Используется будущими сюжетными условиями.

## Detected

Учитывает только signals с:

```ts
detectedAtWorkdayIndex !== undefined
```

Используется производственным UI.

## Важно

Будущие инциденты должны использовать actual risk.

Игрок может ещё не знать о проблеме, но она уже существует.

При этом будущие фичи должны давать дополнительные предупреждения до необратимого последствия.

Feature 09 сама не запускает такие события.

---

# 6. Задержка обнаружения

## Без Ильи

```ts
export const DEFAULT_RISK_DETECTION_DELAY_DAYS = 3;
```

Signal, созданный в workday 12, становится обнаруженным после завершения workday 15.

## С Ильёй

```ts
export const SECURITY_SPECIALIST_DETECTION_DELAY_DAYS = 1;
```

Signal, созданный в workday 12, становится обнаруженным после завершения workday 13.

## Immediate signals

Если:

```ts
detectionDelayOverride === 0
```

signal обнаруживается в тот же игровой день.

Используй immediate detection только для явно объявленной критической эскалации третьего аудита.

## Найм Ильи после появления signal

Если signal ещё не обнаружен и Илья нанят позже:

- при следующем завершении дня использовать задержку в 1 день;
- старый signal может обнаружиться раньше первоначального срока;
- detectedAt записывается один раз.

Формула eligibility:

```ts
currentWorkdayIndex >=
  createdAtWorkdayIndex +
  effectiveDetectionDelay
```

---

# 7. Risk observations

Не создавай отдельный изменяемый список observations.

Наблюдения выводятся из detected signals.

Добавь чистые selectors:

```ts
export type RiskObservation = {
  domain: RiskDomain;
  level: RiskLevel;
  title: string;
  summary: string;
  detectedSignalIds: string[];
  unacknowledgedSignalIds: string[];
  factorLabels: string[];
};

export function buildRiskObservations(
  signals: RiskSignal[],
  options: {
    revealDetailedFactors: boolean;
  }
): RiskObservation[];
```

## Без Ильи

Игрок видит:

- домен;
- уровень;
- общий симптом;
- без точного списка технических причин.

Пример:

```text
Учётные записи и права доступа
Требует внимания

В доступах OfficeFlow обнаружены признаки избыточных разрешений.
```

## С Ильёй

Игрок дополнительно видит факторы:

```text
Факторы:
• повторные ошибки при настройке AUTH;
• проверка прав доступа ещё не завершена.
```

Не показывай raw signal ids.

---

# 8. Зафиксированные UI-формулировки уровней

```text
controlled -> Под контролем
low        -> Наблюдение
elevated   -> Требует внимания
high       -> Высокий риск
critical   -> Критический риск
```

Рекомендуемые summary:

## office-access

```text
controlled:
Процессы доступа и поведения сотрудников находятся под контролем.

low/elevated:
Есть признаки слабой дисциплины доступа и блокировки рабочих мест.

high/critical:
Недостатки контроля доступа могут позволить постороннему
получить доступ к офису или рабочей станции.
```

## identity-access

```text
controlled:
Критичные проблемы учётных записей не обнаружены.

low/elevated:
В правах и служебных учётных записях есть признаки избыточного доступа.

high/critical:
Компрометация одной учётной записи может дать доступ
к важным функциям OfficeFlow.
```

## sensitive-data

```text
controlled:
Признаки раскрытия чувствительных данных не обнаружены.

low/elevated:
Технические журналы и запросы требуют дополнительной проверки.

high/critical:
Пароли, токены или пользовательские данные могут попасть
в журналы или быть извлечены через уязвимый запрос.
```

## service-continuity

```text
controlled:
Критичные риски устойчивости инфраструктуры не обнаружены.

low/elevated:
Работа инфраструктуры зависит от ручных исправлений.

high/critical:
Следующий сбой может привести к заметному простою OfficeFlow.
```

## governance

```text
controlled:
Требования безопасности выполняются последовательно.

low/elevated:
Ответственность за безопасность распределена неясно.

high/critical:
Повторное игнорирование требований может привести
к остановке проекта решением руководства.
```

## delivery-pressure

```text
controlled:
Планирование оставляет время на проверку изменений.

low/elevated:
Команда регулярно берёт больше работы, чем может завершить.

high/critical:
Постоянная перегрузка повышает вероятность дефектов
и срыва релиза.
```

---

# 9. Сигналы кадрового решения

После Feature 06 при решении:

```ts
"decline-security-hire"
```

добавь два signals:

```ts
{
  id: "staffing:decline-security-hire:governance",
  domain: "governance",
  impact: 2,
  source: "staffing-decision",
  sourceRef: "decline-security-hire",
}
```

```ts
{
  id: "staffing:decline-security-hire:office-access",
  domain: "office-access",
  impact: 1,
  source: "staffing-decision",
  sourceRef: "decline-security-hire",
}
```

После реального найма Ильи:

```ts
{
  id: "staffing:ilya-vlasov-hired:governance",
  domain: "governance",
  impact: -1,
  source: "security-hire",
  sourceRef: "ilya-vlasov",
}
```

## Важно

Одобрение вакансии без фактического найма не создаёт mitigation.

Нужен реальный hire record.

---

# 10. Сигналы закрытия замечаний

При первом закрытии finding добавляй signals.

## workstation-locking-training

```ts
{
  id: "finding:workstation-locking-training:closed",
  domain: "office-access",
  impact: -2,
  source: "security-finding",
  sourceRef: "workstation-locking-training",
}
```

## account-access-review

```ts
{
  id: "finding:account-access-review:closed",
  domain: "identity-access",
  impact: -3,
  source: "security-finding",
  sourceRef: "account-access-review",
}
```

## incident-response-procedure

Два signals:

```ts
{
  id: "finding:incident-response-procedure:closed:governance",
  domain: "governance",
  impact: -1,
  source: "security-finding",
  sourceRef: "incident-response-procedure",
}
```

```ts
{
  id: "finding:incident-response-procedure:closed:continuity",
  domain: "service-continuity",
  impact: -1,
  source: "security-finding",
  sourceRef: "incident-response-procedure",
}
```

## sensitive-data-logging-review

```ts
{
  id: "finding:sensitive-data-logging-review:closed",
  domain: "sensitive-data",
  impact: -3,
  source: "security-finding",
  sourceRef: "sensitive-data-logging-review",
}
```

Создавай signals в том же use-case, где finding впервые становится closed.

Не сканируй React UI.

---

# 11. Сигналы повторных аудитов

## Успешный аудит

Для audit number N:

```ts
{
  id: `audit:${N}:passed:governance`,
  domain: "governance",
  impact: -3,
  source: "security-audit",
  sourceRef: `audit:${N}:passed`,
}
```

## Первый провал

```ts
{
  id: "audit:1:failed:governance",
  domain: "governance",
  impact: 2,
  source: "security-audit",
  sourceRef: "audit:1:failed",
}
```

## Второй провал

```ts
{
  id: "audit:2:failed:governance",
  domain: "governance",
  impact: 3,
  source: "security-audit",
  sourceRef: "audit:2:failed",
}
```

## Третий провал

```ts
{
  id: "audit:3:failed:governance",
  domain: "governance",
  impact: 4,
  source: "security-audit",
  sourceRef: "audit:3:failed",
  detectionDelayOverride: 0,
}
```

Audit signals создаются при идемпотентном разрешении проверки.

Повторное открытие сцены не создаёт копии.

---

# 12. Сигналы серверных мини-игр

Используй существующие rack ids или создай явный adapter.

Рекомендуемый модуль:

`src/game/serverRiskAdapter.ts`

## Поддерживаемые стойки

- GATEWAY;
- AUTH;
- DATABASE.

BACKUP в Feature 09 не создаёт signals, поскольку для неё ещё нет завершённой механики.

## Ошибки

Учитываются только первые две неуспешные попытки каждой стойки.

### GATEWAY

```text
server:gateway:failure:1 -> service-continuity +1
server:gateway:failure:2 -> service-continuity +1
```

### AUTH

```text
server:auth:failure:1 -> identity-access +1
server:auth:failure:2 -> identity-access +1
```

### DATABASE

```text
server:database:failure:1 -> sensitive-data +1
server:database:failure:2 -> sensitive-data +1
```

Третья и последующие ошибки сохраняются в существующей истории, но не добавляют новые risk points.

## Успешная стабилизация

При первом успешном решении:

```text
server:gateway:stabilized  -> service-continuity -2
server:auth:stabilized     -> identity-access -2
server:database:stabilized -> sensitive-data -2
```

## Требования

- не менять существующий incident history;
- не переписывать мини-игры;
- signals создаются после сохранения результата мини-игры;
- success signal создаётся один раз;
- старые failures не удаляются;
- прошлые risk signals не удаляются;
- mitigation компенсирует их суммой.

---

# 13. Сигналы перегруженного спринта

При запуске спринта вычисляй planned load Кирилла и Алины.

Для каждого сотрудника с load > 10 добавляй один signal.

## Impact

```ts
export function getSprintOverloadRiskImpact(
  plannedLoadDays: number
): number;
```

Зафиксированные правила:

```text
load <= 10 -> 0
load 11–13 -> 1
load 14–16 -> 2
load >= 17 -> 3
```

## Signal id

```text
sprint:{sprintNumber}:overload:{employeeId}
```

Пример:

```ts
{
  id: "sprint:3:overload:kirill-morozov",
  domain: "delivery-pressure",
  impact: 2,
  source: "sprint-plan",
  sourceRef: "sprint:3:kirill-morozov:load-15",
}
```

## Сбалансированный спринт

Если:

- Кирилл load <= 10;
- Алина load <= 10;
- в истории уже существует хотя бы один положительный overload signal;

добавь:

```ts
{
  id: `sprint:${sprintNumber}:balanced-plan`,
  domain: "delivery-pressure",
  impact: -1,
  source: "sprint-plan",
  sourceRef: `sprint:${sprintNumber}:balanced`,
}
```

Один сбалансированный спринт уменьшает накопленный риск только на 1.

Не создавай более одного balanced signal на спринт.

---

# 14. Факторные подписи

Создай чистое отображение signal → понятная причина.

Рекомендуемая функция:

```ts
export function getRiskSignalFactorLabel(
  signal: RiskSignal
): string;
```

Примеры:

```text
staffing:decline-security-hire
-> За безопасность не назначен отдельный ответственный.

finding:account-access-review:closed
-> Проверка учётных записей и прав доступа завершена.

audit:2:failed
-> Требования повторного аудита не выполнены второй раз.

server:auth:failure:1
-> При настройке AUTH была допущена ошибка.

server:auth:stabilized
-> Конфигурация AUTH успешно исправлена.

sprint:3:overload:kirill-morozov
-> План Кирилла превысил вместимость спринта.
```

Без Ильи factor labels не показываются в production UI.

Они всё равно используются в тестах и dev inspector.

---

# 15. Обнаружение при завершении дня

Расширь единый `completeWorkday`.

После:

- security work;
- product work;
- economy;
- audit scheduling;
- sprint transition;

вызови:

```ts
detectDueSignals(
  completedWorkdayIndex,
  hasSecuritySpecialist
);
```

Рекомендуемый порядок:

1. применить игровые результаты дня;
2. добавить signals, созданные результатами дня;
3. продвинуть sprint state;
4. обнаружить due signals по завершённому workday index;
5. включить detected signals в daily report.

## Важно

Открытие и закрытие интерфейсов не обнаруживает signals.

Обнаружение происходит только при завершении рабочего дня.

---

# 16. Daily report

Добавь раздел только если в завершённый день появились новые detected signals.

## Новый положительный risk signal

```text
Новые сигналы риска

Учётные записи и права доступа
Требует внимания

В правах и служебных учётных записях
есть признаки избыточного доступа.
```

## Новый mitigation signal

```text
Состояние безопасности улучшилось

Учётные записи и права доступа
Риск снижен после завершения проверки прав.
```

## Несколько signals одного домена

Не показывай несколько одинаковых карточек.

Сгруппируй по domain и покажи новое detected level.

## При наличии Ильи

Дополнительно:

```text
Илья связывает риск с двумя факторами:
• повторные ошибки AUTH;
• незавершённая проверка прав доступа.
```

Не открывай отдельную кат-сцену.

---

# 17. Вкладка «Безопасность»

Расширь существующую вкладку whiteboard.

После corrective action plan добавь раздел:

```text
Наблюдения и риски
```

## Отображение

Показывай только domains, у которых detected score > 0, а также domains с недавно обнаруженным улучшением.

Карточка:

```text
Учётные записи и права доступа
Высокий риск

Компрометация одной учётной записи может дать
доступ к важным функциям OfficeFlow.
```

С Ильёй:

```text
Факторы:
• две ошибки при настройке AUTH;
• проверка прав доступа не завершена.
```

## Badge

На вкладке показывай число unacknowledged detected signals:

```text
Безопасность (2)
```

При открытии вкладки:

```ts
acknowledgeDetectedSignals(currentWorkdayIndex)
```

Требования:

- acknowledgement не уменьшает risk;
- acknowledgement не удаляет signals;
- badge исчезает;
- reload сохраняет acknowledgement;
- новые detected signals снова создают badge.

---

# 18. Отображение controlled domains

Не показывай все шесть карточек постоянно.

Если domain controlled и в нём никогда не было detected signals:

- карточка скрыта.

Если domain раньше был проблемным, а затем стал controlled:

```text
Учётные записи и права доступа
Под контролем

Последние исправления снизили обнаруженный риск.
```

Карточка остаётся, чтобы игрок видел результат исправлений.

---

# 19. NPC-статусы и короткие реплики

Не добавляй обязательные диалоги.

## Илья

Если есть unacknowledged high/critical observation, повторный статический диалог Ильи меняется на:

```text
Илья:
Я обнаружил риск, который стоит посмотреть на доске безопасности.
Проблема пока не стала инцидентом, но откладывать её опасно.
```

После acknowledgement возвращается обычная реплика.

## Соня без Ильи

Если high/critical observation обнаружен без безопасника:

```text
Соня:
У нас появились тревожные признаки по безопасности.
Я добавила их на доску, но техническую причину ещё нужно уточнить.
```

Не добавляй story marker.

Не блокируй завершение дня.

---

# 20. Dev inspector

Если проект уже использует dev-команды, добавь read-only команду:

```js
window.__getRiskState()
```

Она возвращает:

- signals;
- actual score по domains;
- detected score;
- actual level;
- detected level.

Команда:

- доступна только в dev;
- не изменяет state;
- не добавляет signals;
- не доступна как production UI.

Если существующая архитектура не использует подобные команды, допустимо не добавлять её.

---

# 21. Stable selectors для будущих фич

Обязательно экспортируй:

```ts
export function hasActualRiskAtLeast(
  signals: RiskSignal[],
  domain: RiskDomain,
  minimumLevel: RiskLevel
): boolean;

export function getRiskLevelReachedAt(
  signals: RiskSignal[],
  domain: RiskDomain,
  minimumLevel: RiskLevel
): number | null;

export function getActivePositiveRiskSignals(
  signals: RiskSignal[],
  domain: RiskDomain
): RiskSignal[];

export function getActiveMitigationSignals(
  signals: RiskSignal[],
  domain: RiskDomain
): RiskSignal[];
```

## getRiskLevelReachedAt

Возвращает первый workday index, на котором накопленная сумма signals достигла указанного уровня.

Суммируй signals в порядке:

1. createdAtWorkdayIndex;
2. id для стабильного tie-break.

Mitigation может позже снизить уровень, но функция возвращает исторический первый момент достижения.

Feature 10–12 будут использовать этот selector.

---

# 22. Интеграционные точки

Добавляй signals только в конкретных use-cases:

## Staffing

- `resolveSecurityStaffingDecision`;
- `hireSecuritySpecialist`.

## Findings

- `applySecurityWorkday`, когда finding впервые closed.

## Audits

- `resolvePendingAudit`.

## Servers

- use-case сохранения результата mini-game.

## Sprint plan

- `startSprintWithPlan`.

Не создавай:

- общий event bus;
- глобальный подписчик на все stores;
- бесконечный polling;
- browser timer;
- универсальный rules engine.

Risk store не должен сам сканировать остальные stores на каждом render.

---

# 23. Старые сохранения Feature 08

В старом сохранении risk-state отсутствует.

При миграции необходимо восстановить signals из уже произошедших фактов.

Создай чистую функцию:

```ts
export function rebuildRiskSignalsFromGameState(
  snapshot: RiskRebuildSnapshot
): RiskSignal[];
```

## Восстанавливать

- staffing decline;
- реальный hire Ильи;
- закрытые findings;
- records passed/failed audits;
- первые две server failures каждой стойки;
- successful stabilized server states;
- сохранённые планы завершённых/активных спринтов, если overload history доступна.

## Если overload history отсутствует

Не угадывать прошлую перегрузку.

Начать создавать sprint risk signals только с будущих запусков спринта.

## Detection state при миграции

Все восстановленные signals:

- сохраняют approximate created moment из исходных записей;
- если точного момента нет, используют текущий workday index;
- не считаются detected автоматически;
- проходят обычную задержку;
- critical third audit signal может быть detected немедленно.

## Идемпотентность

Повторная миграция не создаёт дубликаты.

---

# 24. Повреждённое risk-state

Безопасно обработай:

- неизвестный domain;
- неизвестный source;
- duplicate ids;
- impact 0;
- дробный impact;
- NaN;
- invalid sprint/day;
- invalid workday index;
- detected before created;
- acknowledged before detected;
- unknown fields.

Правила:

- неизвестные signals удалить;
- duplicates дедуплицировать по id;
- impact округлять запрещено — invalid signal удалить;
- detectedAt не может быть меньше createdAt;
- acknowledgedAt без detectedAt очищается;
- acknowledgedAt не может быть меньше detectedAt;
- risk score всегда clamp до 0;
- другие stores не сбрасывать.

---

# 25. Общий reset

Существующий `?intro` должен:

- удалить все risk signals;
- удалить detection state;
- удалить acknowledgement state;
- вернуть actual и detected risk к controlled;
- сохранить существующий reset других подсистем.

Не добавляй второй обработчик URL.

---

# 26. Что игрок должен увидеть

После Feature 09 игрок видит не новую случайную кат-сцену, а систему ранних признаков.

Пример без Ильи:

```text
Игрок отказался от безопасника
        ↓
Проходит три рабочих дня
        ↓
Daily report:
«Исполнение требований безопасности — требует внимания»
        ↓
На доске появляется общее предупреждение
без точной технической причины
```

Пример с Ильёй:

```text
Игрок дважды ошибся в AUTH
        ↓
Проходит один рабочий день
        ↓
Daily report:
«Учётные записи и права доступа — требует внимания»
        ↓
Илья указывает:
«Причина — повторные ошибки настройки AUTH»
```

Пример исправления:

```text
Игрок завершил проверку прав доступа
        ↓
Создан mitigation signal
        ↓
После обнаружения:
«Риск учётных записей снижен»
```

---

# 27. Что в этой итерации делать нельзя

Не реализовывать:

- автоматическое проникновение в офис;
- сцену со СКУД;
- постоянного нарушителя;
- кражу данных;
- финансовый ущерб серверного сбоя;
- простой OfficeFlow;
- потерю клиента;
- автоматический game over;
- увольнение игрока;
- победу;
- случайный шанс события;
- бросок вероятности;
- скрытый random seed;
- универсальный event engine;
- универсальный risk DSL;
- автоматическое исправление Ильёй;
- новую числовую шкалу в HUD;
- мораль;
- отношения;
- DeepSeek.

Не показывай игроку точные risk points.

---

# 28. Требования к тестам

Добавь unit-тесты чистой логики, stores и интеграций.

Минимальный набор:

## Уровни

1. score 0 -> controlled;
2. score 1–2 -> low;
3. score 3–4 -> elevated;
4. score 5–6 -> high;
5. score 7+ -> critical;
6. отрицательная сумма clamp до 0.

## Risk store

7. signal добавляется;
8. duplicate id не добавляется;
9. несколько domains считаются отдельно;
10. mitigation уменьшает score;
11. signal history не удаляется;
12. reset очищает state;
13. malformed signals нормализуются.

## Detection

14. без Ильи delay 3;
15. с Ильёй delay 1;
16. immediate signal delay 0;
17. signal не обнаруживается раньше;
18. detectedAt записывается один раз;
19. поздний hire Ильи ускоряет detection;
20. acknowledgement не меняет score;
21. unacknowledged badge считается корректно.

## Staffing

22. decline создаёт governance +2;
23. decline создаёт office-access +1;
24. approve без hire не создаёт mitigation;
25. реальный hire Ильи создаёт governance -1;
26. повторный decision/hire не дублирует signals.

## Findings

27. workstation finding уменьшает office-access на 2;
28. account finding уменьшает identity на 3;
29. incident response уменьшает два domains;
30. logging finding уменьшает sensitive-data на 3;
31. повторное закрытие не дублирует signals.

## Audits

32. passed создаёт governance -3;
33. audit 1 failed +2;
34. audit 2 failed +3;
35. audit 3 failed +4 immediate;
36. повторное resolve не дублирует.

## Servers

37. first gateway failure +1 continuity;
38. second gateway failure +1;
39. third failure не создаёт signal;
40. gateway success -2;
41. auth failures влияют только identity;
42. database failures влияют только sensitive-data;
43. success signal создаётся один раз;
44. incident history не меняется risk adapter.

## Sprint overload

45. load 10 -> impact 0;
46. load 11–13 -> 1;
47. load 14–16 -> 2;
48. load 17+ -> 3;
49. overload signal создаётся per employee;
50. balanced sprint создаёт -1;
51. balanced signal только один per sprint;
52. reload не дублирует.

## Observations

53. без Ильи factor labels скрыты;
54. с Ильёй factor labels видны;
55. domains группируются;
56. UI не получает raw score;
57. controlled never-seen domain скрыт;
58. mitigated historical domain остаётся как controlled.

## Workday

59. detection вызывается только при completeWorkday;
60. открытие UI не обнаруживает signals;
61. new detected signals входят в daily report;
62. multiple signals одного domain группируются;
63. mitigation report показывает улучшение.

## Future selectors

64. hasActualRiskAtLeast использует actual;
65. detected risk не влияет на actual selector;
66. getRiskLevelReachedAt возвращает первый threshold moment;
67. mitigation не меняет исторический first reached moment;
68. tie-break стабилен.

## Миграция

69. Feature 08 snapshot восстанавливает decision signals;
70. восстанавливает findings;
71. восстанавливает audits;
72. восстанавливает server failures;
73. overload не угадывается без history;
74. повторный rebuild не дублирует;
75. reset очищает rebuilt signals.

Добавь integration test:

```text
дважды ошибиться AUTH
→ завершить день без Ильи три раза
→ observation identity-access появляется
→ исправить AUTH
→ stabilization mitigation
→ detected level снижается
```

Добавь integration test с Ильёй:

```text
создать database failure
→ нанят Илья
→ завершить следующий день
→ observation sensitive-data появляется
→ factor label виден
```

---

# 29. Обязательная проверка после реализации

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

## Сценарий 1. Отказ от безопасника

1. Пройти аудит.
2. Отказаться от найма Ильи.
3. Убедиться, что warning не появляется сразу.
4. Завершить три рабочих дня.
5. Убедиться, что daily report показывает новый governance risk.
6. Открыть вкладку безопасности.
7. Убедиться, что причина описана обобщённо.
8. Убедиться, что exact score не отображается.

## Сценарий 2. Найм Ильи

1. Одобрить и нанять Илью.
2. Создать новый server risk signal.
3. Завершить один рабочий день.
4. Убедиться, что observation уже обнаружено.
5. Убедиться, что Илья показывает точный factor.
6. Убедиться, что риск не исчез только из-за наличия Ильи.

## Сценарий 3. AUTH

1. Дважды ошибиться в AUTH mini-game.
2. Убедиться, что немедленного события нет.
3. Дождаться detection.
4. Проверить identity-access observation.
5. Успешно решить AUTH.
6. Завершать дни до detection mitigation.
7. Убедиться, что detected level снизился.
8. Убедиться, что failures остались в incident history.

## Сценарий 4. DATABASE

1. Ошибиться в DATABASE.
2. Проверить delayed sensitive-data observation.
3. Успешно исправить DATABASE.
4. Проверить сообщение об улучшении.

## Сценарий 5. GATEWAY

1. Допустить две ошибки GATEWAY.
2. Проверить service-continuity risk.
3. Допустить третью ошибку.
4. Убедиться, что risk points больше не растут.
5. Успешно стабилизировать стойку.
6. Проверить mitigation.

## Сценарий 6. Перегруженный спринт

1. Запланировать Кириллу 15 дней работы.
2. Начать спринт.
3. Убедиться, что risk не показывается сразу.
4. Дождаться detection.
5. Проверить delivery-pressure high/elevated по фактической сумме.
6. В следующем спринте дать обоим не более 10 дней.
7. Убедиться, что создаётся mitigation -1.
8. Убедиться, что риск не обнуляется мгновенно.

## Сценарий 7. Закрытие finding

1. Иметь positive risk соответствующего domain.
2. Закрыть security finding.
3. Убедиться, что mitigation не меняет старую историю.
4. После detection проверить снижение уровня.

## Сценарий 8. Audit failure

1. Провалить первый follow-up audit.
2. Убедиться, что audit fine работает как раньше.
3. Убедиться, что governance signal создан.
4. После detection проверить observation.
5. Провалить второй audit.
6. Убедиться, что уровень усилился.
7. Провалить третий.
8. Убедиться, что critical observation immediate.

## Сценарий 9. Badge и acknowledgement

1. Получить два новых detected signals.
2. Убедиться, что вкладка показывает `(2)`.
3. Открыть вкладку.
4. Убедиться, что badge исчез.
5. Перезагрузить страницу.
6. Убедиться, что старый badge не вернулся.
7. Создать новый signal.
8. Убедиться, что badge появился снова.

## Сценарий 10. Без новых signals

1. Ходить по офису.
2. Открывать панели.
3. Разговаривать с NPC.
4. Подождать реальное время.
5. Убедиться, что detection и risk не меняются.

## Сценарий 11. Миграция

1. Загрузить сохранение Feature 08.
2. Убедиться, что уже произошедшие decisions/findings/audits/servers восстановлены как signals.
3. Убедиться, что штрафы не применились повторно.
4. Убедиться, что product progress и team сохранены.
5. Убедиться, что observations раскрываются по обычной задержке.

## Сценарий 12. Reset

1. Накопить несколько domains риска.
2. Открыть игру с `?intro`.
3. Убедиться, что risk-state пуст.
4. Убедиться, что observations отсутствуют.
5. Убедиться, что badge отсутствует.
6. Убедиться, что normal story flow может создать risks заново.

## Сценарий 13. Регрессия

1. Проверить planning.
2. Проверить product progress.
3. Проверить security findings.
4. Проверить follow-up audit.
5. Проверить fines.
6. Проверить team.
7. Проверить NPC.
8. Проверить server mini-games.
9. Убедиться, что Feature 09 не запускает проникновение.
10. Убедиться, что Feature 09 не создаёт финансовый ущерб серверов.
11. Убедиться, что Feature 09 не завершает игру.

---

# 31. Критерии готовности

Feature 09 считается завершённой только если:

- существуют ровно 6 risk domains;
- risk signals создаются только из конкретных use-cases;
- случайность не используется;
- actual и detected risk разделены;
- без Ильи detection delay равен 3 дням;
- с Ильёй delay равен 1 дню;
- Илья показывает причины, но не удаляет риск;
- staffing decision создаёт signals;
- findings создают mitigation;
- audits создают signals;
- server mini-games создают signals;
- overloaded sprint создаёт delivery pressure;
- balanced sprint уменьшает pressure на 1;
- daily report показывает новые observations;
- whiteboard показывает detected observations;
- exact score скрыт в production;
- acknowledgement работает;
- stable selectors экспортированы для Feature 10–12;
- migration восстанавливает существующие факты;
- reset очищает risks;
- новые инциденты не запускаются;
- финансовые последствия серверов не реализованы;
- game over не реализован;
- существующие механики не сломаны;
- тесты проходят;
- production-сборка проходит.

---

# 32. Формат финального ответа Claude Code

Верни результат строго по структуре:

```md
## Что реализовано

## Какие домены риска добавлены

## Какие решения создают и снижают риски

## Как работает задержка обнаружения

## Чем отличается обнаружение с Ильёй и без него

## Как риски отображаются в daily report и whiteboard

## Какие selectors подготовлены для следующих фич

## Созданные файлы

## Изменённые файлы

## Как устроена миграция и reset

## Чем решение отличается от Feature 08

## Выполненные команды

## Результаты тестов

## Результат production-сборки

## Ручная проверка

## Ограничения текущей итерации
```

Не переходи к Feature 10.

Не добавляй СКУД, проникновение, финансовый ущерб серверов или game over.
