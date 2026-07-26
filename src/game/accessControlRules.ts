import type { RiskLevel } from './riskCatalog'
import type { StoryMoment } from './securityStoryRules'
import { getEmployeeActiveSecurityFinding, type SecurityFindingState } from './securityAuditRules'
import { SECURITY_BALANCE } from './balance/securityBalance'

// Pure, deterministic rules for the access-control (СКУД) initiative and the
// office-intrusion threat (Feature 10). No Zustand, no randomness, no real time.
// The threat uses ACTUAL office-access risk; the proposal unlocks on DETECTED
// risk. All money/day effects are decided here and applied idempotently by the
// store.

export type AccessControlProposalStatus = 'locked' | 'available' | 'postponed' | 'approved' | 'in-progress' | 'active'
export type AccessControlAssigneeId = 'sonya-sokolova' | 'ilya-vlasov'

export interface AccessControlState {
  proposalStatus: AccessControlProposalStatus
  approvedAt?: StoryMoment
  completedAt?: StoryMoment
  assignedEmployeeId?: AccessControlAssigneeId
  progressDays: number
  purchaseTransactionId?: string
  effectsApplied: boolean
  // Feature 16 §9: the workday index when the proposal first became available —
  // used to fire the "not implemented in time" escalation two workdays later.
  availableAtWorkdayIndex?: number
}

export type OfficeIntrusionStatus = 'dormant' | 'armed' | 'pending' | 'running' | 'resolved' | 'prevented'

export interface OfficeIntrusionState {
  status: OfficeIntrusionStatus
  armedAtWorkdayIndex?: number
  dueWorkdayIndex?: number
  triggeredAt?: StoryMoment
  resolvedAt?: StoryMoment
  hadSecuritySpecialistAtIncident?: boolean
  responseTransactionId?: string
  effectsApplied: boolean
}

export const INITIAL_ACCESS_CONTROL: AccessControlState = { proposalStatus: 'locked', progressDays: 0, effectsApplied: false }
export const INITIAL_INTRUSION: OfficeIntrusionState = { status: 'dormant', effectsApplied: false }

export const OFFICE_INTRUSION_DELAY_DAYS = SECURITY_BALANCE.intrusion.delayWorkdays
export const OFFICE_INTRUSION_RESPONSE_COST_WITH_SPECIALIST = SECURITY_BALANCE.intrusion.responseCostWithSpecialistRub
export const OFFICE_INTRUSION_RESPONSE_COST_WITHOUT_SPECIALIST = SECURITY_BALANCE.intrusion.responseCostWithoutSpecialistRub

const LEVEL_ORDER: RiskLevel[] = ['controlled', 'low', 'elevated', 'high', 'critical']
function levelRank(level: RiskLevel): number {
  return LEVEL_ORDER.indexOf(level)
}

// --- Proposal ---------------------------------------------------------------

// The СКУД proposal unlocks once the player can OBSERVE a physical-access
// problem: detected office-access risk at elevated or higher.
export function canUnlockAccessControlProposal(detectedOfficeAccessLevel: RiskLevel): boolean {
  return levelRank(detectedOfficeAccessLevel) >= levelRank('elevated')
}

// --- Implementation effort & assignment -------------------------------------

export function getAccessControlEffortDays(employeeId: AccessControlAssigneeId): number {
  return SECURITY_BALANCE.accessControl.effortDaysByAssignee[employeeId]
}

// Effort still required from the CURRENT assignee (progress carries over on a
// swap but is capped at the new assignee's effort).
export function getRemainingAccessControlEffort(state: AccessControlState): number {
  if (!state.assignedEmployeeId) return 0
  return Math.max(0, getAccessControlEffortDays(state.assignedEmployeeId) - state.progressDays)
}

export type SecurityWorkAssignment = { kind: 'finding'; findingId: string } | { kind: 'access-control' }

// The single security work an employee is currently occupied by - a corrective
// finding (Feature 08) OR the access-control implementation. Used to keep the
// "one security task per employee" rule consistent across both.
export function getEmployeeActiveSecurityWork(
  employeeId: string,
  findingStates: SecurityFindingState[],
  accessControlState: AccessControlState,
): SecurityWorkAssignment | undefined {
  if (
    accessControlState.assignedEmployeeId === employeeId &&
    (accessControlState.proposalStatus === 'approved' || accessControlState.proposalStatus === 'in-progress')
  ) {
    return { kind: 'access-control' }
  }
  const finding = getEmployeeActiveSecurityFinding(findingStates, employeeId)
  return finding ? { kind: 'finding', findingId: finding.findingId } : undefined
}

export interface AccessControlAssignmentContext {
  employeeId: AccessControlAssigneeId
  proposalStatus: AccessControlProposalStatus
  hasIlya: boolean
  findingStates: SecurityFindingState[]
  auditBlocking: boolean
}

export type AccessControlAssignmentReason =
  | 'not-approved'
  | 'already-active'
  | 'ilya-not-hired'
  | 'employee-busy-finding'
  | 'audit-in-progress'

export interface AccessControlAssignmentValidation {
  allowed: boolean
  reason?: AccessControlAssignmentReason
}

// An implementer may be assigned only once the investment is approved (not yet
// active), the audit is not blocking, Ilya (if chosen) is really hired, and the
// employee is not already occupied by a corrective finding.
export function canAssignAccessControlEmployee(ctx: AccessControlAssignmentContext): AccessControlAssignmentValidation {
  if (ctx.proposalStatus === 'active') return { allowed: false, reason: 'already-active' }
  if (ctx.proposalStatus !== 'approved' && ctx.proposalStatus !== 'in-progress') return { allowed: false, reason: 'not-approved' }
  if (ctx.employeeId === 'ilya-vlasov' && !ctx.hasIlya) return { allowed: false, reason: 'ilya-not-hired' }
  if (ctx.auditBlocking) return { allowed: false, reason: 'audit-in-progress' }
  if (getEmployeeActiveSecurityFinding(ctx.findingStates, ctx.employeeId)) return { allowed: false, reason: 'employee-busy-finding' }
  return { allowed: true }
}

export function accessControlWorkdayId(sprintNumber: number, day: number): string {
  return `access-control-work:sprint-${sprintNumber}:day-${day}`
}

// --- Intrusion threat -------------------------------------------------------

export interface IntrusionThreatContext {
  currentWorkdayIndex: number
  actualOfficeAccessLevel: RiskLevel
  accessControlActive: boolean
  intrusionStatus: OfficeIntrusionStatus
  armedAtWorkdayIndex?: number
  dueWorkdayIndex?: number
}

export interface IntrusionThreatTransition {
  status: OfficeIntrusionStatus
  armedAtWorkdayIndex?: number
  dueWorkdayIndex?: number
  changed: boolean
}

// Deterministic threat state machine (Feature 10 §18). The threat arms at high
// actual risk, disarms if the risk drops before the due day, becomes pending on
// the due day, and is prevented forever once СКУД is active. resolved/prevented
// are final.
export function reconcileIntrusionThreatRules(ctx: IntrusionThreatContext): IntrusionThreatTransition {
  const keep = (): IntrusionThreatTransition => ({
    status: ctx.intrusionStatus,
    armedAtWorkdayIndex: ctx.armedAtWorkdayIndex,
    dueWorkdayIndex: ctx.dueWorkdayIndex,
    changed: false,
  })

  if (ctx.intrusionStatus === 'resolved' || ctx.intrusionStatus === 'prevented') return keep()

  // Active access control prevents any not-yet-resolved intrusion (resolved and
  // prevented were already returned above).
  if (ctx.accessControlActive) return { status: 'prevented', changed: true }

  const isHigh = levelRank(ctx.actualOfficeAccessLevel) >= levelRank('high')

  if (ctx.intrusionStatus === 'dormant') {
    if (!isHigh) return keep()
    return { status: 'armed', armedAtWorkdayIndex: ctx.currentWorkdayIndex, dueWorkdayIndex: ctx.currentWorkdayIndex + OFFICE_INTRUSION_DELAY_DAYS, changed: true }
  }

  if (ctx.intrusionStatus === 'armed') {
    if (!isHigh) return { status: 'dormant', changed: true } // risk dropped -> disarm
    if (ctx.dueWorkdayIndex !== undefined && ctx.currentWorkdayIndex >= ctx.dueWorkdayIndex) {
      return { status: 'pending', armedAtWorkdayIndex: ctx.armedAtWorkdayIndex, dueWorkdayIndex: ctx.dueWorkdayIndex, changed: true }
    }
    return keep()
  }

  // pending / running are handled by the scene, not here.
  return keep()
}

// --- Scene trigger ----------------------------------------------------------

export interface OfficeIntrusionTriggerContext {
  intrusionStatus: OfficeIntrusionStatus
  isDailyReportOpen: boolean
  isFollowUpAuditActive: boolean
  isCutsceneRunning: boolean
  isServerMinigameOpen: boolean
  isBlockingOverlayOpen: boolean
  isBlockingDialogueOpen: boolean
}

export function canTriggerOfficeIntrusion(ctx: OfficeIntrusionTriggerContext): boolean {
  return (
    ctx.intrusionStatus === 'pending' &&
    !ctx.isDailyReportOpen &&
    !ctx.isFollowUpAuditActive && // audit runs before the intrusion
    !ctx.isCutsceneRunning &&
    !ctx.isServerMinigameOpen &&
    !ctx.isBlockingOverlayOpen &&
    !ctx.isBlockingDialogueOpen
  )
}

// A pending or running intrusion blocks the next day until it is resolved.
export function isOfficeIntrusionBlocking(intrusion: OfficeIntrusionState): boolean {
  return intrusion.status === 'pending' || intrusion.status === 'running'
}

export function getOfficeIntrusionResponseCost(hasSecuritySpecialist: boolean): number {
  return hasSecuritySpecialist ? OFFICE_INTRUSION_RESPONSE_COST_WITH_SPECIALIST : OFFICE_INTRUSION_RESPONSE_COST_WITHOUT_SPECIALIST
}

// --- Persistence normalisation ---------------------------------------------

const PROPOSAL_STATUSES: AccessControlProposalStatus[] = ['locked', 'available', 'postponed', 'approved', 'in-progress', 'active']
const INTRUSION_STATUSES: OfficeIntrusionStatus[] = ['dormant', 'armed', 'pending', 'running', 'resolved', 'prevented']
const ASSIGNEES: AccessControlAssigneeId[] = ['sonya-sokolova', 'ilya-vlasov']

function validMoment(raw: unknown): StoryMoment | undefined {
  if (!raw || typeof raw !== 'object') return undefined
  const { sprintNumber, day } = raw as Record<string, unknown>
  if (typeof sprintNumber !== 'number' || !Number.isInteger(sprintNumber) || sprintNumber < 1) return undefined
  if (typeof day !== 'number' || !Number.isInteger(day) || day < 1 || day > 10) return undefined
  return { sprintNumber, day }
}

function validIndex(raw: unknown): number | undefined {
  return typeof raw === 'number' && Number.isInteger(raw) && raw >= 1 ? raw : undefined
}

export function normalizeAccessControlState(raw: unknown, detectedOfficeAccessLevel: RiskLevel): AccessControlState {
  if (!raw || typeof raw !== 'object') {
    return { ...INITIAL_ACCESS_CONTROL, proposalStatus: canUnlockAccessControlProposal(detectedOfficeAccessLevel) ? 'available' : 'locked' }
  }
  const r = raw as Record<string, unknown>
  let proposalStatus = PROPOSAL_STATUSES.includes(r.proposalStatus as AccessControlProposalStatus)
    ? (r.proposalStatus as AccessControlProposalStatus)
    : canUnlockAccessControlProposal(detectedOfficeAccessLevel)
      ? 'available'
      : 'locked'

  const rawProgress = typeof r.progressDays === 'number' && Number.isFinite(r.progressDays) ? Math.floor(r.progressDays) : 0
  const progressDays = Math.max(0, rawProgress)
  const completedAt = validMoment(r.completedAt)
  const approvedAt = validMoment(r.approvedAt)
  const assignedEmployeeId = ASSIGNEES.includes(r.assignedEmployeeId as AccessControlAssigneeId) ? (r.assignedEmployeeId as AccessControlAssigneeId) : undefined
  const purchaseTransactionId = typeof r.purchaseTransactionId === 'string' ? r.purchaseTransactionId : undefined

  // active requires a completion moment; otherwise fall back to in-progress.
  if (proposalStatus === 'active' && !completedAt) proposalStatus = 'in-progress'

  const availableAtWorkdayIndex =
    typeof r.availableAtWorkdayIndex === 'number' && Number.isFinite(r.availableAtWorkdayIndex) ? r.availableAtWorkdayIndex : undefined

  const state: AccessControlState = {
    proposalStatus,
    progressDays: proposalStatus === 'active' ? Math.max(progressDays, 0) : progressDays,
    effectsApplied: r.effectsApplied === true,
    ...(approvedAt ? { approvedAt } : {}),
    ...(proposalStatus === 'active' && completedAt ? { completedAt } : {}),
    ...(proposalStatus !== 'active' && assignedEmployeeId ? { assignedEmployeeId } : {}),
    ...(purchaseTransactionId ? { purchaseTransactionId } : {}),
    ...(availableAtWorkdayIndex !== undefined ? { availableAtWorkdayIndex } : {}),
  }
  return state
}

// Feature 16 §9: whether to create the one-time office-access escalation. Fires
// only while the СКУД proposal is still merely available/postponed (never
// approved/in-progress/active), the office-access risk is still elevated (both
// detected and actual — so closing the finding or reducing the risk stops it),
// and at least two workdays have passed since the proposal became available.
export function shouldEscalateAccessControl(ctx: {
  proposalStatus: AccessControlProposalStatus
  currentWorkdayIndex: number
  availableAtWorkdayIndex?: number
  detectedOfficeAccessLevel: RiskLevel
  actualOfficeAccessLevel: RiskLevel
}): boolean {
  if (ctx.proposalStatus !== 'available' && ctx.proposalStatus !== 'postponed') return false
  if (ctx.availableAtWorkdayIndex === undefined) return false
  if (ctx.currentWorkdayIndex - ctx.availableAtWorkdayIndex < SECURITY_BALANCE.accessControl.escalationDelayWorkdays) return false
  if (levelRank(ctx.detectedOfficeAccessLevel) < levelRank('elevated')) return false
  if (levelRank(ctx.actualOfficeAccessLevel) < levelRank('elevated')) return false
  return true
}

export function normalizeIntrusionState(raw: unknown): OfficeIntrusionState {
  if (!raw || typeof raw !== 'object') return { ...INITIAL_INTRUSION }
  const r = raw as Record<string, unknown>
  let status = INTRUSION_STATUSES.includes(r.status as OfficeIntrusionStatus) ? (r.status as OfficeIntrusionStatus) : 'dormant'
  if (status === 'running') status = 'pending' // interrupted by a reload

  const armedAtWorkdayIndex = validIndex(r.armedAtWorkdayIndex)
  let dueWorkdayIndex = validIndex(r.dueWorkdayIndex)
  // due cannot precede armed
  if (dueWorkdayIndex !== undefined && armedAtWorkdayIndex !== undefined && dueWorkdayIndex < armedAtWorkdayIndex) dueWorkdayIndex = armedAtWorkdayIndex + OFFICE_INTRUSION_DELAY_DAYS
  // an armed/pending threat needs a due index
  if ((status === 'armed' || status === 'pending') && dueWorkdayIndex === undefined) {
    status = 'dormant'
  }

  const state: OfficeIntrusionState = { status, effectsApplied: r.effectsApplied === true }
  if (status === 'armed' || status === 'pending') {
    if (armedAtWorkdayIndex !== undefined) state.armedAtWorkdayIndex = armedAtWorkdayIndex
    if (dueWorkdayIndex !== undefined) state.dueWorkdayIndex = dueWorkdayIndex
  }
  const triggeredAt = validMoment(r.triggeredAt)
  if (triggeredAt) state.triggeredAt = triggeredAt
  const resolvedAt = validMoment(r.resolvedAt)
  if (status === 'resolved' && resolvedAt) state.resolvedAt = resolvedAt
  if (typeof r.hadSecuritySpecialistAtIncident === 'boolean') state.hadSecuritySpecialistAtIncident = r.hadSecuritySpecialistAtIncident
  if (typeof r.responseTransactionId === 'string') state.responseTransactionId = r.responseTransactionId
  return state
}
