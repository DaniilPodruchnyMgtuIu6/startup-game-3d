import { create } from 'zustand'
import { isIntroReset } from './gameStore'
import { isNpcId, NPC_CHAT_LIMITS, type NpcId } from './npcChatTypes'

// Feature 14 conversation memory: a small per-NPC message history, persisted so a
// free chat survives reload. Holds ONLY plain user/assistant text — never the
// system prompt, public context, API key, reasoning content or provider data
// (§17). Capped at 12 messages per NPC. `activeNpcChat` (which panel is open) is
// transient. The streaming assistant text lives locally in the panel, not here.

export const NPC_CONVERSATION_MAX = 12

export interface NpcConversationMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  createdAt: number
  // Set when this reply is a local fallback (not a real DeepSeek answer).
  local?: boolean
}

export interface NpcConversationStateData {
  conversations: Partial<Record<NpcId, NpcConversationMessage[]>>
}

const STORAGE_KEY = 'startup-office-npc-conversations'

type Storage = Pick<globalThis.Storage, 'getItem' | 'setItem' | 'removeItem'>
function safeStorage(): Storage | null {
  try {
    return window.localStorage
  } catch {
    return null
  }
}

// Keep only the newest 12 messages (dropping the oldest).
export function trimNpcConversationHistory(history: NpcConversationMessage[]): NpcConversationMessage[] {
  return history.length > NPC_CONVERSATION_MAX ? history.slice(history.length - NPC_CONVERSATION_MAX) : history
}

function sanitizeMessage(raw: unknown): NpcConversationMessage | null {
  if (!raw || typeof raw !== 'object') return null
  const r = raw as Record<string, unknown>
  if (r.role !== 'user' && r.role !== 'assistant') return null
  if (typeof r.content !== 'string') return null
  const content = r.content.trim().slice(0, NPC_CHAT_LIMITS.historyMessageMax)
  if (!content) return null
  const id = typeof r.id === 'string' && r.id ? r.id : `m-${Math.abs(hashString(content + String(r.createdAt)))}`
  const createdAt = typeof r.createdAt === 'number' && Number.isFinite(r.createdAt) ? r.createdAt : 0
  return { id, role: r.role, content, createdAt, ...(r.local === true ? { local: true } : {}) }
}

function hashString(s: string): number {
  let h = 0
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0
  return h
}

function sanitizeConversation(raw: unknown): NpcConversationMessage[] {
  if (!Array.isArray(raw)) return []
  const seen = new Set<string>()
  const messages: NpcConversationMessage[] = []
  for (const item of raw) {
    const msg = sanitizeMessage(item)
    if (!msg || seen.has(msg.id)) continue
    seen.add(msg.id)
    messages.push(msg)
  }
  // Drop leading assistant messages that precede the first user message.
  let start = 0
  while (start < messages.length && messages[start].role === 'assistant') start++
  return trimNpcConversationHistory(messages.slice(start))
}

export function normalizeNpcConversationState(persisted: unknown): NpcConversationStateData {
  if (!persisted || typeof persisted !== 'object') return { conversations: {} }
  const raw = (persisted as Record<string, unknown>).conversations
  if (!raw || typeof raw !== 'object') return { conversations: {} }
  const conversations: Partial<Record<NpcId, NpcConversationMessage[]>> = {}
  for (const [key, value] of Object.entries(raw)) {
    if (!isNpcId(key)) continue
    const messages = sanitizeConversation(value)
    if (messages.length > 0) conversations[key] = messages
  }
  return { conversations }
}

export function loadNpcConversations(storage: Storage | null, search: string): NpcConversationStateData {
  if (isIntroReset(search)) {
    storage?.removeItem(STORAGE_KEY)
    return { conversations: {} }
  }
  if (!storage) return { conversations: {} }
  const rawText = storage.getItem(STORAGE_KEY)
  if (!rawText) return { conversations: {} }
  try {
    return normalizeNpcConversationState(JSON.parse(rawText))
  } catch {
    return { conversations: {} }
  }
}

export function saveNpcConversations(storage: Storage | null, data: NpcConversationStateData): void {
  try {
    storage?.setItem(STORAGE_KEY, JSON.stringify(data))
  } catch {
    // private mode — restarts empty next time
  }
}

interface NpcConversationStore extends NpcConversationStateData {
  activeNpcChat: NpcId | null
  appendMessage: (npcId: NpcId, message: NpcConversationMessage) => void
  clearConversation: (npcId: NpcId) => void
  resetNpcConversations: () => void
  openChat: (npcId: NpcId) => void
  closeChat: () => void
}

const initial = loadNpcConversations(safeStorage(), typeof window === 'undefined' ? '' : window.location.search)

export const useNpcConversationStore = create<NpcConversationStore>()((set, get) => {
  const persist = () => saveNpcConversations(safeStorage(), { conversations: get().conversations })
  return {
    conversations: initial.conversations,
    activeNpcChat: null,

    appendMessage: (npcId, message) => {
      const current = get().conversations[npcId] ?? []
      set({ conversations: { ...get().conversations, [npcId]: trimNpcConversationHistory([...current, message]) } })
      persist()
    },

    clearConversation: (npcId) => {
      const { [npcId]: _drop, ...rest } = get().conversations
      set({ conversations: rest })
      persist()
    },

    resetNpcConversations: () => {
      set({ conversations: {}, activeNpcChat: null })
      persist()
    },

    openChat: (npcId) => set({ activeNpcChat: npcId }),
    closeChat: () => set({ activeNpcChat: null }),
  }
})
