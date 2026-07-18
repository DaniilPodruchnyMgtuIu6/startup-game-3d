import { useSprintStore } from './sprintStore'
import { useEconomyStore } from './economyStore'
import { useProductStore } from './productStore'
import { useTeamStore } from './teamStore'
import { useSecurityAuditStore, isFollowUpAuditBlocking } from './securityAuditStore'
import { useAccessControlStore } from './accessControlStore'
import { isOfficeIntrusionBlocking } from './accessControlRules'
import { useServerIncidentStore } from './serverIncidentStore'
import { useServerIncidentsStore } from './serverIncidentsStore'
import { useGameStore } from './gameStore'
import { useGameOutcomeStore } from './gameOutcomeStore'
import { useRiskStore } from './riskStore'
import { useCutsceneStore } from '../cutscenes/cutsceneStore'
import { calculateBalance } from './economyRules'
import { hasCompletedCoreMvp, completedProductTaskCount, productReadiness } from './productRules'
import { PRODUCT_TASK_CATALOG } from './productTaskCatalog'
import { getUnresolvedFindingIds } from './securityAuditRules'
import { getHiredEmployeeIds, hasSecuritySpecialist } from './teamRules'
import { getActualRiskLevel, getDetectedRiskLevel } from './riskRules'
import { RISK_DOMAINS, type RiskDomain, type RiskLevel } from './riskCatalog'
import { toWorkdayIndex } from './workdayIndex'
import {
  calculateCampaignSuccessScore,
  evaluateMvpReleaseReadiness,
  getCampaignSuccessTier,
  type CampaignSuccessSnapshot,
  type MvpReleaseReadiness,
  type MvpReleaseReadinessSnapshot,
  type OfficeIntrusionOutcome,
} from './mvpReleaseRules'
import type { StoryMoment } from './securityStoryRules'

// Feature 13 release use-case. Gathers live snapshots, re-checks readiness, and
// (only on the player's confirmation) starts the final cutscene. The success
// snapshot is committed from inside the scene via finalizeMvpReleaseSuccess, so
// a scene error leaves the release retryable — mirroring the server-incident
// scene pattern. Never moves the day, spends money, or creates progress.

export const MVP_RELEASE_TASK_ID = 'release-officeflow-mvp'
export const MVP_RELEASE_SCENE_ID = 'officeflow-mvp-release'
const ELEVATED_OR_WORSE: RiskLevel[] = ['elevated', 'high', 'critical']

function totalAuditFines(): number {
  return useSecurityAuditStore.getState().followUpAudit.records.reduce((sum, r) => sum + (r.fineAmount || 0), 0)
}

function deriveIntrusionOutcome(): OfficeIntrusionOutcome {
  const intrusion = useAccessControlStore.getState().intrusion
  if (intrusion.status === 'prevented') return 'prevented'
  if (intrusion.status === 'resolved') return intrusion.hadSecuritySpecialistAtIncident ? 'contained-with-specialist' : 'reached-work-area'
  return 'not-triggered'
}

function occurredServerIncidentIds(): string[] {
  return Object.values(useServerIncidentStore.getState().incidents)
    .filter((s) => s.effectsApplied === true)
    .map((s) => s.incidentId)
}

function sumTransactions(category: string): number {
  return useEconomyStore
    .getState()
    .transactions.filter((t) => t.category === category)
    .reduce((sum, t) => sum + t.amount, 0)
}

export function gatherReleaseReadinessSnapshot(): MvpReleaseReadinessSnapshot {
  const outcome = useGameOutcomeStore.getState()
  const sprint = useSprintStore.getState()
  const audit = useSecurityAuditStore.getState()
  const access = useAccessControlStore.getState()
  const product = useProductStore.getState()
  const game = useGameStore.getState()
  const signals = useRiskStore.getState().signals
  const proposalStatus = access.accessControl.proposalStatus

  const blockingOverlayOpen =
    product.activeReport !== null ||
    audit.auditResultToAcknowledge !== null ||
    access.intrusionResultToAcknowledge !== null ||
    useServerIncidentStore.getState().incidentResultToAcknowledge !== null ||
    isFollowUpAuditBlocking(audit.followUpAudit) ||
    isOfficeIntrusionBlocking(access.intrusion)

  return {
    outcomeStatus: outcome.status,
    releaseStatus: outcome.campaignRelease.status,
    allProductTasksDone: hasCompletedCoreMvp(product.taskStates),
    campaignDeadlineStatus: outcome.campaignDeadline.status,
    sprintNumber: sprint.sprintNumber,
    balance: calculateBalance(useEconomyStore.getState().transactions),
    leadershipReviewStatus: outcome.leadershipReview.status,
    openFindingsCount: getUnresolvedFindingIds(audit.findings).length,
    followUpAuditStatus: audit.followUpAudit.status,
    accessControlProposalStatus: proposalStatus,
    officeIntrusionStatus: access.intrusion.status,
    serverIncidentStatuses: Object.values(useServerIncidentStore.getState().incidents).map((s) => s.status),
    cutsceneRunning: useCutsceneStore.getState().activeSceneId !== null,
    serverMinigameOpen: useServerIncidentsStore.getState().activeMinigame !== null,
    blockingOverlayOpen,
    blockingDialogueOpen: game.activeDialogue !== null || game.activeChoice !== null,
    securitySpecialistHired: hasSecuritySpecialist(useTeamStore.getState().hires),
    accessControlActive: proposalStatus === 'active',
    totalAuditFines: totalAuditFines(),
    leadershipComplaint: audit.leadershipComplaint,
    shutdownRecommendation: audit.shutdownRecommendation,
    officeIntrusionOccurred: access.intrusion.status === 'resolved',
    serverIncidentsOccurred: occurredServerIncidentIds().length > 0,
    hasDetectedElevatedRisk: RISK_DOMAINS.some((d) => ELEVATED_OR_WORSE.includes(getDetectedRiskLevel(signals, d))),
  }
}

export function getMvpReleaseReadiness(): MvpReleaseReadiness {
  return evaluateMvpReleaseReadiness(gatherReleaseReadinessSnapshot())
}

function riskLevelRecord(select: (d: RiskDomain) => RiskLevel): Record<RiskDomain, RiskLevel> {
  const out = {} as Record<RiskDomain, RiskLevel>
  for (const d of RISK_DOMAINS) out[d] = select(d)
  return out
}

// Builds the immutable campaign-success snapshot from the current state. The
// release scene changes nothing that feeds it, so it is deterministic at commit.
export function buildCampaignSuccessSnapshot(moment: StoryMoment): CampaignSuccessSnapshot {
  const signals = useRiskStore.getState().signals
  const audit = useSecurityAuditStore.getState()
  const taskStates = useProductStore.getState().taskStates
  const balance = calculateBalance(useEconomyStore.getState().transactions)
  const failedRecords = audit.followUpAudit.records.filter((r) => r.result === 'failed')
  const occurredIds = occurredServerIncidentIds()
  const intrusionOutcome = deriveIntrusionOutcome()
  const accessControlActive = useAccessControlStore.getState().accessControl.proposalStatus === 'active'
  const actualRiskLevels = riskLevelRecord((d) => getActualRiskLevel(signals, d))
  const warningsAtRelease = getMvpReleaseReadiness().warnings

  const { score } = calculateCampaignSuccessScore({
    failedAuditNumbers: failedRecords.map((r) => r.auditNumber),
    officeIntrusionOutcome: intrusionOutcome,
    occurredServerIncidentCount: occurredIds.length,
    leadershipComplaint: audit.leadershipComplaint,
    shutdownRecommendation: audit.shutdownRecommendation,
    accessControlActive,
    actualRiskLevels,
    balance,
  })

  return {
    releasedAt: { sprintNumber: moment.sprintNumber, day: moment.day },
    releaseWorkdayIndex: toWorkdayIndex(moment.sprintNumber, moment.day),
    resultTier: getCampaignSuccessTier(score),
    campaignScore: score,
    balance,
    completedProductTasks: completedProductTaskCount(taskStates),
    totalProductTasks: PRODUCT_TASK_CATALOG.length,
    productProgressPercent: productReadiness(taskStates),
    completedSprints: Math.max(0, moment.sprintNumber - 1),
    metDeadlineEarly: moment.sprintNumber < 6,
    teamEmployeeIds: getHiredEmployeeIds(useTeamStore.getState().hires),
    securitySpecialistHired: hasSecuritySpecialist(useTeamStore.getState().hires),
    accessControlActive,
    auditRecords: audit.followUpAudit.records.length,
    failedAuditRecords: failedRecords.length,
    totalAuditFines: totalAuditFines(),
    leadershipComplaint: audit.leadershipComplaint,
    shutdownRecommendation: audit.shutdownRecommendation,
    officeIntrusionOutcome: intrusionOutcome,
    occurredServerIncidentIds: occurredIds,
    totalServerDowntimeCost: sumTransactions('service-downtime'),
    totalServerIncidentCost: sumTransactions('server-incident'),
    actualRiskLevels,
    detectedRiskLevels: riskLevelRecord((d) => getDetectedRiskLevel(signals, d)),
    warningsAtRelease,
  }
}

// Creates the department release task exactly once, once all 14 tasks are done
// and the run is still winnable (never for a failed/pending save).
export function ensureMvpReleaseTask(): void {
  if (useGameOutcomeStore.getState().status !== 'playing') return
  if (!hasCompletedCoreMvp(useProductStore.getState().taskStates)) return
  const game = useGameStore.getState()
  if (game.tasks.some((t) => t.id === MVP_RELEASE_TASK_ID)) return
  game.addTask({ id: MVP_RELEASE_TASK_ID, text: 'Выпустить MVP OfficeFlow', done: false })
}

// Committed from the release scene's successful end: build the immutable
// snapshot, register the pending success, and complete the release task. The
// coordinator then opens the success screen. Guarded so a failure that slipped
// in first keeps priority.
export function finalizeMvpReleaseSuccess(): void {
  const sprint = useSprintStore.getState()
  const snapshot = buildCampaignSuccessSnapshot({ sprintNumber: sprint.sprintNumber, day: sprint.day })
  const result = useGameOutcomeStore.getState().registerPendingSuccess(snapshot)
  if (result.registered) useGameStore.getState().completeTask(MVP_RELEASE_TASK_ID)
}

// Dev-only: commit a campaign success from the current statistics without
// playing the scene (the coordinator still opens the success screen).
export function forceRegisterSuccessForDev(): { registered: boolean } {
  const sprint = useSprintStore.getState()
  const snapshot = buildCampaignSuccessSnapshot({ sprintNumber: sprint.sprintNumber, day: sprint.day })
  const result = useGameOutcomeStore.getState().registerPendingSuccess(snapshot)
  if (result.registered) useGameStore.getState().completeTask(MVP_RELEASE_TASK_ID)
  return result
}

export type ReleaseOfficeFlowMvpResult =
  | { released: true }
  | {
      released: false
      reason: 'not-ready' | 'already-running' | 'already-released' | 'game-not-playing'
      readiness?: MvpReleaseReadiness
    }

// The narrow, player-confirmed release operation. Validates, marks the release
// running, records an early deadline as met, and starts the final cutscene.
export function releaseOfficeFlowMvp(context: StoryMoment): ReleaseOfficeFlowMvpResult {
  const outcome = useGameOutcomeStore.getState()
  if (outcome.status !== 'playing') return { released: false, reason: 'game-not-playing' }
  if (outcome.campaignRelease.status === 'running') return { released: false, reason: 'already-running' }
  if (outcome.campaignRelease.status === 'released') return { released: false, reason: 'already-released' }

  const readiness = getMvpReleaseReadiness()
  if (!readiness.ready) return { released: false, reason: 'not-ready', readiness }

  const moment: StoryMoment = { sprintNumber: context.sprintNumber, day: context.day }
  outcome.markMvpReleaseRunning(moment)
  // Early release meets the campaign deadline (reuses Feature 12; never a second
  // deadline state). A deadline already met at the sprint-6 review stays met.
  if (useGameOutcomeStore.getState().campaignDeadline.status === 'active') {
    useGameOutcomeStore.getState().markCampaignDeadlineMet(moment)
  }
  useCutsceneStore.getState().startScene(MVP_RELEASE_SCENE_ID)
  return { released: true }
}
