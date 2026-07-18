import { useSprintStore } from './sprintStore'
import { useTeamStore } from './teamStore'
import { useProductStore } from './productStore'
import { getHiredEmployeeIds, hasInitialDevelopmentTeam } from './teamRules'
import { hasAnyPlannedIncomplete, isFirstSprintPlanValid, isPlanOverloaded, employeesWithoutPlan } from './productRules'

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
  return { started: true }
}
