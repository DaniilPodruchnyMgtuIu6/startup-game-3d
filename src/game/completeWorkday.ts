import { useSprintStore } from './sprintStore'
import { useEconomyStore } from './economyStore'
import { useTeamStore } from './teamStore'
import { useProductStore } from './productStore'
import { useSecurityStoryStore } from './securityStoryStore'
import { useSecurityAuditStore, isFollowUpAuditBlocking, type ApplySecurityWorkdayResult, type ScheduleAuditResult } from './securityAuditStore'
import { useAccessControlStore, syncAccessLogsTask, type ApplyAccessControlWorkdayResult } from './accessControlStore'
import { useServerIncidentStore, type ApplyServerRecoveryWorkdayResult } from './serverIncidentStore'
import { useServerIncidentsStore } from './serverIncidentsStore'
import { getEmployeeSalaryExpenses, getHiredEmployeeIds, getHiredDeveloperIds, hasSecuritySpecialist } from './teamRules'
import { isPostAuditConversationRequired } from './securityStoryRules'
import { isOfficeIntrusionBlocking, canUnlockAccessControlProposal } from './accessControlRules'
import { anyServerIncidentBlocking } from './serverIncidentRules'
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
  reason?: 'invalid-sprint-state' | 'required-story-conversation' | 'required-follow-up-audit' | 'required-office-intrusion' | 'required-server-incident'
  economyApplied?: boolean
  chargedAmount?: number
  workday?: WorkdayProgressRecord
  securityResult?: ApplySecurityWorkdayResult
  accessControlResult?: ApplyAccessControlWorkdayResult
  serverRecoveryResult?: ApplyServerRecoveryWorkdayResult
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
  // A pending/running server incident scene must be resolved before the next day.
  if (anyServerIncidentBlocking(Object.values(useServerIncidentStore.getState().incidents))) {
    return { completed: false, reason: 'required-server-incident' }
  }

  const { sprintNumber, day } = sprint
  const hiredIds = getHiredEmployeeIds(useTeamStore.getState().hires)

  // 1. server incident recovery + downtime (unresolved-at-start of the day)
  const serverRecoveryResult = useServerIncidentStore.getState().applyServerRecoveryWorkday(sprintNumber, day)
  // 2. access-control implementation progress for the day (idempotent)
  const accessControlResult = useAccessControlStore.getState().applyAccessControlWorkday(sprintNumber, day)
  // 3. security corrective work for the day (idempotent) - who was diverted?
  const securityResult = useSecurityAuditStore.getState().applySecurityWorkday(sprintNumber, day)
  const developerIds = getHiredDeveloperIds(useTeamStore.getState().hires)
  // developers diverted to a corrective finding OR a server recovery make no product
  const divertedToSecurity = new Set([...securityResult.divertedEmployeeIds, ...serverRecoveryResult.divertedEmployeeIds])
  const excludedDeveloperIds = developerIds.filter((id) => divertedToSecurity.has(id))

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

  // 11. reconcile server incident threats against ACTUAL domain risk + rack instability
  useServerIncidentStore.getState().reconcileServerIncidentThreats(completedWorkdayIndex)

  // 12. surface the day's report to the player (does not re-run any calc)
  useProductStore.getState().showReport(productResult.record)

  // 13. a server may break on schedule for the player to fix via a mini-game
  // (deterministic; only while the sprint stays active, never during a review)
  if (useSprintStore.getState().phase === 'active') {
    useServerIncidentsStore.getState().autoBreakForWorkday(completedWorkdayIndex, sprintNumber)
  }

  return {
    completed: true,
    economyApplied: economyResult.applied,
    chargedAmount: economyResult.transaction.amount,
    workday: productResult.record,
    securityResult,
    accessControlResult,
    serverRecoveryResult,
    auditScheduleResult,
    sprintNumber,
    day,
  }
}
