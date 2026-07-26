import { SECURITY_FINDING_CATALOG, getSecurityFinding, type SecurityFindingDefinition } from './securityFindingCatalog'
import { SECURITY_BALANCE } from './balance/securityBalance'

// Pure, deterministic rules for the corrective-action plan and follow-up audits
// (Feature 08). No Zustand, no side effects, no real time - eligibility,
// per-day progress, audit evaluation, fines and persistence normalisation, all
// unit-testable. One confirmed day = at most one day of progress per employee.

// --- Finding & audit state --------------------------------------------------

export type SecurityFindingStatus = 'open' | 'in-progress' | 'closed'

export interface SecurityFindingState {
  findingId: string
  status: SecurityFindingStatus
  progressDays: number
  assignedEmployeeId?: string
  closedAt?: { sprintNumber: number; day: number }
}

export type FollowUpAuditStatus =
  | 'not-scheduled'
  | 'scheduled'
  | 'pending'
  | 'running'
  | 'passed'
  | 'critical-escalation'

export interface FollowUpAuditRecord {
  auditNumber: number
  evaluatedAt: { sprintNumber: number; day: number }
  result: 'passed' | 'failed'
  unresolvedFindingIds: string[]
  fineAmount: number
  fineTransactionId?: string
}

export interface SecurityWorkdayEmployeeResult {
  employeeId: string
  findingId: string
  beforeProgressDays: number
  afterProgressDays: number
  closedFinding: boolean
}

export interface SecurityWorkdayRecord {
  id: string
  sprintNumber: number
  day: number
  results: SecurityWorkdayEmployeeResult[]
}

// --- Initialisation ---------------------------------------------------------

export function initializeSecurityFindings(): SecurityFindingState[] {
  return SECURITY_FINDING_CATALOG.map((f) => ({ findingId: f.id, status: 'open', progressDays: 0 }))
}

function effortOf(findingId: string): number {
  return getSecurityFinding(findingId)?.effortDays ?? 0
}

export function getRemainingSecurityEffort(state: SecurityFindingState): number {
  return Math.max(0, effortOf(state.findingId) - state.progressDays)
}

export function allSecurityFindingsClosed(states: SecurityFindingState[]): boolean {
  return states.length > 0 && states.every((s) => s.status === 'closed')
}

export function getUnresolvedFindingIds(states: SecurityFindingState[]): string[] {
  return states.filter((s) => s.status !== 'closed').map((s) => s.findingId)
}

// --- Assignment eligibility -------------------------------------------------

// Sonya is the always-present PM; Kirill and Ilya are eligible ONLY with a real
// hire record (approve alone is not enough for Ilya). Alina is never eligible.
export interface SecurityStaffContext {
  hasKirill: boolean
  hasIlya: boolean
}

export function isSecurityEmployeeAvailable(employeeId: string, ctx: SecurityStaffContext): boolean {
  if (employeeId === 'sonya-sokolova') return true
  if (employeeId === 'kirill-morozov') return ctx.hasKirill
  if (employeeId === 'ilya-vlasov') return ctx.hasIlya
  return false
}

// Employees that may be offered for a finding: in its catalog eligibility list
// and actually available on the current team.
export function getEligibleEmployeesForFinding(findingId: string, ctx: SecurityStaffContext): string[] {
  const def = getSecurityFinding(findingId)
  if (!def) return []
  return def.eligibleEmployeeIds.filter((id) => isSecurityEmployeeAvailable(id, ctx))
}

// The single non-closed finding an employee is currently working on (if any).
export function getEmployeeActiveSecurityFinding(
  states: SecurityFindingState[],
  employeeId: string,
): SecurityFindingState | undefined {
  return states.find((s) => s.status !== 'closed' && s.assignedEmployeeId === employeeId)
}

export function getEmployeesAssignedToSecurity(states: SecurityFindingState[]): string[] {
  const seen = new Set<string>()
  const ids: string[] = []
  for (const s of states) {
    if (s.status === 'closed' || !s.assignedEmployeeId) continue
    if (seen.has(s.assignedEmployeeId)) continue
    seen.add(s.assignedEmployeeId)
    ids.push(s.assignedEmployeeId)
  }
  return ids
}

export type AssignmentBlockReason =
  | 'unknown-finding'
  | 'finding-closed'
  | 'not-eligible'
  | 'employee-busy'

export interface AssignmentValidation {
  allowed: boolean
  reason?: AssignmentBlockReason
}

// A finding may be assigned an eligible, available employee who is not already
// occupied by ANOTHER non-closed finding (one task per employee). Re-selecting
// the employee already on this finding is allowed (idempotent).
export function canAssignEmployeeToFinding(
  findingStates: SecurityFindingState[],
  findingId: string,
  employeeId: string,
  ctx: SecurityStaffContext,
): AssignmentValidation {
  const state = findingStates.find((s) => s.findingId === findingId)
  if (!state || !getSecurityFinding(findingId)) return { allowed: false, reason: 'unknown-finding' }
  if (state.status === 'closed') return { allowed: false, reason: 'finding-closed' }
  if (!getEligibleEmployeesForFinding(findingId, ctx).includes(employeeId)) return { allowed: false, reason: 'not-eligible' }
  const busy = getEmployeeActiveSecurityFinding(findingStates, employeeId)
  if (busy && busy.findingId !== findingId) return { allowed: false, reason: 'employee-busy' }
  return { allowed: true }
}

// --- Assignment mutations (pure) --------------------------------------------

function replaceState(states: SecurityFindingState[], next: SecurityFindingState): SecurityFindingState[] {
  return states.map((s) => (s.findingId === next.findingId ? next : s))
}

export function assignFindingState(
  states: SecurityFindingState[],
  findingId: string,
  employeeId: string,
): SecurityFindingState[] {
  const state = states.find((s) => s.findingId === findingId)
  if (!state || state.status === 'closed') return states
  return replaceState(states, { ...state, assignedEmployeeId: employeeId })
}

export function unassignFindingState(states: SecurityFindingState[], findingId: string): SecurityFindingState[] {
  const state = states.find((s) => s.findingId === findingId)
  if (!state || !state.assignedEmployeeId) return states
  const { assignedEmployeeId: _drop, ...rest } = state
  return replaceState(states, { ...rest })
}

// --- Daily security progress ------------------------------------------------

export interface SecurityWorkdayContext {
  sprintNumber: number
  day: number
}

export interface SecurityWorkdayCalculation {
  states: SecurityFindingState[]
  record: Omit<SecurityWorkdayRecord, 'id'>
  divertedEmployeeIds: string[]
}

export function securityWorkdayId(sprintNumber: number, day: number): string {
  return `security-work:sprint-${sprintNumber}:day-${day}`
}

// One working day: every non-closed finding with an assignee advances by one
// day (clamped to its effort), closing on completion (which frees its assignee).
export function applySecurityWorkdayRules(
  findingStates: SecurityFindingState[],
  ctx: SecurityWorkdayContext,
): SecurityWorkdayCalculation {
  let current = findingStates
  const results: SecurityWorkdayEmployeeResult[] = []
  const divertedEmployeeIds: string[] = []

  // catalog order keeps the calculation deterministic
  for (const def of SECURITY_FINDING_CATALOG) {
    const state = current.find((s) => s.findingId === def.id)
    if (!state || state.status === 'closed' || !state.assignedEmployeeId) continue
    const employeeId = state.assignedEmployeeId
    const before = state.progressDays
    const after = Math.min(def.effortDays, before + 1)
    const closed = after >= def.effortDays
    const next: SecurityFindingState = closed
      ? { findingId: def.id, status: 'closed', progressDays: after, closedAt: { sprintNumber: ctx.sprintNumber, day: ctx.day } }
      : { ...state, status: 'in-progress', progressDays: after }
    current = replaceState(current, next)
    results.push({ employeeId, findingId: def.id, beforeProgressDays: before, afterProgressDays: after, closedFinding: closed })
    divertedEmployeeIds.push(employeeId)
  }

  return { states: current, record: { sprintNumber: ctx.sprintNumber, day: ctx.day, results }, divertedEmployeeIds }
}

// --- Follow-up audit evaluation ---------------------------------------------

export const SECURITY_AUDIT_FINE_BY_NUMBER: Record<number, number> = SECURITY_BALANCE.followUpAudit.fineRubByAuditNumber

export function getSecurityAuditFine(auditNumber: number): number {
  return SECURITY_AUDIT_FINE_BY_NUMBER[auditNumber] ?? 0
}

export interface FollowUpAuditEvaluation {
  passed: boolean
  unresolvedFindingIds: string[]
  fineAmount: number
  leadershipComplaint: boolean
  shutdownRecommendation: boolean
}

export function evaluateFollowUpAudit(findingStates: SecurityFindingState[], auditNumber: number): FollowUpAuditEvaluation {
  const unresolvedFindingIds = getUnresolvedFindingIds(findingStates)
  if (unresolvedFindingIds.length === 0) {
    return { passed: true, unresolvedFindingIds: [], fineAmount: 0, leadershipComplaint: false, shutdownRecommendation: false }
  }
  return {
    passed: false,
    unresolvedFindingIds,
    fineAmount: getSecurityAuditFine(auditNumber),
    leadershipComplaint: auditNumber >= 2,
    shutdownRecommendation: auditNumber >= 3,
  }
}

// --- Persistence normalisation ----------------------------------------------

const FINDING_STATUSES: SecurityFindingStatus[] = ['open', 'in-progress', 'closed']
const VALID_ASSIGNEES = new Set(['sonya-sokolova', 'kirill-morozov', 'ilya-vlasov'])

function validMoment(raw: unknown): { sprintNumber: number; day: number } | undefined {
  if (!raw || typeof raw !== 'object') return undefined
  const { sprintNumber, day } = raw as Record<string, unknown>
  if (typeof sprintNumber !== 'number' || !Number.isInteger(sprintNumber) || sprintNumber < 1) return undefined
  if (typeof day !== 'number' || !Number.isInteger(day) || day < 1 || day > 10) return undefined
  return { sprintNumber, day }
}

function sanitizeFinding(def: SecurityFindingDefinition, raw: Record<string, unknown> | undefined): SecurityFindingState {
  if (!raw) return { findingId: def.id, status: 'open', progressDays: 0 }
  const rawProgress = typeof raw.progressDays === 'number' && Number.isFinite(raw.progressDays) ? Math.floor(raw.progressDays) : 0
  const progressDays = Math.min(def.effortDays, Math.max(0, rawProgress))
  let status: SecurityFindingStatus = FINDING_STATUSES.includes(raw.status as SecurityFindingStatus)
    ? (raw.status as SecurityFindingStatus)
    : 'open'
  // keep status/progress consistent
  if (progressDays >= def.effortDays) status = 'closed'
  else if (status === 'closed') status = progressDays > 0 ? 'in-progress' : 'open'

  const state: SecurityFindingState = { findingId: def.id, status, progressDays }
  const assignee = typeof raw.assignedEmployeeId === 'string' && VALID_ASSIGNEES.has(raw.assignedEmployeeId) ? raw.assignedEmployeeId : undefined
  if (assignee && status !== 'closed') state.assignedEmployeeId = assignee
  const closedAt = validMoment(raw.closedAt)
  if (status === 'closed') state.closedAt = closedAt ?? { sprintNumber: 1, day: 1 }
  return state
}

// Rebuild a complete, valid finding-state list (one per catalog finding).
// Unknown ids dropped, progress clamped, closed findings unassigned, and any
// employee assigned to more than one finding keeps only the first (catalog
// order), the rest cleared.
export function normalizeSecurityFindingStates(raw: unknown): SecurityFindingState[] {
  const byId = new Map<string, Record<string, unknown>>()
  if (Array.isArray(raw)) {
    for (const entry of raw) {
      if (!entry || typeof entry !== 'object') continue
      const r = entry as Record<string, unknown>
      if (typeof r.findingId === 'string' && getSecurityFinding(r.findingId) && !byId.has(r.findingId)) byId.set(r.findingId, r)
    }
  }
  const states = SECURITY_FINDING_CATALOG.map((def) => sanitizeFinding(def, byId.get(def.id)))

  // one employee -> one finding: keep the first assignment in catalog order
  const claimed = new Set<string>()
  return states.map((s) => {
    if (!s.assignedEmployeeId) return s
    if (claimed.has(s.assignedEmployeeId)) {
      const { assignedEmployeeId: _drop, ...rest } = s
      return { ...rest }
    }
    claimed.add(s.assignedEmployeeId)
    return s
  })
}
