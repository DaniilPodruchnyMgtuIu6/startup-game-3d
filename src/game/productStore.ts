import { create } from 'zustand'
import { useSprintStore } from './sprintStore'
import { isIntroReset } from './gameStore'
import {
  addToPlan,
  applyWorkdayProgress,
  initialTaskStates,
  moveInPlan,
  normalizeHistory,
  normalizeTaskStates,
  prepareNextPlanning as prepareNextPlanningRule,
  removeFromPlan,
  workdayProgressId,
  type ProductTaskState,
  type WorkdayProgressRecord,
} from './productRules'

// OfficeFlow development state. Its own store and localStorage key so the
// existing sprint/economy/team saves are untouched. Only mutable state is
// persisted - the catalog (titles, effort) stays in code.

const PRODUCT_STORAGE_KEY = 'startup-office-product'

type ProductStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>

function safeStorage(): ProductStorage | null {
  try {
    return window.localStorage
  } catch {
    return null
  }
}

interface PersistedProduct {
  taskStates: ProductTaskState[]
  workdayHistory: WorkdayProgressRecord[]
}

export function loadProduct(storage: ProductStorage | null, search: string): PersistedProduct {
  const fresh = (): PersistedProduct => ({ taskStates: initialTaskStates(), workdayHistory: [] })
  if (isIntroReset(search)) {
    storage?.removeItem(PRODUCT_STORAGE_KEY)
    return fresh()
  }
  if (!storage) return fresh()
  const raw = storage.getItem(PRODUCT_STORAGE_KEY)
  if (!raw) return fresh()
  try {
    const parsed = JSON.parse(raw) as Partial<PersistedProduct>
    return { taskStates: normalizeTaskStates(parsed.taskStates), workdayHistory: normalizeHistory(parsed.workdayHistory) }
  } catch {
    return fresh()
  }
}

export function saveProduct(storage: ProductStorage | null, data: PersistedProduct): void {
  try {
    storage?.setItem(PRODUCT_STORAGE_KEY, JSON.stringify(data))
  } catch {
    // private mode - product simply restarts from an empty backlog next time
  }
}

export type BoardTab = 'product' | 'department'

interface ProductStore {
  taskStates: ProductTaskState[]
  workdayHistory: WorkdayProgressRecord[]
  // UI-only (not persisted): the day report to display and the whiteboard panel.
  activeReport: WorkdayProgressRecord | null
  boardOpen: boolean
  boardTab: BoardTab
  // Whether the player dismissed the (non-blocking) planning intro card this
  // planning phase. Not persisted; reset each new planning.
  planningDismissed: boolean
  // The mock OfficeFlow prototype overlay (unlocked after the milestone).
  prototypeOpen: boolean

  dismissPlanning: () => void
  openPrototype: () => void
  closePrototype: () => void

  // planning (only take effect while the sprint phase is `planning`)
  addTaskToPlan: (taskId: string) => void
  removeTaskFromPlan: (taskId: string) => void
  moveTask: (taskId: string, direction: 'up' | 'down') => void

  // one confirmed day of deterministic progress (idempotent by day id)
  applyWorkday: (sprintNumber: number, day: number, employeeIds: string[]) => { applied: boolean; record: WorkdayProgressRecord }
  // carry incomplete tasks back to the backlog for the next planning
  prepareNextPlanning: () => void

  showReport: (record: WorkdayProgressRecord) => void
  closeReport: () => void
  openBoard: (tab?: BoardTab) => void
  closeBoard: () => void
  setTab: (tab: BoardTab) => void
  resetProduct: () => void
}

const initial = loadProduct(safeStorage(), typeof window === 'undefined' ? '' : window.location.search)

export const useProductStore = create<ProductStore>()((set, get) => {
  const persist = () => saveProduct(safeStorage(), { taskStates: get().taskStates, workdayHistory: get().workdayHistory })
  const inPlanning = () => useSprintStore.getState().phase === 'planning'

  return {
    taskStates: initial.taskStates,
    workdayHistory: initial.workdayHistory,
    activeReport: null,
    boardOpen: false,
    boardTab: 'product',
    planningDismissed: false,
    prototypeOpen: false,

    dismissPlanning: () => set({ planningDismissed: true }),
    openPrototype: () => set({ prototypeOpen: true }),
    closePrototype: () => set({ prototypeOpen: false }),

    addTaskToPlan: (taskId) => {
      if (!inPlanning()) return
      set({ taskStates: addToPlan(get().taskStates, taskId, useSprintStore.getState().sprintNumber) })
      persist()
    },
    removeTaskFromPlan: (taskId) => {
      if (!inPlanning()) return
      set({ taskStates: removeFromPlan(get().taskStates, taskId) })
      persist()
    },
    moveTask: (taskId, direction) => {
      if (!inPlanning()) return
      set({ taskStates: moveInPlan(get().taskStates, taskId, direction) })
      persist()
    },

    applyWorkday: (sprintNumber, day, employeeIds) => {
      const id = workdayProgressId(sprintNumber, day)
      const existing = get().workdayHistory.find((r) => r.id === id)
      if (existing) return { applied: false, record: existing } // idempotent - never charge/progress twice
      const { states, record } = applyWorkdayProgress(get().taskStates, sprintNumber, day, employeeIds)
      const full: WorkdayProgressRecord = { id, ...record }
      set({ taskStates: states, workdayHistory: [...get().workdayHistory, full] })
      persist()
      return { applied: true, record: full }
    },

    prepareNextPlanning: () => {
      set({ taskStates: prepareNextPlanningRule(get().taskStates), planningDismissed: false })
      persist()
    },

    showReport: (record) => set({ activeReport: record }),
    closeReport: () => set({ activeReport: null }),
    openBoard: (tab = 'product') => set({ boardOpen: true, boardTab: tab }),
    closeBoard: () => set({ boardOpen: false }),
    setTab: (tab) => set({ boardTab: tab }),

    resetProduct: () => {
      set({ taskStates: initialTaskStates(), workdayHistory: [], activeReport: null, boardOpen: false, boardTab: 'product', planningDismissed: false, prototypeOpen: false })
      persist()
    },
  }
})
