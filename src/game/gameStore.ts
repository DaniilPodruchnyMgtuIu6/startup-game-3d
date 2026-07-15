import { create } from 'zustand'
import { BOARD_TASKS, type BoardTask } from './tasks'

// 'fired' is the refusal ending - never persisted, a reload starts over.
export type GamePhase = 'intro' | 'meetPm' | 'free' | 'fired'

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

export interface ChoiceOption {
  id: string
  label: string
}

interface ActiveChoice {
  options: ChoiceOption[]
  onChoose: (id: string) => void
}

const STORAGE_KEY = 'startup-office-progress'

interface SavedProgress {
  playerName: string
  phase: GamePhase
  tasks: BoardTask[]
  reprimands: number
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
  const fresh: SavedProgress = { playerName: '', phase: 'intro', tasks: BOARD_TASKS, reprimands: 0 }
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
    const tasks = Array.isArray(parsed.tasks) ? parsed.tasks : BOARD_TASKS
    const reprimands = typeof parsed.reprimands === 'number' ? parsed.reprimands : 0
    return { playerName: parsed.playerName, phase: parsed.phase, tasks, reprimands }
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
  activeChoice: ActiveChoice | null
  tasks: BoardTask[]
  reprimands: number
  // the meeting room whiteboard with the task reminders
  taskBoardOpen: boolean
  completeIntro: (name: string) => void
  refuseJob: () => void
  restartGame: () => void
  startDialogue: (lines: DialogueLine[]) => void
  advanceDialogue: () => void
  presentChoice: (options: ChoiceOption[], onChoose: (id: string) => void) => void
  chooseOption: (id: string) => void
  addTask: (task: BoardTask) => void
  addReprimand: () => void
  openTaskBoard: () => void
  closeTaskBoard: () => void
}

const initial = loadProgress(safeStorage(), typeof window === 'undefined' ? '' : window.location.search)

export const useGameStore = create<GameStore>()((set, get) => ({
  phase: initial.phase,
  playerName: initial.playerName,
  activeDialogue: null,
  activeChoice: null,
  tasks: initial.tasks,
  reprimands: initial.reprimands,
  taskBoardOpen: false,
  completeIntro: (name) => {
    const playerName = name.trim()
    if (!playerName) return
    set({ playerName, phase: 'meetPm' })
    saveProgress(safeStorage(), { playerName, phase: 'meetPm', tasks: get().tasks, reprimands: get().reprimands })
  },
  refuseJob: () => set({ phase: 'fired' }),
  restartGame: () => {
    try {
      safeStorage()?.removeItem(STORAGE_KEY)
    } catch {
      // ignore
    }
    set({
      phase: 'intro',
      playerName: '',
      activeDialogue: null,
      activeChoice: null,
      tasks: BOARD_TASKS,
      reprimands: 0,
    })
  },
  startDialogue: (lines) => {
    if (lines.length === 0) return
    set({ activeDialogue: { lines, index: 0 } })
  },
  presentChoice: (options, onChoose) => set({ activeChoice: { options, onChoose } }),
  chooseOption: (id) => {
    const choice = get().activeChoice
    set({ activeChoice: null })
    choice?.onChoose(id)
  },
  addTask: (task) => {
    set((s) => ({ tasks: [...s.tasks, task] }))
    const { playerName, phase, tasks, reprimands } = get()
    saveProgress(safeStorage(), { playerName, phase, tasks, reprimands })
  },
  addReprimand: () => {
    set((s) => ({ reprimands: s.reprimands + 1 }))
    const { playerName, phase, tasks, reprimands } = get()
    saveProgress(safeStorage(), { playerName, phase, tasks, reprimands })
  },
  openTaskBoard: () => set({ taskBoardOpen: true }),
  closeTaskBoard: () => set({ taskBoardOpen: false }),
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
      saveProgress(safeStorage(), {
        playerName: get().playerName,
        phase: 'free',
        tasks: get().tasks,
        reprimands: get().reprimands,
      })
      return
    }
    set({ activeDialogue: null })
  },
}))
