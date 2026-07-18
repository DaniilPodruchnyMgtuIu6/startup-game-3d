import { describe, it, expect, beforeEach } from 'vitest'
import { useGameOutcomeStore } from './gameOutcomeStore'
import { useRiskStore } from './riskStore'
import type { GameFailureSnapshot } from './gameOutcomeRules'

const out = () => useGameOutcomeStore.getState()

function snapshot(reason: GameFailureSnapshot['reason'] = 'budget-exhausted'): GameFailureSnapshot {
  return {
    reason,
    contributingReasons: [],
    failedAt: { sprintNumber: 3, day: 4 },
    balance: -1,
    productProgressPercent: 40,
    completedProductTasks: 5,
    totalProductTasks: 14,
    completedSprints: 2,
    totalAuditFines: 0,
    unresolvedSecurityFindings: 0,
    unresolvedServerIncidentIds: [],
    primarySourceRef: 'test',
  }
}

beforeEach(() => {
  window.localStorage.clear()
  useRiskStore.setState({ signals: [] })
  out().resetGameOutcome()
})

describe('initial state + reset', () => {
  it('is playing with an inactive review and sprint-6 deadline', () => {
    expect(out().status).toBe('playing')
    expect(out().leadershipReview.status).toBe('inactive')
    expect(out().campaignDeadline.deadlineSprintNumber).toBe(6)
  })
  it('reset clears a registered failure', () => {
    out().registerPendingFailure(snapshot())
    out().markFailureScreenOpened()
    out().resetGameOutcome()
    expect(out().status).toBe('playing')
    expect(out().failure).toBeUndefined()
    expect(out().pendingFailure).toBeUndefined()
  })
})

describe('register + open', () => {
  it('registers once and ignores a second registration', () => {
    expect(out().registerPendingFailure(snapshot('budget-exhausted')).registered).toBe(true)
    expect(out().status).toBe('failure-pending')
    expect(out().registerPendingFailure(snapshot('service-collapse')).registered).toBe(false)
    expect(out().pendingFailure?.reason).toBe('budget-exhausted')
  })
  it('markFailureScreenOpened moves pending → failed with the snapshot', () => {
    out().registerPendingFailure(snapshot())
    out().markFailureScreenOpened()
    expect(out().status).toBe('failed')
    expect(out().failure?.reason).toBe('budget-exhausted')
    expect(out().pendingFailure).toBeUndefined()
  })
})

describe('leadership grace', () => {
  it('arms a five-day deadline and is idempotent', () => {
    expect(out().startLeadershipGracePeriod(22).changed).toBe(true)
    expect(out().leadershipReview).toMatchObject({ status: 'grace-period', startedAtWorkdayIndex: 22, dueWorkdayIndex: 27 })
    expect(out().startLeadershipGracePeriod(99).changed).toBe(false)
    expect(out().leadershipReview.dueWorkdayIndex).toBe(27)
  })

  it('recovers when all findings are closed (any time up to due) and emits the signal once', () => {
    out().startLeadershipGracePeriod(22)
    const r = out().resolveLeadershipReview({ currentWorkdayIndex: 24, allFindingsClosed: true, moment: { sprintNumber: 3, day: 4 } })
    expect(r.status).toBe('recovered')
    expect(useRiskStore.getState().signals.filter((s) => s.id === 'leadership-review:recovered:governance')).toHaveLength(1)
    // a second resolve does nothing (no longer grace-period, no duplicate signal)
    out().resolveLeadershipReview({ currentWorkdayIndex: 25, allFindingsClosed: true, moment: { sprintNumber: 3, day: 5 } })
    expect(useRiskStore.getState().signals.filter((s) => s.id === 'leadership-review:recovered:governance')).toHaveLength(1)
  })

  it('does not resolve before the due day with an open finding', () => {
    out().startLeadershipGracePeriod(22)
    const r = out().resolveLeadershipReview({ currentWorkdayIndex: 26, allFindingsClosed: false, moment: { sprintNumber: 3, day: 6 } })
    expect(r.changed).toBe(false)
    expect(out().leadershipReview.status).toBe('grace-period')
  })

  it('fails on/after the due day with an open finding', () => {
    out().startLeadershipGracePeriod(22)
    const r = out().resolveLeadershipReview({ currentWorkdayIndex: 27, allFindingsClosed: false, moment: { sprintNumber: 3, day: 7 } })
    expect(r.status).toBe('failed')
    expect(out().leadershipReview.status).toBe('failed')
  })
})

describe('campaign deadline', () => {
  it('marks met once', () => {
    expect(out().markCampaignDeadlineMet({ sprintNumber: 6, day: 10 }).changed).toBe(true)
    expect(out().campaignDeadline.status).toBe('met')
    expect(out().markCampaignDeadlineMissed().changed).toBe(false)
  })
  it('marks missed once', () => {
    expect(out().markCampaignDeadlineMissed().changed).toBe(true)
    expect(out().campaignDeadline.status).toBe('missed')
  })
})
