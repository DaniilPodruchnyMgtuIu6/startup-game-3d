# Feature 15 — полное тестирование, баланс, полировка и готовность к релизу

## Как использовать этот файл

Передай Claude Code только этот feature-файл вместе с доступом к актуальному репозиторию.

Постоянные правила проекта должны быть подключены через корневой `CLAUDE.md`:

- `AGENTS.md`;
- `docs/claude/00-implementation-workflow.md`;
- `docs/claude/00-fixed-game-rules.md`.

Feature 15 не добавляет новую сюжетную механику. Это стабилизационная итерация после завершения Feature 01–14.

---

# Предварительные условия

Feature 01–14 должны быть реализованы и приняты.

В проекте уже должны работать:

- полный игровой цикл от новой игры до победы или поражения;
- относительное время и спринты;
- бюджет и финансовый журнал;
- найм Кирилла, Алины и условный найм Ильи;
- backlog OfficeFlow и прогресс задач;
- первый аудит и разговор с Соней;
- замечания, повторные аудиты и штрафы;
- скрытые риски;
- СКУД и проникновение;
- серверные инциденты, простой и восстановление;
- четыре причины поражения;
- выпуск MVP и три успешных результата;
- необязательные разговоры через DeepSeek с server-side fallback;
- сохранение, миграции и общий reset через `?intro`.

Если какая-либо предыдущая фича фактически не завершена, сначала зафиксируй это как блокер. Не маскируй отсутствующую механику тестовыми заглушками.

---

# Роль Claude Code

Ты работаешь с завершённой игровой кампанией Startup Office.

Цель итерации — доказать, что вся система:

- технически стабильна;
- логически согласована;
- проходима разными стратегиями;
- не имеет необратимых soft-lock;
- экономически сбалансирована;
- понятно объясняет последствия;
- корректно сохраняется и мигрируется;
- безопасно использует DeepSeek;
- готова к production-сборке и внешнему тестированию.

Сначала изучи актуальный репозиторий. Не исходи только из названий и примеров этого документа.

Обязательно найди и проанализируй:

- `AGENTS.md`;
- корневой `CLAUDE.md`;
- все документы `docs/claude/features/01–14`;
- `package.json` и все scripts;
- тестовую инфраструктуру;
- Zustand stores и версии persist-схем;
- единый `completeWorkday`;
- запуск и завершение спринта;
- event priority coordinator;
- outcome coordinator;
- экономические constants и transaction categories;
- product task catalog;
- security findings;
- audit, intrusion и server-incident stores;
- risk store;
- NPC roster, navigation, claims и activities;
- DeepSeek server endpoint, provider, fallback и env configuration;
- production build и способ локального запуска;
- текущие console warnings и TypeScript suppressions;
- существующие TODO/FIXME/HACK;
- текущие ESLint/TypeScript/Vitest exclusions;
- `.gitignore`, `.env.example` и server-side env loading.

Перед любыми изменениями верни отчёт:

1. какие автоматические проверки уже существуют;
2. какие уровни тестирования отсутствуют;
3. какие основные игровые пути сейчас не покрыты;
4. какие persist-версии и миграции существуют;
5. какие экономические constants являются источником истины;
6. как сейчас определяется порядок обязательных событий;
7. какие ошибки, warnings, TODO и временные обходы найдены;
8. есть ли реальные обращения к DeepSeek в tests или CI;
9. какие файлы планируется создать;
10. какие файлы планируется изменить;
11. какие изменения относятся к bugfix, balance или polish;
12. какие проблемы являются блокерами релиза.

После анализа реализуй только Feature 15.

---

# 1. Жёсткие границы итерации

Разрешено:

- исправлять подтверждённые ошибки;
- добавлять тесты и тестовые helpers;
- добавлять E2E-инфраструктуру;
- добавлять сценарный симулятор;
- корректировать числовые constants баланса;
- улучшать тексты, размеры, отступы и состояния UI;
- исправлять визуальные конфликты, z-index и focus management;
- оптимизировать производительность без изменения правил игры;
- укреплять миграции и normalizers;
- улучшать fallback DeepSeek;
- удалять мёртвый код и подтверждённо ненужные suppressions;
- добавлять документацию QA и release checklist.

Запрещено:

- добавлять новые сюжетные события;
- добавлять новую роль или нового постоянного NPC;
- добавлять второй этап кампании;
- менять жанр и основные правила;
- добавлять случайность в детерминированные события;
- переписывать архитектуру «с нуля»;
- создавать универсальный engine без необходимости;
- заменять реальные проверки snapshot-тестами большого JSX;
- вызывать платный DeepSeek API из автоматических tests;
- помещать API-ключ в исходники, fixtures, логи, Markdown или bundle;
- ослаблять тесты ради зелёного результата;
- скрывать найденные дефекты.

Любое изменение игрового правила должно быть отражено:

- в соответствующей constant;
- в unit-тестах;
- в balance report;
- в `00-fixed-game-rules.md`, если правило является постоянным.

---

# 2. Артефакты Feature 15

Создай каталог:

```text
/docs/qa/
```

Минимальные документы:

```text
docs/qa/15-release-readiness-report.md
docs/qa/15-manual-test-matrix.md
docs/qa/15-balance-report.md
docs/qa/15-known-issues.md
```

## 15-release-readiness-report.md

Должен содержать:

- commit/branch или иной идентификатор проверенной версии;
- дату проверки;
- среду запуска;
- выполненные команды;
- количество unit/integration/E2E tests;
- результаты build, lint и typecheck;
- результаты migration tests;
- результаты soak/performance проверки;
- security/secret checks;
- список исправленных P0/P1/P2 дефектов;
- итоговый verdict: `READY`, `READY WITH KNOWN ISSUES` или `NOT READY`.

## 15-manual-test-matrix.md

Содержит полный набор ручных сценариев с колонками:

```text
ID
Категория
Предусловия
Шаги
Ожидаемый результат
Фактический результат
Статус
Комментарий/issue
```

## 15-balance-report.md

Содержит:

- исходные constants;
- описание сценарного симулятора;
- результаты обязательных стратегий;
- бюджеты по дням/спринтам;
- срок MVP;
- число отвлечённых рабочих дней;
- штрафы, инвестиции, инциденты и простой;
- сравнительный эффект найма Ильи;
- найденные доминирующие или бесполезные решения;
- внесённые balance changes;
- результаты повторного прогона после изменений.

## 15-known-issues.md

Содержит только реальные оставшиеся проблемы:

- severity;
- шаги воспроизведения;
- влияние;
- workaround;
- причина, почему issue не блокирует релиз;
- ссылка на задачу, если используется tracker.

Пустой документ допустим с явной строкой:

```text
На момент проверки известных релизных дефектов нет.
```

---

# 3. Классификация дефектов

Используй уровни:

## P0 — блокер

- приложение не запускается;
- production build не собирается;
- новая игра не начинается;
- невозможно завершить кампанию;
- сохранение повреждается;
- API-ключ попал в клиент или Git;
- деньги/progress применяются дважды;
- обязательная сцена создаёт soft-lock;
- победа или поражение срабатывает неправильно и необратимо.

Релиз запрещён.

## P1 — критический

- одна из основных веток кампании непроходима;
- один из четырёх loss outcomes недостижим или срабатывает без причины;
- release checklist ошибочно пропускает blocker;
- event priority нарушается;
- reload меняет ветку или сумму ущерба;
- NPC навсегда блокирует дверь/waypoint;
- баланс делает обязательным ровно один вариант прохождения.

Релиз запрещён.

## P2 — значимый

- заметная ошибка UI;
- неверный текст/сумма в отчёте при правильной математике;
- редкое застревание NPC с самовосстановлением;
- неудобное управление;
- performance regression;
- проблема fallback, не блокирующая кампанию.

Допустим только с явно принятым known issue.

## P3 — косметический

- небольшой визуальный дефект;
- несовершенный отступ;
- необязательное улучшение текста;
- малозаметная анимационная шероховатость.

Может остаться в backlog.

---

# 4. Единая команда проверки

Добавь script, использующий существующий package manager.

Рекомендуемое имя:

```json
{
  "scripts": {
    "verify": "<lint + typecheck + unit/integration + e2e + build>"
  }
}
```

Не дублируй команды, если уже есть `check`, `ci` или `test:all`.

`verify` должна:

1. завершаться с ненулевым кодом при любой обязательной ошибке;
2. не выполнять платные внешние запросы;
3. работать на чистой установке dependencies;
4. быть пригодной для CI;
5. не требовать настоящий DeepSeek token;
6. не изменять tracked files;
7. не зависеть от порядка предыдущих запусков.

Если E2E требует отдельного поднятия server, используй стандартный `webServer` механизм выбранного E2E runner.

---

# 5. Статические проверки

Обязательны:

- TypeScript typecheck без emit;
- lint;
- production build;
- проверка циклических import, если в проекте уже есть инструмент;
- отсутствие tracked `.env*` с секретами;
- отсутствие client-side `VITE_DEEPSEEK_API_KEY`;
- отсутствие прямого запроса браузера на `api.deepseek.com`;
- отсутствие `console.log` с игровым snapshot или секретными headers в production code;
- отсутствие новых `any`, `@ts-ignore`, `eslint-disable` без объяснения;
- отсутствие битых imports и неиспользуемых exports.

Не вводи новый тяжёлый статический анализатор только ради Feature 15, если текущего lint/typecheck достаточно.

Все остающиеся suppressions перечисли в release report.

---

# 6. Проверка секрета DeepSeek

Автоматические tests работают только с mock provider.

Обязательные проверки:

1. server-side env-файл игнорируется Git;
2. `.env.example` не содержит значения ключа;
3. browser bundle не содержит значение `DEEPSEEK_API_KEY`;
4. browser source не читает `process.env.DEEPSEEK_API_KEY` напрямую;
5. React обращается только к собственному `/api/npc-chat`;
6. server logs не выводят Authorization header;
7. ошибки provider не включают секрет;
8. request от клиента не может передать произвольный system prompt;
9. NPC id и контекст валидируются на сервере;
10. длина пользовательского сообщения ограничена.

Безопасная локальная проверка утечки должна возвращать только `PASS/FAIL` и не печатать значение ключа.

CI не должен требовать реальный ключ.

Ручной live smoke-test DeepSeek:

- выполняется отдельно;
- максимум один короткий запрос на каждого доступного NPC;
- не входит в обычный `npm test`/`verify`;
- результат записывается без prompt/body, содержащего персональные или секретные данные.

---

# 7. Unit-тесты чистой логики

Проверь покрытие всех ключевых доменов.

Минимально:

## Время и спринты

- допустимые переходы фаз;
- 10 дней спринта;
- idempotency завершения дня;
- day 10 → review;
- запрет некорректных переходов;
- deadline шестого спринта.

## Экономика

- стартовый бюджет;
- базовые расходы;
- зарплаты состава;
- инвестиция СКУД;
- штрафы аудитов;
- расходы проникновения;
- immediate server incident costs;
- downtime costs;
- дедупликация transaction ids;
- immutable прошлых операций;
- правильный итоговый баланс.

## Продукт

- каталог 14 задач;
- общая трудоёмкость;
- fixed assignees;
- max один день progress на сотрудника;
- carryover;
- prototype milestone;
- 100% readiness;
- release checklist.

## Команда

- найм Кирилла/Алины;
- условная доступность Ильи;
- team count;
- salary lines;
- active roster;
- reset.

## Аудиты

- четыре finding;
- assignments;
- employee diversion;
- три штрафа;
- complaint/recommendation;
- passed audit;
- event due calculations.

## Риски

- actual/detected separation;
- detection delay 3/1;
- signal idempotency;
- mitigation;
- threshold history;
- acknowledgement;
- rebuild from old game state.

## СКУД и проникновение

- unlock;
- approve/postpone;
- 180 000 ₽;
- effort 3/2;
- threat arm/cancel/due;
- prevented/resolved;
- branches with/without Ilya.

## Серверные инциденты

- rack instability;
- threat delay;
- fixed queue priority;
- immediate costs;
- recovery effort;
- downtime;
- diversion;
- mitigation.

## Outcomes

- каждая loss reason;
- grace periods;
- last-day recovery;
- win readiness;
- score calculation;
- immutable outcome snapshot;
- mutual exclusivity win/loss.

## DeepSeek

- request validation;
- visible-context builder;
- hidden-state exclusion;
- persona selection;
- timeout;
- provider error;
- invalid JSON/response;
- static fallback;
- mandatory dialogue priority.

Не устанавливай искусственный coverage threshold, если текущая база значительно ниже и это заставит писать бессмысленные тесты.

Но итоговый report должен показывать coverage по:

- statements;
- branches;
- functions;
- lines.

Все критические pure rules должны иметь branch coverage.

---

# 8. Интеграционные тесты use-cases

Обязательны тесты реального взаимодействия stores/use-cases без Three.js rendering.

Минимальные сценарии:

1. новая игра → найм разработчиков → старт первого спринта;
2. завершение дня → product + economy + sprint;
3. prototype → Feature 05 trigger eligibility;
4. security-breach → post-audit conversation;
5. решение approve → hire Ильи;
6. решение decline → прохождение без Ильи;
7. security assignment Кирилла → product diversion;
8. audit due → daily report → scene → fine;
9. risk signal → delayed detection;
10. access-control work → active;
11. high office-access → intrusion threat → branch;
12. server threat → scene → recovery → downtime;
13. negative balance → queued loss после обязательных UI;
14. sixth sprint deadline → win/loss branch;
15. all 14 tasks + blockers clear → release success;
16. DeepSeek unavailable → static fallback без изменения game state.

Для обязательных событий проверяй не только финальное состояние, но и порядок переходов.

---

# 9. Deterministic campaign simulator

Создай test-only или tools-only сценарный симулятор.

Рекомендуемый путь:

```text
tools/balance/run-campaign-scenarios.ts
```

или эквивалент текущей структуры.

## Требования

Симулятор:

- использует реальные domain constants и чистые use-cases;
- не копирует экономические формулы вручную;
- не запускает React/Three.js;
- не вызывает DeepSeek;
- не использует случайность;
- позволяет описывать решения по дням;
- сохраняет timeline;
- возвращает структурированный итог;
- пригоден для test assertions и balance report.

## Минимальный результат

```ts
export type CampaignSimulationResult = {
  outcome: "win" | "loss" | "incomplete";
  outcomeReason?: string;
  releaseMoment?: StoryMoment;
  completedSprints: number;
  completedProductTaskIds: string[];
  productReadinessPercent: number;
  finalBudget: number;
  operationsCost: number;
  salaryCost: number;
  investmentsCost: number;
  auditFines: number;
  incidentCosts: number;
  downtimeCosts: number;
  securityWorkdaysByEmployee: Record<string, number>;
  productWorkdaysByEmployee: Record<string, number>;
  auditRecords: unknown[];
  intrusionResult?: string;
  serverIncidentResults: unknown[];
  finalRiskLevels: Record<string, string>;
  finalScore?: number;
  timeline: CampaignTimelineEntry[];
};
```

Не сохраняй simulation state в пользовательский localStorage.

---

# 10. Обязательные balance-сценарии

Создай минимум следующие сценарии.

Имена стабильны и используются в tests/report.

## BAL-01 — дисциплинированный путь с Ильёй

Стратегия:

- реалистичные планы без перегруза;
- Илья нанят после разблокировки;
- замечания закрываются до проверки;
- СКУД внедряется;
- серверные угрозы предотвращаются;
- MVP выпускается досрочно.

Ожидания:

- победа;
- выпуск в промежутке от середины 4-го до конца 5-го спринта;
- положительный бюджет;
- итоговый score не ниже 75;
- отсутствие обязательного штрафа;
- найм Ильи не делает бюджет автоматически отрицательным.

## BAL-02 — дисциплинированный путь без Ильи

Стратегия:

- игрок отказывается от Ильи;
- использует Соню и Кирилла для security work;
- внедряет СКУД силами Сони;
- закрывает замечания;
- выпускает MVP.

Ожидания:

- победа достижима;
- выпуск не позже конца 6-го спринта;
- положительный бюджет;
- больше diverted product days Кирилла, чем в BAL-01;
- путь заметно сложнее, но не является ловушкой.

## BAL-03 — одна серьёзная ошибка, но восстановление

Стратегия:

- допускается один штраф или один серверный инцидент;
- проблема затем исправляется;
- MVP выпускается до дедлайна.

Ожидания:

- победа достижима;
- финальный бюджет положительный, но ощутимо ниже BAL-01/02;
- score ниже идеального;
- ошибка не делает прохождение математически безнадёжным.

## BAL-04 — инвестиция в СКУД в последний допустимый момент

Ожидания:

- при корректном назначении проникновение предотвращается;
- стоимость и рабочие дни применяются ровно один раз;
- у игрока остаётся понятное окно реакции;
- не требуется знание скрытого due index.

## BAL-05 — проникновение с Ильёй

Ожидания:

- инцидент не завершает кампанию автоматически;
- ущерб ниже ветки без Ильи;
- после исправлений победа всё ещё достижима.

## BAL-06 — проникновение без Ильи

Ожидания:

- ветка сложнее BAL-05;
- создаётся sensitive-data risk;
- победа остаётся достижимой при достаточно раннем инциденте и правильном восстановлении;
- ущерб не должен гарантированно приводить к банкротству независимо от прежних решений.

## BAL-07 — серверный инцидент AUTH с Ильёй

Ожидания:

- Илья может выполнить recovery;
- Кирилл сохраняет product progress;
- один downtime day списывается;
- кампания остаётся выигрышной.

## BAL-08 — DATABASE без Ильи и позднее восстановление

Ожидания:

- высокая цена ошибки очевидна;
- несколько дней простоя существенно ухудшают бюджет;
- восстановление до critical downtime предотвращает поражение;
- последний безопасный день реально работает.

## BAL-09 — банкротство

Ожидания:

- loss reason `budget-exhausted` достижима;
- перед добровольным расходом есть предупреждение;
- обязательные расходы могут привести к loss после отчёта/сцен;
- transaction не откатывается.

## BAL-10 — остановка руководством

Ожидания:

- третий провал аудита запускает grace period;
- закрытие findings в последний допустимый день спасает проект;
- незакрытое finding приводит к правильному loss.

## BAL-11 — длительный server downtime

Ожидания:

- recovery в последний допустимый день спасает проект;
- отсутствие recovery приводит к server-downtime loss;
- день считается ровно один раз.

## BAL-12 — срыв дедлайна MVP

Ожидания:

- незавершённые задачи к review 6-го спринта вызывают loss;
- завершённые 14/14 не вызывают loss;
- невозможно перейти в 7-й спринт после срыва.

## BAL-13 — ранний успешный выпуск

Ожидания:

- выпуск возможен до 6-го спринта;
- только 14/14 и cleared blockers;
- win snapshot корректен;
- score детерминирован.

## BAL-14 — запуск под давлением

Стратегия:

- прошлые fines/incidents существуют;
- все обязательные blockers устранены;
- бюджет положительный;
- выпуск подтверждён.

Ожидания:

- это победа, а не loss;
- tier соответствует низкому score;
- summary честно показывает последствия.

---

# 11. Целевые диапазоны баланса

Диапазоны являются acceptance bands, а не новыми формулами.

Если фактический дизайн после реализации предыдущих фич делает диапазон неадекватным, не меняй его молча. Покажи расчёт и предложи корректировку.

## Срок выпуска

- идеальный опытный путь: не раньше середины 4-го спринта;
- нормальный осторожный путь: 4–5-й спринт;
- путь без Ильи или с одной серьёзной ошибкой: до конца 6-го спринта;
- победа не должна требовать идеального знания будущих событий.

## Бюджет победителя

Для хотя бы одного чистого пути с Ильёй:

```text
целевой остаток: 250 000–900 000 ₽
```

Для хотя бы одного чистого пути без Ильи:

```text
целевой остаток: 150 000–900 000 ₽
```

Для восстановленного пути с одной серьёзной ошибкой:

```text
целевой остаток: 1–450 000 ₽
```

Ни один clean path не должен:

- завершаться с бюджетом почти равным стартовому;
- гарантированно уходить в минус;
- требовать избегать всех предусмотренных инвестиций.

## Цена Ильи

Илья должен быть стратегическим trade-off.

Требования:

- его зарплата заметна;
- он экономит product days Кирилла;
- он снижает часть immediate costs и effort;
- найм не должен быть строго лучшим во всех сценариях;
- отказ не должен быть строго проигрышным;
- разница clean-path итогов не должна сводиться только к одному очевидному ответу.

Покажи сравнительную таблицу:

```text
метрика | с Ильёй | без Ильи | разница
```

Минимальные метрики:

- дни до MVP;
- salary cost;
- diverted product days Кирилла;
- security work throughput;
- incident cost;
- final budget;
- final score.

## Штрафы и инциденты

- один ранний штраф или один быстро восстановленный incident должен быть переживаемым;
- два крупных последствия должны создавать серьёзный риск поражения;
- повторное игнорирование должно почти наверняка приводить к loss;
- штраф/инцидент не должен быть дешевле очевидного профилактического решения настолько, чтобы игнорирование всегда было выгоднее;
- профилактика не должна гарантировать идеальный результат без управления.

## СКУД

Сравни:

```text
инвестиция: 180 000 ₽ + 2/3 workdays
```

с ожидаемыми ветками:

```text
проникновение с Ильёй: 60 000 ₽ + risks/tasks
проникновение без Ильи: 140 000 ₽ + stronger risks/tasks
```

СКУД ценна не только прямой экономией, но и предотвращением дополнительных рисков.

Но одобрение СКУД не должно быть скрытой обязательной кнопкой для каждой победы.

## Server downtime

- один день downtime заметен, но переживаем;
- отсутствие assignee дорого;
- recovery до последнего дня сохраняет шанс;
- стоимость не должна применяться после resolved;
- комбинация двух одновременно unresolved incidents должна быть опасной, но корректно рассчитываться.

---

# 12. Правила изменения баланса

Балансировать только после первоначального отчёта всех BAL-сценариев.

Приоритет изменения:

1. исправить ошибку расчёта;
2. исправить неправильный порядок применения;
3. изменить одну source-of-truth constant;
4. изменить несколько связанных constants только с объяснением;
5. не добавлять скрытые исключения для конкретного сценария.

Не исправляй баланс через:

- специальные скидки только перед поражением;
- автоматическое прощение штрафа;
- скрытую выдачу денег;
- изменение результата задним числом;
- разные формулы в UI и domain logic;
- проверку имени сценария симулятора.

После каждого balance change повторно прогоняй все BAL-01–BAL-14.

В report покажи таблицу before/after.

---

# 13. E2E browser tests

Если E2E runner отсутствует, добавь Playwright как отдельную dev dependency, если это совместимо с текущим проектом.

Не добавляй Cypress и Playwright одновременно.

E2E должны использовать production-like приложение и собственный server endpoint с mock DeepSeek provider.

## Обязательные smoke-тесты

### E2E-01 — старт новой игры

- очистить storage;
- открыть приложение;
- пройти intro;
- увидеть офис;
- убедиться в отсутствии console errors.

### E2E-02 — save/reload

- изменить состояние;
- reload;
- проверить восстановление sprint/budget/team/product;
- reset через `?intro`;
- проверить чистую игру.

### E2E-03 — основной успешный путь

Допустимо использовать test-only deterministic helpers для ускоренного выставления состояний, но финальные действия должны проходить через публичный UI:

- release checklist;
- confirm release;
- success scene;
- outcome screen;
- reload outcome.

### E2E-04 — loss

- подготовить одну loss reason;
- выполнить последнюю публичную операцию;
- увидеть правильный экран;
- reload;
- reset.

### E2E-05 — event priority

- одновременно подготовить pending audit, intrusion, server incident и day-10 review;
- закрывать UI последовательно;
- проверить точный порядок;
- убедиться, что ни одно событие не потеряно и не дублировано.

### E2E-06 — NPC interaction

- кликнуть по NPC издалека;
- дождаться подхода;
- открыть обязательный или свободный диалог;
- закрыть;
- убедиться, что planner/claims восстановлены.

### E2E-07 — DeepSeek fallback

- endpoint возвращает timeout/500;
- игрок получает статический fallback;
- управление возвращается;
- game state не изменяется;
- console не содержит секрета.

### E2E-08 — responsive desktop UI

Проверить минимум:

- 1366×768;
- 1920×1080;
- 2560×1440.

На каждом размере:

- HUD не перекрывает обязательные кнопки;
- модальные окна помещаются;
- длинные русские строки не обрезают смысл;
- whiteboard доступен;
- outcome screen читаем.

Не объявляй мобильную поддержку, если проект её не предусматривает.

---

# 14. Матрица сохранений и миграций

Создай representative fixture для каждой реально поддерживаемой persist schema version.

Не генерируй фиктивные версии, которых в коде не было.

Для каждой версии проверь:

- hydration без exception;
- migration до current version;
- сохранение основных данных;
- отсутствие дубликатов transactions/tasks/signals/NPC;
- нормализацию `running -> pending`, где предусмотрено;
- отсутствие ретроактивных штрафов и инцидентов;
- возможность продолжить кампанию;
- повторный reload после миграции;
- reset.

## Опасные точки reload

Минимально:

1. открытый daily report;
2. pending security-breach;
3. running security-breach;
4. pending post-audit conversation;
5. pending follow-up audit;
6. running audit;
7. armed intrusion;
8. pending intrusion;
9. running intrusion;
10. armed server incident;
11. несколько pending server incidents;
12. recovery с partial progress;
13. grace period leadership;
14. pending loss;
15. completed loss outcome;
16. release checklist open;
17. completed win outcome;
18. DeepSeek request interrupted reload.

После каждой точки игра не должна:

- застревать;
- повторно списывать деньги;
- повторно добавлять progress;
- менять сохранённую ветку;
- создавать дубликат NPC;
- пропускать обязательное событие.

---

# 15. Event priority verification

Зафиксируй единый документированный порядок обязательных событий.

Ожидаемый общий порядок после завершения дня:

```text
1. Daily report
2. Follow-up audit
3. Office intrusion
4. Server incidents: GATEWAY → AUTH → DATABASE
5. Pending defeat, если оно должно ждать обязательных результатов дня
6. Sprint review
```

Если фактическое правило Feature 12/13 отличается, используй принятое правило из кода и постоянных документов, но сделай его единым.

Добавь integration tests для всех парных конфликтов:

- audit + intrusion;
- audit + server incident;
- intrusion + server incident;
- server incident + loss;
- review + любое событие;
- win readiness + pending mandatory event;
- loss + win readiness в одном transition.

Win и loss не могут завершиться одновременно.

При конфликте outcome правила должны иметь один детерминированный победивший результат, описанный в tests и release report.

---

# 16. Soft-lock audit

Проверь каждое blocking state.

Для каждого ответь:

- что его открывает;
- что его закрывает;
- переживает ли reload;
- есть ли fallback при ошибке;
- может ли игрок потерять кнопку закрытия;
- может ли поверх открыться второй blocker;
- разблокируется ли player input;
- восстанавливаются ли NPC planners/claims.

Обязательные blockers:

- intro;
- planning explanation;
- hire confirmations;
- End Day confirmation;
- daily report;
- review;
- mandatory dialogues;
- cutscenes;
- audit result;
- intrusion result;
- server incident result;
- release checklist;
- win/loss outcome;
- DeepSeek loading/error state.

Не допускается blocker, который закрывается только через dev-команду.

---

# 17. Финансовая сверка

Добавь test/helper, который для любого save проверяет:

```text
current balance = initial funding + income transactions - expense transactions
```

Поскольку текущая кампания может не иметь доходов, формула всё равно должна поддерживать обе стороны ledger.

Проверь:

- каждая transaction id уникальна;
- amount положительный, направление определяется kind;
- UI summary равен journal;
- preview следующего дня не меняет journal;
- confirm применяет ровно один раз;
- cancel не применяет;
- прошлые breakdown immutable;
- итоговый outcome snapshot равен ledger;
- reset очищает ledger и возвращает initial funding.

Создай diagnostic, который выводит расхождение без автоматического «исправления» данных.

---

# 18. UX-полировка

Проведи системный аудит всех экранов.

## Терминология

Единообразно используй:

- `Спринт N`;
- `День X/10`;
- `OfficeFlow`;
- `Специалист по информационной безопасности`;
- `СКУД` после первого полного расшифрованного упоминания;
- `Повторный аудит`;
- `Замечание`;
- `Инцидент`;
- `Простой`.

Не смешивай в пользовательском UI:

- `finding`;
- `risk signal`;
- `workday index`;
- `pending`;
- `running`;
- внутренние ids.

## Деньги

Формат:

```text
2 500 000 ₽
−120 000 ₽
```

Используй один formatter.

Не смешивай обычный дефис и математический минус в одной таблице.

## Даты

Только относительные игровые даты:

```text
Спринт 3 · День 4
```

Не показывай реальные календарные даты.

## Disabled states

Каждая важная недоступная кнопка должна:

- визуально быть disabled;
- иметь понятную причину рядом или в tooltip;
- не полагаться только на цвет;
- иметь такую же server/use-case validation.

## Тексты

- убрать временные dev-тексты;
- исправить опечатки;
- сократить повторения;
- убедиться, что последствия решения видны до подтверждения;
- не раскрывать скрытые actual risks;
- не обещать функциональность следующей кампании.

---

# 19. UI и accessibility

Минимальные требования:

- видимый keyboard focus на кнопках и controls;
- `Escape` закрывает только закрываемые панели, но не отменяет применённое событие;
- модальный focus не уходит под overlay;
- после закрытия focus возвращается к разумному элементу;
- кнопки имеют понятные accessible names;
- важное состояние не передаётся только цветом;
- текст имеет достаточный контраст;
- длинные списки прокручиваются внутри окна;
- scroll не перемещает камеру, когда курсор над scrollable UI;
- подтверждение опасного расхода не срабатывает по случайному двойному нажатию;
- кнопки защищены от повторного submit во время обработки;
- loading DeepSeek можно отменить/закрыть безопасно согласно текущему UX;
- `prefers-reduced-motion` уменьшает необязательные UI-анимации, если они есть.

Не обещай полное соответствие WCAG без отдельного профессионального аудита.

---

# 20. Визуальная полировка 3D-офиса

Проверь:

- player не появляется внутри мебели;
- все постоянные NPC имеют уникальные модели/визуальные признаки;
- временные аудиторы и нарушитель исчезают после сцены;
- СКУД не мешает двери и navmesh;
- аварийные индикаторы стоек соответствуют incident state;
- marker не проходит сквозь потолок/интерфейс;
- camera не клиппует критически в стенах при обычном маршруте;
- игрок может подойти к whiteboard, каждому NPC и серверным стойкам;
- interact target не остаётся после удаления actor;
- claims освобождаются после диалогов, cutscenes и reload;
- NPC не стоят бесконечно в дверях;
- два NPC не занимают одно рабочее место;
- hover/status labels не перекрывают друг друга постоянно;
- lighting/emissive не становится чрезмерно ярким после нескольких reload.

Исправляй только подтверждённые проблемы.

Не переделывай весь арт-стиль.

---

# 21. NPC soak test

Создай ручной или автоматизированный dev-сценарий минимум на 30 минут игрового выполнения без продвижения времени.

Проверить:

- 3/4 постоянных NPC продолжают выбирать активности;
- никто не дублируется;
- claims не утекают;
- маршруты завершаются;
- NPC могут выйти из server room и meeting room;
- player interaction прерывает и восстанавливает planner;
- свободные DeepSeek-диалоги не оставляют NPC в `talking`;
- memory и количество scene objects не растут постоянно;
- console не заполняется повторяющимися warnings.

Если автоматический 30-минутный test непрактичен для CI, сделай короткий automated stress test и отдельный ручной soak protocol.

---

# 22. Производительность

Не устанавливай универсальные FPS требования без указания reference environment.

В release report зафиксируй:

- OS;
- браузер и версию;
- CPU/GPU, если доступны;
- разрешение;
- production или dev build.

Минимальные проверки:

1. production build запускается без постоянных console errors;
2. обычное перемещение по офису не имеет продолжительных зависаний;
3. открытие whiteboard/finance/team не создаёт заметную многосекундную паузу;
4. cutscene не создаёт неконтролируемое число actors/objects;
5. 30-минутный soak не показывает монотонный рост heap/scene objects;
6. DeepSeek timeout не блокирует main thread;
7. повторные reload не дублируют event listeners;
8. bundle не содержит source maps с секретами в production, если они публикуются.

## Regression budget

Запиши текущий baseline:

- размер client bundle;
- размер server bundle;
- время production build;
- время запуска tests;
- приблизительный heap после прогрева.

Feature 15 не должна увеличивать client bundle более чем на 10% без объяснённой причины.

E2E dependency и test-only code не должны попадать в production bundle.

---

# 23. DeepSeek quality and resilience matrix

Проверь NPC:

- Соня;
- Кирилл;
- Алина;
- Илья только при найме.

## Provider cases

1. нормальный короткий ответ;
2. timeout;
3. HTTP 401/403;
4. HTTP 429;
5. HTTP 500;
6. invalid response schema;
7. пустой ответ;
8. слишком длинный ответ;
9. markdown/code block;
10. попытка модели дать игроку скрытую информацию;
11. попытка пользователя изменить system instructions;
12. message на русском;
13. пустой/пробельный message;
14. очень длинный message;
15. неизвестный NPC id.

## Acceptance

- game state не изменяется;
- mandatory dialogue имеет приоритет;
- скрытые actual risks не попадают в context;
- future event flags не попадают в context;
- ответ ограничен по длине;
- unsafe/invalid response заменяется fallback;
- пользователь получает понятную, но не технически подробную ошибку;
- request можно повторить;
- API key не попадает в browser/log;
- отсутствие env не ломает production startup.

Не оценивай художественное качество только автоматическим assertion.

В manual matrix добавь проверку соответствия persona и фактам текущего прохождения.

---

# 24. Проверка отсутствия утечек будущего состояния в ИИ

Создай test snapshot не текста prompt целиком, а структуры разрешённого context.

Разрешено:

- текущий видимый спринт/день;
- видимый бюджет, если NPC должен его знать;
- видимый progress;
- назначение NPC;
- detected risks;
- завершённые события;
- player-visible tasks.

Запрещено:

- actual undetected risks;
- armed/due скрытых угроз до обнаружения;
- будущий outcome;
- внутренние score thresholds;
- transaction ids;
- API key;
- полный Zustand snapshot;
- технические stack traces;
- тексты других приватных NPC context, не нужные собеседнику.

Тест должен падать при появлении запрещённых полей в context builder.

---

# 25. Console и error handling

На clean campaign path в production console не должно быть:

- uncaught exceptions;
- React key warnings;
- hydration warnings;
- Three.js object disposal warnings, повторяющихся постоянно;
- rejected promises;
- failed requests без обработанного UI fallback;
- логов с полным save state;
- логов с DeepSeek headers/body.

Допустимые intentional warnings перечисли и обоснуй.

Все критические async operations должны иметь:

- loading state;
- controlled error result;
- recovery path;
- защиту от double-submit.

---

# 26. Проверка reset

После любого состояния `?intro` должен вернуть чистую новую игру.

Протестируй reset после:

- частично пройденной кампании;
- active audit;
- active intrusion;
- unresolved server incidents;
- negative budget;
- loss outcome;
- win outcome;
- активной СКУД;
- hired Ilya;
- risk signals;
- DeepSeek conversation history/loading.

После reset:

- один player;
- только стартовый roster;
- начальный budget;
- пустой journal кроме initial funding;
- sprint 1 planning;
- product progress 0;
- нет findings/risks/incidents;
- нет outcome;
- нет временных actors;
- нет старых overlays;
- нет старых async responses, меняющих новое прохождение.

Особенно проверь race:

```text
отправить DeepSeek request
→ reset
→ старый response приходит позже
```

Старый response не должен влиять на новую игру.

---

# 27. Полная ручная матрица кампании

Ручной тест должен включать минимум следующие полные проходы.

## RUN-01 — чистая победа с Ильёй

От intro до финального success outcome без state injection.

## RUN-02 — чистая победа без Ильи

Доказывает, что ветка отказа проходима.

## RUN-03 — восстановленная кампания

Один audit fine и один server incident, затем победа.

## RUN-04 — банкротство

Проверка предупреждений и финального snapshot.

## RUN-05 — остановка руководством

Третий провал + grace period + loss.

## RUN-06 — критический простой

Пять unresolved дней + loss.

## RUN-07 — срыв MVP

Review шестого спринта с незавершёнными задачами.

## RUN-08 — ранний устойчивый запуск

Победа до шестого спринта с высоким score.

## RUN-09 — запуск под давлением

Победа с низким score и историей ошибок.

## RUN-10 — DeepSeek disabled

Полная проходимость при отсутствии API key/network.

Для каждого прохода фиксируй:

- длительность реального тестирования;
- release/loss момент;
- final budget;
- число штрафов/инцидентов;
- blockers/soft-locks;
- UX observations;
- найденные issues.

---

# 28. Release checklist

Создай финальный checklist.

## Code

- [ ] `verify` проходит на чистой установке.
- [ ] TypeScript проходит.
- [ ] Lint проходит.
- [ ] Unit/integration проходят.
- [ ] E2E проходят.
- [ ] Production build проходит.
- [ ] Нет P0/P1.
- [ ] P2 перечислены и приняты.

## Saves

- [ ] Все поддерживаемые migrations проверены.
- [ ] Опасные reload-точки проверены.
- [ ] Reset проверен после win/loss/events.
- [ ] Нет дубликатов transactions/tasks/signals/NPC.

## Balance

- [ ] BAL-01–BAL-14 проходят ожидаемые assertions.
- [ ] Есть выигрышный путь с Ильёй.
- [ ] Есть выигрышный путь без Ильи.
- [ ] Есть выигрышный путь после серьёзной ошибки.
- [ ] Все четыре loss reason достижимы.
- [ ] Последний безопасный день работает.
- [ ] Нет строго доминирующего обязательного решения.

## UX

- [ ] Все disabled states объяснены.
- [ ] Деньги и даты форматируются единообразно.
- [ ] Нет внутренних ids/status в UI.
- [ ] Все blocking overlays закрываются корректно.
- [ ] Desktop resolutions проверены.
- [ ] Keyboard focus и modal focus работают.

## 3D/NPC

- [ ] NPC не дублируются.
- [ ] Claims освобождаются.
- [ ] Двери/waypoints не блокируются.
- [ ] Временные actors удаляются.
- [ ] 30-минутный soak выполнен.

## DeepSeek

- [ ] Ключ не tracked и не в bundle.
- [ ] Tests не делают live requests.
- [ ] Fallback работает.
- [ ] Hidden state не передаётся.
- [ ] Mandatory dialogues имеют приоритет.
- [ ] Timeout/rate-limit/errors обработаны.

## Release

- [ ] `15-release-readiness-report.md` заполнен.
- [ ] `15-balance-report.md` заполнен.
- [ ] `15-manual-test-matrix.md` заполнен.
- [ ] `15-known-issues.md` заполнен.
- [ ] Итоговый verdict не `NOT READY`.

---

# 29. Когда можно менять gameplay constants

Claude Code может изменить constants только если выполнены все условия:

1. проблема подтверждена минимум двумя BAL-сценариями или одним математически доказанным soft-lock;
2. показан текущий результат;
3. сформулирована цель изменения;
4. изменяется минимальный набор constants;
5. все связанные tests обновлены;
6. все BAL-сценарии прогнаны повторно;
7. результат отражён в balance report;
8. новое значение не противоречит постоянным правилам без их явного обновления.

Не менять больше одного смыслового блока баланса за один цикл:

- salaries/operations;
- fines;
- access-control costs;
- incident costs;
- downtime;
- deadlines/effort;
- final score penalties.

После каждого блока — полный повторный прогон.

---

# 30. Критерии готовности Feature 15

Feature 15 считается завершённой только если:

- создан единый воспроизводимый `verify` flow;
- автоматические tests не используют настоящий DeepSeek API;
- существуют unit, integration и browser E2E проверки;
- создан deterministic campaign simulator;
- BAL-01–BAL-14 прогнаны;
- есть победа с Ильёй;
- есть победа без Ильи;
- есть победа после серьёзной ошибки;
- все четыре поражения достижимы;
- economy ledger сходится;
- event priority полностью протестирован;
- save migrations и опасные reload-точки проверены;
- reset очищает любое состояние;
- нет P0/P1 дефектов;
- DeepSeek secret не попадает в Git/client/logs;
- fallback DeepSeek работает;
- UI проверен на целевых desktop-разрешениях;
- выполнен NPC/performance soak;
- составлен balance report before/after;
- составлен manual test matrix;
- составлен known issues report;
- production build проходит;
- итоговый verdict — `READY` или явно согласованный `READY WITH KNOWN ISSUES`.

---

# 31. Формат финального ответа Claude Code

Верни результат строго по структуре:

```md
## Итоговый статус готовности

## Что было проверено до изменений

## Найденные дефекты по приоритетам

## Исправленные ошибки

## Изменения баланса и их обоснование

## Результаты BAL-01–BAL-14

## Автоматические тесты

## E2E и ручные проходы

## Проверка сохранений и миграций

## Проверка DeepSeek и секретов

## Производительность и soak test

## UX и визуальная полировка

## Созданные файлы

## Изменённые файлы

## Выполненные команды

## Результаты production-сборки

## Оставшиеся известные проблемы

## Финальный release verdict
```

В финальном ответе:

- не печатай DeepSeek API-ключ;
- не скрывай упавшие tests;
- не называй релиз готовым при наличии P0/P1;
- приложи пути ко всем документам `docs/qa/`;
- укажи точные численные результаты balance-сценариев;
- отдели реальные проверки от того, что не удалось выполнить.

После Feature 15 не добавляй новую игровую механику без отдельного нового решения пользователя.
