import { useSprintStore } from './sprintStore'
import { useEconomyStore } from './economyStore'
import { useTeamStore } from './teamStore'
import { useProductStore } from './productStore'
import { useSecurityStoryStore } from './securityStoryStore'
import { useSecurityAuditStore, isFollowUpAuditBlocking, type ApplySecurityWorkdayResult, type ScheduleAuditResult } from './securityAuditStore'
import { useAccessControlStore, syncAccessLogsTask, type ApplyAccessControlWorkdayResult } from './accessControlStore'
import { getEmployeeSalaryExpenses, getHiredEmployeeIds, getHiredDeveloperIds, hasSecuritySpecialist } from './teamRules'
import { isPostAuditConversationRequired } from './securityStoryRules'
import { isOfficeIntrusionBlocking, canUnlockAccessControlProposal } from './accessControlRules'
import { useRiskStore } from './riskStore'
import { getActualRiskLevel, getDetectedRiskLevel } from './riskRules'
import { toWorkdayIndex } from './workdayIndex'
import type { WorkdayProgressRecord } from './productRules'

// The single game operation that finalises a working day. It is the ONLY path
// that advances the day. Order (Features 08-10): access-control work, then
// security corrective work (so we know who is diverted), then product progress
// (excluding diverted developers), then expenses, then a possible pending audit,
// then advance the clock, detect risk signals, unlock the СКУД proposal and
// reconcile the intrusion threat, then surface the report. Kept out of React.

export interface CompleteWorkdayResult {
  completed: boolean
  reason?: 'invalid-sprint-state' | 'required-story-conversation' | 'required-follow-up-audit' | 'required-office-intrusion'
  economyApplied?: boolean
  chargedAmount?: number
  workday?: WorkdayProgressRecord
  securityResult?: ApplySecurityWorkdayResult
  accessControlResult?: ApplyAccessControlWorkdayResult
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
  // A pending/running follow-up audit must be resolved before the next day.
  if (isFollowUpAuditBlocking(useSecurityAuditStore.getState().followUpAudit)) {
    return { completed: false, reason: 'required-follow-up-audit' }
  }
  // A pending/running office intrusion must be resolved before the next day.
  if (isOfficeIntrusionBlocking(useAccessControlStore.getState().intrusion)) {
    return { completed: false, reason: 'required-office-intrusion' }
  }

  const { sprintNumber, day } = sprint
  const hiredIds = getHiredEmployeeIds(useTeamStore.getState().hires)

  // 1. access-control implementation progress for the day (idempotent)
  const accessControlResult = useAccessControlStore.getState().applyAccessControlWorkday(sprintNumber, day)
  // 2. security corrective work for the day (idempotent) - who was diverted?
  const securityResult = useSecurityAuditStore.getState().applySecurityWorkday(sprintNumber, day)
  const developerIds = getHiredDeveloperIds(useTeamStore.getState().hires)
  const excludedDeveloperIds = developerIds.filter((id) => securityResult.divertedEmployeeIds.includes(id))

  // 3. deterministic development progress (diverted developers make none), THEN
  const productResult = useProductStore.getState().applyWorkday(sprintNumber, day, developerIds, excludedDeveloperIds)
  // 4. financial expenses incl. salaries of the whole team, THEN
  const salaryItems = getEmployeeSalaryExpenses(hiredIds)
  const economyResult = useEconomyStore.getState().applyDailyOperatingExpense(sprintNumber, day, salaryItems)
  // 5. create a pending follow-up audit if this completed day hit the deadline
  const auditScheduleResult = useSecurityAuditStore.getState().schedulePendingAuditIfDue(sprintNumber, day)
  // 6. advance the sprint clock (day -> day+1, or day 10 -> review)
  useSprintStore.getState().confirmEndDay()

  // 7. detect risk signals whose delay elapsed by the completed day
  const completedWorkdayIndex = toWorkdayIndex(sprintNumber, day)
  const hasSpecialist = hasSecuritySpecialist(useTeamStore.getState().hires)
  useRiskStore.getState().detectDueSignals(completedWorkdayIndex, hasSpecialist)

  // 8. the incident's access-log task closes once both findings are closed
  syncAccessLogsTask()

  // 9. unlock the СКУД proposal once office-access risk is observably elevated
  const signals = useRiskStore.getState().signals
  if (canUnlockAccessControlProposal(getDetectedRiskLevel(signals, 'office-access'))) {
    useAccessControlStore.getState().unlockProposal()
  }

  // 10. reconcile the office-intrusion threat against ACTUAL office-access risk
  const ac = useAccessControlStore.getState()
  ac.reconcileIntrusionThreat({
    currentWorkdayIndex: completedWorkdayIndex,
    actualOfficeAccessLevel: getActualRiskLevel(signals, 'office-access'),
    accessControlActive: ac.accessControl.proposalStatus === 'active',
    intrusionStatus: ac.intrusion.status,
    armedAtWorkdayIndex: ac.intrusion.armedAtWorkdayIndex,
    dueWorkdayIndex: ac.intrusion.dueWorkdayIndex,
  })

  // 11. surface the day's report to the player (does not re-run any calc)
  useProductStore.getState().showReport(productResult.record)

  return {
    completed: true,
    economyApplied: economyResult.applied,
    chargedAmount: economyResult.transaction.amount,
    workday: productResult.record,
    securityResult,
    accessControlResult,
    auditScheduleResult,
    sprintNumber,
    day,
  }
}
