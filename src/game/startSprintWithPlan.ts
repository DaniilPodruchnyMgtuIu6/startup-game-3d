import { useSprintStore } from './sprintStore'
import { useTeamStore } from './teamStore'
import { useProductStore } from './productStore'
import { getHiredEmployeeIds, hasInitialDevelopmentTeam } from './teamRules'
import { hasAnyPlannedIncomplete, isFirstSprintPlanValid, isPlanOverloaded, employeesWithoutPlan, plannedLoadForEmployee } from './productRules'
import { useRiskStore } from './riskStore'
import { sprintPlanSignals } from './riskSignals'
import { getActivePositiveRiskSignals } from './riskRules'
import { riskMomentNow } from './riskContext'
import { isGameOutcomeBlocking } from './registerGameFailure'

// The single use-case that starts a sprint from the whiteboard plan. The
// low-level sprintStore.startSprint must not be called by components directly -
// it would bypass the product-plan checks.

export type StartSprintResult =
  | { started: true }
  | {
      started: false
      reason: 'not-planning' | 'team-incomplete' | 'first-sprint-needs-both-roles' | 'no-planned-tasks'
    }

// Soft warnings the UI can surface (and let the player confirm) before starting.
export function getStartSprintWarnings(): { overloaded: boolean; employeesWithoutPlan: string[] } {
  const states = useProductStore.getState().taskStates
  const ids = getHiredEmployeeIds(useTeamStore.getState().hires)
  return { overloaded: isPlanOverloaded(states, ids), employeesWithoutPlan: employeesWithoutPlan(states, ids) }
}

export function canStartSprintWithPlan(): StartSprintResult {
  const sprint = useSprintStore.getState()
  if (sprint.phase !== 'planning') return { started: false, reason: 'not-planning' }
  // A registered defeat (pending or final) freezes every game action.
  if (isGameOutcomeBlocking()) return { started: false, reason: 'not-planning' }

  const hires = useTeamStore.getState().hires
  const states = useProductStore.getState().taskStates

  if (sprint.sprintNumber === 1) {
    if (!hasInitialDevelopmentTeam(hires)) return { started: false, reason: 'team-incomplete' }
    if (!isFirstSprintPlanValid(states)) return { started: false, reason: 'first-sprint-needs-both-roles' }
  } else if (!hasAnyPlannedIncomplete(states)) {
    return { started: false, reason: 'no-planned-tasks' }
  }
  return { started: true }
}

export function startSprintWithPlan(): StartSprintResult {
  const check = canStartSprintWithPlan()
  if (!check.started) return check
  useSprintStore.getState().startSprint()

  // Feature 09: record delivery-pressure risk for the started sprint - one
  // signal per developer over 10-day capacity, or a single mitigation when the
  // plan is balanced after previous overload. Deterministic, from the plan only.
  const states = useProductStore.getState().taskStates
  const loads = ['kirill-morozov', 'alina-belova'].map((employeeId) => ({
    employeeId,
    plannedLoadDays: plannedLoadForEmployee(states, employeeId),
  }))
  const hadOverloadHistory = getActivePositiveRiskSignals(useRiskStore.getState().signals, 'delivery-pressure').length > 0
  const signals = sprintPlanSignals(useSprintStore.getState().sprintNumber, loads, hadOverloadHistory, riskMomentNow())
  if (signals.length > 0) useRiskStore.getState().addSignalsOnce(signals)

  return { started: true }
}
