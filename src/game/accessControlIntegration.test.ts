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
import { INITIAL_SECURITY_BREACH } from './securityStoryRules'
import { initialTransactions, calculateBalance, INITIAL_BUDGET, ACCESS_CONTROL_INVESTMENT_COST } from './economyRules'
import { initialTaskStates } from './productRules'
import { getActualRiskScore, type RiskSignal } from './riskRules'

const ac = () => useAccessControlStore.getState()
const balance = () => calculateBalance(useEconomyStore.getState().transactions)
const hasTx = (id: string) => useEconomyStore.getState().transactions.some((t) => t.id === id)

// office-access positive signals, already detected, giving actual = detected = n.
function officeAccessSignals(n: number): RiskSignal[] {
  return Array.from({ length: n }, (_, i) => ({
    id: `seed:office-access:${i}`,
    domain: 'office-access' as const,
    impact: 1,
    source: 'staffing-decision' as const,
    sourceRef: 'seed',
    createdAt: { sprintNumber: 1, day: 1 },
    createdAtWorkdayIndex: 1,
    detectedAtWorkdayIndex: 1,
  }))
}

function setup(withIlya: boolean, officeAccessScore: number) {
  useSprintStore.setState({ sprintNumber: 2, day: 2, phase: 'active', confirmingEndDay: false })
  useTeamStore.setState({ hires: withIlya ? [{ employeeId: 'ilya-vlasov', hiredAtSprint: 2, hiredAtDay: 1 }] : [], panelOpen: false })
  useEconomyStore.setState({ transactions: initialTransactions(), panelOpen: false })
  useProductStore.setState({ taskStates: initialTaskStates(), workdayHistory: [], activeReport: null })
  useRiskStore.setState({ signals: officeAccessSignals(officeAccessScore) })
  useSecurityStoryStore.setState({
    securityBreach: { ...INITIAL_SECURITY_BREACH, status: 'completed', decision: 'take-responsibility', effectsApplied: true },
    postAuditConversation: { status: 'completed', staffingDecision: withIlya ? 'approve-security-hire' : 'decline-security-hire', completedAt: { sprintNumber: 2, day: 1 }, effectsApplied: true },
    hasIntroducedSecuritySpecialist: false,
  })
  useSecurityAuditStore.setState({ ...INITIAL_SECURITY_AUDIT, auditResultToAcknowledge: null })
  useAccessControlStore.setState({ ...INITIAL_ACCESS_CONTROL_DATA, intrusionResultToAcknowledge: null })
  window.localStorage.clear()
}

function completeOneDay() {
  useSprintStore.setState({ confirmingEndDay: true })
  const r = completeWorkday()
  useProductStore.getState().closeReport()
  return r
}

describe('approve -> implement -> prevented', () => {
  beforeEach(() => setup(true, 5)) // high actual office-access, Ilya hired

  it('installs СКУД which prevents the armed intrusion', () => {
    // first day: proposal unlocks (detected high) and the threat arms (actual high)
    completeOneDay()
    expect(ac().accessControl.proposalStatus).toBe('available')
    expect(ac().intrusion.status).toBe('armed')

    // approve (-180 000) and assign Ilya
    expect(ac().approveAccessControl({ sprintNumber: 2, day: 3 }).applied).toBe(true)
    expect(hasTx('security-investment:access-control')).toBe(true)
    expect(balance()).toBeLessThan(INITIAL_BUDGET - ACCESS_CONTROL_INVESTMENT_COST + 1)
    expect(ac().assignAccessControlImplementation('ilya-vlasov').assigned).toBe(true)

    // two completed days -> СКУД active -> intrusion prevented
    completeOneDay()
    completeOneDay()
    expect(ac().accessControl.proposalStatus).toBe('active')
    expect(ac().intrusion.status).toBe('prevented')
  })
})

describe('no СКУД -> armed -> pending -> intrusion resolved without Ilya', () => {
  beforeEach(() => setup(false, 5)) // high actual office-access, no Ilya

  it('fires after 4 days, blocks the next day, then resolves for 140k with a sensitive-data signal', () => {
    completeOneDay() // day 2 (index 12): arm, due = 16
    expect(ac().intrusion.status).toBe('armed')
    expect(ac().intrusion.dueWorkdayIndex).toBe(16)

    completeOneDay() // 13
    completeOneDay() // 14
    completeOneDay() // 15 (< 16) still armed
    expect(ac().intrusion.status).toBe('armed')
    completeOneDay() // 16 -> pending
    expect(ac().intrusion.status).toBe('pending')

    // the next day is blocked until the intrusion is resolved
    useSprintStore.setState({ confirmingEndDay: true })
    expect(completeWorkday()).toEqual({ completed: false, reason: 'required-office-intrusion' })

    // the scene resolves it (no Ilya branch)
    const res = ac().resolveIntrusion({ sprintNumber: 3, day: 7 }, false)
    expect(res).toEqual({ resolved: true, hadSecuritySpecialist: false, cost: 140_000 })
    expect(hasTx('security-incident:office-intrusion')).toBe(true)
    expect(getActualRiskScore(useRiskStore.getState().signals, 'sensitive-data')).toBe(2)
    expect(ac().intrusion.status).toBe('resolved')

    // once resolved, days can be completed again; the incident never repeats
    useSprintStore.setState({ confirmingEndDay: true })
    expect(completeWorkday().completed).toBe(true)
  })
})
