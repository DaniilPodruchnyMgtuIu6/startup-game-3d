import { planNextActivity, WORK_BIASED_WEIGHTS, type ActivityPlanner } from '../character/npcBehavior'
import { useSprintStore } from './sprintStore'
import { useProductStore } from './productStore'
import { getProductTask } from './productTaskCatalog'

// A developer with an unfinished planned task in the current active sprint
// should be seen working more. This wraps the existing office planner and only
// boosts the `work` weight - no parallel scheduler, no teleporting, progress is
// never tied to how long the walk/typing animation runs.
function hasActiveTask(employeeId: string): boolean {
  const sprint = useSprintStore.getState()
  if (sprint.phase !== 'active') return false
  return useProductStore.getState().taskStates.some((s) => {
    const def = getProductTask(s.taskId)
    return (
      def?.assigneeEmployeeId === employeeId &&
      (s.status === 'planned' || s.status === 'in-progress') &&
      s.plannedSprintNumber === sprint.sprintNumber &&
      s.progressDays < def.effortDays
    )
  })
}

// One stable planner per employee id (referential stability keeps the NPC brain
// effect from re-subscribing every render).
const cache = new Map<string, ActivityPlanner>()

export function developerPlanActivity(employeeId: string): ActivityPlanner {
  let planner = cache.get(employeeId)
  if (!planner) {
    planner = (rng, ctx) => planNextActivity(rng, ctx, hasActiveTask(employeeId) ? WORK_BIASED_WEIGHTS : undefined)
    cache.set(employeeId, planner)
  }
  return planner
}
