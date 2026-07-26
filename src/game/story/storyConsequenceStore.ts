import { create } from 'zustand'
import { isIntroReset } from '../gameStore'
import {
  LEVEL1_CHECKPOINT_IDS,
  CONSEQUENCE_PRIORITY,
  consequencePriorityRank,
  type CheckpointStatus,
  type Level1CheckpointId,
  type StoryConsequenceId,
} from './level1Checkpoints'

// Persistent Feature 17C state: immutable checkpoint records, the priority
// queue of pending mandatory consequence scenes, effect idempotency keys and
// the two facts checkpoints care about (baseline review completed, a late
// restore drill finished). Own store + localStorage key; a reload rolls a
// running scene back to pending and never re-applies effects (§14).

const STORY_CONSEQUENCE_STORAGE_KEY = 'startup-office-story-consequences'

export interface CheckpointRecord {
  id: Level1CheckpointId
  status: CheckpointStatus
  evaluatedAtWorkdayIndex?: number
}

export interface StoryConsequenceState {
  checkpoints: Record<Level1CheckpointId, CheckpointRecord>
  pendingConsequenceIds: StoryConsequenceId[]
  runningConsequenceId?: StoryConsequenceId
  completedConsequenceIds: StoryConsequenceId[]
  // One entry per applied one-time effect (operation ids) - §14 applied modifiers.
  appliedEffectIds: string[]
  baselineSecurityReviewCompleted: boolean
  lateRestoreDrillCompleted: boolean
  finalWarningShownAtWorkdayIndex?: number
}

type StoryStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>

function safeStorage(): StoryStorage | null {
  try {
    return window.localStorage
  } catch {
    return null
  }
}

function initialCheckpoints(): Record<Level1CheckpointId, CheckpointRecord> {
  const records = {} as Record<Level1CheckpointId, CheckpointRecord>
  for (const id of LEVEL1_CHECKPOINT_IDS) records[id] = { id, status: 'pending' }
  return records
}

export function initialConsequenceState(): StoryConsequenceState {
  return {
    checkpoints: initialCheckpoints(),
    pendingConsequenceIds: [],
    runningConsequenceId: undefined,
    completedConsequenceIds: [],
    appliedEffectIds: [],
    baselineSecurityReviewCompleted: false,
    lateRestoreDrillCompleted: false,
    finalWarningShownAtWorkdayIndex: undefined,
  }
}

const CHECKPOINT_STATUSES: CheckpointStatus[] = ['pending', 'triggered', 'passed', 'skipped-migration']

function isConsequenceId(x: unknown): x is StoryConsequenceId {
  return typeof x === 'string' && (CONSEQUENCE_PRIORITY as readonly string[]).includes(x)
}

// Coerce a loaded/corrupt blob into safe state. A `running` scene interrupted
// by the reload returns to the head of the pending queue; completed scenes are
// never re-queued; unknown ids are dropped.
export function normalizeConsequenceState(raw: unknown): StoryConsequenceState {
  const fresh = initialConsequenceState()
  if (!raw || typeof raw !== 'object') return fresh
  const r = raw as Record<string, unknown>

  const checkpoints = initialCheckpoints()
  if (r.checkpoints && typeof r.checkpoints === 'object') {
    for (const id of LEVEL1_CHECKPOINT_IDS) {
      const entry = (r.checkpoints as Record<string, unknown>)[id]
      if (!entry || typeof entry !== 'object') continue
      const e = entry as Record<string, unknown>
      const status = CHECKPOINT_STATUSES.includes(e.status as CheckpointStatus) ? (e.status as CheckpointStatus) : 'pending'
      const evaluatedAtWorkdayIndex =
        typeof e.evaluatedAtWorkdayIndex === 'number' && Number.isInteger(e.evaluatedAtWorkdayIndex) && e.evaluatedAtWorkdayIndex >= 1
          ? e.evaluatedAtWorkdayIndex
          : undefined
      checkpoints[id] = { id, status, ...(evaluatedAtWorkdayIndex !== undefined ? { evaluatedAtWorkdayIndex } : {}) }
    }
  }

  const completed = Array.isArray(r.completedConsequenceIds) ? r.completedConsequenceIds.filter(isConsequenceId) : []
  const completedSet = new Set(completed)

  let pending = Array.isArray(r.pendingConsequenceIds) ? r.pendingConsequenceIds.filter(isConsequenceId) : []
  const running = isConsequenceId(r.runningConsequenceId) ? r.runningConsequenceId : undefined
  if (running && !completedSet.has(running)) pending = [running, ...pending]
  pending = [...new Set(pending)].filter((id) => !completedSet.has(id))
  pending.sort((a, b) => consequencePriorityRank(a) - consequencePriorityRank(b))

  return {
    checkpoints,
    pendingConsequenceIds: pending,
    runningConsequenceId: undefined,
    completedConsequenceIds: [...completedSet],
    appliedEffectIds: Array.isArray(r.appliedEffectIds) ? [...new Set(r.appliedEffectIds.filter((x): x is string => typeof x === 'string'))] : [],
    baselineSecurityReviewCompleted: r.baselineSecurityReviewCompleted === true,
    lateRestoreDrillCompleted: r.lateRestoreDrillCompleted === true,
    finalWarningShownAtWorkdayIndex:
      typeof r.finalWarningShownAtWorkdayIndex === 'number' && Number.isInteger(r.finalWarningShownAtWorkdayIndex)
        ? r.finalWarningShownAtWorkdayIndex
        : undefined,
  }
}

export function loadConsequences(storage: StoryStorage | null, search: string): StoryConsequenceState {
  if (isIntroReset(search)) {
    storage?.removeItem(STORY_CONSEQUENCE_STORAGE_KEY)
    return initialConsequenceState()
  }
  if (!storage) return initialConsequenceState()
  const raw = storage.getItem(STORY_CONSEQUENCE_STORAGE_KEY)
  if (!raw) return initialConsequenceState()
  try {
    return normalizeConsequenceState(JSON.parse(raw))
  } catch {
    return initialConsequenceState()
  }
}

interface StoryConsequenceStore extends StoryConsequenceState {
  // Records the checkpoint outcome exactly once (immutable afterwards).
  markCheckpoint: (id: Level1CheckpointId, status: Exclude<CheckpointStatus, 'pending'>, workdayIndex: number) => boolean
  // Adds a mandatory scene to the queue once (never after completion).
  queueConsequenceOnce: (id: StoryConsequenceId) => boolean
  startConsequence: (id: StoryConsequenceId) => void
  completeConsequence: (id: StoryConsequenceId) => void
  markConsequenceInterrupted: (id: StoryConsequenceId) => void
  // One-time effect guard (§14 applied modifier ids). True the first time only.
  markEffectAppliedOnce: (effectId: string) => boolean
  setBaselineReviewCompleted: () => void
  setLateRestoreDrillCompleted: () => void
  setFinalWarningShown: (workdayIndex: number) => void
  resetConsequences: () => void
}

const initial = loadConsequences(safeStorage(), typeof window === 'undefined' ? '' : window.location.search)

export const useStoryConsequenceStore = create<StoryConsequenceStore>()((set, get) => {
  const persist = () => {
    try {
      const s = get()
      safeStorage()?.setItem(
        STORY_CONSEQUENCE_STORAGE_KEY,
        JSON.stringify({
          checkpoints: s.checkpoints,
          pendingConsequenceIds: s.pendingConsequenceIds,
          runningConsequenceId: s.runningConsequenceId,
          completedConsequenceIds: s.completedConsequenceIds,
          appliedEffectIds: s.appliedEffectIds,
          baselineSecurityReviewCompleted: s.baselineSecurityReviewCompleted,
          lateRestoreDrillCompleted: s.lateRestoreDrillCompleted,
          finalWarningShownAtWorkdayIndex: s.finalWarningShownAtWorkdayIndex,
        }),
      )
    } catch {
      // private mode
    }
  }

  return {
    ...initial,

    markCheckpoint: (id, status, workdayIndex) => {
      const record = get().checkpoints[id]
      if (record.status !== 'pending') return false
      set({ checkpoints: { ...get().checkpoints, [id]: { id, status, evaluatedAtWorkdayIndex: workdayIndex } } })
      persist()
      return true
    },

    queueConsequenceOnce: (id) => {
      const s = get()
      if (s.completedConsequenceIds.includes(id) || s.pendingConsequenceIds.includes(id) || s.runningConsequenceId === id) return false
      const pending = [...s.pendingConsequenceIds, id].sort((a, b) => consequencePriorityRank(a) - consequencePriorityRank(b))
      set({ pendingConsequenceIds: pending })
      persist()
      return true
    },

    startConsequence: (id) => {
      const s = get()
      if (s.runningConsequenceId || !s.pendingConsequenceIds.includes(id)) return
      set({ runningConsequenceId: id, pendingConsequenceIds: s.pendingConsequenceIds.filter((x) => x !== id) })
      persist()
    },

    completeConsequence: (id) => {
      const s = get()
      if (s.runningConsequenceId !== id && !s.pendingConsequenceIds.includes(id)) {
        if (s.completedConsequenceIds.includes(id)) return
      }
      set({
        runningConsequenceId: s.runningConsequenceId === id ? undefined : s.runningConsequenceId,
        pendingConsequenceIds: s.pendingConsequenceIds.filter((x) => x !== id),
        completedConsequenceIds: s.completedConsequenceIds.includes(id) ? s.completedConsequenceIds : [...s.completedConsequenceIds, id],
      })
      persist()
    },

    markConsequenceInterrupted: (id) => {
      const s = get()
      if (s.runningConsequenceId !== id) return
      const pending = [id, ...s.pendingConsequenceIds].sort((a, b) => consequencePriorityRank(a) - consequencePriorityRank(b))
      set({ runningConsequenceId: undefined, pendingConsequenceIds: pending })
      persist()
    },

    markEffectAppliedOnce: (effectId) => {
      if (get().appliedEffectIds.includes(effectId)) return false
      set({ appliedEffectIds: [...get().appliedEffectIds, effectId] })
      persist()
      return true
    },

    setBaselineReviewCompleted: () => {
      if (get().baselineSecurityReviewCompleted) return
      set({ baselineSecurityReviewCompleted: true })
      persist()
    },

    setLateRestoreDrillCompleted: () => {
      if (get().lateRestoreDrillCompleted) return
      set({ lateRestoreDrillCompleted: true })
      persist()
    },

    setFinalWarningShown: (workdayIndex) => {
      if (get().finalWarningShownAtWorkdayIndex !== undefined) return
      set({ finalWarningShownAtWorkdayIndex: workdayIndex })
      persist()
    },

    resetConsequences: () => {
      set(initialConsequenceState())
      persist()
    },
  }
})
