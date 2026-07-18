import { describe, it, expect } from 'vitest'
import {
  CAMPAIGN_DEADLINE_SPRINT,
  buildGameFailureSnapshot,
  countServerDowntimeDays,
  evaluateGameFailureConditions,
  getGameFailurePriority,
  initialGameOutcome,
  isLeadershipSuspensionDue,
  normalizeGameOutcome,
  type GameOutcomeEvaluationSnapshot,
} from './gameOutcomeRules'
import type { MoneyTransaction } from './economyRules'

function snap(overrides: Partial<GameOutcomeEvaluationSnapshot> = {}): GameOutcomeEvaluationSnapshot {
  return {
    sprintNumber: 3,
    day: 2,
    completedSprints: 2,
    balance: 100_000,
    productProgressPercent: 40,
    completedProductTasks: 5,
    totalProductTasks: 14,
    shutdownRecommendation: false,
    leadershipReviewStatus: 'inactive',
    currentWorkdayIndex: 22,
    unresolvedSecurityFindings: 0,
    unresolvedServerIncidents: [],
    campaignDeadlineSprint: 6,
    campaignDeadlineStatus: 'active',
    ...overrides,
  }
}

describe('initial outcome + constants', () => {
  it('starts playing with an inactive review and the sprint-6 deadline', () => {
    const s = initialGameOutcome()
    expect(s.status).toBe('playing')
    expect(s.leadershipReview.status).toBe('inactive')
    expect(s.campaignDeadline).toEqual({ deadlineSprintNumber: CAMPAIGN_DEADLINE_SPRINT, status: 'active' })
    expect(CAMPAIGN_DEADLINE_SPRINT).toBe(6)
  })
})

describe('evaluateGameFailureConditions — budget', () => {
  it('balance 1 does not fail', () => expect(evaluateGameFailureConditions(snap({ balance: 1 })).primaryReason).toBeUndefined())
  it('balance 0 fails with budget-exhausted', () => expect(evaluateGameFailureConditions(snap({ balance: 0 })).primaryReason).toBe('budget-exhausted'))
  it('balance -1 fails with budget-exhausted', () => expect(evaluateGameFailureConditions(snap({ balance: -1 })).primaryReason).toBe('budget-exhausted'))
})

describe('evaluateGameFailureConditions — leadership / service / deadline', () => {
  it('leadership review failed → leadership-suspension', () => {
    expect(evaluateGameFailureConditions(snap({ leadershipReviewStatus: 'failed' })).primaryReason).toBe('leadership-suspension')
  })
  it('4 downtime days do not collapse', () => {
    const s = snap({ unresolvedServerIncidents: [{ incidentId: 'auth-account-incident', downtimeDays: 4, status: 'recovering' }] })
    expect(evaluateGameFailureConditions(s).primaryReason).toBeUndefined()
  })
  it('5 downtime days on an unresolved incident → service-collapse', () => {
    const s = snap({ unresolvedServerIncidents: [{ incidentId: 'auth-account-incident', downtimeDays: 5, status: 'recovery-required' }] })
    expect(evaluateGameFailureConditions(s).primaryReason).toBe('service-collapse')
  })
  it('a resolved incident with 5 downtime days is ignored', () => {
    const s = snap({ unresolvedServerIncidents: [{ incidentId: 'auth-account-incident', downtimeDays: 5, status: 'resolved' }] })
    expect(evaluateGameFailureConditions(s).primaryReason).toBeUndefined()
  })
  it('missed campaign deadline → delivery-deadline-missed', () => {
    expect(evaluateGameFailureConditions(snap({ campaignDeadlineStatus: 'missed' })).primaryReason).toBe('delivery-deadline-missed')
  })
  it('an active deadline never fails', () => {
    expect(evaluateGameFailureConditions(snap({ campaignDeadlineStatus: 'active' })).primaryReason).toBeUndefined()
  })
})

describe('priority', () => {
  it('budget > leadership > service > deadline', () => {
    expect(getGameFailurePriority('budget-exhausted')).toBeLessThan(getGameFailurePriority('leadership-suspension'))
    expect(getGameFailurePriority('leadership-suspension')).toBeLessThan(getGameFailurePriority('service-collapse'))
    expect(getGameFailurePriority('service-collapse')).toBeLessThan(getGameFailurePriority('delivery-deadline-missed'))
  })
  it('picks the highest priority as primary and keeps the rest as contributing', () => {
    const s = snap({
      balance: -1,
      leadershipReviewStatus: 'failed',
      unresolvedServerIncidents: [{ incidentId: 'auth-account-incident', downtimeDays: 6, status: 'recovering' }],
    })
    const e = evaluateGameFailureConditions(s)
    expect(e.primaryReason).toBe('budget-exhausted')
    expect(e.contributingReasons).toEqual(['leadership-suspension', 'service-collapse'])
  })
})

describe('countServerDowntimeDays', () => {
  const tx = (id: string, category: MoneyTransaction['category']): MoneyTransaction => ({ id, kind: 'expense', category, title: 't', amount: 1, sprintNumber: 1, day: 1 })
  it('counts unique downtime ids for the incident, ignoring other categories/incidents', () => {
    const txs: MoneyTransaction[] = [
      tx('server-downtime:auth-account-incident:sprint-3:day-2', 'service-downtime'),
      tx('server-downtime:auth-account-incident:sprint-3:day-3', 'service-downtime'),
      tx('server-downtime:gateway-outage:sprint-3:day-2', 'service-downtime'),
      tx('server-incident:auth-account-incident', 'server-incident'),
    ]
    expect(countServerDowntimeDays(txs, 'auth-account-incident')).toBe(2)
    expect(countServerDowntimeDays(txs, 'gateway-outage')).toBe(1)
    expect(countServerDowntimeDays(txs, 'database-exposure-review')).toBe(0)
  })
})

describe('isLeadershipSuspensionDue', () => {
  it('is due only on/after the due index', () => {
    expect(isLeadershipSuspensionDue(26, 27)).toBe(false)
    expect(isLeadershipSuspensionDue(27, 27)).toBe(true)
    expect(isLeadershipSuspensionDue(28, 27)).toBe(true)
  })
})

describe('buildGameFailureSnapshot', () => {
  it('captures the context and dedupes/excludes the primary from contributing', () => {
    const s = buildGameFailureSnapshot('budget-exhausted', ['leadership-suspension', 'leadership-suspension', 'budget-exhausted'], {
      failedAt: { sprintNumber: 4, day: 7 },
      balance: -45_000,
      productProgressPercent: 71,
      completedProductTasks: 10,
      totalProductTasks: 14,
      completedSprints: 3,
      totalAuditFines: 370_000,
      unresolvedSecurityFindings: 2,
      unresolvedServerIncidentIds: ['auth-account-incident'],
      primarySourceRef: 'complete-workday:sprint-4:day-7',
    })
    expect(s.reason).toBe('budget-exhausted')
    expect(s.contributingReasons).toEqual(['leadership-suspension'])
    expect(s.balance).toBe(-45_000)
    expect(s.failedAt).toEqual({ sprintNumber: 4, day: 7 })
    expect(s.totalAuditFines).toBe(370_000)
  })
})

describe('normalizeGameOutcome', () => {
  it('invalid status → playing', () => {
    expect(normalizeGameOutcome({ status: 'bogus' }).status).toBe('playing')
  })
  it('pending/failed without a valid snapshot → playing', () => {
    expect(normalizeGameOutcome({ status: 'failure-pending' }).status).toBe('playing')
    expect(normalizeGameOutcome({ status: 'failed', failure: { reason: 'nope' } }).status).toBe('playing')
  })
  it('keeps a valid failed snapshot', () => {
    const raw = {
      status: 'failed',
      failure: { reason: 'budget-exhausted', failedAt: { sprintNumber: 4, day: 7 }, contributingReasons: ['budget-exhausted', 'service-collapse'], balance: -1 },
    }
    const n = normalizeGameOutcome(raw)
    expect(n.status).toBe('failed')
    expect(n.failure?.reason).toBe('budget-exhausted')
    expect(n.failure?.contributingReasons).toEqual(['service-collapse']) // primary excluded, deduped
  })
  it('normalises an out-of-range day and deadline sprint', () => {
    const n = normalizeGameOutcome({ status: 'failed', failure: { reason: 'budget-exhausted', failedAt: { sprintNumber: 2, day: 99 } }, campaignDeadline: { deadlineSprintNumber: -3, status: 'active' } })
    expect(n.failure?.failedAt.day).toBe(10)
    expect(n.campaignDeadline.deadlineSprintNumber).toBe(6)
  })
  it('repairs a leadership due earlier than start', () => {
    const n = normalizeGameOutcome({ status: 'playing', leadershipReview: { status: 'grace-period', startedAtWorkdayIndex: 20, dueWorkdayIndex: 5 } })
    expect(n.leadershipReview.dueWorkdayIndex).toBe(25)
  })
  it('drops metAt-less met deadline moment but keeps met status', () => {
    const n = normalizeGameOutcome({ status: 'playing', campaignDeadline: { deadlineSprintNumber: 6, status: 'met' } })
    expect(n.campaignDeadline.status).toBe('met')
    expect(n.campaignDeadline.metAt).toBeUndefined()
  })
})
