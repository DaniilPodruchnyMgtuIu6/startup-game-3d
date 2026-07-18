import type { MoneyTransaction } from './economyRules'
import type { StoryMoment } from './securityStoryRules'

// Pure, deterministic evaluation of the four Feature 12 defeat conditions. No
// store reads, no state mutation, no UI, no randomness, no Date. The use-case
// (registerGameFailure) gathers a snapshot from the live stores and calls
// evaluateGameFailureConditions; the store persists the resulting immutable
// failure snapshot exactly once.

export type GameOutcomeStatus = 'playing' | 'failure-pending' | 'failed'

export type GameFailureReason =
  | 'budget-exhausted'
  | 'leadership-suspension'
  | 'service-collapse'
  | 'delivery-deadline-missed'

export type LeadershipReviewStatus = 'inactive' | 'grace-period' | 'recovered' | 'failed'

export type CampaignDeadlineStatus = 'active' | 'met' | 'missed'

// The first campaign stage must prepare OfficeFlow for release by the end of
// sprint 6. Not configurable through production UI.
export const CAMPAIGN_DEADLINE_SPRINT = 6
// Five future completed working days to close every finding after the third
// failed audit before leadership suspends the project.
export const LEADERSHIP_GRACE_PERIOD_DAYS = 5
// A single unresolved server incident may stay down at most five paid days.
export const MAX_SERVER_DOWNTIME_DAYS = 5

const ALL_FAILURE_REASONS: GameFailureReason[] = [
  'budget-exhausted',
  'leadership-suspension',
  'service-collapse',
  'delivery-deadline-missed',
]

// Fixed priority when several conditions hold at once. Lower number wins as the
// primary reason; the rest become contributing reasons.
const FAILURE_PRIORITY: Record<GameFailureReason, number> = {
  'budget-exhausted': 1,
  'leadership-suspension': 2,
  'service-collapse': 3,
  'delivery-deadline-missed': 4,
}

export function getGameFailurePriority(reason: GameFailureReason): number {
  return FAILURE_PRIORITY[reason]
}

// --- Persisted outcome state -------------------------------------------------

export interface LeadershipReviewState {
  status: LeadershipReviewStatus
  startedAtWorkdayIndex?: number
  dueWorkdayIndex?: number
  recoveredAt?: StoryMoment
}

export interface CampaignDeadlineState {
  deadlineSprintNumber: number
  status: CampaignDeadlineStatus
  metAt?: StoryMoment
}

export interface GameFailureSnapshot {
  reason: GameFailureReason
  contributingReasons: GameFailureReason[]
  failedAt: { sprintNumber: number; day: number }
  balance: number
  productProgressPercent: number
  completedProductTasks: number
  totalProductTasks: number
  completedSprints: number
  totalAuditFines: number
  unresolvedSecurityFindings: number
  unresolvedServerIncidentIds: string[]
  primarySourceRef: string
}

export interface GameOutcomeData {
  status: GameOutcomeStatus
  pendingFailure?: GameFailureSnapshot
  failure?: GameFailureSnapshot
  leadershipReview: LeadershipReviewState
  campaignDeadline: CampaignDeadlineState
}

export function initialGameOutcome(): GameOutcomeData {
  return {
    status: 'playing',
    leadershipReview: { status: 'inactive' },
    campaignDeadline: { deadlineSprintNumber: CAMPAIGN_DEADLINE_SPRINT, status: 'active' },
  }
}

// --- Evaluation --------------------------------------------------------------

export interface UnresolvedServerIncidentInput {
  incidentId: string
  downtimeDays: number
  status: string
}

export interface GameOutcomeEvaluationSnapshot {
  sprintNumber: number
  day: number
  completedSprints: number
  balance: number
  productProgressPercent: number
  completedProductTasks: number
  totalProductTasks: number
  shutdownRecommendation: boolean
  leadershipReviewStatus: LeadershipReviewStatus
  leadershipReviewDueWorkdayIndex?: number
  currentWorkdayIndex: number
  unresolvedSecurityFindings: number
  unresolvedServerIncidents: UnresolvedServerIncidentInput[]
  campaignDeadlineSprint: number
  campaignDeadlineStatus: CampaignDeadlineStatus
}

export interface GameOutcomeEvaluation {
  primaryReason?: GameFailureReason
  contributingReasons: GameFailureReason[]
}

export function isLeadershipSuspensionDue(currentWorkdayIndex: number, dueWorkdayIndex: number): boolean {
  return currentWorkdayIndex >= dueWorkdayIndex
}

// One downtime day per unique server-downtime transaction id for the incident.
export function countServerDowntimeDays(transactions: MoneyTransaction[], incidentId: string): number {
  const prefix = `server-downtime:${incidentId}:`
  const ids = new Set<string>()
  for (const t of transactions) {
    if (t.category === 'service-downtime' && t.id.startsWith(prefix)) ids.add(t.id)
  }
  return ids.size
}

function isIncidentDowntimeUnresolved(incident: UnresolvedServerIncidentInput): boolean {
  return (
    (incident.status === 'recovery-required' || incident.status === 'recovering') &&
    incident.downtimeDays >= MAX_SERVER_DOWNTIME_DAYS
  )
}

export function evaluateGameFailureConditions(snapshot: GameOutcomeEvaluationSnapshot): GameOutcomeEvaluation {
  const reasons: GameFailureReason[] = []

  if (snapshot.balance <= 0) reasons.push('budget-exhausted')
  if (snapshot.leadershipReviewStatus === 'failed') reasons.push('leadership-suspension')
  if (snapshot.unresolvedServerIncidents.some(isIncidentDowntimeUnresolved)) reasons.push('service-collapse')
  if (snapshot.campaignDeadlineStatus === 'missed') reasons.push('delivery-deadline-missed')

  if (reasons.length === 0) return { contributingReasons: [] }

  const sorted = [...new Set(reasons)].sort((a, b) => getGameFailurePriority(a) - getGameFailurePriority(b))
  return { primaryReason: sorted[0], contributingReasons: sorted.slice(1) }
}

// --- Failure snapshot builder ------------------------------------------------

export interface GameFailureSnapshotContext {
  failedAt: { sprintNumber: number; day: number }
  balance: number
  productProgressPercent: number
  completedProductTasks: number
  totalProductTasks: number
  completedSprints: number
  totalAuditFines: number
  unresolvedSecurityFindings: number
  unresolvedServerIncidentIds: string[]
  primarySourceRef: string
}

export function buildGameFailureSnapshot(
  reason: GameFailureReason,
  contributingReasons: GameFailureReason[],
  context: GameFailureSnapshotContext,
): GameFailureSnapshot {
  const contributing = [...new Set(contributingReasons)].filter((r) => r !== reason)
  return {
    reason,
    contributingReasons: contributing,
    failedAt: { sprintNumber: context.failedAt.sprintNumber, day: context.failedAt.day },
    balance: context.balance,
    productProgressPercent: context.productProgressPercent,
    completedProductTasks: context.completedProductTasks,
    totalProductTasks: context.totalProductTasks,
    completedSprints: context.completedSprints,
    totalAuditFines: context.totalAuditFines,
    unresolvedSecurityFindings: context.unresolvedSecurityFindings,
    unresolvedServerIncidentIds: [...context.unresolvedServerIncidentIds],
    primarySourceRef: context.primarySourceRef,
  }
}

// --- Normalisation of a persisted / corrupt outcome state --------------------

function clampInt(value: unknown, min: number, max: number, fallback: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return fallback
  return Math.min(max, Math.max(min, Math.floor(value)))
}

function normalizeMoment(raw: unknown): StoryMoment | undefined {
  if (!raw || typeof raw !== 'object') return undefined
  const r = raw as Record<string, unknown>
  if (typeof r.sprintNumber !== 'number' || typeof r.day !== 'number') return undefined
  return { sprintNumber: clampInt(r.sprintNumber, 1, 9999, 1), day: clampInt(r.day, 1, 10, 1) }
}

function normalizeReason(raw: unknown): GameFailureReason | null {
  return ALL_FAILURE_REASONS.includes(raw as GameFailureReason) ? (raw as GameFailureReason) : null
}

function normalizeSnapshot(raw: unknown): GameFailureSnapshot | undefined {
  if (!raw || typeof raw !== 'object') return undefined
  const r = raw as Record<string, unknown>
  const reason = normalizeReason(r.reason)
  if (!reason) return undefined
  const failedAt = normalizeMoment(r.failedAt)
  if (!failedAt) return undefined
  const contributing = Array.isArray(r.contributingReasons)
    ? [...new Set(r.contributingReasons.map(normalizeReason).filter((x): x is GameFailureReason => x !== null))].filter(
        (x) => x !== reason,
      )
    : []
  const ids = Array.isArray(r.unresolvedServerIncidentIds)
    ? r.unresolvedServerIncidentIds.filter((x): x is string => typeof x === 'string')
    : []
  return {
    reason,
    contributingReasons: contributing,
    failedAt,
    balance: typeof r.balance === 'number' && Number.isFinite(r.balance) ? r.balance : 0,
    productProgressPercent: clampInt(r.productProgressPercent, 0, 100, 0),
    completedProductTasks: clampInt(r.completedProductTasks, 0, 9999, 0),
    totalProductTasks: clampInt(r.totalProductTasks, 0, 9999, 0),
    completedSprints: clampInt(r.completedSprints, 0, 9999, 0),
    totalAuditFines: typeof r.totalAuditFines === 'number' && Number.isFinite(r.totalAuditFines) ? r.totalAuditFines : 0,
    unresolvedSecurityFindings: clampInt(r.unresolvedSecurityFindings, 0, 9999, 0),
    unresolvedServerIncidentIds: ids,
    primarySourceRef: typeof r.primarySourceRef === 'string' ? r.primarySourceRef : 'unknown',
  }
}

function normalizeLeadershipReview(raw: unknown): LeadershipReviewState {
  if (!raw || typeof raw !== 'object') return { status: 'inactive' }
  const r = raw as Record<string, unknown>
  const valid: LeadershipReviewStatus[] = ['inactive', 'grace-period', 'recovered', 'failed']
  const status = valid.includes(r.status as LeadershipReviewStatus) ? (r.status as LeadershipReviewStatus) : 'inactive'
  if (status !== 'grace-period') {
    const recoveredAt = status === 'recovered' ? normalizeMoment(r.recoveredAt) : undefined
    return { status, ...(recoveredAt ? { recoveredAt } : {}) }
  }
  const started = typeof r.startedAtWorkdayIndex === 'number' && Number.isFinite(r.startedAtWorkdayIndex) ? Math.floor(r.startedAtWorkdayIndex) : undefined
  let due = typeof r.dueWorkdayIndex === 'number' && Number.isFinite(r.dueWorkdayIndex) ? Math.floor(r.dueWorkdayIndex) : undefined
  // A due earlier than start (or absent) is repaired to start + grace period.
  if (started !== undefined && (due === undefined || due < started)) due = started + LEADERSHIP_GRACE_PERIOD_DAYS
  return { status: 'grace-period', startedAtWorkdayIndex: started, dueWorkdayIndex: due }
}

function normalizeCampaignDeadline(raw: unknown): CampaignDeadlineState {
  if (!raw || typeof raw !== 'object') return { deadlineSprintNumber: CAMPAIGN_DEADLINE_SPRINT, status: 'active' }
  const r = raw as Record<string, unknown>
  const valid: CampaignDeadlineStatus[] = ['active', 'met', 'missed']
  const status = valid.includes(r.status as CampaignDeadlineStatus) ? (r.status as CampaignDeadlineStatus) : 'active'
  const deadlineSprintNumber =
    typeof r.deadlineSprintNumber === 'number' && r.deadlineSprintNumber >= 1
      ? Math.floor(r.deadlineSprintNumber)
      : CAMPAIGN_DEADLINE_SPRINT
  const metAt = status === 'met' ? normalizeMoment(r.metAt) : undefined
  return { deadlineSprintNumber, status, ...(metAt ? { metAt } : {}) }
}

export function normalizeGameOutcome(raw: unknown): GameOutcomeData {
  if (!raw || typeof raw !== 'object') return initialGameOutcome()
  const r = raw as Record<string, unknown>
  const leadershipReview = normalizeLeadershipReview(r.leadershipReview)
  const campaignDeadline = normalizeCampaignDeadline(r.campaignDeadline)

  const rawStatus = r.status
  const validStatus: GameOutcomeStatus[] = ['playing', 'failure-pending', 'failed']
  let status: GameOutcomeStatus = validStatus.includes(rawStatus as GameOutcomeStatus) ? (rawStatus as GameOutcomeStatus) : 'playing'

  const pendingFailure = normalizeSnapshot(r.pendingFailure)
  const failure = normalizeSnapshot(r.failure)

  // pending/failed without a valid snapshot degrade to playing (re-evaluated in
  // the next use-case). A valid snapshot must back the terminal states.
  if (status === 'failure-pending' && !pendingFailure) status = 'playing'
  if (status === 'failed' && !failure) status = 'playing'

  return {
    status,
    ...(status === 'failure-pending' && pendingFailure ? { pendingFailure } : {}),
    ...(status === 'failed' && failure ? { failure } : {}),
    leadershipReview,
    campaignDeadline,
  }
}
