import type { RiskLevel } from './riskCatalog'
import type { RiskSignal } from './riskRules'
import type { StoryMoment } from './securityStoryRules'
import { getEmployeeActiveSecurityFinding, type SecurityFindingState } from './securityAuditRules'
import type { AccessControlState } from './accessControlRules'
import {
  SERVER_INCIDENT_CATALOG,
  SERVER_INCIDENT_PRIORITY,
  getServerIncident,
  type ServerIncidentDefinition,
  type ServerIncidentId,
  type ServerRackId,
} from './serverIncidentCatalog'

// Pure, deterministic rules for server incidents (Feature 11). No Zustand, no
// randomness. Threats are derived from ACTUAL risk + rack instability; costs,
// effort and downtime come from the catalog; recovery is measured in the
// assigned employee's working days. All idempotent effects are applied by the
// store.

export type ServerIncidentStatus =
  | 'dormant'
  | 'armed'
  | 'pending'
  | 'running'
  | 'recovery-required'
  | 'recovering'
  | 'resolved'

export interface ServerIncidentState {
  incidentId: ServerIncidentId
  status: ServerIncidentStatus
  armedAtWorkdayIndex?: number
  dueWorkdayIndex?: number
  triggeredAt?: StoryMoment
  resolvedAt?: StoryMoment
  hadSecuritySpecialistAtIncident?: boolean
  assignedEmployeeId?: string
  recoveryProgressDays: number
  immediateCostTransactionId?: string
  effectsApplied: boolean
}

export interface ServerRecoveryWorkdayRecord {
  id: string
  sprintNumber: number
  day: number
  incidentResults: {
    incidentId: ServerIncidentId
    employeeId?: string
    beforeProgressDays?: number
    afterProgressDays?: number
    completed?: boolean
    idleReason?: 'no-assignee'
  }[]
  downtimeTransactionIds: string[]
}

export const SERVER_INCIDENT_DELAY_DAYS = 4

export function initialServerIncidentState(incidentId: ServerIncidentId): ServerIncidentState {
  return { incidentId, status: 'dormant', recoveryProgressDays: 0, effectsApplied: false }
}

export function initialServerIncidents(): Record<ServerIncidentId, ServerIncidentState> {
  return {
    'gateway-outage': initialServerIncidentState('gateway-outage'),
    'auth-account-incident': initialServerIncidentState('auth-account-incident'),
    'database-exposure-review': initialServerIncidentState('database-exposure-review'),
  }
}

const LEVEL_ORDER: RiskLevel[] = ['controlled', 'low', 'elevated', 'high', 'critical']
function isHighOrAbove(level: RiskLevel): boolean {
  return LEVEL_ORDER.indexOf(level) >= LEVEL_ORDER.indexOf('high')
}

// --- Rack instability (from the persisted Feature 09 server risk signals) ----

export interface RackStabilitySnapshot {
  rackId: ServerRackId
  failedAttemptsAfterLastSuccess: number
  hasSuccessfulStabilization: boolean
}

// Instability is read from the persisted server-minigame signals (the mini-game
// incident history itself is in-memory). Only failures AFTER the last
// stabilisation count; without a stabilisation all recorded failures count.
export function getRackStabilitySnapshot(rackId: ServerRackId, signals: RiskSignal[]): RackStabilitySnapshot {
  const failures = signals.filter((s) => s.id.startsWith(`server:${rackId}:failure:`))
  const stabilized = signals.find((s) => s.id === `server:${rackId}:stabilized`)
  const failedAttemptsAfterLastSuccess = stabilized
    ? failures.filter((f) => f.createdAtWorkdayIndex > stabilized.createdAtWorkdayIndex).length
    : failures.length
  return { rackId, failedAttemptsAfterLastSuccess, hasSuccessfulStabilization: !!stabilized }
}

export function isRackUnstable(snapshot: RackStabilitySnapshot): boolean {
  return snapshot.failedAttemptsAfterLastSuccess >= 2
}

// A dormant incident is eligible to arm when its domain risk is high and its
// rack is unstable.
export function isServerIncidentEligible(
  definition: ServerIncidentDefinition,
  incidentState: ServerIncidentState,
  actualRiskLevel: RiskLevel,
  rackSnapshot: RackStabilitySnapshot,
): boolean {
  return incidentState.status === 'dormant' && isHighOrAbove(actualRiskLevel) && isRackUnstable(rackSnapshot)
}

// --- Threat state machine (per incident) ------------------------------------

export interface ServerIncidentThreatRuleContext {
  currentWorkdayIndex: number
  incidentState: ServerIncidentState
  actualRiskLevel: RiskLevel
  rackUnstable: boolean
}

export interface ServerIncidentThreatTransition {
  status: ServerIncidentStatus
  armedAtWorkdayIndex?: number
  dueWorkdayIndex?: number
  changed: boolean
}

// Only dormant/armed are governed here (later stages are driven by the scene and
// recovery). resolved and every post-arming status are final for this machine.
export function reconcileServerIncidentThreatRules(ctx: ServerIncidentThreatRuleContext): ServerIncidentThreatTransition {
  const s = ctx.incidentState
  const keep = (): ServerIncidentThreatTransition => ({
    status: s.status,
    armedAtWorkdayIndex: s.armedAtWorkdayIndex,
    dueWorkdayIndex: s.dueWorkdayIndex,
    changed: false,
  })
  const eligible = isHighOrAbove(ctx.actualRiskLevel) && ctx.rackUnstable

  if (s.status === 'dormant') {
    if (!eligible) return keep()
    return { status: 'armed', armedAtWorkdayIndex: ctx.currentWorkdayIndex, dueWorkdayIndex: ctx.currentWorkdayIndex + SERVER_INCIDENT_DELAY_DAYS, changed: true }
  }
  if (s.status === 'armed') {
    if (!eligible) return { status: 'dormant', changed: true } // risk dropped or rack stabilised
    if (s.dueWorkdayIndex !== undefined && ctx.currentWorkdayIndex >= s.dueWorkdayIndex) {
      return { status: 'pending', armedAtWorkdayIndex: s.armedAtWorkdayIndex, dueWorkdayIndex: s.dueWorkdayIndex, changed: true }
    }
    return keep()
  }
  return keep()
}

// --- Priority queue ---------------------------------------------------------

export function getNextPendingServerIncident(incidentStates: ServerIncidentState[]): ServerIncidentState | undefined {
  for (const id of SERVER_INCIDENT_PRIORITY) {
    const found = incidentStates.find((s) => s.incidentId === id && s.status === 'pending')
    if (found) return found
  }
  return undefined
}

export function isServerIncidentBlocking(state: ServerIncidentState): boolean {
  return state.status === 'pending' || state.status === 'running'
}

export function anyServerIncidentBlocking(incidentStates: ServerIncidentState[]): boolean {
  return incidentStates.some(isServerIncidentBlocking)
}

// --- Costs & effort ---------------------------------------------------------

export function getServerIncidentImmediateCost(incidentId: ServerIncidentId, hasSecuritySpecialistAtIncident: boolean): number {
  const def = getServerIncident(incidentId)!
  return hasSecuritySpecialistAtIncident ? def.immediateCostWithSecuritySpecialist : def.immediateCostWithoutSecuritySpecialist
}

export function getServerRecoveryEffort(incidentId: ServerIncidentId, hasSecuritySpecialistAtIncident: boolean): number {
  const def = getServerIncident(incidentId)!
  return hasSecuritySpecialistAtIncident ? def.recoveryEffortWithSecuritySpecialist : def.recoveryEffortWithoutSecuritySpecialist
}

export function getServerDowntimeCost(incidentId: ServerIncidentId): number {
  return getServerIncident(incidentId)!.downtimeCostPerDay
}

export function getRemainingServerRecoveryEffort(state: ServerIncidentState): number {
  return Math.max(0, getServerRecoveryEffort(state.incidentId, state.hadSecuritySpecialistAtIncident === true) - state.recoveryProgressDays)
}

export function serverRecoveryWorkdayId(sprintNumber: number, day: number): string {
  return `server-recovery-work:sprint-${sprintNumber}:day-${day}`
}

// --- One-security-work rule (findings / access control / server recovery) ---

export type SecurityWorkAssignment =
  | { kind: 'finding'; id: string }
  | { kind: 'access-control'; id: 'access-control' }
  | { kind: 'server-recovery'; id: ServerIncidentId }

// The single security work an employee is occupied by across all three systems.
// Keeps the "one security task per employee per day" rule consistent.
export function getEmployeeActiveSecurityWork(
  employeeId: string,
  findingStates: SecurityFindingState[],
  accessControlState: AccessControlState,
  serverIncidentStates: ServerIncidentState[],
): SecurityWorkAssignment | undefined {
  const recovery = serverIncidentStates.find(
    (s) => (s.status === 'recovery-required' || s.status === 'recovering') && s.assignedEmployeeId === employeeId,
  )
  if (recovery) return { kind: 'server-recovery', id: recovery.incidentId }
  if (
    accessControlState.assignedEmployeeId === employeeId &&
    (accessControlState.proposalStatus === 'approved' || accessControlState.proposalStatus === 'in-progress')
  ) {
    return { kind: 'access-control', id: 'access-control' }
  }
  const finding = getEmployeeActiveSecurityFinding(findingStates, employeeId)
  return finding ? { kind: 'finding', id: finding.findingId } : undefined
}

export interface ServerRecoveryAssignmentContext {
  incidentId: ServerIncidentId
  employeeId: string
  incidentState: ServerIncidentState
  findingStates: SecurityFindingState[]
  accessControlState: AccessControlState
  serverIncidentStates: ServerIncidentState[]
  hasIlya: boolean
  auditBlocking: boolean
}

export type ServerRecoveryAssignmentReason =
  | 'not-in-recovery'
  | 'not-eligible'
  | 'ilya-not-hired'
  | 'employee-busy'
  | 'audit-in-progress'

export interface ServerRecoveryAssignmentValidation {
  allowed: boolean
  reason?: ServerRecoveryAssignmentReason
}

export function canAssignServerRecovery(ctx: ServerRecoveryAssignmentContext): ServerRecoveryAssignmentValidation {
  const def = getServerIncident(ctx.incidentId)
  if (!def) return { allowed: false, reason: 'not-eligible' }
  if (ctx.incidentState.status !== 'recovery-required' && ctx.incidentState.status !== 'recovering') return { allowed: false, reason: 'not-in-recovery' }
  if (!def.eligibleEmployeeIds.includes(ctx.employeeId)) return { allowed: false, reason: 'not-eligible' }
  if (ctx.employeeId === 'ilya-vlasov' && !ctx.hasIlya) return { allowed: false, reason: 'ilya-not-hired' }
  if (ctx.auditBlocking) return { allowed: false, reason: 'audit-in-progress' }
  // busy with OTHER security work (a different finding / access control / another recovery)
  const active = getEmployeeActiveSecurityWork(ctx.employeeId, ctx.findingStates, ctx.accessControlState, ctx.serverIncidentStates)
  if (active && !(active.kind === 'server-recovery' && active.id === ctx.incidentId)) return { allowed: false, reason: 'employee-busy' }
  return { allowed: true }
}

// --- Persistence normalisation ----------------------------------------------

const STATUSES: ServerIncidentStatus[] = ['dormant', 'armed', 'pending', 'running', 'recovery-required', 'recovering', 'resolved']

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

function normalizeOne(def: ServerIncidentDefinition, raw: Record<string, unknown> | undefined): ServerIncidentState {
  if (!raw) return initialServerIncidentState(def.id)
  let status = STATUSES.includes(raw.status as ServerIncidentStatus) ? (raw.status as ServerIncidentStatus) : 'dormant'
  if (status === 'running') status = 'pending' // interrupted by a reload

  const hadSpecialist = typeof raw.hadSecuritySpecialistAtIncident === 'boolean' ? raw.hadSecuritySpecialistAtIncident : undefined
  const effort = getServerRecoveryEffort(def.id, hadSpecialist === true)
  const rawProgress = typeof raw.recoveryProgressDays === 'number' && Number.isFinite(raw.recoveryProgressDays) ? Math.floor(raw.recoveryProgressDays) : 0
  const recoveryProgressDays = Math.min(effort, Math.max(0, rawProgress))

  const armedAtWorkdayIndex = validIndex(raw.armedAtWorkdayIndex)
  let dueWorkdayIndex = validIndex(raw.dueWorkdayIndex)
  if (dueWorkdayIndex !== undefined && armedAtWorkdayIndex !== undefined && dueWorkdayIndex < armedAtWorkdayIndex) dueWorkdayIndex = armedAtWorkdayIndex + SERVER_INCIDENT_DELAY_DAYS
  if ((status === 'armed' || status === 'pending') && dueWorkdayIndex === undefined) status = 'dormant'

  const resolvedAt = validMoment(raw.resolvedAt)
  if (status === 'resolved' && !resolvedAt) status = 'recovery-required'

  const assignedEmployeeId =
    (status === 'recovery-required' || status === 'recovering') && typeof raw.assignedEmployeeId === 'string' ? raw.assignedEmployeeId : undefined

  const state: ServerIncidentState = { incidentId: def.id, status, recoveryProgressDays, effectsApplied: raw.effectsApplied === true }
  if ((status === 'armed' || status === 'pending') && armedAtWorkdayIndex !== undefined) state.armedAtWorkdayIndex = armedAtWorkdayIndex
  if ((status === 'armed' || status === 'pending') && dueWorkdayIndex !== undefined) state.dueWorkdayIndex = dueWorkdayIndex
  const triggeredAt = validMoment(raw.triggeredAt)
  if (triggeredAt) state.triggeredAt = triggeredAt
  if (status === 'resolved' && resolvedAt) state.resolvedAt = resolvedAt
  if (hadSpecialist !== undefined) state.hadSecuritySpecialistAtIncident = hadSpecialist
  if (assignedEmployeeId) state.assignedEmployeeId = assignedEmployeeId
  if (typeof raw.immediateCostTransactionId === 'string') state.immediateCostTransactionId = raw.immediateCostTransactionId
  return state
}

// Rebuild exactly the three catalog incidents from a loaded/corrupt blob.
export function normalizeServerIncidents(raw: unknown): Record<ServerIncidentId, ServerIncidentState> {
  const byId = new Map<string, Record<string, unknown>>()
  if (raw && typeof raw === 'object') {
    for (const value of Object.values(raw as Record<string, unknown>)) {
      if (value && typeof value === 'object') {
        const r = value as Record<string, unknown>
        if (typeof r.incidentId === 'string' && getServerIncident(r.incidentId)) byId.set(r.incidentId, r)
      }
    }
  }
  const out = {} as Record<ServerIncidentId, ServerIncidentState>
  for (const def of SERVER_INCIDENT_CATALOG) out[def.id] = normalizeOne(def, byId.get(def.id))
  return out
}
