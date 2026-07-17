import { useSprintStore } from './sprintStore'
import { useEconomyStore } from './economyStore'
import { useTeamStore } from './teamStore'
import { getEmployeeSalaryExpenses, getHiredEmployeeIds } from './teamRules'

// The single game operation that finalises a working day. It is the ONLY path
// that advances the day, and it always charges the day's expenses first. The
// low-level sprintStore.confirmEndDay stays available as a primitive but must
// not be called by components directly - doing so would move the day without
// the financial calculation. Kept out of React so the money math is testable in
// isolation (a button component only calls this and shows the result).

export interface CompleteWorkdayResult {
  completed: boolean
  reason?: 'invalid-sprint-state'
  economyApplied?: boolean
  chargedAmount?: number
  sprintNumber?: number
  day?: number
}

// Only an active sprint with an open end-of-day confirmation may complete the
// day - the same guard Feature 01 used to prevent double-advancing.
export function canCompleteCurrentWorkday(): boolean {
  const s = useSprintStore.getState()
  return s.phase === 'active' && s.confirmingEndDay
}

export function completeWorkday(): CompleteWorkdayResult {
  const sprint = useSprintStore.getState()
  if (!canCompleteCurrentWorkday()) {
    return { completed: false, reason: 'invalid-sprint-state' }
  }

  const { sprintNumber, day } = sprint

  // Salaries are computed from the team composition at the moment this day is
  // confirmed, so a developer hired earlier today is charged and one hired
  // after this stays off today's transaction.
  const salaryItems = getEmployeeSalaryExpenses(getHiredEmployeeIds(useTeamStore.getState().hires))

  // 1. charge the day being completed (idempotent), THEN
  const economyResult = useEconomyStore.getState().applyDailyOperatingExpense(sprintNumber, day, salaryItems)
  // 2. advance the sprint clock (day -> day+1, or day 10 -> review)
  useSprintStore.getState().confirmEndDay()

  return {
    completed: true,
    economyApplied: economyResult.applied,
    chargedAmount: economyResult.transaction.amount,
    sprintNumber,
    day,
  }
}
