import { create } from 'zustand'

export type ServerRole = 'gateway' | 'auth' | 'database' | 'backup'
export type RackStatus = 'ok' | 'broken' | 'repairing'
export type MinigameKind = 'firewall' | 'logs' | 'sqli'

// Rack seed (left→right in ServerRoom) → permanent role. 'backup' has no
// mini-game yet and never breaks (reserved slot for a future fourth game).
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

export const MINIGAME_BY_ROLE: Partial<Record<ServerRole, MinigameKind>> = {
  gateway: 'firewall',
  auth: 'logs',
  database: 'sqli',
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

interface ServerIncidentsStore {
  racks: Record<ServerRole, RackState>
  activeMinigame: { role: ServerRole; kind: MinigameKind } | null
  history: IncidentRecord[]
  breakServer: (role?: ServerRole) => void
  beginRepair: (role: ServerRole) => void
  failAttempt: (role: ServerRole) => void
  completeRepair: (role: ServerRole) => void
  closeMinigame: () => void
}

const ROLES: ServerRole[] = ['gateway', 'auth', 'database', 'backup']

function freshRacks(): Record<ServerRole, RackState> {
  return {
    gateway: { role: 'gateway', status: 'ok', brokenAt: null, failures: 0 },
    auth: { role: 'auth', status: 'ok', brokenAt: null, failures: 0 },
    database: { role: 'database', status: 'ok', brokenAt: null, failures: 0 },
    backup: { role: 'backup', status: 'ok', brokenAt: null, failures: 0 },
  }
}

export const useServerIncidentsStore = create<ServerIncidentsStore>()((set, get) => ({
  racks: freshRacks(),
  activeMinigame: null,
  history: [],

  // Break a specific rack, or a random currently-healthy rack that has a
  // mini-game (never 'backup'). No-op if the target is already broken.
  breakServer: (role) => {
    const racks = get().racks
    let target = role
    if (!target) {
      const candidates = ROLES.filter((r) => MINIGAME_BY_ROLE[r] && racks[r].status === 'ok')
      if (candidates.length === 0) return
      // No Math.random at module scope is fine; this is inside an action.
      target = candidates[Math.floor(Math.random() * candidates.length)]
    }
    if (!MINIGAME_BY_ROLE[target] || racks[target].status !== 'ok') return
    set((s) => ({
      racks: {
        ...s.racks,
        [target!]: { ...s.racks[target!], status: 'broken', brokenAt: performance.now(), failures: 0 },
      },
    }))
  },

  // Player arrived at the rack → open the overlay for its bound mini-game.
  beginRepair: (role) => {
    const kind = MINIGAME_BY_ROLE[role]
    if (!kind || get().racks[role].status === 'ok') return
    set((s) => ({
      racks: { ...s.racks, [role]: { ...s.racks[role], status: 'repairing' } },
      activeMinigame: { role, kind },
    }))
  },

  failAttempt: (role) =>
    set((s) => ({ racks: { ...s.racks, [role]: { ...s.racks[role], failures: s.racks[role].failures + 1 } } })),

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
      return { activeMinigame: null, racks }
    }),
}))
