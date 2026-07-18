import { create } from 'zustand'
import { isIntroReset, useGameStore } from './gameStore'
import { useEconomyStore } from './economyStore'
import { useRiskStore } from './riskStore'
import { useTeamStore } from './teamStore'
import { useSecurityAuditStore, isFollowUpAuditBlocking } from './securityAuditStore'
import { hasSecuritySpecialist } from './teamRules'
import { getDetectedRiskLevel } from './riskRules'
import { createSecurityInvestmentTransaction, createSecurityIncidentTransaction } from './economyRules'
import { accessControlActiveSignals, accessControlPostponedSignals, officeIntrusionSignals } from './riskSignals'
import { riskMomentAt } from './riskContext'
import type { BoardTask } from './tasks'
import type { StoryMoment } from './securityStoryRules'
import {
  INITIAL_ACCESS_CONTROL,
  INITIAL_INTRUSION,
  accessControlWorkdayId,
  canAssignAccessControlEmployee,
  getAccessControlEffortDays,
  getOfficeIntrusionResponseCost,
  normalizeAccessControlState,
  normalizeIntrusionState,
  reconcileIntrusionThreatRules,
  type AccessControlAssigneeId,
  type AccessControlAssignmentReason,
  type AccessControlState,
  type IntrusionThreatContext,
  type IntrusionThreatTransition,
  type OfficeIntrusionState,
} from './accessControlRules'

// Access-control initiative + office-intrusion threat state (Feature 10). Its
// own store and localStorage key. The scenes and the workday use-case drive the
// lifecycle; all math lives in accessControlRules. Money, tasks and risk signals
// are applied idempotently through the existing stores.

const ACCESS_CONTROL_STORAGE_KEY = 'startup-office-access-control-v10'

export const REVIEW_ACCESS_CONTROL_TASK: BoardTask = { id: 'review-office-access-control', text: 'Рассмотреть внедрение СКУД', done: false }
export const IMPLEMENT_ACCESS_CONTROL_TASK: BoardTask = { id: 'implement-office-access-control', text: 'Внедрить систему контроля доступа', done: false }
export const REVIEW_ACCESS_LOGS_TASK: BoardTask = { id: 'review-access-logs-after-intrusion', text: 'Проверить доступы и журналы после проникновения', done: false }

export interface AccessControlWorkdayRecord {
  id: string
  sprintNumber: number
  day: number
  employeeId: AccessControlAssigneeId
  beforeProgress: number
  afterProgress: number
  activated: boolean
}

export interface AccessControlData {
  accessControl: AccessControlState
  intrusion: OfficeIntrusionState
  workdayHistory: AccessControlWorkdayRecord[]
}

export const INITIAL_ACCESS_CONTROL_DATA: AccessControlData = {
  accessControl: { ...INITIAL_ACCESS_CONTROL },
  intrusion: { ...INITIAL_INTRUSION },
  workdayHistory: [],
}

type Storage = Pick<globalThis.Storage, 'getItem' | 'setItem' | 'removeItem'>
function safeStorage(): Storage | null {
  try {
    return window.localStorage
  } catch {
    return null
  }
}

function detectedOfficeAccessLevel() {
  return getDetectedRiskLevel(useRiskStore.getState().signals, 'office-access')
}

export function loadAccessControl(storage: Storage | null, search: string): AccessControlData {
  if (isIntroReset(search)) {
    storage?.removeItem(ACCESS_CONTROL_STORAGE_KEY)
    return { accessControl: { ...INITIAL_ACCESS_CONTROL }, intrusion: { ...INITIAL_INTRUSION }, workdayHistory: [] }
  }
  if (!storage) return { accessControl: { ...INITIAL_ACCESS_CONTROL }, intrusion: { ...INITIAL_INTRUSION }, workdayHistory: [] }
  const raw = storage.getItem(ACCESS_CONTROL_STORAGE_KEY)
  if (!raw) return { accessControl: { ...INITIAL_ACCESS_CONTROL }, intrusion: { ...INITIAL_INTRUSION }, workdayHistory: [] }
  try {
    const parsed = JSON.parse(raw) as { accessControl?: unknown; intrusion?: unknown; workdayHistory?: unknown }
    const workdayHistory = Array.isArray(parsed.workdayHistory)
      ? (parsed.workdayHistory.filter((w) => w && typeof w === 'object' && typeof (w as Record<string, unknown>).id === 'string') as AccessControlWorkdayRecord[])
      : []
    return {
      accessControl: normalizeAccessControlState(parsed.accessControl, detectedOfficeAccessLevel()),
      intrusion: normalizeIntrusionState(parsed.intrusion),
      workdayHistory,
    }
  } catch {
    return { accessControl: { ...INITIAL_ACCESS_CONTROL }, intrusion: { ...INITIAL_INTRUSION }, workdayHistory: [] }
  }
}

export function saveAccessControl(storage: Storage | null, data: AccessControlData): void {
  try {
    storage?.setItem(ACCESS_CONTROL_STORAGE_KEY, JSON.stringify(data))
  } catch {
    // private mode - restarts fresh next time
  }
}

// --- Result types -----------------------------------------------------------

export interface AccessControlDecisionResult {
  applied: boolean
}
export interface AccessControlAssignmentResult {
  assigned: boolean
  reason?: AccessControlAssignmentReason
}
export interface ApplyAccessControlWorkdayResult {
  applied: boolean
  record: AccessControlWorkdayRecord | null
  activated: boolean
}
export interface ResolveOfficeIntrusionResult {
  resolved: boolean
  hadSecuritySpecialist?: boolean
  cost?: number
}

interface AccessControlStore extends AccessControlData {
  intrusionResultToAcknowledge: OfficeIntrusionState | null

  unlockProposal: () => void
  postponeAccessControl: (moment: StoryMoment) => AccessControlDecisionResult
  approveAccessControl: (moment: StoryMoment) => AccessControlDecisionResult
  assignAccessControlImplementation: (employeeId: AccessControlAssigneeId) => AccessControlAssignmentResult
  unassignAccessControlImplementation: () => void
  applyAccessControlWorkday: (sprintNumber: number, day: number) => ApplyAccessControlWorkdayResult
  reconcileIntrusionThreat: (context: IntrusionThreatContext) => IntrusionThreatTransition
  markIntrusionRunning: (moment: StoryMoment, hasSecuritySpecialist: boolean) => void
  resolveIntrusion: (moment: StoryMoment, hasSecuritySpecialist: boolean) => ResolveOfficeIntrusionResult
  markIntrusionFailed: () => void
  acknowledgeIntrusionResult: () => void
  resetAccessControl: () => void
}

function addTaskOnce(task: BoardTask): void {
  const game = useGameStore.getState()
  if (!game.tasks.some((t) => t.id === task.id)) game.addTask({ ...task })
}

const initial = loadAccessControl(safeStorage(), typeof window === 'undefined' ? '' : window.location.search)

export const useAccessControlStore = create<AccessControlStore>()((set, get) => {
  const persist = () =>
    saveAccessControl(safeStorage(), { accessControl: get().accessControl, intrusion: get().intrusion, workdayHistory: get().workdayHistory })

  return {
    ...initial,
    intrusionResultToAcknowledge: null,

    unlockProposal: () => {
      if (get().accessControl.proposalStatus !== 'locked') return
      set({ accessControl: { ...get().accessControl, proposalStatus: 'available' } })
      addTaskOnce(REVIEW_ACCESS_CONTROL_TASK)
      persist()
    },

    postponeAccessControl: (moment) => {
      const ac = get().accessControl
      if (ac.proposalStatus !== 'available' && ac.proposalStatus !== 'postponed') return { applied: false }
      const first = ac.proposalStatus === 'available'
      set({ accessControl: { ...ac, proposalStatus: 'postponed' } })
      useGameStore.getState().completeTask(REVIEW_ACCESS_CONTROL_TASK.id)
      if (first) useRiskStore.getState().addSignalsOnce(accessControlPostponedSignals(riskMomentAt(moment.sprintNumber, moment.day)))
      persist()
      return { applied: first }
    },

    approveAccessControl: (moment) => {
      const ac = get().accessControl
      if (ac.proposalStatus !== 'available' && ac.proposalStatus !== 'postponed') return { applied: false }
      const purchase = useEconomyStore.getState().applyOneTimeExpense(createSecurityInvestmentTransaction(moment.sprintNumber, moment.day))
      set({ accessControl: { ...ac, proposalStatus: 'approved', approvedAt: moment, purchaseTransactionId: purchase.transaction.id } })
      useGameStore.getState().completeTask(REVIEW_ACCESS_CONTROL_TASK.id)
      addTaskOnce(IMPLEMENT_ACCESS_CONTROL_TASK)
      persist()
      return { applied: true }
    },

    assignAccessControlImplementation: (employeeId) => {
      const ac = get().accessControl
      const validation = canAssignAccessControlEmployee({
        employeeId,
        proposalStatus: ac.proposalStatus,
        hasIlya: hasSecuritySpecialist(useTeamStore.getState().hires),
        findingStates: useSecurityAuditStore.getState().findings,
        auditBlocking: isFollowUpAuditBlocking(useSecurityAuditStore.getState().followUpAudit),
      })
      if (!validation.allowed) return { assigned: false, reason: validation.reason }
      set({ accessControl: { ...ac, assignedEmployeeId: employeeId } })
      persist()
      return { assigned: true }
    },

    unassignAccessControlImplementation: () => {
      const ac = get().accessControl
      if (!ac.assignedEmployeeId) return
      const { assignedEmployeeId: _drop, ...rest } = ac
      set({ accessControl: { ...rest } })
      persist()
    },

    applyAccessControlWorkday: (sprintNumber, day) => {
      const id = accessControlWorkdayId(sprintNumber, day)
      const existing = get().workdayHistory.find((w) => w.id === id)
      if (existing) return { applied: false, record: existing, activated: existing.activated }
      const ac = get().accessControl
      if ((ac.proposalStatus !== 'approved' && ac.proposalStatus !== 'in-progress') || !ac.assignedEmployeeId) {
        return { applied: false, record: null, activated: false }
      }
      const employeeId = ac.assignedEmployeeId
      const effort = getAccessControlEffortDays(employeeId)
      const before = ac.progressDays
      const after = Math.min(effort, before + 1)
      const activated = after >= effort
      const record: AccessControlWorkdayRecord = { id, sprintNumber, day, employeeId, beforeProgress: before, afterProgress: after, activated }

      if (activated) {
        set({
          accessControl: { ...ac, proposalStatus: 'active', progressDays: after, completedAt: { sprintNumber, day }, assignedEmployeeId: undefined },
          workdayHistory: [...get().workdayHistory, record],
        })
        useGameStore.getState().completeTask(IMPLEMENT_ACCESS_CONTROL_TASK.id)
        useRiskStore.getState().addSignalsOnce(accessControlActiveSignals(riskMomentAt(sprintNumber, day)))
      } else {
        set({
          accessControl: { ...ac, proposalStatus: 'in-progress', progressDays: after },
          workdayHistory: [...get().workdayHistory, record],
        })
      }
      persist()
      return { applied: true, record, activated }
    },

    reconcileIntrusionThreat: (context) => {
      const transition = reconcileIntrusionThreatRules(context)
      if (!transition.changed) return transition
      const intrusion = get().intrusion
      set({
        intrusion: {
          ...intrusion,
          status: transition.status,
          ...(transition.armedAtWorkdayIndex !== undefined ? { armedAtWorkdayIndex: transition.armedAtWorkdayIndex } : { armedAtWorkdayIndex: undefined }),
          ...(transition.dueWorkdayIndex !== undefined ? { dueWorkdayIndex: transition.dueWorkdayIndex } : { dueWorkdayIndex: undefined }),
        },
      })
      persist()
      return transition
    },

    markIntrusionRunning: (moment, hasSecuritySpecialist) => {
      const intrusion = get().intrusion
      if (intrusion.status !== 'pending') return
      set({
        intrusion: {
          ...intrusion,
          status: 'running',
          triggeredAt: intrusion.triggeredAt ?? moment,
          hadSecuritySpecialistAtIncident: intrusion.hadSecuritySpecialistAtIncident ?? hasSecuritySpecialist,
        },
      })
      persist()
    },

    resolveIntrusion: (moment, hasSecuritySpecialist) => {
      const intrusion = get().intrusion
      if (intrusion.status !== 'pending' && intrusion.status !== 'running') return { resolved: false }
      const hadSpecialist = intrusion.hadSecuritySpecialistAtIncident ?? hasSecuritySpecialist

      if (intrusion.effectsApplied) {
        // already applied (reload mid-scene) - just finish the visual part
        set({ intrusion: { ...intrusion, status: 'resolved', resolvedAt: intrusion.resolvedAt ?? moment }, intrusionResultToAcknowledge: { ...intrusion, status: 'resolved' } })
        persist()
        return { resolved: false, hadSecuritySpecialist: hadSpecialist, cost: getOfficeIntrusionResponseCost(hadSpecialist) }
      }

      const cost = getOfficeIntrusionResponseCost(hadSpecialist)
      const response = useEconomyStore.getState().applyOneTimeExpense(createSecurityIncidentTransaction(cost, moment.sprintNumber, moment.day))
      useRiskStore.getState().addSignalsOnce(officeIntrusionSignals(hadSpecialist, riskMomentAt(moment.sprintNumber, moment.day)))

      // tasks: keep/create the implement task if СКУД is not active, plus the
      // access-log review task (done immediately if both findings are already closed).
      if (get().accessControl.proposalStatus !== 'active') addTaskOnce(IMPLEMENT_ACCESS_CONTROL_TASK)
      addTaskOnce(REVIEW_ACCESS_LOGS_TASK)
      syncAccessLogsTask()

      const resolved: OfficeIntrusionState = {
        ...intrusion,
        status: 'resolved',
        resolvedAt: moment,
        hadSecuritySpecialistAtIncident: hadSpecialist,
        responseTransactionId: response.transaction.id,
        effectsApplied: true,
      }
      set({ intrusion: resolved, intrusionResultToAcknowledge: resolved })
      persist()
      return { resolved: true, hadSecuritySpecialist: hadSpecialist, cost }
    },

    markIntrusionFailed: () => {
      const intrusion = get().intrusion
      if (intrusion.status !== 'running') return
      set({ intrusion: { ...intrusion, status: 'pending' } })
      persist()
    },

    acknowledgeIntrusionResult: () => set({ intrusionResultToAcknowledge: null }),

    resetAccessControl: () => {
      set({ accessControl: { ...INITIAL_ACCESS_CONTROL }, intrusion: { ...INITIAL_INTRUSION }, workdayHistory: [], intrusionResultToAcknowledge: null })
      persist()
    },
  }
})

// The post-intrusion access-log task is done once both the account-access and
// sensitive-data findings are closed (never re-opens them). Callable from the
// workday use-case as those findings close.
export function syncAccessLogsTask(): void {
  const game = useGameStore.getState()
  const task = game.tasks.find((t) => t.id === REVIEW_ACCESS_LOGS_TASK.id)
  if (!task || task.done) return
  const findings = useSecurityAuditStore.getState().findings
  const closed = (id: string) => findings.find((f) => f.findingId === id)?.status === 'closed'
  if (closed('account-access-review') && closed('sensitive-data-logging-review')) game.completeTask(REVIEW_ACCESS_LOGS_TASK.id)
}
