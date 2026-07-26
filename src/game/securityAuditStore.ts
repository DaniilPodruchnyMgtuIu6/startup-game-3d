import { create } from 'zustand'
import { isIntroReset, useGameStore } from './gameStore'
import { useTeamStore } from './teamStore'
import { useEconomyStore } from './economyStore'
import { useSecurityStoryStore, CLOSE_FINDINGS_TASK } from './securityStoryStore'
import { isEmployeeHired } from './teamRules'
import { SECURITY_SPECIALIST_ID } from './teamCatalog'
import { toWorkdayIndex } from './workdayIndex'
import { SECURITY_BALANCE } from './balance/securityBalance'
import { useRiskStore } from './riskStore'
import { auditSignals, findingClosedSignals } from './riskSignals'
import { riskMomentAt } from './riskContext'
import type { BoardTask } from './tasks'
import {
  applySecurityWorkdayRules,
  assignFindingState,
  canAssignEmployeeToFinding,
  evaluateFollowUpAudit,
  initializeSecurityFindings,
  normalizeSecurityFindingStates,
  securityWorkdayId,
  unassignFindingState,
  type AssignmentBlockReason,
  type FollowUpAuditEvaluation,
  type FollowUpAuditRecord,
  type FollowUpAuditStatus,
  type SecurityFindingState,
  type SecurityStaffContext,
  type SecurityWorkdayRecord,
} from './securityAuditRules'

// Corrective-action plan and follow-up audits (Feature 08). Its own store and
// localStorage key so the sprint/economy/product/team/story saves are
// untouched. The scenes and the workday use-case drive the lifecycle; all math
// lives in securityAuditRules so it stays deterministic and testable.

const SECURITY_AUDIT_STORAGE_KEY = 'startup-office-security-audit'

// Department task for the approve branch (the decline branch reuses the Feature
// 06 task). Marked done when the follow-up audit is finally passed.
export const CLOSE_AUDIT_FINDINGS_TASK: BoardTask = {
  id: 'close-security-audit-findings',
  text: 'Закрыть замечания внутреннего аудита',
  done: false,
}

export interface FollowUpAuditData {
  status: FollowUpAuditStatus
  nextAuditWorkdayIndex?: number
  pendingAuditNumber?: number
  records: FollowUpAuditRecord[]
}

export interface SecurityAuditData {
  initialized: boolean
  findings: SecurityFindingState[]
  followUpAudit: FollowUpAuditData
  leadershipComplaint: boolean
  shutdownRecommendation: boolean
  workdayHistory: SecurityWorkdayRecord[]
}

export const INITIAL_SECURITY_AUDIT: SecurityAuditData = {
  initialized: false,
  findings: [],
  followUpAudit: { status: 'not-scheduled', records: [] },
  leadershipComplaint: false,
  shutdownRecommendation: false,
  workdayHistory: [],
}

// A pending or running audit must be resolved before the day/assignments move on.
export function isFollowUpAuditBlocking(followUpAudit: FollowUpAuditData): boolean {
  return followUpAudit.status === 'pending' || followUpAudit.status === 'running'
}

type StoryStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>

function safeStorage(): StoryStorage | null {
  try {
    return window.localStorage
  } catch {
    return null
  }
}

const AUDIT_STATUSES: FollowUpAuditStatus[] = ['not-scheduled', 'scheduled', 'pending', 'running', 'passed', 'critical-escalation']

function validMoment(raw: unknown): { sprintNumber: number; day: number } | undefined {
  if (!raw || typeof raw !== 'object') return undefined
  const { sprintNumber, day } = raw as Record<string, unknown>
  if (typeof sprintNumber !== 'number' || !Number.isInteger(sprintNumber) || sprintNumber < 1) return undefined
  if (typeof day !== 'number' || !Number.isInteger(day) || day < 1 || day > 10) return undefined
  return { sprintNumber, day }
}

function normalizeRecords(raw: unknown): FollowUpAuditRecord[] {
  if (!Array.isArray(raw)) return []
  const byNumber = new Map<number, FollowUpAuditRecord>()
  for (const entry of raw) {
    if (!entry || typeof entry !== 'object') continue
    const r = entry as Record<string, unknown>
    const auditNumber = r.auditNumber
    if (typeof auditNumber !== 'number' || !Number.isInteger(auditNumber) || auditNumber < 1) continue
    if (byNumber.has(auditNumber)) continue // dedupe by audit number
    const evaluatedAt = validMoment(r.evaluatedAt)
    if (!evaluatedAt) continue
    const result = r.result === 'passed' || r.result === 'failed' ? r.result : 'failed'
    byNumber.set(auditNumber, {
      auditNumber,
      evaluatedAt,
      result,
      unresolvedFindingIds: Array.isArray(r.unresolvedFindingIds) ? (r.unresolvedFindingIds.filter((x) => typeof x === 'string') as string[]) : [],
      fineAmount: typeof r.fineAmount === 'number' && r.fineAmount >= 0 ? r.fineAmount : 0,
      ...(typeof r.fineTransactionId === 'string' ? { fineTransactionId: r.fineTransactionId } : {}),
    })
  }
  return [...byNumber.values()].sort((a, b) => a.auditNumber - b.auditNumber)
}

// Coerce a loaded/corrupt blob into safe SecurityAuditData. Interrupted running
// audits become pending again; invalid pending falls back to scheduled; records
// dedupe by audit number; the economy journal stays the source of financial
// truth (fines are not re-derived here). See spec §30.
export function normalizeSecurityAuditState(raw: unknown): SecurityAuditData {
  if (!raw || typeof raw !== 'object') return { ...INITIAL_SECURITY_AUDIT }
  const r = raw as Record<string, unknown>
  if (r.initialized !== true) return { ...INITIAL_SECURITY_AUDIT }

  const findings = normalizeSecurityFindingStates(r.findings)
  const fu = (r.followUpAudit ?? {}) as Record<string, unknown>
  const records = normalizeRecords(fu.records)

  let status: FollowUpAuditStatus = AUDIT_STATUSES.includes(fu.status as FollowUpAuditStatus) ? (fu.status as FollowUpAuditStatus) : 'scheduled'
  if (status === 'running') status = 'pending' // interrupted by a reload

  const rawNext = fu.nextAuditWorkdayIndex
  const nextAuditWorkdayIndex = typeof rawNext === 'number' && Number.isInteger(rawNext) && rawNext >= 1 ? rawNext : undefined

  let pendingAuditNumber =
    typeof fu.pendingAuditNumber === 'number' && Number.isInteger(fu.pendingAuditNumber) && fu.pendingAuditNumber >= 1
      ? fu.pendingAuditNumber
      : undefined
  if (status === 'pending' && pendingAuditNumber === undefined) {
    // invalid pending -> treat as scheduled so the next completed day re-creates it
    status = 'scheduled'
  }
  if (status !== 'pending') pendingAuditNumber = undefined

  const leadershipComplaint = r.leadershipComplaint === true
  const shutdownRecommendation = r.shutdownRecommendation === true

  const workdayHistory = Array.isArray(r.workdayHistory)
    ? (r.workdayHistory.filter((w) => w && typeof w === 'object' && typeof (w as Record<string, unknown>).id === 'string') as SecurityWorkdayRecord[])
    : []

  return {
    initialized: true,
    findings,
    followUpAudit: { status, records, ...(nextAuditWorkdayIndex !== undefined ? { nextAuditWorkdayIndex } : {}), ...(pendingAuditNumber !== undefined ? { pendingAuditNumber } : {}) },
    leadershipComplaint,
    shutdownRecommendation,
    workdayHistory,
  }
}

export function loadSecurityAudit(storage: StoryStorage | null, search: string): SecurityAuditData {
  if (isIntroReset(search)) {
    storage?.removeItem(SECURITY_AUDIT_STORAGE_KEY)
    return { ...INITIAL_SECURITY_AUDIT }
  }
  if (!storage) return { ...INITIAL_SECURITY_AUDIT }
  const raw = storage.getItem(SECURITY_AUDIT_STORAGE_KEY)
  if (!raw) return { ...INITIAL_SECURITY_AUDIT }
  try {
    return normalizeSecurityAuditState(JSON.parse(raw))
  } catch {
    return { ...INITIAL_SECURITY_AUDIT }
  }
}

export function saveSecurityAudit(storage: StoryStorage | null, data: SecurityAuditData): void {
  try {
    storage?.setItem(SECURITY_AUDIT_STORAGE_KEY, JSON.stringify(data))
  } catch {
    // private mode - the audit plan simply restarts next time
  }
}

// --- Action result types ----------------------------------------------------

export interface InitializeCorrectiveActionContext {
  currentWorkdayIndex: number
  // migration: the computed old deadline is already in the past, so fire after
  // the next completed day instead of 9 days out.
  overdue?: boolean
  staffingDecision?: 'approve-security-hire' | 'decline-security-hire'
}
export interface InitializeCorrectiveActionResult {
  initialized: boolean
}
export type AssignFindingReason = AssignmentBlockReason | 'audit-in-progress' | 'not-initialized'
export interface AssignFindingResult {
  assigned: boolean
  reason?: AssignFindingReason
}
export interface ApplySecurityWorkdayResult {
  applied: boolean
  record: SecurityWorkdayRecord | null
  divertedEmployeeIds: string[]
}
export interface ScheduleAuditResult {
  scheduled: boolean
  auditNumber?: number
}
export interface ResolveFollowUpAuditResult {
  resolved: boolean
  evaluation?: FollowUpAuditEvaluation
  record?: FollowUpAuditRecord
}

interface SecurityAuditStore extends SecurityAuditData {
  // UI-only (not persisted): the audit result awaiting the player's acknowledgement.
  auditResultToAcknowledge: FollowUpAuditRecord | null

  initializeCorrectiveActionPlan: (context: InitializeCorrectiveActionContext) => InitializeCorrectiveActionResult
  assignFinding: (findingId: string, employeeId: string) => AssignFindingResult
  unassignFinding: (findingId: string) => AssignFindingResult
  applySecurityWorkday: (sprintNumber: number, day: number) => ApplySecurityWorkdayResult
  schedulePendingAuditIfDue: (sprintNumber: number, completedDay: number) => ScheduleAuditResult
  markAuditRunning: () => void
  resolvePendingAudit: (moment: { sprintNumber: number; day: number }) => ResolveFollowUpAuditResult
  markAuditFailed: () => void
  acknowledgeAuditResult: () => void
  // Feature 17B: an honest disclosure clears the complaint; an incident during
  // a quiet investigation raises it.
  clearLeadershipComplaint: () => void
  raiseLeadershipComplaint: () => void
  resetSecurityAudit: () => void
}

// Build the eligibility context from the live team (Ilya needs a real hire).
export function currentSecurityStaffContext(): SecurityStaffContext {
  const hires = useTeamStore.getState().hires
  return { hasKirill: isEmployeeHired(hires, 'kirill-morozov'), hasIlya: isEmployeeHired(hires, SECURITY_SPECIALIST_ID) }
}

function uniqueDiverted(record: SecurityWorkdayRecord): string[] {
  return [...new Set(record.results.map((r) => r.employeeId))]
}

const initial = loadSecurityAudit(safeStorage(), typeof window === 'undefined' ? '' : window.location.search)

export const useSecurityAuditStore = create<SecurityAuditStore>()((set, get) => {
  const persist = () =>
    saveSecurityAudit(safeStorage(), {
      initialized: get().initialized,
      findings: get().findings,
      followUpAudit: get().followUpAudit,
      leadershipComplaint: get().leadershipComplaint,
      shutdownRecommendation: get().shutdownRecommendation,
      workdayHistory: get().workdayHistory,
    })

  return {
    ...initial,
    auditResultToAcknowledge: null,

    initializeCorrectiveActionPlan: ({ currentWorkdayIndex, overdue, staffingDecision }) => {
      if (get().initialized) return { initialized: false } // idempotent
      // The audit lands ON the interval's last day: anchor + (interval - 1).
      const nextAuditWorkdayIndex = overdue
        ? currentWorkdayIndex
        : currentWorkdayIndex + SECURITY_BALANCE.followUpAudit.intervalWorkdays - 1
      set({
        initialized: true,
        findings: initializeSecurityFindings(),
        followUpAudit: { status: 'scheduled', nextAuditWorkdayIndex, records: [] },
        leadershipComplaint: false,
        shutdownRecommendation: false,
        workdayHistory: [],
      })
      // approve branch owns the "close audit findings" task; decline reuses F06's.
      if (staffingDecision === 'approve-security-hire') {
        const game = useGameStore.getState()
        if (!game.tasks.some((t) => t.id === CLOSE_AUDIT_FINDINGS_TASK.id)) game.addTask({ ...CLOSE_AUDIT_FINDINGS_TASK })
      }
      persist()
      return { initialized: true }
    },

    assignFinding: (findingId, employeeId) => {
      if (!get().initialized) return { assigned: false, reason: 'not-initialized' }
      if (isFollowUpAuditBlocking(get().followUpAudit)) return { assigned: false, reason: 'audit-in-progress' }
      const check = canAssignEmployeeToFinding(get().findings, findingId, employeeId, currentSecurityStaffContext())
      if (!check.allowed) return { assigned: false, reason: check.reason }
      set({ findings: assignFindingState(get().findings, findingId, employeeId) })
      persist()
      return { assigned: true }
    },

    unassignFinding: (findingId) => {
      if (!get().initialized) return { assigned: false, reason: 'not-initialized' }
      if (isFollowUpAuditBlocking(get().followUpAudit)) return { assigned: false, reason: 'audit-in-progress' }
      set({ findings: unassignFindingState(get().findings, findingId) })
      persist()
      return { assigned: true }
    },

    applySecurityWorkday: (sprintNumber, day) => {
      if (!get().initialized) return { applied: false, record: null, divertedEmployeeIds: [] }
      const id = securityWorkdayId(sprintNumber, day)
      const existing = get().workdayHistory.find((w) => w.id === id)
      if (existing) return { applied: false, record: existing, divertedEmployeeIds: uniqueDiverted(existing) } // idempotent
      const calc = applySecurityWorkdayRules(get().findings, { sprintNumber, day })
      const record: SecurityWorkdayRecord = { id, ...calc.record }
      set({ findings: calc.states, workdayHistory: [...get().workdayHistory, record] })
      persist()
      // Feature 09: each finding first closed today produces a mitigation signal.
      const moment = riskMomentAt(sprintNumber, day)
      for (const r of calc.record.results) {
        if (r.closedFinding) useRiskStore.getState().addSignalsOnce(findingClosedSignals(r.findingId, moment))
      }
      return { applied: true, record, divertedEmployeeIds: calc.divertedEmployeeIds }
    },

    schedulePendingAuditIfDue: (sprintNumber, completedDay) => {
      const fu = get().followUpAudit
      if (fu.status !== 'scheduled' || fu.nextAuditWorkdayIndex === undefined) return { scheduled: false }
      const completedIndex = toWorkdayIndex(sprintNumber, completedDay)
      if (completedIndex < fu.nextAuditWorkdayIndex) return { scheduled: false }
      const auditNumber = fu.records.length + 1
      set({ followUpAudit: { ...fu, status: 'pending', pendingAuditNumber: auditNumber } })
      persist()
      return { scheduled: true, auditNumber }
    },

    markAuditRunning: () => {
      const fu = get().followUpAudit
      if (fu.status !== 'pending') return
      set({ followUpAudit: { ...fu, status: 'running' } })
      persist()
    },

    resolvePendingAudit: (moment) => {
      const fu = get().followUpAudit
      if (fu.status !== 'pending' && fu.status !== 'running') return { resolved: false }
      const auditNumber = fu.pendingAuditNumber ?? fu.records.length + 1
      // dedupe: a record for this audit number already exists -> already resolved
      const already = fu.records.find((rec) => rec.auditNumber === auditNumber)
      if (already) {
        set({ followUpAudit: { ...fu, status: already.result === 'passed' ? 'passed' : fu.status }, auditResultToAcknowledge: already })
        return { resolved: false, record: already }
      }

      const evaluation = evaluateFollowUpAudit(get().findings, auditNumber)
      let fineTransactionId: string | undefined
      if (!evaluation.passed && evaluation.fineAmount > 0) {
        const fine = useEconomyStore.getState().applyAuditFine(auditNumber, evaluation.fineAmount, moment.sprintNumber, moment.day)
        fineTransactionId = fine.transaction.id
      }

      const record: FollowUpAuditRecord = {
        auditNumber,
        evaluatedAt: moment,
        result: evaluation.passed ? 'passed' : 'failed',
        unresolvedFindingIds: evaluation.unresolvedFindingIds,
        fineAmount: evaluation.fineAmount,
        ...(fineTransactionId ? { fineTransactionId } : {}),
      }

      // next status + deadline
      let status: FollowUpAuditStatus
      let nextAuditWorkdayIndex: number | undefined = fu.nextAuditWorkdayIndex
      if (evaluation.passed) {
        status = 'passed'
        nextAuditWorkdayIndex = undefined
      } else if (evaluation.shutdownRecommendation) {
        status = 'critical-escalation'
        nextAuditWorkdayIndex = undefined
      } else {
        status = 'scheduled'
        nextAuditWorkdayIndex = toWorkdayIndex(moment.sprintNumber, moment.day) + SECURITY_BALANCE.followUpAudit.intervalWorkdays
      }

      set({
        followUpAudit: { status, records: [...fu.records, record], ...(nextAuditWorkdayIndex !== undefined ? { nextAuditWorkdayIndex } : {}) },
        leadershipComplaint: get().leadershipComplaint || evaluation.leadershipComplaint,
        shutdownRecommendation: get().shutdownRecommendation || evaluation.shutdownRecommendation,
        auditResultToAcknowledge: record,
      })

      // passed -> close the branch department task (approve vs decline)
      if (evaluation.passed) {
        const decision = useSecurityStoryStore.getState().postAuditConversation.staffingDecision
        const taskId = decision === 'decline-security-hire' ? CLOSE_FINDINGS_TASK.id : CLOSE_AUDIT_FINDINGS_TASK.id
        useGameStore.getState().completeTask(taskId)
      }
      // Feature 09: the audit outcome moves governance risk (a third failure is
      // an immediate critical escalation). Idempotent by signal id.
      useRiskStore.getState().addSignalsOnce(auditSignals(auditNumber, evaluation.passed, riskMomentAt(moment.sprintNumber, moment.day)))
      persist()
      return { resolved: true, evaluation, record }
    },

    markAuditFailed: () => {
      const fu = get().followUpAudit
      if (fu.status !== 'running') return
      set({ followUpAudit: { ...fu, status: 'pending' } })
      persist()
    },

    acknowledgeAuditResult: () => set({ auditResultToAcknowledge: null }),

    clearLeadershipComplaint: () => {
      if (!get().leadershipComplaint) return
      set({ leadershipComplaint: false })
      persist()
    },

    raiseLeadershipComplaint: () => {
      if (get().leadershipComplaint) return
      set({ leadershipComplaint: true })
      persist()
    },

    resetSecurityAudit: () => {
      set({ ...INITIAL_SECURITY_AUDIT, auditResultToAcknowledge: null })
      persist()
    },
  }
})
