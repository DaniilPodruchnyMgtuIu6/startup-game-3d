import { STORY_BALANCE } from '../balance/storyBalance'
import { toWorkdayIndex } from '../workdayIndex'
import { useStoryDecisionStore } from './storyDecisionStore'
import { useStoryWorkStore } from './storyWorkStore'
import { useStoryConsequenceStore } from './storyConsequenceStore'
import type { Level1StoryDecisionId } from './level1Timeline'

// Derived, read-only consequences of RESOLVED story choices (Feature 17B).
// Other systems (server incidents, risk detection, MVP score) read these
// instead of the story store directly, so every delayed consequence has one
// obvious source. Pure reads - nothing here mutates state.

function resolvedChoice(id: Level1StoryDecisionId): string | undefined {
  const record = useStoryDecisionStore.getState().decisions[id]
  return record.status === 'resolved' ? record.selectedChoiceId : undefined
}

// --- Baseline path -----------------------------------------------------------

export type BaselinePath = 'external-audit' | 'internal-review' | 'undecided'

export function getBaselinePath(): BaselinePath {
  const choice = resolvedChoice('security-baseline-path')
  if (choice === 'commission-security-audit' || choice === 'order-external-audit') return 'external-audit'
  if (choice === 'hire-security-specialist-first') return 'internal-review'
  return 'undecided'
}

// --- Server incident cost modifiers ------------------------------------------

// Permanent admin access widens the blast radius of the AUTH incident;
// separated boundaries localize AUTH/DATABASE damage; an honest report makes
// any later incident response cheaper. Total is clamped by the caller so the
// final cost never drops below zero.
export function getStoryIncidentCostModifierRub(incidentId: string): number {
  let modifier = 0
  const isAuthOrDb = incidentId === 'auth-account-incident' || incidentId === 'database-exposure-review'
  if (incidentId === 'auth-account-incident' && resolvedChoice('developer-admin-access') === 'grant-permanent-admin') {
    modifier += STORY_BALANCE.adminAccess.permanentAuthIncidentCostIncreaseRub
  }
  if (isAuthOrDb && resolvedChoice('architecture-boundary') === 'separate-security-boundaries') {
    modifier -= STORY_BALANCE.architecture.separateIncidentCostReductionRub
  }
  // 17C §10: the shared technical access widens the blast radius - the
  // emergency response of an AUTH/DATABASE incident becomes more expensive.
  if (isAuthOrDb && resolvedChoice('architecture-boundary') === 'keep-shared-architecture') {
    modifier += STORY_BALANCE.consequences.architectureIncidentCostIncreaseRub
  }
  if (resolvedChoice('suspicious-activity-disclosure') === 'report-activity-immediately') {
    modifier -= STORY_BALANCE.disclosure.reportIncidentCostReductionRub
  }
  return modifier
}

// 17C §10: shared architecture also makes the recovery of an AUTH/DATABASE
// incident one day longer (applied per incident naturally - the effort is read
// once per incident lifecycle).
export function getStoryRecoveryEffortExtraDays(incidentId: string): number {
  const isAuthOrDb = incidentId === 'auth-account-incident' || incidentId === 'database-exposure-review'
  return isAuthOrDb && resolvedChoice('architecture-boundary') === 'keep-shared-architecture'
    ? STORY_BALANCE.consequences.architectureRecoveryEffortIncreaseDays
    : 0
}

// --- Risk detection ----------------------------------------------------------

// Central logging shortens every future signal's detection delay.
export function getStoryDetectionDelayReductionDays(): number {
  return resolvedChoice('security-first-priority') === 'prioritize-central-logging'
    ? STORY_BALANCE.firstPriority.loggingDetectionDelayReductionWorkdays
    : 0
}

// --- Backup / restore readiness ----------------------------------------------

export type RestoreReadiness = 'verified' | 'configured' | 'absent' | 'unknown'

export function getRestoreReadiness(): RestoreReadiness {
  // A finished late restore drill (17C) verifies recovery regardless of the
  // original choice. Lazy import-free read via the consequence store.
  if (useStoryConsequenceStore.getState().lateRestoreDrillCompleted) return 'verified'
  const choice = resolvedChoice('backup-and-restore-strategy')
  if (choice === 'run-full-restore-drill') return 'verified'
  if (choice === 'configure-backups-only') return 'configured'
  if (choice === 'postpone-backup-work') return 'absent'
  return 'unknown'
}

// --- Quiet investigation window ----------------------------------------------

export const QUIET_INVESTIGATION_ASSIGNMENT_PREFIX = 'story-decision:suspicious-activity-disclosure:investigate-quietly'

// While the quiet-investigation work is still running, a landing incident
// raises the leadership complaint (the delay becomes known).
export function isQuietInvestigationOpen(): boolean {
  return useStoryWorkStore
    .getState()
    .assignments.some((a) => a.id.startsWith(QUIET_INVESTIGATION_ASSIGNMENT_PREFIX) && a.remainingDays > 0)
}

// --- Release gating ----------------------------------------------------------

// The pre-release decision must be resolved before the report goes out while
// its scene is on the table.
export function isReleaseRiskDecisionPending(): boolean {
  const status = useStoryDecisionStore.getState().decisions['release-risk-decision'].status
  return status === 'available' || status === 'running'
}

// Hardening delays the release by a fixed number of completed workdays after
// the choice; normal daily costs keep running during them.
export function getHardeningDaysLeft(currentWorkdayIndex: number): number {
  const record = useStoryDecisionStore.getState().decisions['release-risk-decision']
  if (record.status !== 'resolved' || record.selectedChoiceId !== 'delay-for-hardening' || !record.resolvedAt) return 0
  const resolvedIndex = toWorkdayIndex(record.resolvedAt.sprintNumber, record.resolvedAt.day)
  return Math.max(0, resolvedIndex + STORY_BALANCE.release.hardeningDelayWorkdays - currentWorkdayIndex)
}

export function isHiddenRiskChoice(): boolean {
  const record = useStoryDecisionStore.getState().decisions['release-risk-decision']
  return record.status === 'resolved' && record.selectedChoiceId === 'hide-open-risk'
}

// --- Release score -----------------------------------------------------------

// Story penalties applied to the campaign success score, all from balance.
export function getStoryReleaseScoreAdjustment(): number {
  let penalty = 0
  if (resolvedChoice('frontend-test-data') === 'copy-production-data') penalty += STORY_BALANCE.testData.productionReleaseScorePenalty
  const release = resolvedChoice('release-risk-decision')
  if (release === 'release-with-known-risk') penalty += STORY_BALANCE.release.knownRiskScorePenalty
  if (release === 'hide-open-risk') penalty += STORY_BALANCE.release.hideRiskScorePenalty
  return penalty
}
