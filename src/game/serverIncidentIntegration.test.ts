import { describe, it, expect, beforeEach } from 'vitest'
import { completeWorkday } from './completeWorkday'
import { useSprintStore } from './sprintStore'
import { useEconomyStore } from './economyStore'
import { useTeamStore } from './teamStore'
import { useProductStore } from './productStore'
import { useRiskStore } from './riskStore'
import { useSecurityStoryStore } from './securityStoryStore'
import { useSecurityAuditStore, INITIAL_SECURITY_AUDIT } from './securityAuditStore'
import { useAccessControlStore, INITIAL_ACCESS_CONTROL_DATA } from './accessControlStore'
import { useServerIncidentStore, INITIAL_SERVER_INCIDENT_DATA } from './serverIncidentStore'
import { useGameStore } from './gameStore'
import { INITIAL_SECURITY_BREACH } from './securityStoryRules'
import { initialTransactions, calculateBalance, INITIAL_BUDGET } from './economyRules'
import { initialTaskStates } from './productRules'
import { getActualRiskScore } from './riskRules'

const srv = () => useServerIncidentStore.getState()
const balance = () => calculateBalance(useEconomyStore.getState().transactions)
const hasTx = (id: string) => useEconomyStore.getState().transactions.some((t) => t.id === id)
const progressOf = (taskId: string) => useProductStore.getState().taskStates.find((s) => s.taskId === taskId)!.progressDays

function plannedStates() {
  return initialTaskStates().map((s) => {
    if (s.taskId === 'auth-api') return { ...s, status: 'planned' as const, plannedSprintNumber: 3, planOrder: 1 }
    if (s.taskId === 'login-screen') return { ...s, status: 'planned' as const, plannedSprintNumber: 3, planOrder: 2 }
    return s
  })
}

function setup(withIlya: boolean) {
  useSprintStore.setState({ sprintNumber: 3, day: 2, phase: 'active', confirmingEndDay: false })
  useTeamStore.setState({ hires: [{ employeeId: 'kirill-morozov', hiredAtSprint: 1, hiredAtDay: 1 }, { employeeId: 'alina-belova', hiredAtSprint: 1, hiredAtDay: 1 }, ...(withIlya ? [{ employeeId: 'ilya-vlasov', hiredAtSprint: 2, hiredAtDay: 1 }] : [])], panelOpen: false })
  useEconomyStore.setState({ transactions: initialTransactions(), panelOpen: false })
  useProductStore.setState({ taskStates: plannedStates(), workdayHistory: [], activeReport: null })
  useRiskStore.setState({ signals: [] })
  useSecurityStoryStore.setState({ securityBreach: { ...INITIAL_SECURITY_BREACH, status: 'completed', decision: 'take-responsibility', effectsApplied: true }, postAuditConversation: { status: 'completed', staffingDecision: withIlya ? 'approve-security-hire' : 'decline-security-hire', completedAt: { sprintNumber: 3, day: 1 }, effectsApplied: true }, hasIntroducedSecuritySpecialist: false })
  useSecurityAuditStore.setState({ ...INITIAL_SECURITY_AUDIT, auditResultToAcknowledge: null })
  useAccessControlStore.setState({ ...INITIAL_ACCESS_CONTROL_DATA, intrusionResultToAcknowledge: null })
  useServerIncidentStore.setState({ ...INITIAL_SERVER_INCIDENT_DATA, incidentResultToAcknowledge: null })
  useGameStore.setState({ tasks: [] })
  window.localStorage.clear()
}

function completeOneDay() {
  useSprintStore.setState({ confirmingEndDay: true })
  const r = completeWorkday()
  useProductStore.getState().closeReport()
  return r
}

describe('AUTH incident with Ilya: recovery keeps Kirill on product', () => {
  beforeEach(() => setup(true))

  it('scene charges 100k, Ilya recovers in 1 day with downtime, Kirill keeps product progress', () => {
    useServerIncidentStore.setState({ incidents: { ...srv().incidents, 'auth-account-incident': { incidentId: 'auth-account-incident', status: 'pending', recoveryProgressDays: 0, effectsApplied: false } } })
    // the scene (via the runner) marks running + resolves
    srv().markServerIncidentRunning('auth-account-incident', { sprintNumber: 3, day: 2 }, true)
    const res = srv().resolveServerIncidentScene('auth-account-incident', { sprintNumber: 3, day: 2 })
    expect(res.immediateCost).toBe(100_000)
    expect(srv().incidents['auth-account-incident'].status).toBe('recovery-required')

    expect(srv().assignServerRecovery('auth-account-incident', 'ilya-vlasov').assigned).toBe(true)

    const before = balance()
    completeOneDay()
    // downtime 30k charged, recovery effort 1 -> resolved
    expect(hasTx('server-downtime:auth-account-incident:sprint-3:day-2')).toBe(true)
    expect(balance()).toBeLessThan(before)
    expect(srv().incidents['auth-account-incident'].status).toBe('resolved')
    expect(getActualRiskScore(useRiskStore.getState().signals, 'identity-access')).toBeLessThan(3) // -4 mitigation applied
    // Kirill (not diverted - Ilya did the recovery) keeps product progress
    expect(progressOf('auth-api')).toBe(1)
    expect(progressOf('login-screen')).toBe(1)
  })
})

describe('DATABASE incident without Ilya: Kirill diverted, downtime each day', () => {
  beforeEach(() => setup(false))

  it('260k immediate, 3 recovery days with 50k downtime each, Kirill product +0', () => {
    useServerIncidentStore.setState({ incidents: { ...srv().incidents, 'database-exposure-review': { incidentId: 'database-exposure-review', status: 'pending', recoveryProgressDays: 0, effectsApplied: false } } })
    const res = srv().resolveServerIncidentScene('database-exposure-review', { sprintNumber: 3, day: 2 })
    expect(res.immediateCost).toBe(260_000)
    expect(balance()).toBe(INITIAL_BUDGET - 260_000)
    expect(srv().assignServerRecovery('database-exposure-review', 'kirill-morozov').assigned).toBe(true)

    // day is blocked? no - recovery-required does not block; only pending/running do
    completeOneDay() // 1/3
    completeOneDay() // 2/3
    completeOneDay() // 3/3 -> resolved
    expect(srv().incidents['database-exposure-review'].status).toBe('resolved')

    // three downtime days of 50 000 each
    expect(hasTx('server-downtime:database-exposure-review:sprint-3:day-2')).toBe(true)
    expect(hasTx('server-downtime:database-exposure-review:sprint-3:day-4')).toBe(true)
    // Kirill made no product progress (diverted all three days); Alina finished
    // her 2-day task (login-screen effort is 2, done by day 2)
    expect(progressOf('auth-api')).toBe(0)
    expect(progressOf('login-screen')).toBe(2)
  })

  it('a pending server incident blocks the next day', () => {
    useServerIncidentStore.setState({ incidents: { ...srv().incidents, 'gateway-outage': { incidentId: 'gateway-outage', status: 'pending', recoveryProgressDays: 0, effectsApplied: false } } })
    useSprintStore.setState({ confirmingEndDay: true })
    expect(completeWorkday()).toEqual({ completed: false, reason: 'required-server-incident' })
  })
})
