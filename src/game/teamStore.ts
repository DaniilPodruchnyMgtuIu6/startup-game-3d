import { create } from 'zustand'
import { normalizeHires, type HireRecord } from './teamRules'
import { getEmployee } from './teamCatalog'
import { isIntroReset } from './gameStore'

// Team composition lives in its own store and its own localStorage key so the
// existing gameStore / sprintStore / economyStore saves are untouched. Only the
// facts of hiring are persisted (see HireRecord); the catalog is code.

const TEAM_STORAGE_KEY = 'startup-office-team'

type TeamStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>

function safeStorage(): TeamStorage | null {
  try {
    return window.localStorage
  } catch {
    return null
  }
}

// Reads saved hires. `?intro` wipes them (parsed by gameStore.isIntroReset - one
// URL rule). Missing (fresh or old Feature-02 save), corrupt, or invalid data
// fall back to an empty team; hires are never auto-created. Exported for tests.
export function loadTeam(storage: TeamStorage | null, search: string): HireRecord[] {
  if (isIntroReset(search)) {
    storage?.removeItem(TEAM_STORAGE_KEY)
    return []
  }
  if (!storage) return []
  const raw = storage.getItem(TEAM_STORAGE_KEY)
  if (!raw) return []
  try {
    return normalizeHires((JSON.parse(raw) as { hires?: unknown }).hires)
  } catch {
    return []
  }
}

export function saveTeam(storage: TeamStorage | null, hires: HireRecord[]): void {
  try {
    storage?.setItem(TEAM_STORAGE_KEY, JSON.stringify({ hires }))
  } catch {
    // private mode - team simply restarts empty next time
  }
}

export type HireEmployeeResult =
  | { hired: true; employeeId: string }
  | { hired: false; reason: 'already-hired' | 'unknown-employee' | 'invalid-game-state' }

interface TeamStore {
  hires: HireRecord[]
  // UI flag for the team panel (not persisted), mirroring the project pattern.
  panelOpen: boolean
  hireEmployee: (employeeId: string, context: { sprintNumber: number; day: number }) => HireEmployeeResult
  resetTeam: () => void
  openPanel: () => void
  closePanel: () => void
}

const initial = loadTeam(safeStorage(), typeof window === 'undefined' ? '' : window.location.search)

export const useTeamStore = create<TeamStore>()((set, get) => ({
  hires: initial,
  panelOpen: false,

  hireEmployee: (employeeId, context) => {
    if (!getEmployee(employeeId)) return { hired: false, reason: 'unknown-employee' }
    if (get().hires.some((h) => h.employeeId === employeeId)) return { hired: false, reason: 'already-hired' }
    const { sprintNumber, day } = context
    if (!Number.isInteger(sprintNumber) || sprintNumber < 1 || !Number.isInteger(day) || day < 1) {
      return { hired: false, reason: 'invalid-game-state' }
    }
    const hires = [...get().hires, { employeeId, hiredAtSprint: sprintNumber, hiredAtDay: day }]
    set({ hires })
    saveTeam(safeStorage(), hires)
    return { hired: true, employeeId }
  },

  resetTeam: () => {
    set({ hires: [], panelOpen: false })
    saveTeam(safeStorage(), [])
  },

  openPanel: () => set({ panelOpen: true }),
  closePanel: () => set({ panelOpen: false }),
}))
