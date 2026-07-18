import { describe, it, expect, beforeEach } from 'vitest'
import { completeWorkday } from './completeWorkday'
import { hireDeveloper } from './hireDeveloper'
import { startSprintWithPlan } from './startSprintWithPlan'
import { completeSprintAndPrepareNextPlanning, completeCampaignDeadlineMet, failCampaignDeadlineMissed } from './completeSprintReview'
import { useSprintStore } from './sprintStore'
import { useEconomyStore } from './economyStore'
import { useTeamStore } from './teamStore'
import { useProductStore } from './productStore'
import { useRiskStore } from './riskStore'
import { useSecurityStoryStore } from './securityStoryStore'
import { useSecurityAuditStore, INITIAL_SECURITY_AUDIT } from './securityAuditStore'
import { useAccessControlStore, INITIAL_ACCESS_CONTROL_DATA } from './accessControlStore'
import { useServerIncidentStore, INITIAL_SERVER_INCIDENT_DATA } from './serverIncidentStore'
import { useServerIncidentsStore } from './serverIncidentsStore'
import { useGameStore } from './gameStore'
import { useGameOutcomeStore } from './gameOutcomeStore'
import { INITIAL_SECURITY_BREACH } from './securityStoryRules'
import { initialTransactions, calculateBalance, type MoneyTransaction } from './economyRules'
import { initialTaskStates } from './productRules'
import { PRODUCT_TASK_CATALOG } from './productTaskCatalog'

const out = () => useGameOutcomeStore.getState()
const srv = () => useServerIncidentStore.getState()
const balance = () => calculateBalance(useEconomyStore.getState().transactions)

function baseSetup() {
  useSprintStore.setState({ sprintNumber: 3, day: 2, phase: 'active', confirmingEndDay: false })
  useTeamStore.setState({
    hires: [
      { employeeId: 'kirill-morozov', hiredAtSprint: 1, hiredAtDay: 1 },
      { employeeId: 'alina-belova', hiredAtSprint: 1, hiredAtDay: 1 },
    ],
    panelOpen: false,
  })
  useEconomyStore.setState({ transactions: initialTransactions(), panelOpen: false })
  useProductStore.setState({ taskStates: initialTaskStates(), workdayHistory: [], activeReport: null })
  useRiskStore.setState({ signals: [] })
  useSecurityStoryStore.setState({
    securityBreach: { ...INITIAL_SECURITY_BREACH, status: 'completed', decision: 'take-responsibility', effectsApplied: true },
    postAuditConversation: { status: 'completed', staffingDecision: 'decline-security-hire', completedAt: { sprintNumber: 3, day: 1 }, effectsApplied: true },
    hasIntroducedSecuritySpecialist: false,
  })
  useSecurityAuditStore.setState({ ...INITIAL_SECURITY_AUDIT, auditResultToAcknowledge: null })
  useAccessControlStore.setState({ ...INITIAL_ACCESS_CONTROL_DATA, intrusionResultToAcknowledge: null })
  useServerIncidentStore.setState({ ...INITIAL_SERVER_INCIDENT_DATA, incidentResultToAcknowledge: null })
  useServerIncidentsStore.getState().resetServerRacks()
  useGameStore.setState({ tasks: [] })
  useGameOutcomeStore.getState().resetGameOutcome()
  window.localStorage.clear()
}

function completeOneDay() {
  useSprintStore.setState({ confirmingEndDay: true })
  const r = completeWorkday()
  useProductStore.getState().closeReport()
  return r
}

function downtimeTx(sprintNumber: number, day: number): MoneyTransaction {
  return { id: `server-downtime:auth-account-incident:sprint-${sprintNumber}:day-${day}`, kind: 'expense', category: 'service-downtime', title: 'Простой', amount: 30_000, sprintNumber, day }
}

beforeEach(baseSetup)

describe('budget-exhausted via a completed workday', () => {
  it('the daily expense empties the budget → pending budget failure, report first, next day blocked', () => {
    // start with far less than a single day's operating cost
    useEconomyStore.setState({ transactions: [{ id: 'initial-funding', kind: 'income', category: 'funding', title: 'Финансирование', amount: 1000, sprintNumber: 0, day: 0 }], panelOpen: false })
    completeOneDay()
    expect(balance()).toBeLessThanOrEqual(0)
    expect(out().status).toBe('failure-pending')
    expect(out().pendingFailure?.reason).toBe('budget-exhausted')
    // a new day cannot start once a defeat is pending
    useSprintStore.setState({ confirmingEndDay: true })
    expect(completeWorkday()).toEqual({ completed: false, reason: 'game-outcome-pending' })
  })
})

describe('leadership suspension after the third audit', () => {
  it('arms a five-day grace, then fails once the due day passes with an open finding', () => {
    useSecurityAuditStore.setState({
      ...INITIAL_SECURITY_AUDIT,
      initialized: true,
      shutdownRecommendation: true,
      leadershipComplaint: true,
      followUpAudit: { status: 'critical-escalation', records: [] },
      findings: [{ findingId: 'workstation-locking-training', status: 'open', progressDays: 0 }],
      auditResultToAcknowledge: null,
    })

    for (let i = 0; i < 8 && out().status === 'playing'; i++) completeOneDay()

    expect(out().leadershipReview.status).toBe('failed')
    expect(out().status).toBe('failure-pending')
    expect(out().pendingFailure?.reason).toBe('leadership-suspension')
  })

  it('recovers (no defeat) when the finding is closed before the due day', () => {
    useSecurityAuditStore.setState({
      ...INITIAL_SECURITY_AUDIT,
      initialized: true,
      shutdownRecommendation: true,
      followUpAudit: { status: 'critical-escalation', records: [] },
      findings: [{ findingId: 'workstation-locking-training', status: 'closed', progressDays: 3, closedAt: { sprintNumber: 3, day: 1 } }],
      auditResultToAcknowledge: null,
    })
    completeOneDay()
    expect(out().leadershipReview.status).toBe('recovered')
    expect(out().status).toBe('playing')
  })
})

describe('server downtime collapse', () => {
  it('a fifth unresolved downtime day collapses the service', () => {
    useEconomyStore.setState({ transactions: [...initialTransactions(), downtimeTx(2, 6), downtimeTx(2, 7), downtimeTx(2, 8), downtimeTx(2, 9)], panelOpen: false })
    useServerIncidentStore.setState({
      incidents: { ...srv().incidents, 'auth-account-incident': { incidentId: 'auth-account-incident', status: 'recovery-required', recoveryProgressDays: 0, effectsApplied: true, hadSecuritySpecialistAtIncident: false } },
    })
    completeOneDay() // charges the fifth downtime day, still unresolved (no assignee)
    expect(out().status).toBe('failure-pending')
    expect(out().pendingFailure?.reason).toBe('service-collapse')
    expect(out().pendingFailure?.unresolvedServerIncidentIds).toContain('auth-account-incident')
  })

  it('finishing recovery on the fifth day prevents the collapse', () => {
    useEconomyStore.setState({ transactions: [...initialTransactions(), downtimeTx(2, 6), downtimeTx(2, 7), downtimeTx(2, 8), downtimeTx(2, 9)], panelOpen: false })
    useServerIncidentStore.setState({
      incidents: { ...srv().incidents, 'auth-account-incident': { incidentId: 'auth-account-incident', status: 'recovery-required', recoveryProgressDays: 1, effectsApplied: true, hadSecuritySpecialistAtIncident: false, assignedEmployeeId: 'kirill-morozov' } },
    })
    completeOneDay() // fifth downtime charged, recovery 1→2 (effort 2) → resolved
    expect(srv().incidents['auth-account-incident'].status).toBe('resolved')
    expect(out().status).toBe('playing')
  })
})

describe('campaign deadline at the sprint-6 review', () => {
  function reviewWithDone(count: number) {
    const states = initialTaskStates().map((s, i) => (i < count ? { ...s, status: 'done' as const, completedAt: { sprintNumber: 6, day: 10 } } : s))
    useProductStore.setState({ taskStates: states, activeReport: null })
    useSprintStore.setState({ sprintNumber: 6, day: 10, phase: 'review', confirmingEndDay: false })
  }

  it('13/14 done → delivery-deadline-missed, and sprint 7 is not reachable', () => {
    reviewWithDone(13)
    const r = failCampaignDeadlineMissed()
    expect(r.registered).toBe(true)
    expect(out().status).toBe('failure-pending')
    expect(out().pendingFailure?.reason).toBe('delivery-deadline-missed')
    expect(out().campaignDeadline.status).toBe('missed')
    // the review → planning transition is blocked
    expect(completeSprintAndPrepareNextPlanning()).toEqual({ completed: false })
    expect(useSprintStore.getState().sprintNumber).toBe(6)
  })

  it('14/14 done → deadline met, no defeat, campaign continues', () => {
    reviewWithDone(PRODUCT_TASK_CATALOG.length)
    const r = completeCampaignDeadlineMet()
    expect(r.completed).toBe(true)
    expect(out().campaignDeadline.status).toBe('met')
    expect(out().status).toBe('playing')
    expect(useSprintStore.getState().sprintNumber).toBe(7)
    expect(useSprintStore.getState().phase).toBe('planning')
  })
})

describe('pending failure blocks every game action', () => {
  beforeEach(() => {
    out().registerPendingFailure({
      reason: 'budget-exhausted',
      contributingReasons: [],
      failedAt: { sprintNumber: 3, day: 2 },
      balance: -1,
      productProgressPercent: 0,
      completedProductTasks: 0,
      totalProductTasks: 14,
      completedSprints: 2,
      totalAuditFines: 0,
      unresolvedSecurityFindings: 0,
      unresolvedServerIncidentIds: [],
      primarySourceRef: 'test',
    })
  })

  it('blocks completeWorkday', () => {
    useSprintStore.setState({ confirmingEndDay: true })
    expect(completeWorkday()).toEqual({ completed: false, reason: 'game-outcome-pending' })
  })
  it('blocks hiring', () => {
    expect(hireDeveloper('kirill-morozov').hired).toBe(false)
  })
  it('blocks starting a sprint', () => {
    useSprintStore.setState({ phase: 'planning' })
    expect(startSprintWithPlan().started).toBe(false)
  })
  it('blocks opening a server mini-game', () => {
    useServerIncidentsStore.getState().breakServer('gateway')
    useServerIncidentsStore.getState().beginRepair('gateway')
    expect(useServerIncidentsStore.getState().activeMinigame).toBeNull()
  })
})
