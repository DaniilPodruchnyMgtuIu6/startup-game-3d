import { create } from 'zustand'
import { isIntroReset } from '../gameStore'
import type { StoryMoment } from '../securityStoryRules'
import { toWorkdayIndex } from '../workdayIndex'
import {
  CYBER_CONSEQUENCES_FOR_INCIDENT,
  CYBER_CONSEQUENCE_PRIORITY,
  CYBER_STORY_INCIDENT_PRIORITY,
  cyberConsequencePriorityRank,
  cyberStoryOperationId,
  initialCyberStoryFlags,
  type CredentialExposureState,
  type CyberConsequenceId,
  type CyberStoryChoiceId,
  type CyberStoryFlags,
  type CyberStoryIncidentId,
  type CyberStoryRecords,
  type ShadowAiPolicy,
  type UnknownSessionState,
} from './cyberStoryTypes'
import {
  getActiveBlockingCyberIncidentId,
  initialCyberStoryRecords,
  isCyberConsequenceId,
  isValidCyberChoice,
  normalizeCyberStoryRecords,
  normalizeScheduledConsequences,
} from './cyberStoryRules'
import { applyCyberStoryChoiceEffects } from './cyberStoryHandlers'

// Feature 19: the single store for all three cyber incidents - their status
// records AND their delayed-consequence schedule/queue/flags. One file, one
// localStorage key, mirroring the combined responsibility storyDecisionStore
// (17A) + storyConsequenceStore (17C) split into two files for historical
// reasons; here a single store is simpler (only 3 incidents, 1 consequence
// each) and still keeps every rule in cyberStoryRules.ts testable in isolation.

const CYBER_STORY_STORAGE_KEY = 'startup-office-cyber-story'

// The 8 plain-boolean flags, kept as their own list (distinct from the 3
// small state-machine flags below) so normalizeCyberStoryState can validate
// each group with its own rule instead of one loop assuming a single shape.
const BOOLEAN_FLAG_KEYS = [
  'phishingInformationExposed',
  'phishingVerifiedAndRejected',
  'phishingEscalatedToSecurity',
  'supplyChainUpdateInstalled',
  'supplyChainReviewedAndPinned',
  'rawLogsExternallyShared',
  'logsManuallySanitized',
  'secureLogSharingConfigured',
] as const satisfies readonly (keyof CyberStoryFlags)[]

const CREDENTIAL_EXPOSURE_STATES: readonly CredentialExposureState[] = ['none', 'history-retained', 'reduced', 'rotated']
const UNKNOWN_SESSION_STATES: readonly UnknownSessionState[] = ['none', 'active', 'revoked']
const SHADOW_AI_POLICIES: readonly ShadowAiPolicy[] = ['unset', 'unrestricted', 'banned', 'controlled-gateway']

type CyberStoryStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>

function safeStorage(): CyberStoryStorage | null {
  try {
    return window.localStorage
  } catch {
    return null
  }
}

interface ScheduledConsequence {
  dueWorkdayIndex: number
}

export interface CyberStoryState {
  incidents: CyberStoryRecords
  activeIncidentId?: CyberStoryIncidentId
  scheduledConsequences: Partial<Record<CyberConsequenceId, ScheduledConsequence>>
  pendingConsequenceIds: CyberConsequenceId[]
  runningConsequenceId?: CyberConsequenceId
  completedConsequenceIds: CyberConsequenceId[]
  appliedEffectIds: string[]
  flags: CyberStoryFlags
}

function freshState(): CyberStoryState {
  return {
    incidents: initialCyberStoryRecords(),
    activeIncidentId: undefined,
    scheduledConsequences: {},
    pendingConsequenceIds: [],
    runningConsequenceId: undefined,
    completedConsequenceIds: [],
    appliedEffectIds: [],
    flags: initialCyberStoryFlags(),
  }
}

export function loadCyberStory(storage: CyberStoryStorage | null, search: string): CyberStoryState {
  if (isIntroReset(search)) {
    storage?.removeItem(CYBER_STORY_STORAGE_KEY)
    return freshState()
  }
  if (!storage) return freshState()
  const raw = storage.getItem(CYBER_STORY_STORAGE_KEY)
  if (!raw) return freshState()
  try {
    return normalizeCyberStoryState(JSON.parse(raw))
  } catch {
    return freshState()
  }
}

// Coerce a loaded/corrupt blob into a complete, consistent state. A `running`
// consequence interrupted by the reload returns to the head of the pending
// queue; completed consequences are never re-queued; unknown ids are dropped;
// flags default to false; a scheduled consequence already completed is dropped.
export function normalizeCyberStoryState(persisted: unknown): CyberStoryState {
  const fresh = freshState()
  if (!persisted || typeof persisted !== 'object') return fresh
  const r = persisted as Record<string, unknown>

  const { incidents } = normalizeCyberStoryRecords(r)

  const completed = Array.isArray(r.completedConsequenceIds) ? r.completedConsequenceIds.filter(isCyberConsequenceId) : []
  const completedSet = new Set(completed)

  let pending = Array.isArray(r.pendingConsequenceIds) ? r.pendingConsequenceIds.filter(isCyberConsequenceId) : []
  const running = isCyberConsequenceId(r.runningConsequenceId) ? r.runningConsequenceId : undefined
  if (running && !completedSet.has(running)) pending = [running, ...pending]
  pending = [...new Set(pending)].filter((id) => !completedSet.has(id))
  pending.sort((a, b) => cyberConsequencePriorityRank(a) - cyberConsequencePriorityRank(b))
  const pendingSet = new Set(pending)

  const scheduledList = normalizeScheduledConsequences(r.scheduledConsequences)
  const scheduledConsequences: Partial<Record<CyberConsequenceId, ScheduledConsequence>> = {}
  for (const s of scheduledList) {
    if (completedSet.has(s.id) || pendingSet.has(s.id)) continue // already handled - never re-schedule
    scheduledConsequences[s.id] = { dueWorkdayIndex: s.dueWorkdayIndex }
  }

  const flagsRaw = r.flags && typeof r.flags === 'object' ? (r.flags as Record<string, unknown>) : {}
  const flags: CyberStoryFlags = initialCyberStoryFlags()
  for (const key of BOOLEAN_FLAG_KEYS) {
    if (flagsRaw[key] === true) flags[key] = true
  }
  if (typeof flagsRaw.credentialExposureState === 'string' && (CREDENTIAL_EXPOSURE_STATES as readonly string[]).includes(flagsRaw.credentialExposureState)) {
    flags.credentialExposureState = flagsRaw.credentialExposureState as CredentialExposureState
  }
  if (typeof flagsRaw.unknownSessionState === 'string' && (UNKNOWN_SESSION_STATES as readonly string[]).includes(flagsRaw.unknownSessionState)) {
    flags.unknownSessionState = flagsRaw.unknownSessionState as UnknownSessionState
  }
  if (typeof flagsRaw.shadowAiPolicy === 'string' && (SHADOW_AI_POLICIES as readonly string[]).includes(flagsRaw.shadowAiPolicy)) {
    flags.shadowAiPolicy = flagsRaw.shadowAiPolicy as ShadowAiPolicy
  }

  return {
    incidents,
    activeIncidentId: getActiveBlockingCyberIncidentId(incidents),
    scheduledConsequences,
    pendingConsequenceIds: pending,
    runningConsequenceId: undefined,
    completedConsequenceIds: [...completedSet],
    appliedEffectIds: Array.isArray(r.appliedEffectIds) ? [...new Set(r.appliedEffectIds.filter((x): x is string => typeof x === 'string'))] : [],
    flags,
  }
}

export function saveCyberStory(storage: CyberStoryStorage | null, state: CyberStoryState): void {
  try {
    storage?.setItem(
      CYBER_STORY_STORAGE_KEY,
      JSON.stringify({
        incidents: state.incidents,
        scheduledConsequences: state.scheduledConsequences,
        pendingConsequenceIds: state.pendingConsequenceIds,
        runningConsequenceId: state.runningConsequenceId,
        completedConsequenceIds: state.completedConsequenceIds,
        appliedEffectIds: state.appliedEffectIds,
        flags: state.flags,
      }),
    )
  } catch {
    // private mode - the cyber-story state simply restarts fresh next time
  }
}

export interface CyberStoryResolution {
  applied: boolean
  incidentId: CyberStoryIncidentId
  choiceId: CyberStoryChoiceId
  operationId: string
}

interface CyberStoryStore extends CyberStoryState {
  unlockIncident: (id: CyberStoryIncidentId, moment: StoryMoment) => void
  startIncident: (id: CyberStoryIncidentId, moment: StoryMoment) => void
  resolveIncident: (id: CyberStoryIncidentId, choiceId: string, moment: StoryMoment) => CyberStoryResolution
  markIncidentInterrupted: (id: CyberStoryIncidentId) => void
  // Due-day scheduling for a risky choice's delayed consequence (idempotent:
  // a consequence is scheduled at most once per campaign).
  scheduleConsequenceOnce: (id: CyberConsequenceId, dueWorkdayIndex: number) => boolean
  // Moves a scheduled consequence into the mandatory play queue once its due
  // day has arrived (idempotent, never after completion).
  queueConsequenceOnce: (id: CyberConsequenceId) => boolean
  startConsequence: (id: CyberConsequenceId) => void
  completeConsequence: (id: CyberConsequenceId) => void
  markConsequenceInterrupted: (id: CyberConsequenceId) => void
  markEffectAppliedOnce: (effectId: string) => boolean
  // Dev-only (see cyberStoryDevLauncher.ts): resets exactly one incident back
  // to locked and clears its own scheduled/pending/completed consequence and
  // narrative flags, without touching the other two incidents.
  resetIncident: (id: CyberStoryIncidentId) => void
  resetCyberStory: () => void
}

const INCIDENT_FLAG_KEYS: Record<CyberStoryIncidentId, (keyof CyberStoryFlags)[]> = {
  'executive-phishing-request': ['phishingInformationExposed', 'phishingVerifiedAndRejected', 'phishingEscalatedToSecurity'],
  'supply-chain-update': ['supplyChainUpdateInstalled', 'supplyChainReviewedAndPinned'],
  'shadow-it-log-upload': ['rawLogsExternallyShared', 'logsManuallySanitized', 'secureLogSharingConfigured'],
  'secret-committed-to-repository': ['credentialExposureState'],
  'mfa-fatigue-attack': ['unknownSessionState'],
  'external-ai-data-disclosure': ['shadowAiPolicy'],
}

// Resets exactly the given flag keys back to their initial value, whatever
// that value's type is (boolean or one of the small state-machine unions) -
// generic over K so `next[key] = fresh[key]` stays type-safe per key.
function resetFlagKeys<K extends keyof CyberStoryFlags>(flags: CyberStoryFlags, keys: readonly K[]): CyberStoryFlags {
  const fresh = initialCyberStoryFlags()
  const next = { ...flags }
  for (const key of keys) next[key] = fresh[key]
  return next
}

const initial = loadCyberStory(safeStorage(), typeof window === 'undefined' ? '' : window.location.search)

export const useCyberStoryStore = create<CyberStoryStore>()((set, get) => {
  const persist = () => saveCyberStory(safeStorage(), get())

  const updateIncidents = (incidents: CyberStoryRecords) => {
    set({ incidents, activeIncidentId: getActiveBlockingCyberIncidentId(incidents) })
    persist()
  }

  return {
    ...initial,

    unlockIncident: (id, moment) => {
      const record = get().incidents[id]
      if (record.status !== 'locked') return
      updateIncidents({ ...get().incidents, [id]: { ...record, status: 'available', availableAt: record.availableAt ?? moment } })
    },

    startIncident: (id, moment) => {
      const record = get().incidents[id]
      if (record.status !== 'available') return
      updateIncidents({ ...get().incidents, [id]: { ...record, status: 'running', startedAt: record.startedAt ?? moment } })
    },

    // Records the choice once and applies effects idempotently (mirrors
    // storyDecisionStore.resolveDecision). A repeated call returns the
    // existing choice without re-applying anything.
    resolveIncident: (id, rawChoiceId, moment) => {
      const record = get().incidents[id]
      const finalChoiceId = (record.selectedChoiceId ?? rawChoiceId) as CyberStoryChoiceId
      const operationId = cyberStoryOperationId(id, finalChoiceId)

      const applyAndSchedule = (rec: typeof record) => {
        const result = applyCyberStoryChoiceEffects(rec, moment, get().flags)
        if (result.flagsToSet) set({ flags: { ...get().flags, ...result.flagsToSet } })
        if (result.scheduleConsequence) {
          const dueWorkdayIndex = toWorkdayIndex(moment.sprintNumber, moment.day) + result.scheduleConsequence.delayWorkdays
          get().scheduleConsequenceOnce(result.scheduleConsequence.id, dueWorkdayIndex)
        }
      }

      if (record.selectedChoiceId) {
        if (!record.effectsApplied) {
          applyAndSchedule(record)
          updateIncidents({ ...get().incidents, [id]: { ...record, status: 'resolved', effectsApplied: true } })
        }
        return { applied: false, incidentId: id, choiceId: finalChoiceId, operationId }
      }

      if (!isValidCyberChoice(id, rawChoiceId)) {
        return { applied: false, incidentId: id, choiceId: rawChoiceId as CyberStoryChoiceId, operationId }
      }

      // 1. persist the choice first - a crash after this point recovers via
      //    the partial-resolve branch above without asking the player again.
      const chosen = { ...record, status: 'resolved' as const, selectedChoiceId: rawChoiceId as CyberStoryChoiceId, resolvedAt: record.resolvedAt ?? moment }
      updateIncidents({ ...get().incidents, [id]: chosen })
      // 2. apply the effects, then mark them applied.
      applyAndSchedule(chosen)
      updateIncidents({ ...get().incidents, [id]: { ...chosen, effectsApplied: true } })
      return { applied: true, incidentId: id, choiceId: rawChoiceId as CyberStoryChoiceId, operationId }
    },

    markIncidentInterrupted: (id) => {
      const record = get().incidents[id]
      if (record.status !== 'running') return
      updateIncidents({ ...get().incidents, [id]: { ...record, status: 'available' } })
    },

    scheduleConsequenceOnce: (id, dueWorkdayIndex) => {
      const s = get()
      if (s.scheduledConsequences[id] || s.pendingConsequenceIds.includes(id) || s.runningConsequenceId === id || s.completedConsequenceIds.includes(id)) {
        return false
      }
      set({ scheduledConsequences: { ...s.scheduledConsequences, [id]: { dueWorkdayIndex } } })
      persist()
      return true
    },

    queueConsequenceOnce: (id) => {
      const s = get()
      if (s.completedConsequenceIds.includes(id) || s.pendingConsequenceIds.includes(id) || s.runningConsequenceId === id) return false
      const { [id]: _removed, ...restScheduled } = s.scheduledConsequences
      const pending = [...s.pendingConsequenceIds, id].sort((a, b) => cyberConsequencePriorityRank(a) - cyberConsequencePriorityRank(b))
      set({ pendingConsequenceIds: pending, scheduledConsequences: restScheduled })
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
      const pending = [id, ...s.pendingConsequenceIds].sort((a, b) => cyberConsequencePriorityRank(a) - cyberConsequencePriorityRank(b))
      set({ runningConsequenceId: undefined, pendingConsequenceIds: pending })
      persist()
    },

    markEffectAppliedOnce: (effectId) => {
      if (get().appliedEffectIds.includes(effectId)) return false
      set({ appliedEffectIds: [...get().appliedEffectIds, effectId] })
      persist()
      return true
    },

    resetIncident: (id) => {
      const s = get()
      const consequenceIds = CYBER_CONSEQUENCES_FOR_INCIDENT[id]
      const restScheduled = { ...s.scheduledConsequences }
      for (const cId of consequenceIds) delete restScheduled[cId]
      const nextFlags = resetFlagKeys(s.flags, INCIDENT_FLAG_KEYS[id])
      const resetRecord = { incidentId: id, status: 'locked' as const, effectsApplied: false }
      const nextIncidents = { ...s.incidents, [id]: resetRecord }
      set({
        incidents: nextIncidents,
        activeIncidentId: getActiveBlockingCyberIncidentId(nextIncidents),
        scheduledConsequences: restScheduled,
        pendingConsequenceIds: s.pendingConsequenceIds.filter((x) => !consequenceIds.includes(x)),
        runningConsequenceId: s.runningConsequenceId && consequenceIds.includes(s.runningConsequenceId) ? undefined : s.runningConsequenceId,
        completedConsequenceIds: s.completedConsequenceIds.filter((x) => !consequenceIds.includes(x)),
        flags: nextFlags,
      })
      persist()
    },

    resetCyberStory: () => {
      set(freshState())
      persist()
    },
  }
})

export { CYBER_STORY_INCIDENT_PRIORITY, CYBER_CONSEQUENCE_PRIORITY }
