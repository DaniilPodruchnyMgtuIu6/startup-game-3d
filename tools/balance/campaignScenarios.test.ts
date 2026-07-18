import { describe, it, expect } from 'vitest'
import {
  runCleanCampaign,
  resetCampaign,
  hireDevelopers,
  developUntilComplete,
  injectServerIncident,
  completeDay,
  releaseMvp,
  buildResult,
} from './campaignSimulator'
import { useEconomyStore } from '../../src/game/economyStore'
import { useSprintStore } from '../../src/game/sprintStore'
import { useProductStore } from '../../src/game/productStore'
import { useGameOutcomeStore } from '../../src/game/gameOutcomeStore'
import { failCampaignDeadlineMissed } from '../../src/game/completeSprintReview'
import { initialTaskStates } from '../../src/game/productRules'

const log = (tag: string, obj: unknown) => {
  // eslint-disable-next-line no-console
  console.log(tag, JSON.stringify(obj))
}

// --- Wins --------------------------------------------------------------------

const releaseDay = (m: { sprintNumber: number; day: number }) => (m.sprintNumber - 1) * 10 + m.day

describe('BAL wins', () => {
  it('BAL-01/13 — disciplined path with Ilya: win in the target window and budget band', () => {
    const r = runCleanCampaign({ withIlya: true, withCorrectivePlan: true })
    log('BAL-01', { outcome: r.outcome, release: r.releaseMoment, budget: r.finalBudget, score: r.finalScore, salary: r.salaryCost, fines: r.auditFines, sec: r.securityWorkdaysByEmployee })
    expect(r.outcome).toBe('win')
    // §11 release window: not before mid-sprint 4, not after sprint 5 (clean expert path)
    expect(releaseDay(r.releaseMoment!)).toBeGreaterThanOrEqual(35)
    expect(releaseDay(r.releaseMoment!)).toBeLessThanOrEqual(50)
    // §11 winner budget band with Ilya
    expect(r.finalBudget).toBeGreaterThanOrEqual(250_000)
    expect(r.finalBudget).toBeLessThanOrEqual(900_000)
    expect(r.finalScore ?? 0).toBeGreaterThanOrEqual(75)
    expect(r.auditFines).toBe(0) // disciplined: findings closed before the audit
    // Ilya (not Kirill) closes the findings — no product diversion
    expect(r.securityWorkdaysByEmployee['kirill-morozov'] ?? 0).toBe(0)
  })

  it('BAL-02 — disciplined path without Ilya: winnable, harder, in its band', () => {
    const r = runCleanCampaign({ withIlya: false, withCorrectivePlan: true })
    log('BAL-02', { outcome: r.outcome, release: r.releaseMoment, budget: r.finalBudget, salary: r.salaryCost, fines: r.auditFines, sec: r.securityWorkdaysByEmployee })
    expect(r.outcome).toBe('win')
    expect(r.releaseMoment!.sprintNumber).toBeLessThanOrEqual(6)
    // §11 winner budget band without Ilya
    expect(r.finalBudget).toBeGreaterThanOrEqual(150_000)
    expect(r.finalBudget).toBeLessThanOrEqual(900_000)
    expect(r.auditFines).toBe(0)
    // Kirill IS diverted to the technical findings on this branch (more than BAL-01)
    expect(r.securityWorkdaysByEmployee['kirill-morozov'] ?? 0).toBeGreaterThan(0)
  })

  it('BAL-03/05/07 — one server incident (recovered) still wins with a lower budget', () => {
    resetCampaign({ withIlya: true })
    hireDevelopers()
    developUntilComplete(6)
    const budgetBefore = useEconomyStore.getState().transactions.length
    injectServerIncident('auth-account-incident', 'ilya-vlasov', true) // immediate cost
    completeDay() // charges one downtime day, Ilya recovers (effort 1) → resolved
    expect(useGameOutcomeStore.getState().status).toBe('playing')
    const released = releaseMvp()
    const r = buildResult()
    log('BAL-03', { released, outcome: r.outcome, budget: r.finalBudget, incident: r.incidentCosts, downtime: r.downtimeCosts })
    expect(r.outcome).toBe('win')
    // §11 recovered-path band: positive but noticeably below the clean paths
    expect(r.finalBudget).toBeGreaterThan(0)
    expect(r.finalBudget).toBeLessThanOrEqual(450_000)
    expect(r.incidentCosts).toBeGreaterThan(0) // the mistake had a real, one-time cost
    expect(useEconomyStore.getState().transactions.length).toBeGreaterThan(budgetBefore)
  })
})

// --- Ilya trade-off ----------------------------------------------------------

describe('BAL Ilya trade-off', () => {
  it('Ilya trades a visible salary for keeping Kirill on product (not strictly dominant)', () => {
    const withIlya = runCleanCampaign({ withIlya: true, withCorrectivePlan: true })
    const without = runCleanCampaign({ withIlya: false, withCorrectivePlan: true })
    log('ILYA-TABLE', {
      withIlya: { budget: withIlya.finalBudget, salary: withIlya.salaryCost, release: withIlya.releaseMoment, kirillDiverted: withIlya.securityWorkdaysByEmployee['kirill-morozov'] ?? 0 },
      without: { budget: without.finalBudget, salary: without.salaryCost, release: without.releaseMoment, kirillDiverted: without.securityWorkdaysByEmployee['kirill-morozov'] ?? 0 },
      salaryDelta: withIlya.salaryCost - without.salaryCost,
    })
    // his salary is a real, noticeable cost...
    expect(withIlya.salaryCost).toBeGreaterThan(without.salaryCost)
    // ...but he saves Kirill's product days (the MVP ships earlier)
    expect(withIlya.securityWorkdaysByEmployee['kirill-morozov'] ?? 0).toBeLessThan(without.securityWorkdaysByEmployee['kirill-morozov'] ?? 0)
    expect(releaseDay(withIlya.releaseMoment!)).toBeLessThan(releaseDay(without.releaseMoment!))
    // both branches are winnable → hiring is not strictly required, refusing is not a trap
    expect(withIlya.outcome).toBe('win')
    expect(without.outcome).toBe('win')
  })
})

// --- Losses reachable (BAL-09/12; leadership/service proven in F12 integration) ---

describe('BAL losses reachable', () => {
  it('BAL-09 — mandatory day expenses can exhaust the budget → budget-exhausted loss', () => {
    resetCampaign({ withIlya: false })
    hireDevelopers()
    // far less than a single day's operating cost
    useEconomyStore.setState({ transactions: [{ id: 'initial-funding', kind: 'income', category: 'funding', title: 'Финансирование', amount: 1000, sprintNumber: 0, day: 0 }], panelOpen: false })
    // must be in an active sprint to complete a day
    useProductStore.getState().addTaskToPlan('auth-api')
    useProductStore.getState().addTaskToPlan('login-screen')
    useSprintStore.getState().startSprint()
    completeDay()
    expect(useGameOutcomeStore.getState().status).toBe('failure-pending')
    expect(useGameOutcomeStore.getState().pendingFailure?.reason).toBe('budget-exhausted')
  })

  it('BAL-12 — unfinished tasks at the sprint-6 review → delivery-deadline-missed loss', () => {
    resetCampaign({ withIlya: false })
    const states = initialTaskStates().map((s, i) => (i < 13 ? { ...s, status: 'done' as const, completedAt: { sprintNumber: 6, day: 10 } } : s))
    useProductStore.setState({ taskStates: states })
    useSprintStore.setState({ sprintNumber: 6, day: 10, phase: 'review', confirmingEndDay: false })
    const res = failCampaignDeadlineMissed()
    expect(res.registered).toBe(true)
    expect(useGameOutcomeStore.getState().pendingFailure?.reason).toBe('delivery-deadline-missed')
    expect(useSprintStore.getState().sprintNumber).toBe(6) // cannot advance to sprint 7
  })
})
