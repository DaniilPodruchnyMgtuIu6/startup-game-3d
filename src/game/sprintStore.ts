import { create } from 'zustand'
import {
  INITIAL_SPRINT_STATE,
  advanceSprintDay,
  completeSprintReview as completeReviewRule,
  normalizeSprintState,
  startSprint as startSprintRule,
  type SprintState,
} from './sprintRules'
import { isIntroReset } from './gameStore'

// Sprint clock lives in its own store and its own localStorage key so the
// existing gameStore save format is untouched (backward compatible). Game time
// only moves on an explicit player confirmation - never on a timer.

const SPRINT_STORAGE_KEY = 'startup-office-sprint'
// Feature 16 §2: which sprint's kickoff has already been shown. Persisted in its
// own key so it survives a reload (a React ref did not) and stays independent of
// the pure sprint clock in SPRINT_STORAGE_KEY. Absent key => never shown (null).
const SPRINT_KICKOFF_KEY = 'startup-office-sprint-kickoff'

type SprintStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>

function safeStorage(): SprintStorage | null {
  try {
    return window.localStorage
  } catch {
    return null // private mode / storage disabled
  }
}

// Reads saved sprint state. `?intro` wipes it (parsed by gameStore.isIntroReset,
// so the URL rule lives in exactly one place). A missing key (fresh or
// pre-sprint save), corrupt JSON, or out-of-range values all fall back to the
// initial state. Exported for tests.
export function loadSprint(storage: SprintStorage | null, search: string): SprintState {
  if (isIntroReset(search)) {
    storage?.removeItem(SPRINT_STORAGE_KEY)
    return { ...INITIAL_SPRINT_STATE }
  }
  if (!storage) return { ...INITIAL_SPRINT_STATE }
  const raw = storage.getItem(SPRINT_STORAGE_KEY)
  if (!raw) return { ...INITIAL_SPRINT_STATE }
  try {
    return normalizeSprintState(JSON.parse(raw))
  } catch {
    return { ...INITIAL_SPRINT_STATE }
  }
}

export function saveSprint(storage: SprintStorage | null, state: SprintState): void {
  try {
    storage?.setItem(SPRINT_STORAGE_KEY, JSON.stringify(state))
  } catch {
    // private mode - the sprint simply restarts from planning next time
  }
}

// The persisted "kickoff already shown" marker. `?intro` wipes it; a missing key
// or malformed value reads as null (never shown). Exported for tests.
export function loadKickoffShown(storage: SprintStorage | null, search: string): number | null {
  if (isIntroReset(search)) {
    storage?.removeItem(SPRINT_KICKOFF_KEY)
    return null
  }
  if (!storage) return null
  const raw = storage.getItem(SPRINT_KICKOFF_KEY)
  if (!raw) return null
  const n = Number(raw)
  return Number.isInteger(n) && n >= 1 ? n : null
}

function saveKickoffShown(storage: SprintStorage | null, value: number | null): void {
  try {
    if (value === null) storage?.removeItem(SPRINT_KICKOFF_KEY)
    else storage?.setItem(SPRINT_KICKOFF_KEY, String(value))
  } catch {
    // private mode - the kickoff may replay once next session; harmless
  }
}

interface SprintStore extends SprintState {
  // True while the end-of-day confirmation is open. The day only moves on an
  // explicit confirm, so the first click just opens this.
  confirmingEndDay: boolean
  // Feature 16 §2: the sprint number whose kickoff has already been shown (null
  // if none yet). Persisted, so a reload on day 1 does not replay the kickoff.
  kickoffShownForSprint: number | null
  startSprint: () => void
  requestEndDay: () => void
  confirmEndDay: () => void
  cancelEndDay: () => void
  completeSprintReview: () => void
  markSprintKickoffShown: (sprintNumber: number) => void
  resetSprint: () => void
}

function sprintOf(s: SprintState): SprintState {
  return { sprintNumber: s.sprintNumber, day: s.day, phase: s.phase }
}

const search = typeof window === 'undefined' ? '' : window.location.search
const initial = loadSprint(safeStorage(), search)
const initialKickoffShown = loadKickoffShown(safeStorage(), search)

function persist(state: SprintState) {
  saveSprint(safeStorage(), state)
}

export const useSprintStore = create<SprintStore>()((set, get) => ({
  ...initial,
  confirmingEndDay: false,
  kickoffShownForSprint: initialKickoffShown,

  startSprint: () => {
    const next = startSprintRule(sprintOf(get()))
    set(next)
    persist(next)
  },

  // First press only opens the confirmation - the day must not move yet.
  requestEndDay: () => {
    if (get().phase !== 'active') return
    set({ confirmingEndDay: true })
  },

  // Only an open confirmation may advance the day, and it closes immediately,
  // so a repeated confirm cannot advance twice.
  confirmEndDay: () => {
    if (!get().confirmingEndDay) return
    const next = advanceSprintDay(sprintOf(get()))
    set({ ...next, confirmingEndDay: false })
    persist(next)
  },

  cancelEndDay: () => set({ confirmingEndDay: false }),

  completeSprintReview: () => {
    const next = completeReviewRule(sprintOf(get()))
    set(next)
    persist(next)
  },

  // Records (and persists) that the current sprint's kickoff has been shown, so
  // the Workday Flow does not replay it after a reload. Idempotent.
  markSprintKickoffShown: (sprintNumber: number) => {
    if (get().kickoffShownForSprint === sprintNumber) return
    set({ kickoffShownForSprint: sprintNumber })
    saveKickoffShown(safeStorage(), sprintNumber)
  },

  resetSprint: () => {
    set({ ...INITIAL_SPRINT_STATE, confirmingEndDay: false, kickoffShownForSprint: null })
    persist(INITIAL_SPRINT_STATE)
    saveKickoffShown(safeStorage(), null)
  },
}))
