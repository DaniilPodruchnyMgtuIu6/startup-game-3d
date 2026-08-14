import { useSprintStore } from '../sprintStore'
import { useTeamStore } from '../teamStore'
import { useProductStore } from '../productStore'
import { useGameOutcomeStore } from '../gameOutcomeStore'
import { isEmployeeHired } from '../teamRules'
import { completedProductTaskCount, hasFirstPrototype } from '../productRules'
import { PRODUCT_TASK_CATALOG } from '../productTaskCatalog'
import { toWorkdayIndex } from '../workdayIndex'
import { useCyberStoryStore } from './cyberStoryStore'
import { useStoryDecisionStore } from './storyDecisionStore'
import {
  canUnlockExecutivePhishing,
  canUnlockExternalAiDataDisclosure,
  canUnlockMfaFatigueAttack,
  canUnlockSecretCommittedToRepository,
  canUnlockShadowItLogUpload,
  canUnlockSupplyChainUpdate,
} from './cyberStoryRules'
import { CYBER_STORY_INCIDENT_PRIORITY, type CyberStoryIncidentId, type CyberStoryRecords } from './cyberStoryTypes'
import type { ProductTaskState } from '../productRules'

// The single deterministic trigger evaluator for Feature 19's three cyber
// incidents - mirrors evaluateStoryUnlocks.ts exactly. Reads live store state,
// asks the pure canUnlock* rules and unlocks every eligible LOCKED incident
// (idempotent - the store ignores unlocks of non-locked records). Called from
// the trigger controller, the startup reconcile and tests.

// §"Event priority": no two major cyber-story scenes unlock or resolve the
// same relative workday. Checked against the OTHER five incidents' own
// availableAt/resolvedAt moment - simple and deterministic, no new state.
function anyOtherIncidentTriggeredToday(incidents: CyberStoryRecords, excludeId: CyberStoryIncidentId, todayIndex: number): boolean {
  return CYBER_STORY_INCIDENT_PRIORITY.some((id) => {
    if (id === excludeId) return false
    const record = incidents[id]
    const availIndex = record.availableAt ? toWorkdayIndex(record.availableAt.sprintNumber, record.availableAt.day) : undefined
    const resolvedIndex = record.resolvedAt ? toWorkdayIndex(record.resolvedAt.sprintNumber, record.resolvedAt.day) : undefined
    return availIndex === todayIndex || resolvedIndex === todayIndex
  })
}

function hasBackendProgress(taskStates: ProductTaskState[]): boolean {
  const backendTaskIds = new Set(PRODUCT_TASK_CATALOG.filter((t) => t.role === 'backend-developer').map((t) => t.id))
  return taskStates.some((s) => backendTaskIds.has(s.taskId) && s.status === 'done')
}

function hasFrontendProgress(taskStates: ProductTaskState[]): boolean {
  const frontendTaskIds = new Set(PRODUCT_TASK_CATALOG.filter((t) => t.role === 'frontend-developer').map((t) => t.id))
  return taskStates.some((s) => frontendTaskIds.has(s.taskId) && s.status === 'done')
}

export function evaluateCyberStoryUnlocks(): CyberStoryIncidentId[] {
  if (useGameOutcomeStore.getState().status !== 'playing') return []

  const sprint = useSprintStore.getState()
  const moment = { sprintNumber: sprint.sprintNumber, day: sprint.day }
  const hires = useTeamStore.getState().hires
  const taskStates = useProductStore.getState().taskStates
  const unlocked: CyberStoryIncidentId[] = []

  // Reads useCyberStoryStore fresh on every call (not a snapshot captured
  // once at the top) - an unlockIncident() a few lines above in THIS SAME
  // pass must be visible to the day-spacing check a few lines below, or two
  // eligible scenes could both unlock in one call/day (§"Event priority").
  const tryUnlock = (id: CyberStoryIncidentId, eligible: boolean) => {
    const cyber = useCyberStoryStore.getState()
    if (!eligible || cyber.incidents[id].status !== 'locked') return
    cyber.unlockIncident(id, moment)
    unlocked.push(id)
  }

  const kirillHired = isEmployeeHired(hires, 'kirill-morozov')
  const alinaHired = isEmployeeHired(hires, 'alina-belova')

  tryUnlock(
    'executive-phishing-request',
    canUnlockExecutivePhishing({
      kirillHired,
      alinaHired,
      sprintPhase: sprint.phase,
      day: sprint.day,
    }),
  )

  tryUnlock(
    'supply-chain-update',
    canUnlockSupplyChainUpdate({
      kirillHired,
      completedProductTasks: completedProductTaskCount(taskStates),
      sprintPhase: sprint.phase,
      day: sprint.day,
      authTaskActiveOrDone: taskStates.some((s) => s.taskId === 'auth-api' && (s.status === 'in-progress' || s.status === 'done')),
    }),
  )

  tryUnlock(
    'shadow-it-log-upload',
    canUnlockShadowItLogUpload({
      kirillHired,
      alinaHired,
      frontendTestDataResolved: useStoryDecisionStore.getState().decisions['frontend-test-data'].status === 'resolved',
      firstPrototypeReady: hasFirstPrototype(taskStates),
    }),
  )

  const todayIndex = toWorkdayIndex(moment.sprintNumber, moment.day)

  tryUnlock(
    'secret-committed-to-repository',
    canUnlockSecretCommittedToRepository({
      kirillHired,
      hasBackendProgress: hasBackendProgress(taskStates),
      otherIncidentAvailableOrResolvedToday: anyOtherIncidentTriggeredToday(useCyberStoryStore.getState().incidents, 'secret-committed-to-repository', todayIndex),
    }),
  )

  tryUnlock(
    'mfa-fatigue-attack',
    canUnlockMfaFatigueAttack({
      kirillHired,
      hasFirstPrototype: hasFirstPrototype(taskStates),
      phishingResolved: useCyberStoryStore.getState().incidents['executive-phishing-request'].status === 'resolved',
      sprintNumber: sprint.sprintNumber,
      day: sprint.day,
      otherIncidentAvailableOrResolvedToday: anyOtherIncidentTriggeredToday(useCyberStoryStore.getState().incidents, 'mfa-fatigue-attack', todayIndex),
    }),
  )

  tryUnlock(
    'external-ai-data-disclosure',
    canUnlockExternalAiDataDisclosure({
      alinaHired,
      hasFrontendProgress: hasFrontendProgress(taskStates),
      sprintNumber: sprint.sprintNumber,
      otherIncidentAvailableOrResolvedToday: anyOtherIncidentTriggeredToday(useCyberStoryStore.getState().incidents, 'external-ai-data-disclosure', todayIndex),
    }),
  )

  return unlocked
}
