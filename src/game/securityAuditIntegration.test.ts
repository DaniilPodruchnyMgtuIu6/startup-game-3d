import { describe, it, expect, beforeEach } from 'vitest'
import { completeWorkday } from './completeWorkday'
import { useSprintStore } from './sprintStore'
import { useEconomyStore } from './economyStore'
import { useTeamStore } from './teamStore'
import { useProductStore } from './productStore'
import { useSecurityStoryStore } from './securityStoryStore'
import { useSecurityAuditStore, INITIAL_SECURITY_AUDIT } from './securityAuditStore'
import { INITIAL_SECURITY_BREACH } from './securityStoryRules'
import { initialTransactions, calculateBalance, INITIAL_BUDGET } from './economyRules'
import { initialTaskStates } from './productRules'
import { getProductTask } from './productTaskCatalog'

const KIRILL = 'kirill-morozov'
const ALINA = 'alina-belova'
const TECH = 'account-access-review' // Kirill-eligible, effort 3
const balance = () => calculateBalance(useEconomyStore.getState().transactions)
const audit = () => useSecurityAuditStore.getState()
const product = () => useProductStore.getState()
const progressOf = (taskId: string) => product().taskStates.find((s) => s.taskId === taskId)!.progressDays

function plannedStates() {
  // Kirill on auth-api, Alina on login-screen, both planned in the active sprint 2.
  return initialTaskStates().map((s) => {
    if (s.taskId === 'auth-api') return { ...s, status: 'planned' as const, plannedSprintNumber: 2, planOrder: 1 }
    if (s.taskId === 'login-screen') return { ...s, status: 'planned' as const, plannedSprintNumber: 2, planOrder: 2 }
    return s
  })
}

function setup() {
  useSprintStore.setState({ sprintNumber: 2, day: 3, phase: 'active', confirmingEndDay: true })
  useTeamStore.setState({ hires: [{ employeeId: KIRILL, hiredAtSprint: 1, hiredAtDay: 1 }, { employeeId: ALINA, hiredAtSprint: 1, hiredAtDay: 1 }], panelOpen: false })
  useEconomyStore.setState({ transactions: initialTransactions(), panelOpen: false })
  useProductStore.setState({ taskStates: plannedStates(), workdayHistory: [], activeReport: null })
  useSecurityStoryStore.setState({
    securityBreach: { ...INITIAL_SECURITY_BREACH, status: 'completed', decision: 'take-responsibility', effectsApplied: true },
    postAuditConversation: { status: 'completed', staffingDecision: 'approve-security-hire', completedAt: { sprintNumber: 2, day: 2 }, effectsApplied: true },
    hasIntroducedSecuritySpecialist: false,
  })
  useSecurityAuditStore.setState({ ...INITIAL_SECURITY_AUDIT, auditResultToAcknowledge: null })
  window.localStorage.clear()
}

describe('Feature 08 - completeWorkday with security work', () => {
  beforeEach(setup)

  it('a developer diverted to security makes no product progress; the other continues', () => {
    audit().initializeCorrectiveActionPlan({ currentWorkdayIndex: 13, staffingDecision: 'approve-security-hire' })
    expect(audit().assignFinding(TECH, KIRILL).assigned).toBe(true)

    const result = completeWorkday()
    expect(result.completed).toBe(true)

    // security +1 on Kirill's finding
    expect(audit().findings.find((f) => f.findingId === TECH)!.progressDays).toBe(1)
    // Kirill product +0, Alina +1
    expect(progressOf('auth-api')).toBe(0)
    expect(progressOf('login-screen')).toBe(1)

    // daily report shows Kirill diverted + Alina progress
    const report = product().activeReport!
    const kirill = report.employeeResults.find((r) => r.employeeId === KIRILL)!
    expect(kirill.idleReason).toBe('security-diverted')
    expect(report.employeeResults.find((r) => r.employeeId === ALINA)!.afterProgressDays).toBe(1)

    // finance still 37 000 ₽ for the day (salaries charged regardless of diversion)
    expect(balance()).toBe(INITIAL_BUDGET - 37_000)
  })

  it('an unassigned developer keeps normal product progress', () => {
    audit().initializeCorrectiveActionPlan({ currentWorkdayIndex: 13, staffingDecision: 'approve-security-hire' })
    completeWorkday()
    expect(progressOf('auth-api')).toBe(1)
    expect(progressOf('login-screen')).toBe(1)
  })
})

describe('Feature 08 - follow-up audit lifecycle through completeWorkday', () => {
  beforeEach(setup)

  it('deadline day creates a pending audit that then blocks the next day until resolved', () => {
    // deadline is the current workday index (sprint 2 day 3 -> 13), so it fires now
    audit().initializeCorrectiveActionPlan({ currentWorkdayIndex: 13, overdue: true, staffingDecision: 'approve-security-hire' })
    // leave a finding open -> the audit will fail

    const result = completeWorkday()
    expect(result.auditScheduleResult).toEqual({ scheduled: true, auditNumber: 1 })
    expect(audit().followUpAudit.status).toBe('pending')

    // the next day is blocked until the audit is resolved
    useSprintStore.setState({ confirmingEndDay: true, phase: 'active' })
    expect(completeWorkday()).toEqual({ completed: false, reason: 'required-follow-up-audit' })

    // resolve (what the follow-up scene does): fine applied, next deadline set
    const resolved = audit().resolvePendingAudit({ sprintNumber: 2, day: 4 })
    expect(resolved.evaluation?.fineAmount).toBe(120_000)
    expect(balance()).toBe(INITIAL_BUDGET - 37_000 - 120_000) // day expense + fine
    expect(audit().followUpAudit.status).toBe('scheduled')

    // once resolved, the day can complete again
    useSprintStore.setState({ confirmingEndDay: true, phase: 'active' })
    expect(completeWorkday().completed).toBe(true)
  })
})
