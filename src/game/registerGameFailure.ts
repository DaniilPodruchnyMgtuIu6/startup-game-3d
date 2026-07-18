import { useSprintStore } from './sprintStore'
import { useEconomyStore } from './economyStore'
import { useProductStore } from './productStore'
import { useSecurityAuditStore } from './securityAuditStore'
import { useServerIncidentStore } from './serverIncidentStore'
import { useGameOutcomeStore } from './gameOutcomeStore'
import { calculateBalance } from './economyRules'
import { productReadiness, completedProductTaskCount } from './productRules'
import { PRODUCT_TASK_CATALOG } from './productTaskCatalog'
import { getUnresolvedFindingIds } from './securityAuditRules'
import { toWorkdayIndex } from './workdayIndex'
import {
  buildGameFailureSnapshot,
  countServerDowntimeDays,
  evaluateGameFailureConditions,
  type GameFailureReason,
  type GameOutcomeEvaluationSnapshot,
  type UnresolvedServerIncidentInput,
} from './gameOutcomeRules'

// The narrow Feature 12 use-case: read the live stores, build the evaluation
// snapshot, run the pure rule, and register a pending failure exactly once. It
// never opens UI (the coordinator does that) and never re-registers over an
// existing failure. Also hosts the small blocking predicate and the two
// leadership-grace steps that run inside completeWorkday.

// Any incident still costing downtime is "unresolved" for the outcome.
const UNRESOLVED_INCIDENT_STATUSES = new Set(['recovery-required', 'recovering'])

export function isGameOutcomeBlocking(): boolean {
  return useGameOutcomeStore.getState().status !== 'playing'
}

function unresolvedServerIncidents(): UnresolvedServerIncidentInput[] {
  const transactions = useEconomyStore.getState().transactions
  return Object.values(useServerIncidentStore.getState().incidents)
    .filter((s) => UNRESOLVED_INCIDENT_STATUSES.has(s.status))
    .map((s) => ({
      incidentId: s.incidentId,
      status: s.status,
      downtimeDays: countServerDowntimeDays(transactions, s.incidentId),
    }))
}

function totalAuditFines(): number {
  return useSecurityAuditStore.getState().followUpAudit.records.reduce((sum, r) => sum + (r.fineAmount || 0), 0)
}

function buildEvaluationSnapshot(sprintNumber: number, day: number): GameOutcomeEvaluationSnapshot {
  const balance = calculateBalance(useEconomyStore.getState().transactions)
  const taskStates = useProductStore.getState().taskStates
  const audit = useSecurityAuditStore.getState()
  const outcome = useGameOutcomeStore.getState()
  return {
    sprintNumber,
    day,
    completedSprints: Math.max(0, sprintNumber - 1),
    balance,
    productProgressPercent: productReadiness(taskStates),
    completedProductTasks: completedProductTaskCount(taskStates),
    totalProductTasks: PRODUCT_TASK_CATALOG.length,
    shutdownRecommendation: audit.shutdownRecommendation,
    leadershipReviewStatus: outcome.leadershipReview.status,
    leadershipReviewDueWorkdayIndex: outcome.leadershipReview.dueWorkdayIndex,
    currentWorkdayIndex: toWorkdayIndex(sprintNumber, day),
    unresolvedSecurityFindings: getUnresolvedFindingIds(audit.findings).length,
    unresolvedServerIncidents: unresolvedServerIncidents(),
    campaignDeadlineSprint: outcome.campaignDeadline.deadlineSprintNumber,
    campaignDeadlineStatus: outcome.campaignDeadline.status,
  }
}

export interface RegisterGameFailureContext {
  sprintNumber: number
  day: number
}

export function registerGameFailureIfNeeded(sourceRef: string, context: RegisterGameFailureContext): { registered: boolean } {
  if (useGameOutcomeStore.getState().status !== 'playing') return { registered: false }

  const snapshot = buildEvaluationSnapshot(context.sprintNumber, context.day)
  const evaluation = evaluateGameFailureConditions(snapshot)
  if (!evaluation.primaryReason) return { registered: false }

  const failureSnapshot = buildGameFailureSnapshot(evaluation.primaryReason, evaluation.contributingReasons, {
    failedAt: { sprintNumber: context.sprintNumber, day: context.day },
    balance: snapshot.balance,
    productProgressPercent: snapshot.productProgressPercent,
    completedProductTasks: snapshot.completedProductTasks,
    totalProductTasks: snapshot.totalProductTasks,
    completedSprints: snapshot.completedSprints,
    totalAuditFines: totalAuditFines(),
    unresolvedSecurityFindings: snapshot.unresolvedSecurityFindings,
    unresolvedServerIncidentIds: snapshot.unresolvedServerIncidents.map((i) => i.incidentId),
    primarySourceRef: sourceRef,
  })

  return useGameOutcomeStore.getState().registerPendingFailure(failureSnapshot)
}

// Dev-only: force a defeat with the current live statistics through the normal
// register flow (the coordinator then opens the screen at a safe moment).
export function forceRegisterFailureForDev(reason: GameFailureReason): { registered: boolean } {
  const sprint = useSprintStore.getState()
  const snapshot = buildEvaluationSnapshot(sprint.sprintNumber, sprint.day)
  const failureSnapshot = buildGameFailureSnapshot(reason, [], {
    failedAt: { sprintNumber: sprint.sprintNumber, day: sprint.day },
    balance: snapshot.balance,
    productProgressPercent: snapshot.productProgressPercent,
    completedProductTasks: snapshot.completedProductTasks,
    totalProductTasks: snapshot.totalProductTasks,
    completedSprints: snapshot.completedSprints,
    totalAuditFines: totalAuditFines(),
    unresolvedSecurityFindings: snapshot.unresolvedSecurityFindings,
    unresolvedServerIncidentIds: snapshot.unresolvedServerIncidents.map((i) => i.incidentId),
    primarySourceRef: `dev:trigger:${reason}`,
  })
  return useGameOutcomeStore.getState().registerPendingFailure(failureSnapshot)
}

// --- Leadership grace steps (run inside completeWorkday) ---------------------

// Lazily arm the five-day grace period once the third failed audit has latched
// shutdownRecommendation. Idempotent (the store no-ops if not inactive).
export function startLeadershipGraceIfNeeded(currentWorkdayIndex: number): void {
  const audit = useSecurityAuditStore.getState()
  const outcome = useGameOutcomeStore.getState()
  if (audit.shutdownRecommendation && outcome.leadershipReview.status === 'inactive') {
    outcome.startLeadershipGracePeriod(currentWorkdayIndex)
  }
}

// Resolve the grace period for a completed day: recover if every finding is
// closed, fail once the due day has arrived with an open finding.
export function resolveLeadershipReviewForWorkday(sprintNumber: number, day: number, currentWorkdayIndex: number): void {
  const outcome = useGameOutcomeStore.getState()
  if (outcome.leadershipReview.status !== 'grace-period') return
  const allFindingsClosed = getUnresolvedFindingIds(useSecurityAuditStore.getState().findings).length === 0
  outcome.resolveLeadershipReview({ currentWorkdayIndex, allFindingsClosed, moment: { sprintNumber, day } })
}
