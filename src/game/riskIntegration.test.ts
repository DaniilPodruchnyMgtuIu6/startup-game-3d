import { describe, it, expect, beforeEach } from 'vitest'
import { completeWorkday } from './completeWorkday'
import { recordServerFailureRisk, recordServerStabilizedRisk } from './serverRiskAdapter'
import { useRiskStore } from './riskStore'
import { useSprintStore } from './sprintStore'
import { useEconomyStore } from './economyStore'
import { useTeamStore } from './teamStore'
import { useProductStore } from './productStore'
import { useSecurityStoryStore } from './securityStoryStore'
import { useSecurityAuditStore, INITIAL_SECURITY_AUDIT } from './securityAuditStore'
import { INITIAL_SECURITY_BREACH } from './securityStoryRules'
import { initialTransactions } from './economyRules'
import { initialTaskStates } from './productRules'
import { buildRiskObservations, getDetectedRiskLevel } from './riskRules'

const risk = () => useRiskStore.getState()
const detectedLevel = (domain: Parameters<typeof getDetectedRiskLevel>[1]) => getDetectedRiskLevel(risk().signals, domain)

function setup(withIlya = false) {
  useRiskStore.setState({ signals: [] })
  useSprintStore.setState({ sprintNumber: 2, day: 2, phase: 'active', confirmingEndDay: false })
  const hires = withIlya ? [{ employeeId: 'ilya-vlasov', hiredAtSprint: 2, hiredAtDay: 1 }] : []
  useTeamStore.setState({ hires, panelOpen: false })
  useEconomyStore.setState({ transactions: initialTransactions(), panelOpen: false })
  useProductStore.setState({ taskStates: initialTaskStates(), workdayHistory: [], activeReport: null })
  useSecurityStoryStore.setState({
    securityBreach: { ...INITIAL_SECURITY_BREACH, status: 'completed', decision: 'take-responsibility', effectsApplied: true },
    postAuditConversation: { status: 'completed', staffingDecision: withIlya ? 'approve-security-hire' : 'decline-security-hire', completedAt: { sprintNumber: 2, day: 2 }, effectsApplied: true },
    hasIntroducedSecuritySpecialist: false,
  })
  useSecurityAuditStore.setState({ ...INITIAL_SECURITY_AUDIT, auditResultToAcknowledge: null })
  window.localStorage.clear()
}

function completeOneDay() {
  useSprintStore.setState({ confirmingEndDay: true })
  const result = completeWorkday()
  useProductStore.getState().closeReport()
  return result
}

describe('AUTH failures without Ilya -> delayed identity-access observation -> stabilised', () => {
  beforeEach(() => setup(false))

  it('detects after 3 elapsed days, then mitigation lowers the detected level', () => {
    // two failed AUTH attempts create identity-access +1 each (created at index 12)
    recordServerFailureRisk('auth')
    recordServerFailureRisk('auth')
    expect(risk().signals.filter((s) => s.domain === 'identity-access')).toHaveLength(2)
    expect(detectedLevel('identity-access')).toBe('controlled') // not yet detected

    // no immediate observation
    expect(buildRiskObservations(risk().signals, { revealDetailedFactors: false })).toEqual([])

    // complete days 2,3,4 -> completed indices 12,13,14 (< 15) -> still hidden
    completeOneDay()
    completeOneDay()
    completeOneDay()
    expect(detectedLevel('identity-access')).toBe('controlled')

    // completing day 5 (index 15 = 12 + delay 3) reveals it
    completeOneDay()
    expect(detectedLevel('identity-access')).toBe('low') // 2 points detected
    const obs = buildRiskObservations(risk().signals, { revealDetailedFactors: false })
    expect(obs.find((o) => o.domain === 'identity-access')).toBeDefined()

    // stabilise AUTH -> -2 mitigation, detected after its own 3-day delay. The
    // reveal advanced the clock to day 6 (index 16), so it detects at index 19.
    recordServerStabilizedRisk('auth')
    expect(detectedLevel('identity-access')).toBe('low') // mitigation not detected yet
    completeOneDay() // detect 16
    completeOneDay() // detect 17
    completeOneDay() // detect 18 (< 19, still hidden)
    expect(detectedLevel('identity-access')).toBe('low')
    completeOneDay() // detect 19 = 16 + 3 -> mitigation revealed
    expect(detectedLevel('identity-access')).toBe('controlled') // 2 - 2 = 0

    // the failures remain in history (never removed)
    expect(risk().signals.filter((s) => s.id.startsWith('server:auth:failure')).length).toBe(2)
  })
})

describe('DATABASE failure with Ilya -> next day observation + factor label', () => {
  beforeEach(() => setup(true))

  it('detects after a single day and reveals the factor', () => {
    recordServerFailureRisk('database') // sensitive-data +1 at index 12
    // with Ilya (delay 1): completing day 2 (index 12) not yet due (12 < 13)
    completeOneDay()
    expect(detectedLevel('sensitive-data')).toBe('controlled')
    // completing day 3 (index 13 = 12 + 1) reveals it
    completeOneDay()
    expect(detectedLevel('sensitive-data')).toBe('low')

    const obs = buildRiskObservations(risk().signals, { revealDetailedFactors: true })
    const dataObs = obs.find((o) => o.domain === 'sensitive-data')!
    expect(dataObs.factorLabels.length).toBeGreaterThan(0)
    expect(dataObs.factorLabels[0]).toContain('DATABASE')
  })
})

describe('opening panels never detects signals', () => {
  it('detection only happens on completeWorkday', () => {
    setup(false)
    recordServerFailureRisk('gateway')
    // simulate lots of "UI activity" - no day completed
    useProductStore.getState().openBoard('security')
    useProductStore.getState().closeBoard()
    useEconomyStore.getState().openPanel()
    useEconomyStore.getState().closePanel()
    expect(detectedLevel('service-continuity')).toBe('controlled')
  })
})
