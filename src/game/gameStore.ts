import { create } from 'zustand'

export type GamePhase = 'intro' | 'meetPm' | 'free'

export interface DialogueLine {
  speaker: string
  speakerRole?: string
  // Drawn portrait of the speaker shown beside the line.
  portrait?: string
  text: string
}

interface ActiveDialogue {
  lines: DialogueLine[]
  index: number
}

const STORAGE_KEY = 'startup-office-progress'

interface SavedProgress {
  playerName: string
  phase: GamePhase
}

type ProgressStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>

function safeStorage(): ProgressStorage | null {
  try {
    return window.localStorage
  } catch {
    return null // private mode / storage disabled
  }
}

// Reads saved progress; `?intro` in the search string wipes it so the intro
// can be replayed. Exported for tests.
export function loadProgress(storage: ProgressStorage | null, search: string): SavedProgress {
  const fresh: SavedProgress = { playerName: '', phase: 'intro' }
  if (!storage) return fresh
  try {
    if (new URLSearchParams(search).has('intro')) {
      storage.removeItem(STORAGE_KEY)
      return fresh
    }
    const raw = storage.getItem(STORAGE_KEY)
    if (!raw) return fresh
    const parsed = JSON.parse(raw) as Partial<SavedProgress>
    if (typeof parsed.playerName !== 'string') return fresh
    if (parsed.phase !== 'meetPm' && parsed.phase !== 'free') return fresh
    return { playerName: parsed.playerName, phase: parsed.phase }
  } catch {
    return fresh
  }
}

export function saveProgress(storage: ProgressStorage | null, progress: SavedProgress): void {
  try {
    storage?.setItem(STORAGE_KEY, JSON.stringify(progress))
  } catch {
    // private mode - the game simply restarts from the intro next time
  }
}

interface GameStore {
  phase: GamePhase
  playerName: string
  activeDialogue: ActiveDialogue | null
  completeIntro: (name: string) => void
  startDialogue: (lines: DialogueLine[]) => void
  advanceDialogue: () => void
}

const initial = loadProgress(safeStorage(), typeof window === 'undefined' ? '' : window.location.search)

export const useGameStore = create<GameStore>()((set, get) => ({
  phase: initial.phase,
  playerName: initial.playerName,
  activeDialogue: null,
  completeIntro: (name) => {
    const playerName = name.trim()
    if (!playerName) return
    set({ playerName, phase: 'meetPm' })
    saveProgress(safeStorage(), { playerName, phase: 'meetPm' })
  },
  startDialogue: (lines) => {
    if (lines.length === 0) return
    set({ activeDialogue: { lines, index: 0 } })
  },
  advanceDialogue: () => {
    const dialogue = get().activeDialogue
    if (!dialogue) return
    if (dialogue.index + 1 < dialogue.lines.length) {
      set({ activeDialogue: { ...dialogue, index: dialogue.index + 1 } })
      return
    }
    // the only dialogue in phase meetPm is the PM intro - closing it unlocks
    // free play and starts NPC life
    if (get().phase === 'meetPm') {
      set({ activeDialogue: null, phase: 'free' })
      saveProgress(safeStorage(), { playerName: get().playerName, phase: 'free' })
      return
    }
    set({ activeDialogue: null })
  },
}))
