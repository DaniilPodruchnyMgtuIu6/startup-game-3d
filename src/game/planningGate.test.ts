import { describe, it, expect, beforeEach } from 'vitest'
import { canPlanProductTasks, clearPlanningWithoutTeam } from './planningGate'
import { useProductStore, reconcilePlanningWithoutTeam } from './productStore'
import { useTeamStore } from './teamStore'
import { useSprintStore } from './sprintStore'
import { INITIAL_SPRINT_STATE } from './sprintRules'
import { initialTaskStates, type ProductTaskState } from './productRules'

// Feature 16 §6: no product planning before both developers are hired — enforced
// in the pure predicate, the store action, and via a corrupted-save migration.

const KIRILL = { employeeId: 'kirill-morozov', hiredAtSprint: 1, hiredAtDay: 1 }
const ALINA = { employeeId: 'alina-belova', hiredAtSprint: 1, hiredAtDay: 1 }

function planned(taskId: string): ProductTaskState {
  return { taskId, status: 'planned', progressDays: 0, plannedSprintNumber: 1, planOrder: 0 }
}

describe('canPlanProductTasks', () => {
  it('is false until BOTH developers are hired', () => {
    expect(canPlanProductTasks([])).toBe(false)
    expect(canPlanProductTasks([KIRILL])).toBe(false)
    expect(canPlanProductTasks([KIRILL, ALINA])).toBe(true)
  })
})

describe('clearPlanningWithoutTeam (corrupted-save repair)', () => {
  it('reverts planned/in-progress tasks to backlog, keeping progress and done, when no team', () => {
    const states: ProductTaskState[] = [
      planned('auth-api'),
      { taskId: 'rooms-api', status: 'in-progress', progressDays: 2, plannedSprintNumber: 1, planOrder: 1 },
      { taskId: 'booking-api', status: 'done', progressDays: 5, completedAt: { sprintNumber: 1, day: 3 } },
      { taskId: 'login-screen', status: 'backlog', progressDays: 0 },
    ]
    const repaired = clearPlanningWithoutTeam(states, [])
    const auth = repaired.find((s) => s.taskId === 'auth-api')!
    expect(auth.status).toBe('backlog')
    expect(auth.plannedSprintNumber).toBeUndefined()
    expect(auth.planOrder).toBeUndefined()
    // progress kept, assignment cleared
    expect(repaired.find((s) => s.taskId === 'rooms-api')).toMatchObject({ status: 'backlog', progressDays: 2 })
    // done + backlog untouched
    expect(repaired.find((s) => s.taskId === 'booking-api')?.status).toBe('done')
    expect(repaired.find((s) => s.taskId === 'login-screen')?.status).toBe('backlog')
  })

  it('is a no-op when the team is present', () => {
    const states = [planned('auth-api')]
    expect(clearPlanningWithoutTeam(states, [KIRILL, ALINA])).toBe(states)
  })
})

describe('addTaskToPlan store guard', () => {
  beforeEach(() => {
    window.localStorage.clear()
    useSprintStore.setState({ ...INITIAL_SPRINT_STATE, phase: 'planning' })
    useProductStore.setState({ taskStates: initialTaskStates() })
    useTeamStore.setState({ hires: [], panelOpen: false })
  })

  it('does NOT add a task while no developers are hired (direct store call is blocked)', () => {
    useProductStore.getState().addTaskToPlan('auth-api')
    expect(useProductStore.getState().taskStates.find((s) => s.taskId === 'auth-api')?.status).toBe('backlog')
  })

  it('adds once both developers are hired', () => {
    useTeamStore.setState({ hires: [KIRILL, ALINA], panelOpen: false })
    useProductStore.getState().addTaskToPlan('auth-api')
    expect(useProductStore.getState().taskStates.find((s) => s.taskId === 'auth-api')?.status).toBe('planned')
  })

  it('reconcilePlanningWithoutTeam drops invalid assignments from a corrupted save', () => {
    useProductStore.setState({ taskStates: [planned('auth-api'), ...initialTaskStates().filter((s) => s.taskId !== 'auth-api')] })
    useTeamStore.setState({ hires: [], panelOpen: false })
    reconcilePlanningWithoutTeam()
    expect(useProductStore.getState().taskStates.find((s) => s.taskId === 'auth-api')?.status).toBe('backlog')
  })
})
