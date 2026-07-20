import { create } from 'zustand'
import { isIntroReset } from './gameStore'
import { isOnceConversation, type NpcAmbientConversation } from './npcAmbientConversation'

// Feature 16 §8 runtime: the currently-playing NPC↔NPC conversation (for the 3D
// speech bubbles) plus the persisted memory of what has already been shown —
// story beats fire once per campaign, and each sprint-day gets at most one
// ambient beat, deduped by key so a reload never replays it (same discipline as
// the sprint-kickoff marker).

export interface ActiveAmbientConversation {
  conversation: NpcAmbientConversation
  lineIndex: number // -1 before the first line is spoken; then 0..lines.length-1
}

const STORAGE_KEY = 'startup-office-ambient'

interface PersistedAmbient {
  playedIds: string[] // story beats already fired (never repeat)
  playedDayKey: string | null // the `${sprint}:${day}` whose ambient beat already ran
}

type Storage = Pick<globalThis.Storage, 'getItem' | 'setItem' | 'removeItem'>
function safeStorage(): Storage | null {
  try {
    return window.localStorage
  } catch {
    return null
  }
}

export function loadAmbient(storage: Storage | null, search: string): PersistedAmbient {
  const empty: PersistedAmbient = { playedIds: [], playedDayKey: null }
  if (isIntroReset(search)) {
    storage?.removeItem(STORAGE_KEY)
    return empty
  }
  if (!storage) return empty
  const raw = storage.getItem(STORAGE_KEY)
  if (!raw) return empty
  try {
    const p = JSON.parse(raw) as Partial<PersistedAmbient>
    return {
      playedIds: Array.isArray(p.playedIds) ? p.playedIds.filter((x): x is string => typeof x === 'string') : [],
      playedDayKey: typeof p.playedDayKey === 'string' ? p.playedDayKey : null,
    }
  } catch {
    return empty
  }
}

function saveAmbient(storage: Storage | null, data: PersistedAmbient): void {
  try {
    storage?.setItem(STORAGE_KEY, JSON.stringify(data))
  } catch {
    // private mode — a conversation may replay once next session; harmless
  }
}

interface NpcAmbientStore {
  active: ActiveAmbientConversation | null
  playedIds: string[]
  playedDayKey: string | null
  begin: (conversation: NpcAmbientConversation, dayKey: string) => void
  setLineIndex: (lineIndex: number) => void
  end: () => void
  reset: () => void
}

const initial = loadAmbient(safeStorage(), typeof window === 'undefined' ? '' : window.location.search)

export const useNpcAmbientStore = create<NpcAmbientStore>()((set, get) => ({
  active: null,
  playedIds: initial.playedIds,
  playedDayKey: initial.playedDayKey,

  // Start a conversation and record that this day (and, for a story beat, this
  // id) has had its ambient moment — persisted so it never replays on reload.
  begin: (conversation, dayKey) => {
    const playedIds =
      isOnceConversation(conversation.id) && !get().playedIds.includes(conversation.id)
        ? [...get().playedIds, conversation.id]
        : get().playedIds
    set({ active: { conversation, lineIndex: -1 }, playedIds, playedDayKey: dayKey })
    saveAmbient(safeStorage(), { playedIds, playedDayKey: dayKey })
  },

  setLineIndex: (lineIndex) => set((s) => (s.active ? { active: { ...s.active, lineIndex } } : {})),

  end: () => set({ active: null }),

  reset: () => {
    set({ active: null, playedIds: [], playedDayKey: null })
    saveAmbient(safeStorage(), { playedIds: [], playedDayKey: null })
  },
}))
