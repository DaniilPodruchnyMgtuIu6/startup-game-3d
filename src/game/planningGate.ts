import { hasInitialDevelopmentTeam, type HireRecord } from './teamRules'
import type { ProductTaskState } from './productRules'

// Feature 16 §6: OfficeFlow tasks cannot be planned into a sprint until BOTH
// developers (Kirill + Alina) are hired. The rule is enforced in the store
// action, the use-cases and the UI so it can't be bypassed; this module holds
// the single pure predicate + the corrupted-save repair.

export function canPlanProductTasks(hires: HireRecord[]): boolean {
  return hasInitialDevelopmentTeam(hires)
}

// A save that has planned / in-progress product tasks but no development team is
// invalid (nobody could have been assigned that work). Revert ONLY those
// assignments back to the backlog, keeping progressDays and any done tasks. Pure
// and idempotent; a save with the team present is returned unchanged.
export function clearPlanningWithoutTeam(states: ProductTaskState[], hires: HireRecord[]): ProductTaskState[] {
  if (canPlanProductTasks(hires)) return states
  let changed = false
  const next = states.map((s) => {
    if (s.status !== 'planned' && s.status !== 'in-progress') return s
    changed = true
    const { plannedSprintNumber: _p, planOrder: _o, ...rest } = s
    return { ...rest, status: 'backlog' as const }
  })
  return changed ? next : states
}
