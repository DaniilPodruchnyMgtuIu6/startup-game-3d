# Feature 17C — checkpoints, последствия, новое поражение и полная проверка

## Цель

Связать решения 17B с отложенными событиями.

Система должна проверять не только выбранную кнопку, но и фактическое состояние к фиксированным точкам Level 1.

Не использовать случайность.

---

# 1. Checkpoint catalog

Создать:

```ts
export type Level1CheckpointId =
  | "baseline-review-deadline"
  | "access-consequence-check"
  | "test-data-consequence-check"
  | "backup-warning"
  | "data-loss-final-warning"
  | "data-loss-resolution"
  | "architecture-consequence"
  | "disclosure-consequence"
  | "release-consequence";
```

## Fixed timeline

```ts
export const LEVEL1_TIMELINE_BALANCE = {
  baselineReviewDeadlineWorkdays: 5,
  backupWarningAfterChoiceWorkdays: 2,
  dataLossFinalWarning: {
    sprintNumber: 4,
    day: 3,
  },
  dataLossResolution: {
    sprintNumber: 4,
    day: 6,
  },
  releaseDecisionLatestSprint: 6,
} as const;
```

Использовать workday index для сравнения.

Checkpoint вычисляется один раз и имеет immutable record.

---

# 2. Baseline review deadline

Если игрок выбрал hire path, но:

- Илья не нанят;
- либо internal review не завершён;
- прошло 3 workdays;

показать обязательный разговор Сони:

```text
Соня:
Мы выбрали внутреннюю проверку,
но у нас всё ещё нет ни специалиста, ни результата.

Соня:
Если продолжим без проверки,
мы будем принимать следующие решения вслепую.
```

Effects:

- governance +2 один раз;
- objective нанять Илью или завершить review;
- первый sprint может продолжаться;
- future checkpoints учитывают отсутствие review.

Если внешний аудит заказан, но результат задержан из-за блокирующего события:

- не штрафовать игрока;
- checkpoint ждёт фактический audit result;
- delay не должен дублировать сцену.

---

# 3. Результат первичной проверки

## External audit

Через 2 завершённых workdays:

- короткая сцена с временными аудиторами;
- использовать существующие модели Feature 08;
- создать baseline findings;
- `baselineSecurityReviewCompleted = true`;
- task completed;
- actor cleanup.

Диалог:

```text
Аудитор:
Критической компрометации мы не нашли.
Но доступы, резервные копии и тестовые данные
нужно привести в контролируемое состояние.

Соня:
Хорошо. Теперь у нас есть список,
а не только предположения.
```

## Internal review

После 2 workdays Ильи:

```text
Илья:
Я закончил первичную проверку.
Система не выглядит потерянной,
но несколько решений нужно принять до следующего этапа.
```

- `baselineSecurityReviewCompleted = true`;
- создать те же категории findings без дублирования;
- формулировки могут отличаться;
- task completed.

---

# 4. Consequence административных прав

Если выбран permanent admin и позже:

- AUTH risk достигает high;
- либо происходит первый AUTH failure;

запустить короткий разговор:

```text
Илья:
Подозрительная сессия использовала те же права,
которые мы оставили постоянными.

Кирилл:
Это ещё не доказывает, что доступ украли.
Но область возможного ущерба стала больше.
```

Effects:

- дополнительный identity signal +1;
- incident immediate cost modifier уже читается из story choice;
- один раз.

Если выбрано JIT/controlled:

- сцена становится положительным acknowledgement;
- extra signal не создаётся;
- incident dialogue говорит, что доступ был локализован.

---

# 5. Consequence тестовых данных

Если выбрана production copy и sensitive-data становится high:

```text
Алина:
В тестовой среде осталась копия реальных данных.
Я думала удалить её после проверки,
но мы так и не зафиксировали этот шаг.

Илья:
Теперь придётся считать,
что подозрительный доступ мог затронуть и её.
```

Effects:

- sensitive-data +1;
- task `remove-production-test-data`;
- Алина или Илья 1 workday;
- если task закрыта до DATABASE incident, дополнительный modifier снимается.

Если synthetic/masked:

- positive acknowledgement;
- task не создаётся.

---

# 6. Backup warning

Через 2 workdays после `configure-backups-only` или `postpone-backup-work`:

## Configure only

```text
Кирилл:
Копии создаются по расписанию.
Но я всё ещё не проверял,
что проект реально поднимается из них целиком.
```

## Postpone

```text
Кирилл:
Мы снова отложили резервное копирование.
Сейчас единственная рабочая версия проекта —
та, с которой работает команда.
```

Objective:

```text
Подтвердите возможность восстановления проекта
```

Игрок может вернуться к полной проверке.

Поздняя проверка:

- стоит те же 60 000 ₽;
- требует оставшиеся effort days;
- блокирует катастрофический финал после completion;
- не дублирует первоначальную transaction configure-only.

---

# 7. Final warning перед потерей данных

На checkpoint Sprint 4 Day 3, если одновременно:

- baseline security review не completed;
- restore readiness не `verified`;
- actual `service-continuity >= high`
  или `sensitive-data >= high`;

запустить обязательный разговор.

```text
Соня:
У нас нет завершённой проверки системы.
И мы не доказали, что можем восстановить проект.

Соня:
Это уже не просто технический долг.
Следующий серьёзный сбой может оставить нас без рабочей версии.

Кирилл:
Мне нужен хотя бы один день,
чтобы проверить копию и журналы.

Илья:
Если отложим ещё раз,
я не смогу обещать, что восстановление вообще возможно.
```

Если Ильи нет, последнюю позицию формулирует Кирилл.

Objective:

```text
Устраните критический риск потери проекта
```

Игроку дать до Sprint 4 Day 6.

Подсказка должна показывать:

```text
Осталось рабочих дней: N
```

Не показывать raw risk score.

---

# 8. Утро без проекта

## Trigger

На Sprint 4 Day 6 после daily calculation, если:

- final warning был показан;
- baseline review всё ещё не completed;
- restore readiness `absent`;
- actual service-continuity или sensitive-data high/critical;
- нет уже terminal outcome.

## Scene

ID:

```text
project-files-destroyed
```

Диалог:

```text
Кирилл:
Репозиторий не открывается.
Общая папка тоже пустая.

Алина:
У меня осталась только вчерашняя сборка интерфейса.
Исходников и макетов нет.

Соня:
Резервная копия?

Кирилл:
Проверенной копии нет.
Журналы обрываются ночью.

Илья:
Это мог быть взлом,
вредоносный пакет или ошибочная команда.
Без аудита и журналов мы не докажем причину.

Соня:
Но главное уже понятно:
восстановить проект в срок мы не можем.
```

Если Ильи нет, его реплика передаётся Кириллу без утверждения точной причины.

Outcome:

```ts
failureReason = "unrecoverable-project-data-loss";
```

Итоговый заголовок:

```text
Проект потерян
```

Описание:

```text
Рабочие файлы OfficeFlow были удалены или зашифрованы.
Проверенной резервной копии и завершённого аудита не оказалось.
```

Не использовать насилие, полицию или визуализацию злоумышленника.

Не утверждать точно, что это был взлом.

---

# 9. Recoverable branch

Если baseline review не completed, но restore readiness `configured`:

- не game over;
- expense 300 000 ₽;
- category `security-recovery`;
- transaction id `story:recover-unverified-backup`;
- Кирилл занят 3 workdays;
- product progress остановлен для Кирилла;
- risk service-continuity +2;
- task `recover-project-from-unverified-backup`;
- если бюджет становится неположительным, работает существующее поражение.

Диалог:

```text
Кирилл:
Копия есть, но она не поднимается автоматически.
Мне придётся вручную собирать проект и проверять целостность.

Соня:
Сколько времени?

Кирилл:
Три рабочих дня, если внутри копии нет новых повреждений.
```

Если restore readiness `verified`:

- catastrophic scene не запускается;
- показать короткую положительную consequence scene;
- service-continuity mitigation -1.

```text
Кирилл:
Основная версия повреждена,
но проверенная копия поднялась штатно.
Мы потеряли часы, а не проект.
```

---

# 10. Архитектурное последствие

Если shared architecture выбрана и происходит AUTH или DATABASE incident:

- соседний домен получает +1 signal;
- immediate cost +40 000 ₽;
- recovery effort +1 day максимум один раз;
- dialogue упоминает общую техническую границу.

Пример:

```text
Кирилл:
Проблема началась в AUTH,
но общий технический доступ затронул и операции базы.
```

Если boundaries separated/review:

- modifier отсутствует;
- dialogue признаёт, что ущерб локализован.

```text
Илья:
Инцидент остался внутри контура авторизации.
Разделение доступов сработало так, как мы рассчитывали.
```

---

# 11. Disclosure consequence

## Report immediately

При incident:

```text
Соня:
Руководство уже знает контекст.
Нам не нужно объяснять, почему мы молчали.
```

- leadership complaint не создаётся.

## Investigate quietly

Если investigation завершена до incident:

- governance mitigation -1;
- сцена сообщает, что команда успела проверить сигнал.

Если incident раньше completion:

- leadershipComplaint = true;
- score penalty;
- обязательная реплика руководства через Соню.

## Dismiss

При следующем incident:

- mandatory dialogue;
- governance +2 дополнительно;
- руководство требует объяснение;
- failure не наступает мгновенно, если бюджет/дедлайны ещё позволяют исправление.

```text
Соня:
Нам уже задавали вопрос об этой активности.
Мы решили, что это ложное срабатывание.
Теперь придётся объяснить, почему проверка не была проведена.
```

---

# 12. Release consequence

## Release with known risk

- release flow продолжается;
- итоговый отчёт содержит честный раздел ограничений;
- score penalty -10.

## Delay for hardening

Создать task:

```text
complete-release-security-hardening
```

Два workdays:

- обычные daily costs;
- один available employee на день может выполнять hardening;
- product tasks уже завершены;
- Workday Flow показывает progress;
- deadline всё ещё действует.

## Hide open risk

Перед финальным результатом проверить:

- actual governance critical;
- unresolved server incident;
- pending audit;
- leadership complaint;
- hidden critical risk.

Если есть terminal combination:

- release не завершается;
- сцена обнаружения расхождения;
- существующее dismissal failure либо новый reason:
  `concealed-critical-release-risk`.

Не создавать новый reason, если существующий `project-closure-by-management` семантически подходит.

Если terminal combination отсутствует:

- разрешить только `Запуск под давлением`;
- score -25;
- итоговый текст фиксирует расхождение.

---

# 13. Checkpoint integration

Порядок внутри завершения дня:

1. apply work;
2. economy;
3. risk signals;
4. detect risks;
5. existing Feature 08–13 reconciliations;
6. Feature 17 consequence checkpoints;
7. daily report;
8. mandatory scenes по общему priority coordinator.

Feature 17 не должна обходить existing priority:

```text
daily report
→ audit
→ office intrusion
→ server incidents
→ Feature 17 consequence scene
→ sprint review
→ outcome
```

Исключение:

- terminal data-loss outcome применяется после своей обязательной scene, до review.

Если несколько Feature 17 consequences pending:

1. final data-loss warning;
2. data-loss scene;
3. disclosure consequence;
4. architecture consequence;
5. access/test-data acknowledgement.

---

# 14. Save/reload

Сохранять:

- checkpoint records;
- warning shown;
- remaining deadline;
- pending consequence id;
- running consequence id;
- applied modifier ids;
- restore readiness;
- baseline review status;
- investigation progress;
- hardening progress.

После reload:

```text
running consequence -> pending
```

Не применять effects повторно.

Если terminal scene effects уже applied:

- outcome snapshot остаётся immutable;
- визуальная сцена может безопасно завершиться;
- повторная transaction не создаётся.

---

# 15. Миграция

Старое сохранение Feature 16:

- не получает катастрофу задним числом;
- текущий Level 1 получает полный срок до новых checkpoint;
- прошлые risky choices, которых не существовало, не угадываются;
- restore readiness по умолчанию `unknown`;
- если campaign уже после Sprint 4 Day 3, data-loss checkpoints пометить skipped for migration;
- новый failure применяется только к новым прохождениям либо прохождениям до безопасной точки.

Не ломать существующие victory/failure saves.

---

# 16. Balance report

Обновить campaign simulator.

Создать:

```text
docs/qa/17-story-balance-report.md
```

Обязательные пути:

## SEC-01 Осторожный

- external audit;
- JIT access;
- synthetic data;
- full restore;
- separated boundaries;
- report immediately;
- release known risk.

Должен быть выигрышным.

## SEC-02 Штатный безопасник

- hire Ilya;
- controlled access;
- masked data;
- logging;
- full restore;
- architecture review;
- investigate quietly and finish;
- release known risk.

Должен быть выигрышным, но дороже по зарплате.

## SEC-03 Быстрый рискованный

- external audit;
- permanent admin;
- production data;
- configure only;
- shared architecture;
- investigate quietly;
- release known risk.

Должен оставаться выигрышным при хорошей последующей реакции,
но с низким score и небольшим бюджетом.

## SEC-04 Катастрофа

- hire path;
- не нанять Илью;
- production data;
- postpone backup;
- shared architecture;
- dismiss warning.

Должен приводить к `unrecoverable-project-data-loss`.

## SEC-05 Позднее спасение

- postpone backup;
- получить final warning;
- успеть выполнить restore drill в последний допустимый день.

Не должен приводить к game over.

## SEC-06 Непроверенная копия

- no baseline review;
- configure only;
- high risk.

Должен приводить к recoverable incident, а не мгновенному поражению.

---

# 17. Полная матрица тестов

## Decision core

1. каждый node unlock ровно один раз;
2. blocking objective;
3. DeepSeek priority;
4. choices persist;
5. effects idempotent;
6. unavailable choices скрыты/disabled с причиной.

## Timeline

7. checkpoints используют workday index;
8. reload не сдвигает deadline;
9. missed checkpoint не проигрывается дважды;
10. day auto-completion не пропускает checkpoint;
11. migration даёт безопасный срок;
12. несколько pending consequences имеют стабильный priority.

## Catastrophe

13. без warning game over невозможен;
14. completed audit блокирует terminal trigger;
15. verified restore блокирует trigger;
16. configured restore даёт recoverable branch;
17. absent restore даёт terminal branch;
18. exact day boundary;
19. scene effects one time;
20. reload running → pending;
21. outcome snapshot immutable;
22. reset очищает outcome и story.

## Role dialogues

23. Kirill unlock;
24. Alina unlock;
25. Ilya unlock;
26. third choices only with Ilya;
27. architect hook only if role exists;
28. no placeholder NPC.

## Consequences

29. permanent admin modifies AUTH;
30. JIT does not;
31. production test data creates cleanup task;
32. synthetic/masked do not;
33. shared architecture spreads incident;
34. separated boundaries localize;
35. report clears complaint;
36. quiet investigation can succeed/fail;
37. dismiss escalates next incident.

## Economy

38. все amounts из balance;
39. ledger сходится;
40. repeated choice no duplicate expense;
41. recoverable loss transactions idempotent;
42. hardening uses daily costs;
43. balance simulator paths.

## E2E

44. cautious full path;
45. Ilya full path;
46. risky recoverable path;
47. catastrophic path;
48. late save path;
49. reload before each major dialogue;
50. release decision;
51. victory/failure reset;
52. Workday Flow continues after each scene.

---

# 18. Ручная приёмка диалогов

Для каждой сцены проверить:

- marker виден;
- должности персонажей читаемы;
- реплики не накладываются;
- choice buttons понятны;
- qualitative consequence виден;
- raw scores не видны;
- NPC возвращаются к planner;
- следующий разговор вспоминает прошлое решение;
- DeepSeek не заменяет сцену;
- после reload сцена не повторяет effects.

## Отдельно катастрофическая ветка

1. пройти risky choices;
2. увидеть первое предупреждение;
3. увидеть backup warning;
4. увидеть final warning;
5. попробовать исправить в последний день;
6. подтвердить успешное спасение;
7. повторить без исправления;
8. увидеть сцену `Утро без проекта`;
9. проверить outcome;
10. reload;
11. reset.

---

# 19. Обязательные команды

Использовать scripts проекта.

Минимум:

```bash
npm test
npm run build
```

Если существуют:

```bash
npm run lint
npm run typecheck
npm run test:e2e
```

Также:

```bash
git diff --check
git status --short
```

Не выполнять `git push`.

---

# 20. Критерии завершения 17C

Feature 17 завершена только если:

- все consequence checkpoints работают;
- катастрофа достижима обычным путём;
- катастрофа не происходит без предупреждения;
- позднее исправление действительно спасает;
- configured backup создаёт recoverable branch;
- разные choices изменяют будущие реплики и расходы;
- новый failure интегрирован в outcome;
- balance report создан;
- все шесть сценариев симулятора воспроизводимы;
- tests/E2E/build проходят.

---

# 21. Формат ответа Claude Code

```md
## Реализованные checkpoints

## Отложенные последствия решений

## Как работает ветка потери файлов

## Как игрок получает предупреждения

## Recoverable и terminal варианты

## Как решения изменяют server incidents

## Как решения изменяют финальный выпуск

## Balance report

## Миграция

## Reset

## Созданные файлы

## Изменённые файлы

## Добавленные тесты

## E2E-пути

## Выполненные команды

## Результаты тестов

## Результат production build

## Ручная проверка

## Оставшиеся ограничения
```
