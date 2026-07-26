import { create } from 'zustand'
import { isIntroReset } from '../gameStore'
import type { StoryMoment, SecurityStaffingDecision } from '../securityStoryRules'
import type { Level1StoryDecisionId } from './level1Timeline'
import {
  getActiveBlockingDecisionId,
  initialStoryDecisionRecords,
  isValidChoiceForDecision,
  mapStaffingDecisionToBaselineChoice,
  normalizeStoryDecisionState,
  storyDecisionOperationId,
  type StoryDecisionRecords,
} from './storyDecisionRules'
import { applyStoryDecisionEffects } from './storyDecisionHandlers'

// Mutable state of the eight Level 1 story decisions (Feature 17A §5). Its own
// store and localStorage key so every other save stays untouched. It stores
// statuses, choices and moments ONLY - no money, no risk scores, no product
// progress, no NPC positions, no localized texts.

const STORY_DECISIONS_STORAGE_KEY = 'startup-office-story-decisions'

type StoryStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>

function safeStorage(): StoryStorage | null {
  try {
    return window.localStorage
  } catch {
    return null
  }
}

export interface StoryDecisionState {
  decisions: StoryDecisionRecords
  activeDecisionId?: Level1StoryDecisionId
  completedCheckpointIds: string[]
}

export function loadStoryDecisions(storage: StoryStorage | null, search: string): StoryDecisionState {
  const fresh = (): StoryDecisionState => ({
    decisions: initialStoryDecisionRecords(),
    activeDecisionId: undefined,
    completedCheckpointIds: [],
  })
  if (isIntroReset(search)) {
    storage?.removeItem(STORY_DECISIONS_STORAGE_KEY)
    return fresh()
  }
  if (!storage) return fresh()
  const raw = storage.getItem(STORY_DECISIONS_STORAGE_KEY)
  if (!raw) return fresh()
  try {
    return normalizeStoryDecisionState(JSON.parse(raw))
  } catch {
    return fresh()
  }
}

export function saveStoryDecisions(storage: StoryStorage | null, state: StoryDecisionState): void {
  try {
    storage?.setItem(
      STORY_DECISIONS_STORAGE_KEY,
      JSON.stringify({
        decisions: state.decisions,
        completedCheckpointIds: state.completedCheckpointIds,
      }),
    )
  } catch {
    // private mode - the story simply restarts fresh next time
  }
}

export interface StoryDecisionResolution {
  // Whether THIS call recorded the choice (false = it was already resolved).
  applied: boolean
  decisionId: Level1StoryDecisionId
  choiceId: string
  operationId: string
}

interface StoryDecisionStore extends StoryDecisionState {
  unlockDecision: (id: Level1StoryDecisionId, moment: StoryMoment) => void
  startDecision: (id: Level1StoryDecisionId, moment: StoryMoment) => void
  resolveDecision: (id: Level1StoryDecisionId, choiceId: string, moment: StoryMoment) => StoryDecisionResolution
  // The scene was interrupted (reload/unmount) - roll running back to available.
  markDecisionInterrupted: (id: Level1StoryDecisionId) => void
  // Migration/legacy sync: mark a decision resolved by the pre-17 story without
  // running any 17A+ effects (the legacy path already applied its own).
  recordLegacyBaselineResolution: (decision: SecurityStaffingDecision, moment: StoryMoment) => void
  markCheckpointCompleted: (id: string) => void
  resetLevel1Story: () => void
}

const initial = loadStoryDecisions(safeStorage(), typeof window === 'undefined' ? '' : window.location.search)

export const useStoryDecisionStore = create<StoryDecisionStore>()((set, get) => {
  const persist = () =>
    saveStoryDecisions(safeStorage(), {
      decisions: get().decisions,
      activeDecisionId: get().activeDecisionId,
      completedCheckpointIds: get().completedCheckpointIds,
    })

  const updateRecords = (decisions: StoryDecisionRecords) => {
    set({ decisions, activeDecisionId: getActiveBlockingDecisionId(decisions) })
    persist()
  }

  return {
    ...initial,

    unlockDecision: (id, moment) => {
      const record = get().decisions[id]
      if (record.status !== 'locked') return
      updateRecords({ ...get().decisions, [id]: { ...record, status: 'available', availableAt: record.availableAt ?? moment } })
    },

    startDecision: (id, moment) => {
      const record = get().decisions[id]
      if (record.status !== 'available') return
      updateRecords({ ...get().decisions, [id]: { ...record, status: 'running', startedAt: record.startedAt ?? moment } })
    },

    // Records the choice once and applies effects idempotently (17A §8). A
    // repeated call returns the EXISTING choice without re-applying anything; a
    // partially-applied resolve (choice saved, effects flag still false) safely
    // finishes the effect application on retry.
    resolveDecision: (id, choiceId, moment) => {
      const record = get().decisions[id]
      const finalChoiceId = record.selectedChoiceId ?? choiceId
      const operationId = storyDecisionOperationId(id, finalChoiceId)

      if (record.selectedChoiceId) {
        if (!record.effectsApplied) {
          applyStoryDecisionEffects(record, moment)
          updateRecords({ ...get().decisions, [id]: { ...record, status: 'resolved', effectsApplied: true } })
        }
        return { applied: false, decisionId: id, choiceId: finalChoiceId, operationId }
      }

      if (!isValidChoiceForDecision(id, choiceId)) {
        return { applied: false, decisionId: id, choiceId, operationId }
      }

      // 1. persist the choice first - a crash after this point recovers via the
      //    partial-resolve branch above without asking the player again.
      const chosen = { ...record, status: 'resolved' as const, selectedChoiceId: choiceId, resolvedAt: record.resolvedAt ?? moment }
      updateRecords({ ...get().decisions, [id]: chosen })
      // 2. apply the effects, then mark them applied.
      applyStoryDecisionEffects(chosen, moment)
      updateRecords({ ...get().decisions, [id]: { ...chosen, effectsApplied: true } })
      return { applied: true, decisionId: id, choiceId, operationId }
    },

    markDecisionInterrupted: (id) => {
      const record = get().decisions[id]
      if (record.status !== 'running') return
      updateRecords({ ...get().decisions, [id]: { ...record, status: 'available' } })
    },

    recordLegacyBaselineResolution: (decision, moment) => {
      const record = get().decisions['security-baseline-path']
      if (record.selectedChoiceId) return // already decided (new scene or earlier sync)
      updateRecords({
        ...get().decisions,
        'security-baseline-path': {
          ...record,
          status: 'resolved',
          selectedChoiceId: mapStaffingDecisionToBaselineChoice(decision),
          resolvedAt: record.resolvedAt ?? moment,
          effectsApplied: true,
          migratedFromLegacy: true,
        },
      })
    },

    markCheckpointCompleted: (id) => {
      if (get().completedCheckpointIds.includes(id)) return
      set({ completedCheckpointIds: [...get().completedCheckpointIds, id] })
      persist()
    },

    resetLevel1Story: () => {
      set({ decisions: initialStoryDecisionRecords(), activeDecisionId: undefined, completedCheckpointIds: [] })
      persist()
    },
  }
})
