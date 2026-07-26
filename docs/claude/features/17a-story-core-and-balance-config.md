# Feature 17A — Story Decision Core и balance-конфигурация

## Цель

Создать узкий технический фундамент для фиксированных сюжетных решений Level 1 и вынести редактируемый баланс в отдельные файлы.

Эта часть не должна реализовывать все сюжетные сцены.

В конце 17A должны работать:

- typed story records;
- timeline eligibility;
- один демонстрационный decision node без игровых последствий;
- отдельные balance-файлы;
- persist/migration/reset;
- тесты идемпотентности.

---

# 1. Изучение проекта

Перед изменениями найти:

- Workday Flow Feature 16;
- обязательные objectives;
- dialogue system;
- story markers;
- DeepSeek routing;
- existing security story store;
- risk store;
- economy ledger;
- team/hire records;
- product planning;
- event coordinator;
- outcome store;
- persistence versions;
- reset;
- все hard-coded суммы и сроки, используемые Feature 06–13.

Вернуть список создаваемых и изменяемых файлов.

---

# 2. Balance-файлы

Создать:

```text
src/game/balance/economyBalance.ts
src/game/balance/teamBalance.ts
src/game/balance/securityBalance.ts
src/game/balance/timelineBalance.ts
src/game/balance/storyBalance.ts
src/game/balance/index.ts
```

## Правила

- TypeScript constants;
- `as const`;
- понятные единицы в именах;
- без React;
- без store;
- без локализованных текстов;
- без environment variables;
- без чтения JSON во время выполнения;
- без магических чисел в handlers.

Пример:

```ts
export const STORY_BALANCE = {
  baselineAudit: {
    costRub: 140_000,
    resultDelayWorkdays: 2,
  },
  internalSecurityReview: {
    effortDays: 2,
    hireDeadlineWorkdays: 3,
  },
  backupRestore: {
    fullDrillCostRub: 60_000,
    fullDrillEffortDays: 2,
    configureOnlyCostRub: 30_000,
    configureOnlyEffortDays: 1,
  },
} as const;
```

Все значения уточняются в 17B–17C.

---

# 3. Безопасный перенос существующих constants

Сначала зафиксировать текущие результаты тестов и campaign simulator.

Перенести только значения, относящиеся к:

- найму и зарплате Ильи;
- аудиту;
- СКУД;
- проникновению;
- серверным расходам;
- timeline первого уровня;
- новым story choices.

После каждой группы:

- узкие тесты;
- balance simulator;
- отсутствие изменения результата существующих сценариев.

Не менять числа при переносе.

---

# 4. Story Decision Catalog

```ts
export type StoryDecisionDefinition = {
  id: Level1StoryDecisionId;
  title: string;
  participants: string[];
  blocking: boolean;
  objectiveTitle: string;
  objectiveDescription: string;
  choiceIds: string[];
};
```

Catalog содержит metadata.

Effects не должны описываться универсальным массивом команд.

Использовать явные handlers:

```ts
resolveSecurityBaselineChoice(...)
resolveDeveloperAdminAccessChoice(...)
resolveFrontendTestDataChoice(...)
resolveSecurityPriorityChoice(...)
resolveBackupStrategyChoice(...)
resolveArchitectureBoundaryChoice(...)
resolveSuspiciousActivityDisclosureChoice(...)
resolveReleaseRiskChoice(...)
```

---

# 5. Store

Store хранит:

- records восьми решений;
- историю доступности;
- выполненные consequence checkpoints;
- один active decision id;
- version.

Не хранить:

- деньги;
- risk score;
- task progress;
- NPC position;
- тексты.

Рекомендуемый тип:

```ts
export type Level1StoryStore = {
  decisions: Record<Level1StoryDecisionId, StoryDecisionRecord>;
  activeDecisionId?: Level1StoryDecisionId;
  completedCheckpointIds: string[];
  unlockDecision(id: Level1StoryDecisionId, moment: StoryMoment): void;
  startDecision(id: Level1StoryDecisionId, moment: StoryMoment): void;
  resolveDecision(
    id: Level1StoryDecisionId,
    choiceId: string,
    moment: StoryMoment,
  ): StoryDecisionResolution;
  markCheckpointCompleted(id: string): void;
  resetLevel1Story(): void;
};
```

---

# 6. Eligibility

Создать явные чистые функции:

```ts
canUnlockSecurityBaseline(...)
canUnlockDeveloperAdminAccess(...)
canUnlockFrontendTestData(...)
canUnlockSecurityPriority(...)
canUnlockBackupStrategy(...)
canUnlockArchitectureBoundary(...)
canUnlockSuspiciousActivityDisclosure(...)
canUnlockReleaseRiskDecision(...)
```

Не создавать generic expression parser.

## Приоритеты

Если несколько решений одновременно eligible:

1. `security-baseline-path`;
2. `developer-admin-access`;
3. `frontend-test-data`;
4. `security-first-priority`;
5. `backup-and-restore-strategy`;
6. `architecture-boundary`;
7. `suspicious-activity-disclosure`;
8. `release-risk-decision`.

Одновременно active может быть только одна blocking decision scene.

---

# 7. Интеграция с Workday Flow

Если обязательное решение available:

- оно имеет приоритет над quiet beat;
- создаётся objective `resolve-story-dialogue`;
- день не auto-complete;
- story marker скрывает DeepSeek marker;
- после resolve Workday Flow продолжает текущий день;
- decision effects применяются до завершения дня.

Не создавать новый Workday Flow.

Использовать существующий Feature 16.

---

# 8. Идемпотентность

Каждый choice имеет operation id:

```text
story-decision:{decisionId}:{choiceId}
```

Повторный вызов:

- не создаёт вторую transaction;
- не создаёт второй risk signal;
- не создаёт вторую task;
- не меняет choice;
- возвращает existing result.

Если первый вызов завершился частично из-за ошибки:

- повтор должен безопасно довести недостающие side effects;
- уже созданные effects не дублируются;
- financial journal и risk signal ids являются источниками факта применения.

---

# 9. Миграция

Для старого сохранения:

- создать восемь records;
- не воспроизводить прошедшие решения задним числом;
- security baseline сделать available только если оба разработчика наняты и первый sprint ещё не начат;
- другие nodes создавать только для текущей или будущей точки;
- существующие решения Feature 06–10 не дублировать.

Если текущая кампания уже прошла соответствующий checkpoint:

- node пометить `resolved` через migration metadata;
- не показывать migration choice игроку;
- не применять effects.

## Existing post-breach decision

Feature 17 не должна оставить две одинаковые развилки «аудит или нанять Илью».

После анализа актуального кода Claude должен:

- перенести выбор staffing path в новую раннюю сцену;
- существующую post-breach сцену преобразовать в follow-up разговор о реакции на нарушение;
- либо корректно отключить старую развилку, сохранив уже записанные saves;
- не удалять уже применённые hire records, fines и findings.

Точная миграция должна быть описана в итоговом отчёте.

---

# 10. Reset

Общий reset должен:

- вернуть восемь decisions в `locked`;
- очистить active decision;
- очистить checkpoints;
- удалить новые tasks через общий task reset;
- удалить новые transactions через economy reset;
- удалить новые risk signals через risk reset;
- не добавлять второй обработчик `?intro`.

---

# 11. Тесты 17A

Минимум:

1. catalog содержит 8 уникальных nodes;
2. choice ids уникальны внутри node;
3. store init идемпотентен;
4. только один active blocking decision;
5. priority стабилен;
6. story objective блокирует auto-complete;
7. story marker скрывает DeepSeek;
8. repeated resolve не применяет effects;
9. partial resolve безопасно повторяется;
10. migration не проигрывает прошлые сцены;
11. старый post-breach choice не дублируется;
12. reset очищает records;
13. balance imports не создают циклические зависимости;
14. существующий campaign simulator до/после переноса совпадает;
15. production bundle не содержит server secrets.

---

# 12. Обязательная проверка

Использовать scripts из `package.json`.

Минимально:

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

---

# 13. Критерий завершения 17A

Не переходить к 17B, пока:

- balance-файлы существуют;
- существующий баланс не изменён случайно;
- story core имеет тесты;
- migration безопасна;
- Workday Flow корректно блокируется;
- старая развилка не дублируется;
- DeepSeek routing не сломан;
- tests/build проходят.

---

# 14. Формат ответа Claude Code

```md
## Что изучено

## Как устроен Story Decision Core

## Какие balance constants перенесены

## Как доказано отсутствие изменения старого баланса

## Как интегрирован Workday Flow

## Как устранено дублирование старой развилки

## Миграция

## Reset

## Созданные файлы

## Изменённые файлы

## Добавленные тесты

## Выполненные команды

## Результаты тестов

## Результат production build

## Ограничения перед 17B
```
