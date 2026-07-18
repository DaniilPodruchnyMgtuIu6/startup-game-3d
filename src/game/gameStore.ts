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
  // Label for the button on the last line - defaults to 'Далее' like every
  // other line. Only the PM's welcome conversation asks for something else
  // ('За работу'); a scripted scene's dialogue has no reason to say that
  // mid-scene, so it must be opted into per call, not assumed globally.
  closingLabel?: string
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

// `?intro` in the URL search string requests a full progress reset (replay the
// intro). Kept in one place so gameStore and sprintStore parse the flag
// identically rather than duplicating the URL logic.
export function isIntroReset(search: string): boolean {
  return new URLSearchParams(search).has('intro')
}

// Reads saved progress; `?intro` in the search string wipes it so the intro
// can be replayed. Exported for tests.
export function loadProgress(storage: ProgressStorage | null, search: string): SavedProgress {
  const fresh: SavedProgress = { playerName: '', phase: 'intro', tasks: BOARD_TASKS, reprimands: 0 }
  if (!storage) return fresh
  try {
    if (isIntroReset(search)) {
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
  completeIntro: (name: string) => void
  refuseJob: () => void
  restartGame: () => void
  startDialogue: (lines: DialogueLine[], opts?: { closingLabel?: string }) => void
  advanceDialogue: () => void
  presentChoice: (options: ChoiceOption[], onChoose: (id: string) => void) => void
  chooseOption: (id: string) => void
  addTask: (task: BoardTask) => void
  // Marks an existing board task done (idempotent). No-op if it is already done
  // or the id is unknown - the id is expected to exist in the seeded board.
  completeTask: (id: string) => void
  // Reverts a task to not-done (idempotent). Used only by the Feature 07
  // reconciliation to undo a "done" hire task that has no matching hire record.
  uncompleteTask: (id: string) => void
  addReprimand: () => void
}

const initial = loadProgress(safeStorage(), typeof window === 'undefined' ? '' : window.location.search)

export const useGameStore = create<GameStore>()((set, get) => ({
  phase: initial.phase,
  playerName: initial.playerName,
  activeDialogue: null,
  activeChoice: null,
  tasks: initial.tasks,
  reprimands: initial.reprimands,
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
  startDialogue: (lines, opts) => {
    if (lines.length === 0) return
    set({ activeDialogue: { lines, index: 0, closingLabel: opts?.closingLabel } })
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
  completeTask: (id) => {
    if (!get().tasks.some((t) => t.id === id && !t.done)) return // already done or unknown
    set((s) => ({ tasks: s.tasks.map((t) => (t.id === id ? { ...t, done: true } : t)) }))
    const { playerName, phase, tasks, reprimands } = get()
    saveProgress(safeStorage(), { playerName, phase, tasks, reprimands })
  },
  uncompleteTask: (id) => {
    if (!get().tasks.some((t) => t.id === id && t.done)) return // already not-done or unknown
    set((s) => ({ tasks: s.tasks.map((t) => (t.id === id ? { ...t, done: false } : t)) }))
    const { playerName, phase, tasks, reprimands } = get()
    saveProgress(safeStorage(), { playerName, phase, tasks, reprimands })
  },
  addReprimand: () => {
    set((s) => ({ reprimands: s.reprimands + 1 }))
    const { playerName, phase, tasks, reprimands } = get()
    saveProgress(safeStorage(), { playerName, phase, tasks, reprimands })
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
