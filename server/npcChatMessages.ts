import type { NpcChatRequest, PublicNpcGameContext } from '../src/game/npcChatTypes'
import { personaPrompt, safetyRules } from './npcChatPersonas'

// Pure server-side prompt assembly (Feature 14 §15). The player's message is
// always a `user` role and is never concatenated into a system prompt. The
// public context is rendered as compact code-built text, never a raw JSON dump.

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

const BAND_RU: Record<string, string> = { critical: 'критический', low: 'низкий', stable: 'стабильный', comfortable: 'комфортный' }
const PHASE_RU: Record<string, string> = { planning: 'планирование', active: 'активный', review: 'ревью' }
const CAMPAIGN_RU: Record<string, string> = { playing: 'идёт', won: 'выиграна', lost: 'проиграна' }

export function formatPublicContext(context: PublicNpcGameContext): string {
  const lines: string[] = ['Текущее видимое состояние игры:']
  lines.push(`- Кампания: ${CAMPAIGN_RU[context.campaignStatus] ?? context.campaignStatus}.`)
  if (context.sprint) lines.push(`- Спринт: ${context.sprint.number}, день ${context.sprint.day}, ${PHASE_RU[context.sprint.phase] ?? context.sprint.phase}.`)
  const budget = typeof context.exactBalance === 'number'
    ? `${BAND_RU[context.budgetBand] ?? context.budgetBand} (около ${context.exactBalance.toLocaleString('ru-RU')} ₽)`
    : (BAND_RU[context.budgetBand] ?? context.budgetBand)
  lines.push(`- Бюджет: ${budget}.`)
  lines.push(
    `- OfficeFlow: ${context.product.progressPercent}%, ${context.product.completedTaskCount}/${context.product.totalTaskCount} задач${context.product.firstPrototypeReady ? ', первый прототип готов' : ''}.`,
  )
  if (context.team.hiredEmployeeIds.length) lines.push(`- В команде наняты: ${context.team.hiredEmployeeIds.join(', ')}.`)
  if (context.currentNpc.currentVisibleAssignment) lines.push(`- Твоя текущая задача: ${context.currentNpc.currentVisibleAssignment}.`)
  if (context.visibleObjectives.length) lines.push(`- Видимые цели отдела: ${context.visibleObjectives.join('; ')}.`)
  if (context.detectedRiskObservations.length) {
    lines.push(`- Обнаруженные риски: ${context.detectedRiskObservations.map((o) => `${o.domainLabel} — ${o.levelLabel}`).join('; ')}.`)
  }
  if (context.recentVisibleEvents.length) lines.push(`- Недавние события: ${context.recentVisibleEvents.map((e) => e.label).join('; ')}.`)
  return lines.join('\n')
}

export function buildNpcChatMessages(request: NpcChatRequest): ChatMessage[] {
  const messages: ChatMessage[] = [
    { role: 'system', content: personaPrompt(request.npcId, request.context.sonyaBlamed === true) },
    { role: 'system', content: safetyRules() },
    { role: 'system', content: formatPublicContext(request.context) },
  ]
  for (const h of request.history) {
    // history is already validated to only user/assistant
    messages.push({ role: h.role, content: h.content })
  }
  messages.push({ role: 'user', content: request.message })
  return messages
}
