import { describe, it, expect, beforeEach } from 'vitest'
import {
  useAccessControlStore,
  INITIAL_ACCESS_CONTROL_DATA,
  REVIEW_ACCESS_CONTROL_TASK,
  IMPLEMENT_ACCESS_CONTROL_TASK,
  REVIEW_ACCESS_LOGS_TASK,
} from './accessControlStore'
import { useGameStore } from './gameStore'
import { useEconomyStore } from './economyStore'
import { useRiskStore } from './riskStore'
import { useTeamStore } from './teamStore'
import { useSecurityAuditStore, INITIAL_SECURITY_AUDIT } from './securityAuditStore'
import { initialTransactions, calculateBalance, INITIAL_BUDGET, ACCESS_CONTROL_INVESTMENT_COST } from './economyRules'
import { getActualRiskScore } from './riskRules'
import { initializeSecurityFindings, assignFindingState } from './securityAuditRules'
import { BOARD_TASKS } from './tasks'

const ac = () => useAccessControlStore.getState()
const balance = () => calculateBalance(useEconomyStore.getState().transactions)
const moment = { sprintNumber: 3, day: 2 }
const taskDone = (id: string) => useGameStore.getState().tasks.find((t) => t.id === id)?.done
const taskExists = (id: string) => useGameStore.getState().tasks.some((t) => t.id === id)

function reset(withIlya = false) {
  useAccessControlStore.setState({ ...INITIAL_ACCESS_CONTROL_DATA, intrusionResultToAcknowledge: null })
  useEconomyStore.setState({ transactions: initialTransactions(), panelOpen: false })
  useRiskStore.setState({ signals: [] })
  useGameStore.setState({ tasks: BOARD_TASKS.map((t) => ({ ...t })) })
  useTeamStore.setState({ hires: withIlya ? [{ employeeId: 'ilya-vlasov', hiredAtSprint: 2, hiredAtDay: 1 }] : [], panelOpen: false })
  useSecurityAuditStore.setState({ ...INITIAL_SECURITY_AUDIT, findings: initializeSecurityFindings(), auditResultToAcknowledge: null })
  window.localStorage.clear()
}

describe('proposal decisions', () => {
  beforeEach(() => reset())

  it('unlock adds the review task and is idempotent', () => {
    ac().unlockProposal()
    expect(ac().accessControl.proposalStatus).toBe('available')
    expect(taskExists(REVIEW_ACCESS_CONTROL_TASK.id)).toBe(true)
    ac().unlockProposal()
    expect(useGameStore.getState().tasks.filter((t) => t.id === REVIEW_ACCESS_CONTROL_TASK.id)).toHaveLength(1)
  })

  it('postpone: no charge, two signals, task done; repeat does not duplicate', () => {
    ac().unlockProposal()
    expect(ac().postponeAccessControl(moment)).toEqual({ applied: true })
    expect(balance()).toBe(INITIAL_BUDGET)
    expect(getActualRiskScore(useRiskStore.getState().signals, 'office-access')).toBe(1)
    expect(getActualRiskScore(useRiskStore.getState().signals, 'governance')).toBe(1)
    expect(taskDone(REVIEW_ACCESS_CONTROL_TASK.id)).toBe(true)
    // re-postpone: no new signals
    expect(ac().postponeAccessControl(moment)).toEqual({ applied: false })
    expect(useRiskStore.getState().signals).toHaveLength(2)
  })

  it('approve charges 180 000 once and adds the implement task; postponed can still approve', () => {
    ac().unlockProposal()
    ac().postponeAccessControl(moment)
    expect(ac().approveAccessControl(moment)).toEqual({ applied: true })
    expect(balance()).toBe(INITIAL_BUDGET - ACCESS_CONTROL_INVESTMENT_COST)
    expect(taskExists(IMPLEMENT_ACCESS_CONTROL_TASK.id)).toBe(true)
    // second approve does not charge again
    expect(ac().approveAccessControl(moment)).toEqual({ applied: false })
    expect(balance()).toBe(INITIAL_BUDGET - ACCESS_CONTROL_INVESTMENT_COST)
  })
})

describe('assignment & implementation', () => {
  beforeEach(() => {
    reset(true)
    ac().unlockProposal()
    ac().approveAccessControl(moment)
  })

  it('Ilya implements in two days; task done, СКУД active, mitigation applied', () => {
    expect(ac().assignAccessControlImplementation('ilya-vlasov')).toEqual({ assigned: true })
    const d1 = ac().applyAccessControlWorkday(3, 2)
    expect(d1).toMatchObject({ applied: true, activated: false })
    expect(ac().accessControl.progressDays).toBe(1)
    const d2 = ac().applyAccessControlWorkday(3, 3)
    expect(d2.activated).toBe(true)
    expect(ac().accessControl.proposalStatus).toBe('active')
    expect(ac().accessControl.completedAt).toEqual({ sprintNumber: 3, day: 3 })
    expect(taskDone(IMPLEMENT_ACCESS_CONTROL_TASK.id)).toBe(true)
    // office-access mitigated by -4
    expect(getActualRiskScore(useRiskStore.getState().signals, 'office-access')).toBe(0)
  })

  it('a repeated day does not add progress', () => {
    ac().assignAccessControlImplementation('sonya-sokolova')
    ac().applyAccessControlWorkday(3, 2)
    const again = ac().applyAccessControlWorkday(3, 2)
    expect(again.applied).toBe(false)
    expect(ac().accessControl.progressDays).toBe(1)
  })

  it('progress carries over on a Sonya -> Ilya swap', () => {
    ac().assignAccessControlImplementation('sonya-sokolova') // effort 3
    ac().applyAccessControlWorkday(3, 2) // 1/3
    ac().assignAccessControlImplementation('ilya-vlasov') // effort 2, progress kept
    expect(ac().accessControl.progressDays).toBe(1)
    const d = ac().applyAccessControlWorkday(3, 3) // 2/2 -> active
    expect(d.activated).toBe(true)
  })

  it('an employee already on a finding cannot be assigned', () => {
    useSecurityAuditStore.setState({ findings: assignFindingState(initializeSecurityFindings(), 'account-access-review', 'ilya-vlasov') })
    expect(ac().assignAccessControlImplementation('ilya-vlasov')).toEqual({ assigned: false, reason: 'employee-busy-finding' })
  })
})

describe('intrusion resolution', () => {
  beforeEach(() => reset())

  it('without Ilya: 140k cost, sensitive-data signal, tasks, idempotent', () => {
    useAccessControlStore.setState({ intrusion: { status: 'pending', effectsApplied: false } })
    const res = ac().resolveIntrusion(moment, false)
    expect(res).toEqual({ resolved: true, hadSecuritySpecialist: false, cost: 140_000 })
    expect(balance()).toBe(INITIAL_BUDGET - 140_000)
    expect(getActualRiskScore(useRiskStore.getState().signals, 'sensitive-data')).toBe(2)
    expect(getActualRiskScore(useRiskStore.getState().signals, 'office-access')).toBe(3)
    expect(taskExists(REVIEW_ACCESS_LOGS_TASK.id)).toBe(true)
    expect(ac().intrusion.status).toBe('resolved')

    // re-resolve does not double the cost
    const again = ac().resolveIntrusion(moment, false)
    expect(again.resolved).toBe(false)
    expect(balance()).toBe(INITIAL_BUDGET - 140_000)
  })

  it('with Ilya: 60k cost, no sensitive-data signal', () => {
    useAccessControlStore.setState({ intrusion: { status: 'pending', effectsApplied: false } })
    const res = ac().resolveIntrusion(moment, true)
    expect(res.cost).toBe(60_000)
    expect(balance()).toBe(INITIAL_BUDGET - 60_000)
    expect(getActualRiskScore(useRiskStore.getState().signals, 'sensitive-data')).toBe(0)
    expect(getActualRiskScore(useRiskStore.getState().signals, 'office-access')).toBe(2)
  })

  it('the specialist snapshot is fixed at pending -> running and used on resolve', () => {
    useAccessControlStore.setState({ intrusion: { status: 'pending', effectsApplied: false } })
    ac().markIntrusionRunning(moment, false) // snapshot: no specialist
    // even if we pass true now, the branch stays "no specialist"
    const res = ac().resolveIntrusion(moment, true)
    expect(res.cost).toBe(140_000)
  })

  it('the access-log task is created done when both findings are already closed', () => {
    useSecurityAuditStore.setState({
      findings: initializeSecurityFindings().map((f) =>
        f.findingId === 'account-access-review' || f.findingId === 'sensitive-data-logging-review' ? { ...f, status: 'closed' as const, progressDays: 9 } : f,
      ),
    })
    useAccessControlStore.setState({ intrusion: { status: 'pending', effectsApplied: false } })
    ac().resolveIntrusion(moment, false)
    expect(taskDone(REVIEW_ACCESS_LOGS_TASK.id)).toBe(true)
  })
})
