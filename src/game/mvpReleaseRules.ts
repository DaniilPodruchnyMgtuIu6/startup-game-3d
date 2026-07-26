import type { RiskDomain, RiskLevel } from './riskCatalog'
import type { StoryMoment } from './securityStoryRules'
import type { CampaignDeadlineStatus, GameOutcomeStatus, LeadershipReviewStatus } from './gameOutcomeRules'

// Pure, deterministic Feature 13 logic: MVP release readiness, the campaign
// success score/tier, the final highlights, and the success-registration guard.
// No Zustand reads, no state mutation, no UI, no randomness, no Date. The
// use-case (releaseOfficeFlowMvp) gathers snapshots from the live stores.

// --- Release lifecycle -------------------------------------------------------

export type MvpReleaseStatus = 'not-started' | 'running' | 'released'

export interface CampaignReleaseState {
  status: MvpReleaseStatus
  startedAt?: StoryMoment
  releasedAt?: StoryMoment
}

// --- Readiness ---------------------------------------------------------------

export type MvpReleaseBlockingReason =
  | 'game-not-playing'
  | 'release-already-running'
  | 'release-already-completed'
  | 'deadline-missed'
  | 'product-incomplete'
  | 'budget-exhausted'
  | 'leadership-review-active'
  | 'security-findings-open'
  | 'follow-up-audit-pending'
  | 'access-control-in-progress'
  | 'office-intrusion-unresolved'
  | 'server-threat-unresolved'
  | 'server-incident-unresolved'
  | 'cutscene-running'
  | 'server-minigame-open'
  | 'blocking-overlay-open'
  | 'blocking-dialogue-open'
  // Feature 17B story gating
  | 'story-release-decision-pending'
  | 'hardening-in-progress'
  | 'hidden-risk-blocked'

export type MvpReleaseWarning =
  | 'security-specialist-not-hired'
  | 'access-control-not-active'
  | 'future-audit-scheduled'
  | 'audit-fines-paid'
  | 'leadership-complaint-exists'
  | 'shutdown-recommendation-recovered'
  | 'office-intrusion-occurred'
  | 'server-incidents-occurred'
  | 'detected-security-risks'
  | 'low-remaining-budget'

export interface MvpReleaseReadiness {
  ready: boolean
  blockingReasons: MvpReleaseBlockingReason[]
  warnings: MvpReleaseWarning[]
}

export const CAMPAIGN_DEADLINE_SPRINT_FOR_RELEASE = 6
export const LOW_BUDGET_WARNING_THRESHOLD = 300_000

export interface MvpReleaseReadinessSnapshot {
  outcomeStatus: GameOutcomeStatus
  releaseStatus: MvpReleaseStatus
  allProductTasksDone: boolean
  campaignDeadlineStatus: CampaignDeadlineStatus
  sprintNumber: number
  balance: number
  leadershipReviewStatus: LeadershipReviewStatus
  openFindingsCount: number
  followUpAuditStatus: string
  accessControlProposalStatus: string
  officeIntrusionStatus: string
  serverIncidentStatuses: string[]
  cutsceneRunning: boolean
  serverMinigameOpen: boolean
  blockingOverlayOpen: boolean
  blockingDialogueOpen: boolean
  // Feature 17B story gating (all default-safe for pre-17 saves)
  storyReleaseDecisionPending?: boolean
  storyHardeningDaysLeft?: number
  storyHiddenRiskBlocked?: boolean
  // warning inputs
  securitySpecialistHired: boolean
  accessControlActive: boolean
  totalAuditFines: number
  leadershipComplaint: boolean
  shutdownRecommendation: boolean
  officeIntrusionOccurred: boolean
  serverIncidentsOccurred: boolean
  hasDetectedElevatedRisk: boolean
}

const SERVER_INCIDENT_BLOCKING = new Set(['pending', 'running', 'recovery-required', 'recovering'])

export function evaluateMvpReleaseReadiness(snapshot: MvpReleaseReadinessSnapshot): MvpReleaseReadiness {
  const blockingReasons: MvpReleaseBlockingReason[] = []

  // Outcome / release lifecycle
  if (snapshot.outcomeStatus !== 'playing') blockingReasons.push('game-not-playing')
  if (snapshot.releaseStatus === 'running') blockingReasons.push('release-already-running')
  if (snapshot.releaseStatus === 'released') blockingReasons.push('release-already-completed')

  // Product
  if (!snapshot.allProductTasksDone) blockingReasons.push('product-incomplete')

  // Deadline: missed forbids victory; active is only valid up to sprint 6.
  if (
    snapshot.campaignDeadlineStatus === 'missed' ||
    (snapshot.campaignDeadlineStatus === 'active' && snapshot.sprintNumber > CAMPAIGN_DEADLINE_SPRINT_FOR_RELEASE)
  ) {
    blockingReasons.push('deadline-missed')
  }

  // Budget: zero or negative must lead to Feature 12, not a win.
  if (snapshot.balance <= 0) blockingReasons.push('budget-exhausted')

  // Leadership grace period blocks; recovered is allowed.
  if (snapshot.leadershipReviewStatus === 'grace-period') blockingReasons.push('leadership-review-active')

  // Every audit finding must be closed.
  if (snapshot.openFindingsCount > 0) blockingReasons.push('security-findings-open')

  // A running/pending follow-up audit blocks; scheduled is allowed (warning).
  if (snapshot.followUpAuditStatus === 'pending' || snapshot.followUpAuditStatus === 'running') {
    blockingReasons.push('follow-up-audit-pending')
  }

  // Paid-but-unfinished access control work blocks.
  if (snapshot.accessControlProposalStatus === 'approved' || snapshot.accessControlProposalStatus === 'in-progress') {
    blockingReasons.push('access-control-in-progress')
  }

  // An armed/active intrusion blocks; dormant/prevented/resolved are safe.
  if (['armed', 'pending', 'running'].includes(snapshot.officeIntrusionStatus)) {
    blockingReasons.push('office-intrusion-unresolved')
  }

  // Server threats/incidents must reach a final safe state.
  if (snapshot.serverIncidentStatuses.includes('armed')) blockingReasons.push('server-threat-unresolved')
  if (snapshot.serverIncidentStatuses.some((s) => SERVER_INCIDENT_BLOCKING.has(s))) {
    blockingReasons.push('server-incident-unresolved')
  }

  // Live UI / scenes
  if (snapshot.cutsceneRunning) blockingReasons.push('cutscene-running')
  if (snapshot.serverMinigameOpen) blockingReasons.push('server-minigame-open')
  if (snapshot.blockingOverlayOpen) blockingReasons.push('blocking-overlay-open')
  if (snapshot.blockingDialogueOpen) blockingReasons.push('blocking-dialogue-open')

  // Feature 17B: the pre-release decision must be held first; hardening delays
  // the release by its remaining workdays; a hidden risk with critical
  // governance or an unresolved incident cannot ship.
  if (snapshot.storyReleaseDecisionPending) blockingReasons.push('story-release-decision-pending')
  if ((snapshot.storyHardeningDaysLeft ?? 0) > 0) blockingReasons.push('hardening-in-progress')
  if (snapshot.storyHiddenRiskBlocked) blockingReasons.push('hidden-risk-blocked')

  const warnings: MvpReleaseWarning[] = []
  if (!snapshot.securitySpecialistHired) warnings.push('security-specialist-not-hired')
  if (!snapshot.accessControlActive) warnings.push('access-control-not-active')
  if (snapshot.followUpAuditStatus === 'scheduled') warnings.push('future-audit-scheduled')
  if (snapshot.totalAuditFines > 0) warnings.push('audit-fines-paid')
  if (snapshot.leadershipComplaint) warnings.push('leadership-complaint-exists')
  if (snapshot.shutdownRecommendation) warnings.push('shutdown-recommendation-recovered')
  if (snapshot.officeIntrusionOccurred) warnings.push('office-intrusion-occurred')
  if (snapshot.serverIncidentsOccurred) warnings.push('server-incidents-occurred')
  if (snapshot.hasDetectedElevatedRisk) warnings.push('detected-security-risks')
  if (snapshot.balance < LOW_BUDGET_WARNING_THRESHOLD) warnings.push('low-remaining-budget')

  return { ready: blockingReasons.length === 0, blockingReasons, warnings }
}

// --- Campaign success snapshot ----------------------------------------------

export type OfficeIntrusionOutcome = 'not-triggered' | 'prevented' | 'contained-with-specialist' | 'reached-work-area'

export type CampaignSuccessTier = 'secure-launch' | 'stable-launch' | 'fragile-launch'

export interface CampaignSuccessSnapshot {
  releasedAt: { sprintNumber: number; day: number }
  releaseWorkdayIndex: number
  resultTier: CampaignSuccessTier
  campaignScore: number

  balance: number
  completedProductTasks: number
  totalProductTasks: number
  productProgressPercent: number

  completedSprints: number
  metDeadlineEarly: boolean

  teamEmployeeIds: string[]
  securitySpecialistHired: boolean
  accessControlActive: boolean

  auditRecords: number
  failedAuditRecords: number
  totalAuditFines: number
  leadershipComplaint: boolean
  shutdownRecommendation: boolean

  officeIntrusionOutcome: OfficeIntrusionOutcome
  occurredServerIncidentIds: string[]
  totalServerDowntimeCost: number
  totalServerIncidentCost: number

  actualRiskLevels: Record<RiskDomain, RiskLevel>
  detectedRiskLevels: Record<RiskDomain, RiskLevel>

  warningsAtRelease: MvpReleaseWarning[]
}

// --- Score -------------------------------------------------------------------

export interface CampaignSuccessScoreSnapshot {
  failedAuditNumbers: number[]
  officeIntrusionOutcome: OfficeIntrusionOutcome
  occurredServerIncidentCount: number
  leadershipComplaint: boolean
  shutdownRecommendation: boolean
  accessControlActive: boolean
  actualRiskLevels: Record<RiskDomain, RiskLevel>
  balance: number
  // Feature 17B: cumulative penalty from the Level 1 story choices (production
  // test data, known-risk release, hidden risk). 0 for a pre-17 save.
  storyScorePenalty?: number
}

export interface CampaignSuccessScoreResult {
  score: number
}

const FAILED_AUDIT_PENALTY: Record<number, number> = { 1: 5, 2: 10, 3: 20 }
const INTRUSION_PENALTY: Record<OfficeIntrusionOutcome, number> = {
  'not-triggered': 0,
  prevented: 0,
  'contained-with-specialist': 5,
  'reached-work-area': 12,
}

function clampScore(score: number): number {
  return Math.min(100, Math.max(0, Math.round(score)))
}

function budgetPenalty(balance: number): number {
  if (balance >= 500_000) return 0
  if (balance >= 250_000) return 3
  return 7 // 1..249 999 (non-positive balance is rejected by readiness)
}

function riskPenalty(level: RiskLevel): number {
  if (level === 'high') return 3
  if (level === 'critical') return 6
  return 0
}

export function calculateCampaignSuccessScore(snapshot: CampaignSuccessScoreSnapshot): CampaignSuccessScoreResult {
  let score = 100
  for (const auditNumber of snapshot.failedAuditNumbers) score -= FAILED_AUDIT_PENALTY[auditNumber] ?? 0
  score -= INTRUSION_PENALTY[snapshot.officeIntrusionOutcome]
  score -= 6 * Math.min(3, Math.max(0, snapshot.occurredServerIncidentCount))
  if (snapshot.leadershipComplaint) score -= 8
  if (snapshot.shutdownRecommendation) score -= 15
  if (!snapshot.accessControlActive) score -= 5
  for (const level of Object.values(snapshot.actualRiskLevels)) score -= riskPenalty(level)
  score -= budgetPenalty(snapshot.balance)
  score -= Math.max(0, snapshot.storyScorePenalty ?? 0)
  return { score: clampScore(score) }
}

export function getCampaignSuccessTier(score: number): CampaignSuccessTier {
  if (score >= 85) return 'secure-launch'
  if (score >= 60) return 'stable-launch'
  return 'fragile-launch'
}

export const CAMPAIGN_TIER_TITLE: Record<CampaignSuccessTier, string> = {
  'secure-launch': 'Устойчивый запуск',
  'stable-launch': 'MVP успешно запущен',
  'fragile-launch': 'Запуск под давлением',
}

export const CAMPAIGN_TIER_DESCRIPTION: Record<CampaignSuccessTier, string> = {
  'secure-launch': 'OfficeFlow выпущен с управляемыми рисками и достаточным запасом для следующего этапа.',
  'stable-launch': 'Команда выпустила рабочий MVP. Проекту ещё потребуются улучшения процессов и инфраструктуры.',
  'fragile-launch':
    'MVP выпущен, но прошлые инциденты, штрафы и накопленные риски оставили проекту небольшой запас устойчивости.',
}

// --- Highlights (max 3, deterministic priority order) ------------------------

export function buildCampaignSuccessHighlights(snapshot: CampaignSuccessSnapshot): string[] {
  const highlights: string[] = []
  const push = (text: string) => {
    if (highlights.length < 3) highlights.push(text)
  }

  if (snapshot.metDeadlineEarly) push('Команда выпустила MVP раньше крайнего срока.')
  if (snapshot.shutdownRecommendation) push('Проект дошёл до рекомендации о приостановке, но команда закрыла критические замечания.')
  if (snapshot.officeIntrusionOutcome === 'reached-work-area') push('Посторонний добрался до рабочей зоны — физическому доступу не хватило контроля.')
  else if (snapshot.officeIntrusionOutcome === 'prevented' && snapshot.accessControlActive) push('Своевременная СКУД предотвратила проникновение.')
  if (snapshot.occurredServerIncidentIds.length > 0 && snapshot.totalServerDowntimeCost > 0) push('Серверный простой уменьшил финансовый запас.')
  if (snapshot.securitySpecialistHired) push('Илья позволял устранять технические риски, не останавливая разработку.')
  else push('Замечания безопасности закрывались силами команды без штатного специалиста.')
  if (snapshot.failedAuditRecords > 0) push('Провалённые аудиты добавили штрафов и давления на бюджет.')
  if (snapshot.accessControlActive) push('Внедрённая СКУД укрепила контроль физического доступа.')

  return highlights.slice(0, 3)
}

// --- Success-registration guard ---------------------------------------------

// A success may be registered only from clean play — never over a failure that
// is already pending/final, and never twice.
export function canRegisterSuccess(status: GameOutcomeStatus): boolean {
  return status === 'playing'
}
