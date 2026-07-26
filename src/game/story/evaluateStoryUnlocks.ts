import { useSprintStore } from '../sprintStore'
import { useTeamStore } from '../teamStore'
import { useProductStore } from '../productStore'
import { useRiskStore } from '../riskStore'
import { useSecurityStoryStore } from '../securityStoryStore'
import { useServerIncidentStore } from '../serverIncidentStore'
import { useGameOutcomeStore } from '../gameOutcomeStore'
import { useGameStore } from '../gameStore'
import { isEmployeeHired, hasInitialDevelopmentTeam, hasSecuritySpecialist } from '../teamRules'
import { hasFirstPrototype, hasCompletedCoreMvp, completedProductTaskCount } from '../productRules'
import { getDetectedRiskLevel } from '../riskRules'
import { RISK_DOMAINS } from '../riskCatalog'
import { getProductTask } from '../productTaskCatalog'
import { useStoryDecisionStore } from './storyDecisionStore'
import {
  canUnlockArchitectureBoundary,
  canUnlockBackupStrategy,
  canUnlockDeveloperAdminAccess,
  canUnlockFrontendTestData,
  canUnlockReleaseRiskDecision,
  canUnlockSecurityBaseline,
  canUnlockSecurityPriority,
  canUnlockSuspiciousActivityDisclosure,
} from './storyDecisionRules'
import { BASELINE_AUDIT_RESULT_TASK, INTERNAL_REVIEW_TASK, MISSED_HIRE_DEADLINE_SIGNAL_ID } from './storyFollowUps'
import { getBaselinePath } from './storyEffectSelectors'
import type { Level1StoryDecisionId } from './level1Timeline'

// The single deterministic trigger evaluator (Feature 17B). Reads live store
// state, asks the pure canUnlock* rules and unlocks every eligible LOCKED
// decision (idempotent - the store ignores unlocks of non-locked records).
// One blocking scene at a time is still guaranteed by the priority selector.
// Called from the trigger controller, the startup reconcile and tests.

const RISKY_CHOICES = new Set([
  'grant-permanent-admin',
  'copy-production-data',
  'postpone-backup-work',
  'keep-shared-architecture',
  'dismiss-as-false-positive',
  'investigate-quietly',
])

function baselineFollowUpSettled(): boolean {
  const record = useStoryDecisionStore.getState().decisions['security-baseline-path']
  if (record.migratedFromLegacy) return true // the pre-17 campaign is past this point
  const path = getBaselinePath()
  const tasks = useGameStore.getState().tasks
  if (path === 'external-audit') return tasks.some((t) => t.id === BASELINE_AUDIT_RESULT_TASK.id && t.done)
  if (path === 'internal-review') {
    const reviewDone = tasks.some((t) => t.id === INTERNAL_REVIEW_TASK.id && t.done)
    const deadlineMissed = useRiskStore.getState().signals.some((s) => s.id === MISSED_HIRE_DEADLINE_SIGNAL_ID)
    return reviewDone || deadlineMissed
  }
  return false
}

export function evaluateStoryUnlocks(): Level1StoryDecisionId[] {
  const story = useStoryDecisionStore.getState()
  if (useGameOutcomeStore.getState().status !== 'playing') return []

  const sprint = useSprintStore.getState()
  const moment = { sprintNumber: sprint.sprintNumber, day: sprint.day }
  const hires = useTeamStore.getState().hires
  const taskStates = useProductStore.getState().taskStates
  const signals = useRiskStore.getState().signals
  const incidents = useServerIncidentStore.getState().incidents
  const decisions = story.decisions
  const baselineResolved = decisions['security-baseline-path'].status === 'resolved'
  const unlocked: Level1StoryDecisionId[] = []

  const tryUnlock = (id: Level1StoryDecisionId, eligible: boolean) => {
    if (!eligible || decisions[id].status !== 'locked') return
    story.unlockDecision(id, moment)
    unlocked.push(id)
  }

  tryUnlock(
    'security-baseline-path',
    canUnlockSecurityBaseline({
      bothDevelopersHired: hasInitialDevelopmentTeam(hires),
      sprintNumber: sprint.sprintNumber,
      sprintPhase: sprint.phase,
      legacyStaffingDecided: useSecurityStoryStore.getState().postAuditConversation.staffingDecision !== undefined,
    }),
  )

  tryUnlock(
    'developer-admin-access',
    canUnlockDeveloperAdminAccess({
      kirillHired: isEmployeeHired(hires, 'kirill-morozov'),
      baselineResolved,
      sprintNumber: sprint.sprintNumber,
      sprintPhase: sprint.phase,
      hasBackendProgress: taskStates.some(
        (s) => getProductTask(s.taskId)?.assigneeEmployeeId === 'kirill-morozov' && (s.progressDays > 0 || s.status === 'done'),
      ),
    }),
  )

  tryUnlock(
    'frontend-test-data',
    canUnlockFrontendTestData({
      alinaHired: isEmployeeHired(hires, 'alina-belova'),
      baselineResolved,
      frontendTaskStarted: taskStates.some(
        (s) => getProductTask(s.taskId)?.assigneeEmployeeId === 'alina-belova' && (s.progressDays > 0 || s.status === 'done'),
      ),
    }),
  )

  tryUnlock(
    'security-first-priority',
    canUnlockSecurityPriority({
      ilyaHired: hasSecuritySpecialist(hires),
      ilyaIntroduced: useSecurityStoryStore.getState().hasIntroducedSecuritySpecialist,
    }),
  )

  tryUnlock(
    'backup-and-restore-strategy',
    canUnlockBackupStrategy({
      firstPrototypeReady: hasFirstPrototype(taskStates),
      baselineResolved,
      baselineFollowUpSettled: baselineFollowUpSettled(),
    }),
  )

  tryUnlock(
    'architecture-boundary',
    canUnlockArchitectureBoundary({
      completedProductTasks: completedProductTaskCount(taskStates),
      baselineResolved,
      authOrDatabaseIncidentResolved: ['auth-account-incident', 'database-exposure-review'].some(
        (id) => incidents[id as keyof typeof incidents]?.status === 'resolved',
      ),
    }),
  )

  tryUnlock(
    'suspicious-activity-disclosure',
    canUnlockSuspiciousActivityDisclosure({
      baselineResolved,
      authOrDatabaseThreatArmed: ['auth-account-incident', 'database-exposure-review'].some(
        (id) => incidents[id as keyof typeof incidents]?.status === 'armed',
      ),
      detectedIdentityOrSensitiveCritical:
        getDetectedRiskLevel(signals, 'identity-access') === 'critical' || getDetectedRiskLevel(signals, 'sensitive-data') === 'critical',
    }),
  )

  tryUnlock(
    'release-risk-decision',
    canUnlockReleaseRiskDecision({
      allProductTasksDone: hasCompletedCoreMvp(taskStates),
      releaseStarted: useGameOutcomeStore.getState().campaignRelease.status !== 'not-started',
      hasDetectedHighOrCriticalRisk: RISK_DOMAINS.some((d) => {
        const level = getDetectedRiskLevel(signals, d)
        return level === 'high' || level === 'critical'
      }),
      hasRiskyChoiceHistory: Object.values(decisions).some(
        (r) => r.status === 'resolved' && r.selectedChoiceId !== undefined && RISKY_CHOICES.has(r.selectedChoiceId),
      ),
    }),
  )

  return unlocked
}
