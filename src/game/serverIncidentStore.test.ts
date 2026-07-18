import { describe, it, expect, beforeEach } from 'vitest'
import { useServerIncidentStore, INITIAL_SERVER_INCIDENT_DATA } from './serverIncidentStore'
import { useGameStore } from './gameStore'
import { useEconomyStore } from './economyStore'
import { useRiskStore } from './riskStore'
import { useTeamStore } from './teamStore'
import { useSecurityAuditStore, INITIAL_SECURITY_AUDIT } from './securityAuditStore'
import { useAccessControlStore, INITIAL_ACCESS_CONTROL_DATA } from './accessControlStore'
import { initialTransactions, calculateBalance, INITIAL_BUDGET } from './economyRules'
import { getActualRiskScore } from './riskRules'
import { initializeSecurityFindings, assignFindingState } from './securityAuditRules'
import { BOARD_TASKS } from './tasks'

const srv = () => useServerIncidentStore.getState()
const incident = (id: 'gateway-outage' | 'auth-account-incident' | 'database-exposure-review') => srv().incidents[id]
const balance = () => calculateBalance(useEconomyStore.getState().transactions)
const hasTx = (id: string) => useEconomyStore.getState().transactions.some((t) => t.id === id)
const taskDone = (id: string) => useGameStore.getState().tasks.find((t) => t.id === id)?.done
const moment = { sprintNumber: 3, day: 2 }

function reset(withIlya = false) {
  useServerIncidentStore.setState({ ...INITIAL_SERVER_INCIDENT_DATA, incidentResultToAcknowledge: null })
  useEconomyStore.setState({ transactions: initialTransactions(), panelOpen: false })
  useRiskStore.setState({ signals: [] })
  useGameStore.setState({ tasks: BOARD_TASKS.map((t) => ({ ...t })) })
  useTeamStore.setState({ hires: withIlya ? [{ employeeId: 'ilya-vlasov', hiredAtSprint: 2, hiredAtDay: 1 }] : [], panelOpen: false })
  useSecurityAuditStore.setState({ ...INITIAL_SECURITY_AUDIT, findings: initializeSecurityFindings(), auditResultToAcknowledge: null })
  useAccessControlStore.setState({ ...INITIAL_ACCESS_CONTROL_DATA, intrusionResultToAcknowledge: null })
  window.localStorage.clear()
}

describe('scene resolution', () => {
  beforeEach(() => reset())

  it('DATABASE without Ilya: 260k immediate, occurred signal, task, recovery-required, idempotent', () => {
    useServerIncidentStore.setState({ incidents: { ...srv().incidents, 'database-exposure-review': { incidentId: 'database-exposure-review', status: 'pending', recoveryProgressDays: 0, effectsApplied: false } } })
    const res = srv().resolveServerIncidentScene('database-exposure-review', moment)
    expect(res).toEqual({ resolved: true, hadSecuritySpecialist: false, immediateCost: 260_000, downtimeCost: 50_000 })
    expect(balance()).toBe(INITIAL_BUDGET - 260_000)
    expect(getActualRiskScore(useRiskStore.getState().signals, 'sensitive-data')).toBe(3)
    expect(hasTx('server-incident:database-exposure-review')).toBe(true)
    expect(incident('database-exposure-review').status).toBe('recovery-required')

    const again = srv().resolveServerIncidentScene('database-exposure-review', moment)
    expect(again.resolved).toBe(false)
    expect(balance()).toBe(INITIAL_BUDGET - 260_000) // not doubled
  })

  it('the specialist snapshot is fixed at pending -> running and used for cost', () => {
    useServerIncidentStore.setState({ incidents: { ...srv().incidents, 'auth-account-incident': { incidentId: 'auth-account-incident', status: 'pending', recoveryProgressDays: 0, effectsApplied: false } } })
    srv().markServerIncidentRunning('auth-account-incident', moment, true) // snapshot: had specialist
    const res = srv().resolveServerIncidentScene('auth-account-incident', moment)
    expect(res.immediateCost).toBe(100_000) // with-specialist cost, even if hires change later
  })
})

describe('assignment', () => {
  beforeEach(() => {
    reset(true)
    useServerIncidentStore.setState({ incidents: { ...srv().incidents, 'gateway-outage': { incidentId: 'gateway-outage', status: 'recovery-required', recoveryProgressDays: 0, effectsApplied: true, hadSecuritySpecialistAtIncident: false } } })
  })

  it('gateway is Kirill-only; a finding-busy employee is rejected', () => {
    expect(srv().assignServerRecovery('gateway-outage', 'ilya-vlasov')).toEqual({ assigned: false, reason: 'not-eligible' })
    expect(srv().assignServerRecovery('gateway-outage', 'kirill-morozov')).toEqual({ assigned: true })

    srv().unassignServerRecovery('gateway-outage')
    useSecurityAuditStore.setState({ findings: assignFindingState(initializeSecurityFindings(), 'account-access-review', 'kirill-morozov') })
    expect(srv().assignServerRecovery('gateway-outage', 'kirill-morozov')).toEqual({ assigned: false, reason: 'employee-busy' })
  })
})

describe('recovery workday: downtime + progress', () => {
  beforeEach(() => {
    reset()
    useServerIncidentStore.setState({ incidents: { ...srv().incidents, 'gateway-outage': { incidentId: 'gateway-outage', status: 'recovery-required', recoveryProgressDays: 0, effectsApplied: true, hadSecuritySpecialistAtIncident: false, assignedEmployeeId: 'kirill-morozov' } } })
    useGameStore.getState().addTask({ id: 'recover-gateway-service', text: 'Восстановить внешний шлюз OfficeFlow', done: false })
  })

  it('charges downtime each unresolved day, advances recovery, resolves at effort, idempotent', () => {
    const d1 = srv().applyServerRecoveryWorkday(3, 2)
    expect(d1.applied).toBe(true)
    expect(d1.divertedEmployeeIds).toEqual(['kirill-morozov'])
    expect(hasTx('server-downtime:gateway-outage:sprint-3:day-2')).toBe(true)
    expect(balance()).toBe(INITIAL_BUDGET - 40_000)
    expect(incident('gateway-outage').status).toBe('recovering')

    // repeated day is idempotent
    const again = srv().applyServerRecoveryWorkday(3, 2)
    expect(again.applied).toBe(false)
    expect(balance()).toBe(INITIAL_BUDGET - 40_000)

    // day 2 of recovery: effort 2 reached -> resolved (downtime still charged for this day)
    const d2 = srv().applyServerRecoveryWorkday(3, 3)
    expect(incident('gateway-outage').status).toBe('resolved')
    expect(taskDone('recover-gateway-service')).toBe(true)
    expect(getActualRiskScore(useRiskStore.getState().signals, 'service-continuity')).toBe(0) // -4 mitigation
    expect(balance()).toBe(INITIAL_BUDGET - 80_000) // two downtime days
    void d2
  })

  it('no assignee: downtime charged, idle result, no progress', () => {
    srv().unassignServerRecovery('gateway-outage')
    const d = srv().applyServerRecoveryWorkday(3, 2)
    expect(d.record?.incidentResults[0]).toMatchObject({ incidentId: 'gateway-outage', idleReason: 'no-assignee' })
    expect(incident('gateway-outage').recoveryProgressDays).toBe(0)
    expect(balance()).toBe(INITIAL_BUDGET - 40_000)
  })
})

describe('threat reconciliation', () => {
  beforeEach(() => reset())

  it('arms only with high risk + unstable rack; resolved never re-arms', () => {
    // gateway service-continuity high (score 5) + 2 failures
    useRiskStore.setState({
      signals: [
        ...Array.from({ length: 5 }, (_, i) => ({ id: `sc:${i}`, domain: 'service-continuity' as const, impact: 1, source: 'server-minigame' as const, sourceRef: 'x', createdAt: { sprintNumber: 1, day: 1 }, createdAtWorkdayIndex: 1 })),
        { id: 'server:gateway:failure:1', domain: 'service-continuity', impact: 1, source: 'server-minigame', sourceRef: 'x', createdAt: { sprintNumber: 1, day: 1 }, createdAtWorkdayIndex: 1 },
        { id: 'server:gateway:failure:2', domain: 'service-continuity', impact: 1, source: 'server-minigame', sourceRef: 'x', createdAt: { sprintNumber: 1, day: 1 }, createdAtWorkdayIndex: 1 },
      ],
    })
    srv().reconcileServerIncidentThreats(12)
    expect(incident('gateway-outage').status).toBe('armed')
    expect(incident('gateway-outage').dueWorkdayIndex).toBe(16)
    // auth is not unstable -> stays dormant
    expect(incident('auth-account-incident').status).toBe('dormant')
  })
})
