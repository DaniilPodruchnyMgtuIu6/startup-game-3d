import { CYBER_STORY_INCIDENT_PRIORITY, type CyberStoryChoiceId, type CyberStoryIncidentId } from './cyberStoryTypes'

// Static metadata of the three Feature 19 cyber incidents - titles and
// objective texts only, mirroring storyDecisionCatalog.ts. Dialogue lines live
// in cyberStoryDialogues.ts, effects in cyberStoryHandlers.ts, mutable state in
// cyberStoryStore.ts.

export interface CyberStoryDefinition {
  id: CyberStoryIncidentId
  title: string
  // Employee ids of the colleagues who take part in the scene.
  participants: string[]
  // All three cyber incidents are mandatory once triggered (they pause the
  // Workday Flow, same as every Level 1 decision).
  blocking: boolean
  objectiveTitle: string
  objectiveDescription: string
  choiceIds: CyberStoryChoiceId[]
}

export const CYBER_STORY_CATALOG: CyberStoryDefinition[] = [
  {
    id: 'executive-phishing-request',
    title: 'Срочное письмо от генерального директора',
    participants: ['sonya-sokolova', 'kirill-morozov', 'alina-belova'],
    blocking: true,
    objectiveTitle: 'Поговорите с Соней',
    objectiveDescription: 'Соне пришёл срочный запрос от имени генерального директора — нужно решить, как на него реагировать.',
    choiceIds: ['send-requested-data', 'verify-through-known-channel', 'escalate-phishing-to-security'],
  },
  {
    id: 'supply-chain-update',
    title: 'Обновление перед демонстрацией',
    participants: ['kirill-morozov', 'alina-belova', 'sonya-sokolova'],
    blocking: true,
    objectiveTitle: 'Поговорите с Кириллом',
    objectiveDescription: 'Вышло новое обновление библиотеки авторизации перед демонстрацией — нужно решить, ставить ли его.',
    choiceIds: ['install-update-immediately', 'keep-current-version', 'review-and-pin-dependency'],
  },
  {
    id: 'shadow-it-log-upload',
    title: 'Логи в личном облаке',
    participants: ['kirill-morozov', 'alina-belova', 'sonya-sokolova'],
    blocking: true,
    objectiveTitle: 'Поговорите с Кириллом',
    objectiveDescription: 'Алина не может воспроизвести ошибку без реальных логов — нужно решить, как их передать.',
    choiceIds: ['upload-raw-logs-to-personal-cloud', 'sanitize-logs-manually', 'configure-secure-log-sharing'],
  },
  {
    id: 'secret-committed-to-repository',
    title: 'Ключ уже в истории',
    participants: ['kirill-morozov', 'sonya-sokolova', 'alina-belova'],
    blocking: true,
    objectiveTitle: 'Поговорите с Кириллом',
    objectiveDescription: 'Кирилл удалил временный ключ новым коммитом, но он остался в истории репозитория — нужно решить, что делать.',
    choiceIds: ['remove-secret-in-new-commit', 'rewrite-repository-history', 'rotate-and-secure-secret'],
  },
  {
    id: 'mfa-fatigue-attack',
    title: 'Подтверждение среди ночи',
    participants: ['kirill-morozov', 'sonya-sokolova', 'alina-belova'],
    blocking: true,
    objectiveTitle: 'Поговорите с Кириллом',
    objectiveDescription: 'Ночью телефон Кирилла засыпало запросами подтверждения входа, а на аккаунте видна неизвестная сессия — нужно решить, что делать.',
    choiceIds: ['change-password-only', 'revoke-sessions-and-investigate', 'enable-phishing-resistant-auth'],
  },
  {
    id: 'external-ai-data-disclosure',
    title: 'ИИ уже нашёл ошибку',
    participants: ['alina-belova', 'kirill-morozov', 'sonya-sokolova'],
    blocking: true,
    objectiveTitle: 'Поговорите с Алиной',
    objectiveDescription: 'Алина исправила ошибку с помощью внешнего AI-помощника, но вместе с кодом отправила часть логов — нужно решить общий порядок использования таких инструментов.',
    choiceIds: ['allow-unrestricted-ai-tools', 'ban-external-ai-tools', 'configure-controlled-ai-gateway'],
  },
]

export function getCyberStoryDefinition(id: string): CyberStoryDefinition | undefined {
  return CYBER_STORY_CATALOG.find((d) => d.id === id)
}

// Sanity guard used by tests: the catalog must cover the priority list exactly.
export function cyberCatalogMatchesPriority(): boolean {
  const ids = CYBER_STORY_CATALOG.map((d) => d.id)
  return ids.length === CYBER_STORY_INCIDENT_PRIORITY.length && CYBER_STORY_INCIDENT_PRIORITY.every((id) => ids.includes(id))
}
