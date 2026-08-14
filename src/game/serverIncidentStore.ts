import { create } from 'zustand'
import { isIntroReset, useGameStore } from './gameStore'
import { useEconomyStore } from './economyStore'
import { useRiskStore } from './riskStore'
import { useTeamStore } from './teamStore'
import { useSecurityAuditStore, isFollowUpAuditBlocking } from './securityAuditStore'
import { useAccessControlStore } from './accessControlStore'
import { hasSecuritySpecialist } from './teamRules'
import { getActualRiskLevel } from './riskRules'
import { createServerIncidentTransaction, createServerDowntimeTransaction } from './economyRules'
import { serverIncidentOccurredSignals, serverIncidentRecoveredSignals } from './riskSignals'
import { getStoryIncidentCostModifierRub, getStoryRecoveryEffortExtraDays, isQuietInvestigationOpen } from './story/storyEffectSelectors'
import { applyStoryIncidentConsequences } from './story/storyConsequences'
import { getCyberStoryIncidentCostModifierRub } from './story/cyberStoryEffectSelectors'
import { riskMomentAt } from './riskContext'
import { getServerIncident, type ServerIncidentDefinition, type ServerIncidentId } from './serverIncidentCatalog'
import type { BoardTask } from './tasks'
import type { StoryMoment } from './securityStoryRules'
import {
  canAssignServerRecovery,
  getRackStabilitySnapshot,
  getServerDowntimeCost,
  getServerIncidentImmediateCost,
  getServerRecoveryEffort,
  initialServerIncidents,
  isRackUnstable,
  normalizeServerIncidents,
  reconcileServerIncidentThreatRules,
  serverRecoveryWorkdayId,
  type ServerIncidentState,
  type ServerRecoveryAssignmentReason,
  type ServerRecoveryWorkdayRecord,
} from './serverIncidentRules'

// Server incident threats, scenes and recovery (Feature 11). Its own store and
// localStorage key. Scenes and the workday use-case drive the lifecycle; all
// math lives in serverIncidentRules. Money, tasks and risk signals are applied
// idempotently through the existing stores.

const SERVER_INCIDENT_STORAGE_KEY = 'startup-office-server-incidents'

const RECOVERY_TASK: Record<ServerIncidentId, BoardTask> = {
  'gateway-outage': { id: 'recover-gateway-service', text: 'Восстановить внешний шлюз OfficeFlow', done: false },
  'auth-account-incident': { id: 'contain-auth-account-incident', text: 'Восстановить доступ и проверить учётные записи', done: false },
  'database-exposure-review': { id: 'investigate-database-exposure', text: 'Проверить базу и журналы после инцидента', done: false },
}

export interface ServerIncidentData {
  incidents: Record<ServerIncidentId, ServerIncidentState>
  workdayHistory: ServerRecoveryWorkdayRecord[]
}

export const INITIAL_SERVER_INCIDENT_DATA: ServerIncidentData = { incidents: initialServerIncidents(), workdayHistory: [] }

type Storage = Pick<globalThis.Storage, 'getItem' | 'setItem' | 'removeItem'>
function safeStorage(): Storage | null {
  try {
    return window.localStorage
  } catch {
    return null
  }
}

export function loadServerIncidents(storage: Storage | null, search: string): ServerIncidentData {
  if (isIntroReset(search)) {
    storage?.removeItem(SERVER_INCIDENT_STORAGE_KEY)
    return { incidents: initialServerIncidents(), workdayHistory: [] }
  }
  if (!storage) return { incidents: initialServerIncidents(), workdayHistory: [] }
  const raw = storage.getItem(SERVER_INCIDENT_STORAGE_KEY)
  if (!raw) return { incidents: initialServerIncidents(), workdayHistory: [] }
  try {
    const parsed = JSON.parse(raw) as { incidents?: unknown; workdayHistory?: unknown }
    const workdayHistory = Array.isArray(parsed.workdayHistory)
      ? (parsed.workdayHistory.filter((w) => w && typeof w === 'object' && typeof (w as Record<string, unknown>).id === 'string') as ServerRecoveryWorkdayRecord[])
      : []
    return { incidents: normalizeServerIncidents(parsed.incidents), workdayHistory }
  } catch {
    return { incidents: initialServerIncidents(), workdayHistory: [] }
  }
}

export function saveServerIncidents(storage: Storage | null, data: ServerIncidentData): void {
  try {
    storage?.setItem(SERVER_INCIDENT_STORAGE_KEY, JSON.stringify(data))
  } catch {
    // private mode - restarts fresh next time
  }
}

// --- Result types -----------------------------------------------------------

export interface ReconcileServerThreatsResult {
  changed: ServerIncidentId[]
}
export interface ResolveServerIncidentSceneResult {
  resolved: boolean
  hadSecuritySpecialist?: boolean
  immediateCost?: number
  downtimeCost?: number
}
export interface AssignServerRecoveryResult {
  assigned: boolean
  reason?: ServerRecoveryAssignmentReason
}
export interface ApplyServerRecoveryWorkdayResult {
  applied: boolean
  record: ServerRecoveryWorkdayRecord | null
  divertedEmployeeIds: string[]
}

interface ServerIncidentStore extends ServerIncidentData {
  incidentResultToAcknowledge: ServerIncidentId | null

  reconcileServerIncidentThreats: (currentWorkdayIndex: number) => ReconcileServerThreatsResult
  markServerIncidentRunning: (incidentId: ServerIncidentId, moment: StoryMoment, hasSecuritySpecialist: boolean) => void
  resolveServerIncidentScene: (incidentId: ServerIncidentId, moment: StoryMoment) => ResolveServerIncidentSceneResult
  assignServerRecovery: (incidentId: ServerIncidentId, employeeId: string) => AssignServerRecoveryResult
  unassignServerRecovery: (incidentId: ServerIncidentId) => AssignServerRecoveryResult
  applyServerRecoveryWorkday: (sprintNumber: number, day: number) => ApplyServerRecoveryWorkdayResult
  markServerIncidentSceneFailed: (incidentId: ServerIncidentId) => void
  acknowledgeServerIncidentResult: () => void
  resetServerIncidents: () => void
}

function addTaskOnce(task: BoardTask): void {
  const game = useGameStore.getState()
  if (!game.tasks.some((t) => t.id === task.id)) game.addTask({ ...task })
}

const initial = loadServerIncidents(safeStorage(), typeof window === 'undefined' ? '' : window.location.search)

export const useServerIncidentStore = create<ServerIncidentStore>()((set, get) => {
  const persist = () => saveServerIncidents(safeStorage(), { incidents: get().incidents, workdayHistory: get().workdayHistory })
  const setIncident = (id: ServerIncidentId, next: ServerIncidentState) => set({ incidents: { ...get().incidents, [id]: next } })
  const incidentList = () => Object.values(get().incidents)

  return {
    ...initial,
    incidentResultToAcknowledge: null,

    reconcileServerIncidentThreats: (currentWorkdayIndex) => {
      const signals = useRiskStore.getState().signals
      const changed: ServerIncidentId[] = []
      const incidents = { ...get().incidents }
      for (const def of Object.values(incidents).map((s) => getServerIncident(s.incidentId)!) as ServerIncidentDefinition[]) {
        const state = incidents[def.id]
        const transition = reconcileServerIncidentThreatRules({
          currentWorkdayIndex,
          incidentState: state,
          actualRiskLevel: getActualRiskLevel(signals, def.riskDomain),
          rackUnstable: isRackUnstable(getRackStabilitySnapshot(def.rackId, signals)),
        })
        if (!transition.changed) continue
        changed.push(def.id)
        incidents[def.id] = {
          ...state,
          status: transition.status,
          armedAtWorkdayIndex: transition.armedAtWorkdayIndex,
          dueWorkdayIndex: transition.dueWorkdayIndex,
        }
      }
      if (changed.length > 0) {
        set({ incidents })
        persist()
      }
      return { changed }
    },

    markServerIncidentRunning: (incidentId, moment, hasSecuritySpecialist) => {
      const state = get().incidents[incidentId]
      if (state.status !== 'pending') return
      setIncident(incidentId, {
        ...state,
        status: 'running',
        triggeredAt: state.triggeredAt ?? moment,
        hadSecuritySpecialistAtIncident: state.hadSecuritySpecialistAtIncident ?? hasSecuritySpecialist,
      })
      persist()
    },

    resolveServerIncidentScene: (incidentId, moment) => {
      const state = get().incidents[incidentId]
      const def = getServerIncident(incidentId)!
      if (state.status !== 'pending' && state.status !== 'running') return { resolved: false }
      const hadSpecialist = state.hadSecuritySpecialistAtIncident ?? hasSecuritySpecialist(useTeamStore.getState().hires)
      const immediateCost = getServerIncidentImmediateCost(
        incidentId,
        hadSpecialist,
        getStoryIncidentCostModifierRub(incidentId) + getCyberStoryIncidentCostModifierRub(incidentId),
      )
      const downtimeCost = getServerDowntimeCost(incidentId)

      if (state.effectsApplied) {
        setIncident(incidentId, { ...state, status: 'recovery-required' })
        set({ incidentResultToAcknowledge: incidentId })
        persist()
        return { resolved: false, hadSecuritySpecialist: hadSpecialist, immediateCost, downtimeCost }
      }

      const response = useEconomyStore
        .getState()
        .applyOneTimeExpense(createServerIncidentTransaction(incidentId, def.immediateTransactionTitle, immediateCost, moment.sprintNumber, moment.day))
      useRiskStore.getState().addSignalsOnce(serverIncidentOccurredSignals(incidentId, def.riskDomain, riskMomentAt(moment.sprintNumber, moment.day)))
      addTaskOnce(RECOVERY_TASK[incidentId])
      // Feature 17B: an incident landing while the team quietly investigates the
      // suspicious activity means leadership learns about the delay.
      if (isQuietInvestigationOpen()) useSecurityAuditStore.getState().raiseLeadershipComplaint()
      // Feature 17C: past decisions shape this incident - neighbor-domain
      // spread, checkpoint records and the mandatory consequence scenes.
      applyStoryIncidentConsequences(incidentId, moment)

      setIncident(incidentId, {
        ...state,
        status: 'recovery-required',
        triggeredAt: state.triggeredAt ?? moment,
        hadSecuritySpecialistAtIncident: hadSpecialist,
        immediateCostTransactionId: response.transaction.id,
        effectsApplied: true,
      })
      set({ incidentResultToAcknowledge: incidentId })
      persist()
      return { resolved: true, hadSecuritySpecialist: hadSpecialist, immediateCost, downtimeCost }
    },

    assignServerRecovery: (incidentId, employeeId) => {
      const state = get().incidents[incidentId]
      const validation = canAssignServerRecovery({
        incidentId,
        employeeId,
        incidentState: state,
        findingStates: useSecurityAuditStore.getState().findings,
        accessControlState: useAccessControlStore.getState().accessControl,
        serverIncidentStates: incidentList(),
        hasIlya: hasSecuritySpecialist(useTeamStore.getState().hires),
        auditBlocking: isFollowUpAuditBlocking(useSecurityAuditStore.getState().followUpAudit),
      })
      if (!validation.allowed) return { assigned: false, reason: validation.reason }
      setIncident(incidentId, { ...state, assignedEmployeeId: employeeId })
      persist()
      return { assigned: true }
    },

    unassignServerRecovery: (incidentId) => {
      const state = get().incidents[incidentId]
      if (!state.assignedEmployeeId) return { assigned: false }
      const { assignedEmployeeId: _drop, ...rest } = state
      setIncident(incidentId, { ...rest })
      persist()
      return { assigned: false }
    },

    applyServerRecoveryWorkday: (sprintNumber, day) => {
      const id = serverRecoveryWorkdayId(sprintNumber, day)
      const existing = get().workdayHistory.find((w) => w.id === id)
      if (existing) {
        const diverted = existing.incidentResults.filter((r) => r.employeeId && (r.afterProgressDays ?? 0) > (r.beforeProgressDays ?? 0)).map((r) => r.employeeId!)
        return { applied: false, record: existing, divertedEmployeeIds: [...new Set(diverted)] }
      }

      const incidents = { ...get().incidents }
      const incidentResults: ServerRecoveryWorkdayRecord['incidentResults'] = []
      const downtimeTransactionIds: string[] = []
      const divertedEmployeeIds: string[] = []

      for (const def of Object.values(incidents).map((s) => getServerIncident(s.incidentId)!) as ServerIncidentDefinition[]) {
        const state = incidents[def.id]
        // downtime is charged for every incident unresolved at the START of the day
        if (state.status !== 'recovery-required' && state.status !== 'recovering') continue
        const downtime = useEconomyStore
          .getState()
          .applyOneTimeExpense(createServerDowntimeTransaction(def.id, def.downtimeTransactionTitle, def.downtimeCostPerDay, sprintNumber, day))
        downtimeTransactionIds.push(downtime.transaction.id)

        if (!state.assignedEmployeeId) {
          incidentResults.push({ incidentId: def.id, idleReason: 'no-assignee' })
          continue
        }
        const employeeId = state.assignedEmployeeId
        const effort = getServerRecoveryEffort(def.id, state.hadSecuritySpecialistAtIncident === true, getStoryRecoveryEffortExtraDays(def.id))
        const before = state.recoveryProgressDays
        const after = Math.min(effort, before + 1)
        const completed = after >= effort
        divertedEmployeeIds.push(employeeId)
        incidentResults.push({ incidentId: def.id, employeeId, beforeProgressDays: before, afterProgressDays: after, completed })

        if (completed) {
          incidents[def.id] = { ...state, status: 'resolved', recoveryProgressDays: after, resolvedAt: { sprintNumber, day }, assignedEmployeeId: undefined }
          useGameStore.getState().completeTask(RECOVERY_TASK[def.id].id)
          useRiskStore.getState().addSignalsOnce(serverIncidentRecoveredSignals(def.id, def.riskDomain, riskMomentAt(sprintNumber, day)))
        } else {
          incidents[def.id] = { ...state, status: 'recovering', recoveryProgressDays: after }
        }
      }

      const record: ServerRecoveryWorkdayRecord = { id, sprintNumber, day, incidentResults, downtimeTransactionIds }
      set({ incidents, workdayHistory: [...get().workdayHistory, record] })
      persist()
      return { applied: true, record, divertedEmployeeIds: [...new Set(divertedEmployeeIds)] }
    },

    markServerIncidentSceneFailed: (incidentId) => {
      const state = get().incidents[incidentId]
      if (state.status !== 'running') return
      setIncident(incidentId, { ...state, status: 'pending' })
      persist()
    },

    acknowledgeServerIncidentResult: () => set({ incidentResultToAcknowledge: null }),

    resetServerIncidents: () => {
      set({ incidents: initialServerIncidents(), workdayHistory: [], incidentResultToAcknowledge: null })
      persist()
    },
  }
})
