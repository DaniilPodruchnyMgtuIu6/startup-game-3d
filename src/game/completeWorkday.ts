import { useSprintStore } from './sprintStore'
import { useEconomyStore } from './economyStore'
import { useTeamStore } from './teamStore'
import { useProductStore } from './productStore'
import { useSecurityStoryStore } from './securityStoryStore'
import { useSecurityAuditStore, isFollowUpAuditBlocking, type ApplySecurityWorkdayResult, type ScheduleAuditResult } from './securityAuditStore'
import { getEmployeeSalaryExpenses, getHiredEmployeeIds, getHiredDeveloperIds, hasSecuritySpecialist } from './teamRules'
import { isPostAuditConversationRequired } from './securityStoryRules'
import { useRiskStore } from './riskStore'
import { toWorkdayIndex } from './workdayIndex'
import type { WorkdayProgressRecord } from './productRules'

// The single game operation that finalises a working day. It is the ONLY path
// that advances the day. Feature 08 order: security corrective work FIRST (so we
// know which developers are diverted), THEN product progress (excluding the
// diverted), THEN the day's expenses, THEN a possible pending follow-up audit,
// THEN advance the clock and surface the report. Kept out of React so the math
// is testable in isolation (a button component only calls this).

export interface CompleteWorkdayResult {
  completed: boolean
  reason?: 'invalid-sprint-state' | 'required-story-conversation' | 'required-follow-up-audit'
  economyApplied?: boolean
  chargedAmount?: number
  workday?: WorkdayProgressRecord
  securityResult?: ApplySecurityWorkdayResult
  auditScheduleResult?: ScheduleAuditResult
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
  // A required post-audit conversation must be held before the day can end.
  if (isPostAuditConversationRequired(useSecurityStoryStore.getState().postAuditConversation)) {
    return { completed: false, reason: 'required-story-conversation' }
  }
  // A pending/running follow-up audit must be resolved before the next day - no
  // money, product or security progress happens while blocked.
  if (isFollowUpAuditBlocking(useSecurityAuditStore.getState().followUpAudit)) {
    return { completed: false, reason: 'required-follow-up-audit' }
  }

  const { sprintNumber, day } = sprint
  const hiredIds = getHiredEmployeeIds(useTeamStore.getState().hires)

  // 1. security corrective work for the day (idempotent) - who was diverted?
  const securityResult = useSecurityAuditStore.getState().applySecurityWorkday(sprintNumber, day)
  const developerIds = getHiredDeveloperIds(useTeamStore.getState().hires)
  const excludedDeveloperIds = developerIds.filter((id) => securityResult.divertedEmployeeIds.includes(id))

  // 2. deterministic development progress (diverted developers make none), THEN
  const productResult = useProductStore.getState().applyWorkday(sprintNumber, day, developerIds, excludedDeveloperIds)
  // 3. financial expenses incl. salaries of the whole team (diversion does not
  //    change salary), THEN
  const salaryItems = getEmployeeSalaryExpenses(hiredIds)
  const economyResult = useEconomyStore.getState().applyDailyOperatingExpense(sprintNumber, day, salaryItems)
  // 4. create a pending follow-up audit if this completed day hit the deadline
  const auditScheduleResult = useSecurityAuditStore.getState().schedulePendingAuditIfDue(sprintNumber, day)
  // 5. advance the sprint clock (day -> day+1, or day 10 -> review)
  useSprintStore.getState().confirmEndDay()

  // 6. detect any risk signals whose delay elapsed by the completed day. Only a
  //    completed working day reveals signals; opening UI never does (Feature 09).
  const completedWorkdayIndex = toWorkdayIndex(sprintNumber, day)
  useRiskStore.getState().detectDueSignals(completedWorkdayIndex, hasSecuritySpecialist(useTeamStore.getState().hires))

  // 7. surface the day's report to the player (does not re-run any calc)
  useProductStore.getState().showReport(productResult.record)

  return {
    completed: true,
    economyApplied: economyResult.applied,
    chargedAmount: economyResult.transaction.amount,
    workday: productResult.record,
    securityResult,
    auditScheduleResult,
    sprintNumber,
    day,
  }
}
