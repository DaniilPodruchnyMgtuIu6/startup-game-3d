import { create } from 'zustand'
import { isIntroReset } from './gameStore'
import { useGameOutcomeStore } from './gameOutcomeStore'

export type ServerRole = 'gateway' | 'auth' | 'database' | 'backup'
export type RackStatus = 'ok' | 'broken' | 'repairing'
export type MinigameKind = 'firewall' | 'logs' | 'sqli' | 'backup'

// Rack seed (left→right in ServerRoom) → permanent role.
export const ROLE_BY_SEED: ServerRole[] = ['gateway', 'auth', 'database', 'backup']

// Short ASCII codes for the 3D rack plate. Deliberately ASCII: the plate is
// rendered with drei/troika <Text>, whose default font does not guarantee
// Cyrillic glyphs. Russian role identity is shown in the DOM overlay title
// (each mini-game module's `title`), which renders Cyrillic fine.
export const ROLE_LABEL: Record<ServerRole, string> = {
  gateway: 'GATE',
  auth: 'AUTH',
  database: 'DB',
  backup: 'BKP',
}

// Every rack now owns a security mini-game and can break. gateway/auth/database
// also feed Feature 09 risk and Feature 11 incidents; the backup rack is purely
// educational (its win/loss adds no risk and arms no incident).
export const MINIGAME_BY_ROLE: Record<ServerRole, MinigameKind> = {
  gateway: 'firewall',
  auth: 'logs',
  database: 'sqli',
  backup: 'backup',
}

export interface RackState {
  role: ServerRole
  status: RackStatus
  brokenAt: number | null // performance.now() when it broke; null while ok
  failures: number // failed mini-game attempts on the current incident
}

// A closed incident. history feeds a future "consequences" module (penalties
// for long downtime / repeated failures) with no change to this mechanic.
export interface IncidentRecord {
  role: ServerRole
  brokenAt: number
  fixedAt: number
  failures: number
}

const ROLES: ServerRole[] = ['gateway', 'auth', 'database', 'backup']

// --- Deterministic auto-break schedule --------------------------------------

export const AUTO_BREAK_MIN_SPRINT = 2
export const AUTO_BREAK_CADENCE = 3

// Which rack (if any) should break when the given working day is completed.
// Purely a function of the workday index — no Math.random, no Date — so the
// schedule is stable and testable. Never piles a second incident on an
// unresolved one, and only from the second sprint onward (servers are in real
// use once the first prototype exists). Racks rotate gateway→auth→database→backup.
export function pickAutoBreakRole(
  completedWorkdayIndex: number,
  sprintNumber: number,
  racks: Record<ServerRole, RackState>,
): ServerRole | null {
  if (sprintNumber < AUTO_BREAK_MIN_SPRINT) return null
  if (completedWorkdayIndex <= 0 || completedWorkdayIndex % AUTO_BREAK_CADENCE !== 0) return null
  if (ROLES.some((r) => racks[r].status !== 'ok')) return null
  const role = ROLES[Math.floor(completedWorkdayIndex / AUTO_BREAK_CADENCE) % ROLES.length]
  return racks[role].status === 'ok' ? role : null
}

// --- Persistence ------------------------------------------------------------

const STORAGE_KEY = 'startup-office-server-racks'

export interface ServerRacksData {
  racks: Record<ServerRole, RackState>
}

type Storage = Pick<globalThis.Storage, 'getItem' | 'setItem' | 'removeItem'>
function safeStorage(): Storage | null {
  try {
    return window.localStorage
  } catch {
    return null
  }
}

function freshRacks(): Record<ServerRole, RackState> {
  return {
    gateway: { role: 'gateway', status: 'ok', brokenAt: null, failures: 0 },
    auth: { role: 'auth', status: 'ok', brokenAt: null, failures: 0 },
    database: { role: 'database', status: 'ok', brokenAt: null, failures: 0 },
    backup: { role: 'backup', status: 'ok', brokenAt: null, failures: 0 },
  }
}

function normalizeRacks(parsed: unknown): Record<ServerRole, RackState> {
  const racks = freshRacks()
  if (!parsed || typeof parsed !== 'object') return racks
  const source = parsed as Record<string, unknown>
  for (const role of ROLES) {
    const raw = source[role]
    if (!raw || typeof raw !== 'object') continue
    const rec = raw as Record<string, unknown>
    // 'repairing' means a mini-game overlay was open when the tab closed; there
    // is no active game after a reload, so it reverts to plain 'broken'.
    const status: RackStatus = rec.status === 'broken' || rec.status === 'repairing' ? 'broken' : 'ok'
    const failures = typeof rec.failures === 'number' && rec.failures > 0 ? Math.floor(rec.failures) : 0
    // brokenAt is a performance.now() stamp; it is meaningless across sessions
    // (only feeds the unused history duration), so drop it on load.
    racks[role] = { role, status, brokenAt: null, failures: status === 'ok' ? 0 : failures }
  }
  return racks
}

export function loadServerRacks(storage: Storage | null, search: string): ServerRacksData {
  if (isIntroReset(search)) {
    storage?.removeItem(STORAGE_KEY)
    return { racks: freshRacks() }
  }
  if (!storage) return { racks: freshRacks() }
  const raw = storage.getItem(STORAGE_KEY)
  if (!raw) return { racks: freshRacks() }
  try {
    const parsed = JSON.parse(raw) as { racks?: unknown }
    return { racks: normalizeRacks(parsed.racks) }
  } catch {
    return { racks: freshRacks() }
  }
}

export function saveServerRacks(storage: Storage | null, data: ServerRacksData): void {
  try {
    storage?.setItem(STORAGE_KEY, JSON.stringify(data))
  } catch {
    // private mode — restarts fresh next time
  }
}

interface ServerIncidentsStore {
  racks: Record<ServerRole, RackState>
  activeMinigame: { role: ServerRole; kind: MinigameKind } | null
  history: IncidentRecord[]
  breakServer: (role?: ServerRole) => void
  autoBreakForWorkday: (completedWorkdayIndex: number, sprintNumber: number) => ServerRole | null
  beginRepair: (role: ServerRole) => void
  failAttempt: (role: ServerRole) => void
  completeRepair: (role: ServerRole) => void
  closeMinigame: () => void
  resetServerRacks: () => void
}

const initial = loadServerRacks(safeStorage(), typeof window === 'undefined' ? '' : window.location.search)

export const useServerIncidentsStore = create<ServerIncidentsStore>()((set, get) => {
  const persist = () => saveServerRacks(safeStorage(), { racks: get().racks })

  return {
    racks: initial.racks,
    activeMinigame: null,
    history: [],

    // Break a specific rack, or a random currently-healthy rack. No-op if the
    // target is already broken. (Deterministic scheduling goes through
    // autoBreakForWorkday; the random path stays for the `__breakServer` dev hook.)
    breakServer: (role) => {
      const racks = get().racks
      let target = role
      if (!target) {
        const candidates = ROLES.filter((r) => racks[r].status === 'ok')
        if (candidates.length === 0) return
        target = candidates[Math.floor(Math.random() * candidates.length)]
      }
      if (racks[target].status !== 'ok') return
      set((s) => ({
        racks: {
          ...s.racks,
          [target!]: { ...s.racks[target!], status: 'broken', brokenAt: performance.now(), failures: 0 },
        },
      }))
      persist()
    },

    // Called when a working day is completed: breaks the scheduled rack, if any.
    // Returns the broken role (or null) so callers can log/verify.
    autoBreakForWorkday: (completedWorkdayIndex, sprintNumber) => {
      if (get().activeMinigame) return null
      const role = pickAutoBreakRole(completedWorkdayIndex, sprintNumber, get().racks)
      if (role) get().breakServer(role)
      return role
    },

    // Player arrived at the rack → open the overlay for its bound mini-game.
    beginRepair: (role) => {
      if (get().racks[role].status === 'ok') return
      // A registered defeat (pending or final) freezes every game action.
      if (useGameOutcomeStore.getState().status !== 'playing') return
      set((s) => ({
        racks: { ...s.racks, [role]: { ...s.racks[role], status: 'repairing' } },
        activeMinigame: { role, kind: MINIGAME_BY_ROLE[role] },
      }))
      persist()
    },

    failAttempt: (role) => {
      set((s) => ({ racks: { ...s.racks, [role]: { ...s.racks[role], failures: s.racks[role].failures + 1 } } }))
      persist()
    },

    // Mini-game won → rack healthy, record the incident, close the overlay.
    completeRepair: (role) => {
      const rack = get().racks[role]
      const record: IncidentRecord | null = rack.brokenAt
        ? { role, brokenAt: rack.brokenAt, fixedAt: performance.now(), failures: rack.failures }
        : null
      set((s) => ({
        racks: { ...s.racks, [role]: { role, status: 'ok', brokenAt: null, failures: 0 } },
        activeMinigame: null,
        history: record ? [...s.history, record] : s.history,
      }))
      persist()
    },

    // Exit without fixing → overlay closes, a 'repairing' rack reverts to
    // 'broken'. Never demotes an already-'ok' rack (idempotent safety net for
    // the win path, which calls completeRepair first).
    closeMinigame: () =>
      set((s) => {
        const active = s.activeMinigame
        if (!active) return {}
        const rack = s.racks[active.role]
        const racks =
          rack.status === 'repairing'
            ? { ...s.racks, [active.role]: { ...rack, status: 'broken' as RackStatus } }
            : s.racks
        saveServerRacks(safeStorage(), { racks })
        return { activeMinigame: null, racks }
      }),

    resetServerRacks: () => {
      set({ racks: freshRacks(), activeMinigame: null, history: [] })
      persist()
    },
  }
})
