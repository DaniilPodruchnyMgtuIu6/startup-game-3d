// Shared Feature 14 types for the optional DeepSeek NPC free-chat. Imported by
// both the client (src) and the server proxy (server). Contains NO secrets, NO
// Three.js, NO system prompts — only the wire contract and player-visible shapes.

export type NpcId = 'sonya-sokolova' | 'kirill-morozov' | 'alina-belova' | 'ilya-vlasov'

export const NPC_IDS: NpcId[] = ['sonya-sokolova', 'kirill-morozov', 'alina-belova', 'ilya-vlasov']

export function isNpcId(value: unknown): value is NpcId {
  return typeof value === 'string' && (NPC_IDS as string[]).includes(value)
}

// NpcId → 3D character definition id (used by the approach controller).
export const NPC_CHARACTER_ID: Record<NpcId, string> = {
  'sonya-sokolova': 'npc-female-pm',
  'kirill-morozov': 'npc-kirill-morozov',
  'alina-belova': 'npc-alina-belova',
  'ilya-vlasov': 'npc-ilya-vlasov',
}

// Display metadata for the conversation panel + fallback lines (no portrait here
// to keep this module free of asset/Three imports; the panel adds portraits).
export const NPC_META: Record<NpcId, { name: string; role: string }> = {
  'sonya-sokolova': { name: 'Соня Соколова', role: 'Проджект-менеджер' },
  'kirill-morozov': { name: 'Кирилл Морозов', role: 'Backend-разработчик' },
  'alina-belova': { name: 'Алина Белова', role: 'Frontend-разработчик' },
  'ilya-vlasov': { name: 'Илья Власов', role: 'Специалист по информационной безопасности' },
}

// --- Public game context (visible-only; see npcPublicContext) ----------------

export type BudgetBand = 'critical' | 'low' | 'stable' | 'comfortable'
export type CampaignStatus = 'playing' | 'won' | 'lost'

export interface PublicRiskObservation {
  domainLabel: string
  levelLabel: string
}

export interface PublicNpcEvent {
  label: string
}

export interface PublicNpcGameContext {
  campaignStatus: CampaignStatus
  sprint?: {
    number: number
    day: number
    phase: 'planning' | 'active' | 'review'
  }
  budgetBand: BudgetBand
  exactBalance?: number
  product: {
    progressPercent: number
    completedTaskCount: number
    totalTaskCount: 14
    firstPrototypeReady: boolean
  }
  team: {
    hiredEmployeeIds: string[]
  }
  currentNpc: {
    id: NpcId
    currentVisibleAssignment?: string
  }
  visibleObjectives: string[]
  detectedRiskObservations: PublicRiskObservation[]
  recentVisibleEvents: PublicNpcEvent[]
  // Player-visible: the player blamed the PM in the security-breach scene (only
  // affects Sonya's tone, never any game math).
  sonyaBlamed?: boolean
}

// --- Wire contract -----------------------------------------------------------

export interface NpcChatHistoryMessage {
  role: 'user' | 'assistant'
  content: string
}

export interface NpcChatRequest {
  npcId: NpcId
  message: string
  history: NpcChatHistoryMessage[]
  context: PublicNpcGameContext
}

// Request limits — enforced on the client for UX and again on the server.
export const NPC_CHAT_LIMITS = {
  messageMax: 500,
  historyMax: 12,
  historyMessageMax: 1200,
  historyTotalMax: 6000,
} as const

export type NpcChatErrorCode = 'not_configured' | 'rate_limited' | 'provider_timeout' | 'provider_unavailable' | 'npc_unavailable' | 'invalid_request'
