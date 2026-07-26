import { LEVEL1_DECISION_PRIORITY, type Level1StoryDecisionId } from './level1Timeline'

// Static metadata of the eight Level 1 decisions (Feature 17A §4). Titles and
// objective texts only - dialogue lines live with the scenes (17B), effects
// live in the explicit handlers, mutable state lives in storyDecisionStore.

export interface StoryDecisionDefinition {
  id: Level1StoryDecisionId
  title: string
  // Employee ids of the colleagues who take part in the scene.
  participants: string[]
  // A blocking decision pauses the Workday Flow and must be resolved before the
  // day can complete (17A §7). All Level 1 decisions are mandatory.
  blocking: boolean
  objectiveTitle: string
  objectiveDescription: string
  choiceIds: string[]
}

export const STORY_DECISION_CATALOG: StoryDecisionDefinition[] = [
  {
    id: 'security-baseline-path',
    title: 'Проверка системы: аудит или свой специалист',
    participants: ['sonya-sokolova', 'kirill-morozov', 'alina-belova'],
    blocking: true,
    objectiveTitle: 'Поговорите с Соней',
    objectiveDescription: 'Соня ждёт решения: заказать аудит или сначала нанять специалиста по безопасности.',
    choiceIds: ['commission-security-audit', 'hire-security-specialist-first'],
  },
  {
    id: 'developer-admin-access',
    title: 'Права администратора для разработчика',
    participants: ['kirill-morozov', 'sonya-sokolova', 'ilya-vlasov'],
    blocking: true,
    objectiveTitle: 'Поговорите с Кириллом',
    objectiveDescription: 'Кирилл спрашивает, какие административные права дать backend-разработке.',
    choiceIds: ['grant-permanent-admin', 'use-just-in-time-access', 'configure-controlled-access'],
  },
  {
    id: 'frontend-test-data',
    title: 'Данные для тестирования интерфейса',
    participants: ['alina-belova', 'kirill-morozov', 'sonya-sokolova'],
    blocking: true,
    objectiveTitle: 'Поговорите с Алиной',
    objectiveDescription: 'Алина спрашивает, на каких данных тестировать интерфейс OfficeFlow.',
    choiceIds: ['copy-production-data', 'create-synthetic-data', 'mask-data-with-security'],
  },
  {
    id: 'security-first-priority',
    title: 'Первый приоритет безопасности',
    participants: ['ilya-vlasov', 'sonya-sokolova'],
    blocking: true,
    objectiveTitle: 'Поговорите с Ильёй',
    objectiveDescription: 'Илья спрашивает, что проверить в первую очередь.',
    choiceIds: ['prioritize-endpoint-protection', 'prioritize-central-logging', 'prioritize-security-training'],
  },
  {
    id: 'backup-and-restore-strategy',
    title: 'Резервные копии и проверка восстановления',
    participants: ['kirill-morozov', 'sonya-sokolova', 'ilya-vlasov'],
    blocking: true,
    objectiveTitle: 'Поговорите с Кириллом',
    objectiveDescription: 'Команда ждёт решения: полная проверка восстановления или только настройка копий.',
    choiceIds: ['run-full-restore-drill', 'configure-backups-only', 'postpone-backup-work'],
  },
  {
    id: 'architecture-boundary',
    title: 'Архитектурные границы системы',
    participants: ['kirill-morozov', 'alina-belova', 'sonya-sokolova', 'ilya-vlasov'],
    blocking: true,
    objectiveTitle: 'Поговорите с Кириллом',
    objectiveDescription: 'Нужно решить, закрепить ли границы модулей или ускориться на общей кодовой базе.',
    choiceIds: ['keep-shared-architecture', 'separate-security-boundaries', 'request-architecture-review'],
  },
  {
    id: 'suspicious-activity-disclosure',
    title: 'Подозрительная активность в журналах',
    participants: ['ilya-vlasov', 'kirill-morozov', 'sonya-sokolova'],
    blocking: true,
    objectiveTitle: 'Решите, что делать с находкой',
    objectiveDescription: 'Сообщить руководству о подозрительной активности или сначала расследовать тихо.',
    choiceIds: ['report-activity-immediately', 'investigate-quietly', 'dismiss-as-false-positive'],
  },
  {
    id: 'release-risk-decision',
    title: 'Релиз с риском или укрепление',
    participants: ['sonya-sokolova', 'kirill-morozov', 'alina-belova', 'ilya-vlasov'],
    blocking: true,
    objectiveTitle: 'Примите решение о выпуске',
    objectiveDescription: 'Выпустить MVP с открытыми рисками, укрепить систему или скрыть проблему.',
    choiceIds: ['release-with-known-risk', 'delay-for-hardening', 'hide-open-risk'],
  },
]

export function getStoryDecision(id: string): StoryDecisionDefinition | undefined {
  return STORY_DECISION_CATALOG.find((d) => d.id === id)
}

// Sanity guard used by tests: the catalog must cover the timeline exactly.
export function catalogMatchesTimeline(): boolean {
  const ids = STORY_DECISION_CATALOG.map((d) => d.id)
  return ids.length === LEVEL1_DECISION_PRIORITY.length && LEVEL1_DECISION_PRIORITY.every((id) => ids.includes(id))
}
