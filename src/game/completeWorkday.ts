import { useSprintStore } from './sprintStore'
import { useEconomyStore } from './economyStore'
import { useTeamStore } from './teamStore'
import { useProductStore } from './productStore'
import { getEmployeeSalaryExpenses, getHiredEmployeeIds } from './teamRules'
import type { WorkdayProgressRecord } from './productRules'

// The single game operation that finalises a working day. It is the ONLY path
// that advances the day, and it always applies development progress and charges
// the day's expenses first. The low-level sprintStore.confirmEndDay stays a
// primitive but must not be called by components directly - doing so would move
// the day without the product and financial calculations. Kept out of React so
// the math is testable in isolation (a button component only calls this).

export interface CompleteWorkdayResult {
  completed: boolean
  reason?: 'invalid-sprint-state'
  economyApplied?: boolean
  chargedAmount?: number
  workday?: WorkdayProgressRecord
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
  const hiredIds = getHiredEmployeeIds(useTeamStore.getState().hires)

  // 1. deterministic development progress for the day (idempotent), THEN
  const productResult = useProductStore.getState().applyWorkday(sprintNumber, day, hiredIds)
  // 2. financial expenses incl. salaries of the current team, THEN
  const salaryItems = getEmployeeSalaryExpenses(hiredIds)
  const economyResult = useEconomyStore.getState().applyDailyOperatingExpense(sprintNumber, day, salaryItems)
  // 3. advance the sprint clock (day -> day+1, or day 10 -> review)
  useSprintStore.getState().confirmEndDay()

  // 4. surface the day's report to the player (does not re-run any calc)
  useProductStore.getState().showReport(productResult.record)

  return {
    completed: true,
    economyApplied: economyResult.applied,
    chargedAmount: economyResult.transaction.amount,
    workday: productResult.record,
    sprintNumber,
    day,
  }
}
