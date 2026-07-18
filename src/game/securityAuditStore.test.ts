import { describe, it, expect, beforeEach } from 'vitest'
import {
  useSecurityAuditStore,
  INITIAL_SECURITY_AUDIT,
  CLOSE_AUDIT_FINDINGS_TASK,
  loadSecurityAudit,
  saveSecurityAudit,
} from './securityAuditStore'
import { useTeamStore } from './teamStore'
import { useGameStore } from './gameStore'
import { useEconomyStore } from './economyStore'
import { useSecurityStoryStore, CLOSE_FINDINGS_TASK } from './securityStoryStore'
import { INITIAL_SECURITY_BREACH } from './securityStoryRules'
import { initialTransactions, calculateBalance, INITIAL_BUDGET, auditFineTransactionId } from './economyRules'
import { BOARD_TASKS } from './tasks'
import { toWorkdayIndex } from './workdayIndex'

const KIRILL = 'kirill-morozov'
const ALINA = 'alina-belova'
const ILYA = 'ilya-vlasov'
const SONYA = 'sonya-sokolova'
const PROCESS = 'workstation-locking-training' // effort 2
const TECH = 'account-access-review' // effort 3

const audit = () => useSecurityAuditStore.getState()
const findings = () => audit().findings
const finding = (id: string) => findings().find((f) => f.findingId === id)!
const KEY = 'startup-office-security-audit'
const balance = () => calculateBalance(useEconomyStore.getState().transactions)
const taskDone = (id: string) => useGameStore.getState().tasks.find((t) => t.id === id)?.done

function fakeStorage(init: Record<string, string> = {}) {
  const data = new Map(Object.entries(init))
  return {
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => void data.set(k, v),
    removeItem: (k: string) => void data.delete(k),
  }
}

function hire(employeeId: string) {
  return { employeeId, hiredAtSprint: 1, hiredAtDay: 1 }
}

function reset(decision: 'approve-security-hire' | 'decline-security-hire' = 'approve-security-hire') {
  useSecurityAuditStore.setState({ ...INITIAL_SECURITY_AUDIT, auditResultToAcknowledge: null })
  useTeamStore.setState({ hires: [hire(KIRILL), hire(ALINA), hire(ILYA)], panelOpen: false })
  useEconomyStore.setState({ transactions: initialTransactions(), panelOpen: false })
  useGameStore.setState({ tasks: [...BOARD_TASKS.map((t) => ({ ...t })), { ...CLOSE_FINDINGS_TASK }] })
  useSecurityStoryStore.setState({
    securityBreach: { ...INITIAL_SECURITY_BREACH, status: 'completed', decision: 'take-responsibility', effectsApplied: true },
    postAuditConversation: { status: 'completed', staffingDecision: decision, completedAt: { sprintNumber: 2, day: 2 }, effectsApplied: true },
    hasIntroducedSecuritySpecialist: false,
  })
  window.localStorage.clear()
}

const initPlan = (currentWorkdayIndex = 12, decision: 'approve-security-hire' | 'decline-security-hire' = 'approve-security-hire') =>
  audit().initializeCorrectiveActionPlan({ currentWorkdayIndex, staffingDecision: decision })

describe('initializeCorrectiveActionPlan', () => {
  beforeEach(() => reset())

  it('creates four open findings, schedules the audit at current + 9, and is idempotent', () => {
    const r = initPlan(12)
    expect(r).toEqual({ initialized: true })
    expect(audit().initialized).toBe(true)
    expect(audit().findings).toHaveLength(4)
    expect(audit().followUpAudit.status).toBe('scheduled')
    expect(audit().followUpAudit.nextAuditWorkdayIndex).toBe(21)
    // approve branch gets the close-audit-findings task
    expect(useGameStore.getState().tasks.some((t) => t.id === CLOSE_AUDIT_FINDINGS_TASK.id)).toBe(true)

    // re-init does not reset progress or the deadline
    audit().assignFinding(PROCESS, SONYA)
    audit().applySecurityWorkday(2, 3)
    const before = finding(PROCESS).progressDays
    expect(initPlan(99)).toEqual({ initialized: false })
    expect(finding(PROCESS).progressDays).toBe(before)
    expect(audit().followUpAudit.nextAuditWorkdayIndex).toBe(21)
  })

  it('overdue migration schedules the audit for the current day', () => {
    audit().initializeCorrectiveActionPlan({ currentWorkdayIndex: 40, overdue: true, staffingDecision: 'approve-security-hire' })
    expect(audit().followUpAudit.nextAuditWorkdayIndex).toBe(40)
  })

  it('decline branch does not add the approve task', () => {
    reset('decline-security-hire')
    initPlan(12, 'decline-security-hire')
    expect(useGameStore.getState().tasks.some((t) => t.id === CLOSE_AUDIT_FINDINGS_TASK.id)).toBe(false)
  })
})

describe('assignment through the store', () => {
  beforeEach(() => {
    reset()
    initPlan(12)
  })

  it('assigns eligible employees and blocks a busy employee / ineligible pair', () => {
    expect(audit().assignFinding(PROCESS, SONYA)).toEqual({ assigned: true })
    expect(audit().assignFinding(TECH, ALINA)).toEqual({ assigned: false, reason: 'not-eligible' })
    // Ilya busy elsewhere
    expect(audit().assignFinding(TECH, ILYA)).toEqual({ assigned: true })
    expect(audit().assignFinding('sensitive-data-logging-review', ILYA)).toEqual({ assigned: false, reason: 'employee-busy' })
    audit().unassignFinding(TECH)
    expect(audit().assignFinding('sensitive-data-logging-review', ILYA)).toEqual({ assigned: true })
  })

  it('Ilya cannot be assigned when not really hired', () => {
    useTeamStore.setState({ hires: [hire(KIRILL), hire(ALINA)] }) // no Ilya
    expect(audit().assignFinding(PROCESS, ILYA)).toEqual({ assigned: false, reason: 'not-eligible' })
  })

  it('assignment is blocked while an audit is pending', () => {
    useSecurityAuditStore.setState({ followUpAudit: { ...audit().followUpAudit, status: 'pending', pendingAuditNumber: 1 } })
    expect(audit().assignFinding(PROCESS, SONYA)).toEqual({ assigned: false, reason: 'audit-in-progress' })
  })
})

describe('applySecurityWorkday', () => {
  beforeEach(() => {
    reset()
    initPlan(12)
    audit().assignFinding(TECH, KIRILL)
  })

  it('advances one day, diverts Kirill, and is idempotent per day', () => {
    const r = audit().applySecurityWorkday(2, 3)
    expect(r.applied).toBe(true)
    expect(r.divertedEmployeeIds).toEqual([KIRILL])
    expect(finding(TECH).progressDays).toBe(1)

    const again = audit().applySecurityWorkday(2, 3)
    expect(again.applied).toBe(false)
    expect(again.divertedEmployeeIds).toEqual([KIRILL])
    expect(finding(TECH).progressDays).toBe(1) // not doubled
  })

  it('closes the finding once effort is met and frees the assignee', () => {
    audit().applySecurityWorkday(2, 3)
    audit().applySecurityWorkday(2, 4)
    audit().applySecurityWorkday(2, 5) // effort 3 -> closed
    expect(finding(TECH).status).toBe('closed')
    expect(finding(TECH).assignedEmployeeId).toBeUndefined()
  })
})

describe('scheduling & resolving the follow-up audit', () => {
  beforeEach(() => {
    reset()
    initPlan(12) // deadline index 21 (sprint 3 day 1)
  })

  it('does not schedule before the deadline, then creates pending on the deadline day', () => {
    expect(audit().schedulePendingAuditIfDue(2, 10)).toEqual({ scheduled: false }) // index 20 < 21
    expect(audit().schedulePendingAuditIfDue(3, 1)).toEqual({ scheduled: true, auditNumber: 1 }) // index 21
    expect(audit().followUpAudit.status).toBe('pending')
    expect(audit().followUpAudit.pendingAuditNumber).toBe(1)
  })

  it('passed audit: no fine, status passed, branch task done, no next audit', () => {
    // close all findings
    useSecurityAuditStore.setState({
      findings: findings().map((f) => ({ findingId: f.findingId, status: 'closed' as const, progressDays: 9 })),
    })
    audit().schedulePendingAuditIfDue(3, 1)
    const res = audit().resolvePendingAudit({ sprintNumber: 3, day: 1 })
    expect(res.evaluation?.passed).toBe(true)
    expect(audit().followUpAudit.status).toBe('passed')
    expect(audit().followUpAudit.nextAuditWorkdayIndex).toBeUndefined()
    expect(balance()).toBe(INITIAL_BUDGET) // no fine
    expect(taskDone(CLOSE_AUDIT_FINDINGS_TASK.id)).toBe(true)
  })

  it('first failure: 120k fine, no complaint, next deadline +10, idempotent', () => {
    audit().schedulePendingAuditIfDue(3, 1)
    const res = audit().resolvePendingAudit({ sprintNumber: 3, day: 1 })
    expect(res.evaluation).toMatchObject({ passed: false, fineAmount: 120_000, leadershipComplaint: false })
    expect(balance()).toBe(INITIAL_BUDGET - 120_000)
    expect(audit().followUpAudit.records[0].fineTransactionId).toBe(auditFineTransactionId(1))
    expect(audit().followUpAudit.status).toBe('scheduled')
    expect(audit().followUpAudit.nextAuditWorkdayIndex).toBe(toWorkdayIndex(3, 1) + 10) // 31
    expect(audit().leadershipComplaint).toBe(false)

    // re-resolving does not double the fine
    const again = audit().resolvePendingAudit({ sprintNumber: 3, day: 1 })
    expect(again.resolved).toBe(false)
    expect(balance()).toBe(INITIAL_BUDGET - 120_000)
  })

  it('second failure creates a leadership complaint (250k)', () => {
    useSecurityAuditStore.setState({ followUpAudit: { ...audit().followUpAudit, records: [{ auditNumber: 1, evaluatedAt: { sprintNumber: 3, day: 1 }, result: 'failed', unresolvedFindingIds: [PROCESS], fineAmount: 120_000 }] } })
    audit().schedulePendingAuditIfDue(4, 1)
    const res = audit().resolvePendingAudit({ sprintNumber: 4, day: 1 })
    expect(res.evaluation).toMatchObject({ fineAmount: 250_000, leadershipComplaint: true, shutdownRecommendation: false })
    expect(audit().leadershipComplaint).toBe(true)
    expect(audit().followUpAudit.status).toBe('scheduled')
  })

  it('third failure escalates to critical with a shutdown recommendation (500k), no next audit', () => {
    useSecurityAuditStore.setState({
      followUpAudit: {
        ...audit().followUpAudit,
        records: [
          { auditNumber: 1, evaluatedAt: { sprintNumber: 3, day: 1 }, result: 'failed', unresolvedFindingIds: [PROCESS], fineAmount: 120_000 },
          { auditNumber: 2, evaluatedAt: { sprintNumber: 4, day: 1 }, result: 'failed', unresolvedFindingIds: [PROCESS], fineAmount: 250_000 },
        ],
      },
    })
    audit().schedulePendingAuditIfDue(5, 1)
    const res = audit().resolvePendingAudit({ sprintNumber: 5, day: 1 })
    expect(res.evaluation).toMatchObject({ fineAmount: 500_000, shutdownRecommendation: true })
    expect(audit().followUpAudit.status).toBe('critical-escalation')
    expect(audit().shutdownRecommendation).toBe(true)
    expect(audit().followUpAudit.nextAuditWorkdayIndex).toBeUndefined()
  })

  it('decline branch closes the F06 task on pass', () => {
    reset('decline-security-hire')
    initPlan(12, 'decline-security-hire')
    useSecurityAuditStore.setState({ findings: findings().map((f) => ({ findingId: f.findingId, status: 'closed' as const, progressDays: 9 })) })
    audit().schedulePendingAuditIfDue(3, 1)
    audit().resolvePendingAudit({ sprintNumber: 3, day: 1 })
    expect(taskDone(CLOSE_FINDINGS_TASK.id)).toBe(true)
  })
})

describe('persistence & reset', () => {
  beforeEach(() => reset())

  it('a running audit hydrates back to pending', () => {
    initPlan(12)
    useSecurityAuditStore.setState({ followUpAudit: { ...audit().followUpAudit, status: 'running', pendingAuditNumber: 1 } })
    saveSecurityAudit(window.localStorage, {
      initialized: true,
      findings: findings(),
      followUpAudit: audit().followUpAudit,
      leadershipComplaint: false,
      shutdownRecommendation: false,
      workdayHistory: [],
    })
    const loaded = loadSecurityAudit(window.localStorage, '')
    expect(loaded.followUpAudit.status).toBe('pending')
  })

  it('an uninitialised save loads the empty plan', () => {
    expect(loadSecurityAudit(fakeStorage(), '')).toEqual(INITIAL_SECURITY_AUDIT)
  })

  it('?intro wipes the audit state', () => {
    const storage = fakeStorage({ [KEY]: JSON.stringify({ initialized: true, findings: [] }) })
    expect(loadSecurityAudit(storage, '?intro')).toEqual(INITIAL_SECURITY_AUDIT)
  })

  it('reset returns to the empty plan', () => {
    initPlan(12)
    audit().resetSecurityAudit()
    expect(audit().initialized).toBe(false)
    expect(audit().findings).toEqual([])
  })
})
