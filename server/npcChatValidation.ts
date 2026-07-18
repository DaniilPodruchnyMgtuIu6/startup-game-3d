import {
  isNpcId,
  NPC_CHAT_LIMITS,
  type BudgetBand,
  type CampaignStatus,
  type NpcChatHistoryMessage,
  type NpcChatRequest,
  type NpcId,
  type PublicNpcGameContext,
} from '../src/game/npcChatTypes'

// Server-side validation + sanitisation (Feature 14 §6/§16). The server never
// trusts the client payload: it re-applies every limit, drops unknown fields and
// roles, ignores any client-provided model, and rejects an absent Ilya.

export type ValidatedNpcChatRequestResult =
  | { ok: true; request: NpcChatRequest }
  | { ok: false; code: 'invalid_request' | 'npc_unavailable' }

const BUDGET_BANDS: BudgetBand[] = ['critical', 'low', 'stable', 'comfortable']
const CAMPAIGN_STATUSES: CampaignStatus[] = ['playing', 'won', 'lost']

function str(v: unknown): string {
  return typeof v === 'string' ? v : ''
}
function num(v: unknown, fallback = 0): number {
  return typeof v === 'number' && Number.isFinite(v) ? v : fallback
}
function strArray(v: unknown, max: number): string[] {
  return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string').map((s) => s.trim()).filter(Boolean).slice(0, max) : []
}

function sanitizeHistory(raw: unknown): NpcChatHistoryMessage[] {
  if (!Array.isArray(raw)) return []
  const out: NpcChatHistoryMessage[] = []
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue
    const role = (item as Record<string, unknown>).role
    const content = (item as Record<string, unknown>).content
    if ((role !== 'user' && role !== 'assistant') || typeof content !== 'string') continue
    const trimmed = content.trim().slice(0, NPC_CHAT_LIMITS.historyMessageMax)
    if (!trimmed) continue
    out.push({ role, content: trimmed })
  }
  // keep the most recent 12, then trim to the total-character budget
  let recent = out.slice(-NPC_CHAT_LIMITS.historyMax)
  while (recent.length > 1 && recent.reduce((n, m) => n + m.content.length, 0) > NPC_CHAT_LIMITS.historyTotalMax) {
    recent = recent.slice(1)
  }
  return recent
}

function sanitizeContext(raw: unknown, npcId: NpcId): PublicNpcGameContext {
  const c = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>
  const campaignStatus = CAMPAIGN_STATUSES.includes(c.campaignStatus as CampaignStatus) ? (c.campaignStatus as CampaignStatus) : 'playing'
  const budgetBand = BUDGET_BANDS.includes(c.budgetBand as BudgetBand) ? (c.budgetBand as BudgetBand) : 'stable'
  const sprintRaw = c.sprint as Record<string, unknown> | undefined
  const phase = sprintRaw && ['planning', 'active', 'review'].includes(String(sprintRaw.phase)) ? (sprintRaw.phase as 'planning' | 'active' | 'review') : undefined
  const product = (c.product && typeof c.product === 'object' ? c.product : {}) as Record<string, unknown>
  const team = (c.team && typeof c.team === 'object' ? c.team : {}) as Record<string, unknown>
  const currentNpc = (c.currentNpc && typeof c.currentNpc === 'object' ? c.currentNpc : {}) as Record<string, unknown>
  const risks = Array.isArray(c.detectedRiskObservations) ? c.detectedRiskObservations : []
  const events = Array.isArray(c.recentVisibleEvents) ? c.recentVisibleEvents : []
  return {
    campaignStatus,
    ...(sprintRaw && phase ? { sprint: { number: num(sprintRaw.number, 1), day: num(sprintRaw.day, 1), phase } } : {}),
    budgetBand,
    ...(npcId === 'sonya-sokolova' && typeof c.exactBalance === 'number' ? { exactBalance: c.exactBalance } : {}),
    product: {
      progressPercent: Math.max(0, Math.min(100, num(product.progressPercent))),
      completedTaskCount: Math.max(0, Math.min(14, num(product.completedTaskCount))),
      totalTaskCount: 14,
      firstPrototypeReady: product.firstPrototypeReady === true,
    },
    team: { hiredEmployeeIds: strArray(team.hiredEmployeeIds, 8) },
    currentNpc: { id: npcId, ...(typeof currentNpc.currentVisibleAssignment === 'string' ? { currentVisibleAssignment: currentNpc.currentVisibleAssignment.slice(0, 200) } : {}) },
    visibleObjectives: strArray(c.visibleObjectives, 8).map((s) => s.slice(0, 200)),
    detectedRiskObservations: risks
      .filter((o): o is Record<string, unknown> => !!o && typeof o === 'object')
      .slice(0, 6)
      .map((o) => ({ domainLabel: str(o.domainLabel).slice(0, 120), levelLabel: str(o.levelLabel).slice(0, 60) }))
      .filter((o) => o.domainLabel && o.levelLabel),
    recentVisibleEvents: events
      .filter((e): e is Record<string, unknown> => !!e && typeof e === 'object')
      .slice(0, 6)
      .map((e) => ({ label: str(e.label).slice(0, 160) }))
      .filter((e) => e.label),
    ...(npcId === 'sonya-sokolova' && c.sonyaBlamed === true ? { sonyaBlamed: true } : {}),
  }
}

export function validateNpcChatRequest(input: unknown): ValidatedNpcChatRequestResult {
  if (!input || typeof input !== 'object') return { ok: false, code: 'invalid_request' }
  const body = input as Record<string, unknown>

  if (!isNpcId(body.npcId)) return { ok: false, code: 'invalid_request' }
  const npcId = body.npcId

  const message = str(body.message).trim().slice(0, NPC_CHAT_LIMITS.messageMax)
  if (!message) return { ok: false, code: 'invalid_request' }

  const context = sanitizeContext(body.context, npcId)

  // Ilya is only available when actually hired (visible via hiredEmployeeIds).
  if (npcId === 'ilya-vlasov' && !context.team.hiredEmployeeIds.includes('ilya-vlasov')) {
    return { ok: false, code: 'npc_unavailable' }
  }

  return { ok: true, request: { npcId, message, history: sanitizeHistory(body.history), context } }
}
