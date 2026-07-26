import { describe, it, expect, beforeEach } from 'vitest'
import { useEconomyStore } from '../economyStore'
import { useRiskStore } from '../riskStore'
import { useGameStore } from '../gameStore'
import { useTeamStore } from '../teamStore'
import { useProductStore } from '../productStore'
import { useSprintStore } from '../sprintStore'
import { useSecurityAuditStore, INITIAL_SECURITY_AUDIT } from '../securityAuditStore'
import { useStoryDecisionStore } from './storyDecisionStore'
import { useStoryWorkStore } from './storyWorkStore'
import { STORY_BALANCE } from '../balance/storyBalance'
import { initialTransactions, calculateBalance, INITIAL_BUDGET } from '../economyRules'
import { initialTaskStates } from '../productRules'
import { INITIAL_SPRINT_STATE } from '../sprintRules'
import { BOARD_TASKS } from '../tasks'
import { BASELINE_AUDIT_RESULT_TASK } from './storyFollowUps'
import type { Level1StoryDecisionId } from './level1Timeline'

const M = { sprintNumber: 2, day: 3 }
const story = () => useStoryDecisionStore.getState()
const txs = () => useEconomyStore.getState().transactions
const balance = () => calculateBalance(txs())
const signals = () => useRiskStore.getState().signals
const work = () => useStoryWorkStore.getState()
const taskCount = (id: string) => useGameStore.getState().tasks.filter((t) => t.id === id).length

const BOTH_DEVS = [
  { employeeId: 'kirill-morozov', hiredAtSprint: 1, hiredAtDay: 1 },
  { employeeId: 'alina-belova', hiredAtSprint: 1, hiredAtDay: 1 },
]
const WITH_ILYA = [...BOTH_DEVS, { employeeId: 'ilya-vlasov', hiredAtSprint: 2, hiredAtDay: 1 }]

function resolve(id: Level1StoryDecisionId, choiceId: string) {
  return story().resolveDecision(id, choiceId, M)
}

beforeEach(() => {
  window.localStorage.clear()
  useSprintStore.setState({ ...INITIAL_SPRINT_STATE, sprintNumber: M.sprintNumber, day: M.day, phase: 'active', confirmingEndDay: false })
  useEconomyStore.setState({ transactions: initialTransactions(), panelOpen: false })
  useRiskStore.setState({ signals: [] })
  useTeamStore.setState({ hires: BOTH_DEVS, panelOpen: false })
  useProductStore.setState({ taskStates: initialTaskStates(), activeReport: null, boardOpen: false, prototypeOpen: false, releaseCheckOpen: false })
  useGameStore.setState({ phase: 'free', activeDialogue: null, activeChoice: null, tasks: BOARD_TASKS.map((t) => ({ ...t })) })
  useSecurityAuditStore.setState({ ...INITIAL_SECURITY_AUDIT, findings: [], auditResultToAcknowledge: null })
  story().resetLevel1Story()
  work().resetStoryWork()
  // unlock everything so resolve() is reachable in isolation
  for (const id of Object.keys(story().decisions)) story().unlockDecision(id as never, M)
})

describe('baseline handler (scene 1)', () => {
  it('commission-security-audit charges the spec transaction and creates the result task', () => {
    resolve('security-baseline-path', 'commission-security-audit')
    const tx = txs().find((t) => t.id === 'story:baseline-security-audit')
    expect(tx).toMatchObject({ category: 'security-audit', amount: STORY_BALANCE.baselineAudit.costRub })
    expect(balance()).toBe(INITIAL_BUDGET - STORY_BALANCE.baselineAudit.costRub)
    expect(taskCount(BASELINE_AUDIT_RESULT_TASK.id)).toBe(1)
    expect(signals().some((s) => s.id === 'story-decision:security-baseline-path:commission-security-audit:governance')).toBe(true)
  })

  it('hire-first creates the hire task and no expense', () => {
    resolve('security-baseline-path', 'hire-security-specialist-first')
    expect(taskCount('hire-security-specialist')).toBe(1)
    expect(balance()).toBe(INITIAL_BUDGET)
  })
})

describe('admin access handler (scene 2)', () => {
  it('permanent admin adds the identity risk and nothing else', () => {
    resolve('developer-admin-access', 'grant-permanent-admin')
    const s = signals().find((x) => x.id === 'story-decision:developer-admin-access:grant-permanent-admin:identity-access')
    expect(s?.impact).toBe(STORY_BALANCE.adminAccess.permanentIdentityImpact)
    expect(balance()).toBe(INITIAL_BUDGET)
    expect(work().assignments).toHaveLength(0)
  })

  it('JIT access occupies Kirill for one product day', () => {
    resolve('developer-admin-access', 'use-just-in-time-access')
    expect(work().isEmployeeBusy('kirill-morozov')).toBe(true)
    expect(signals().some((x) => x.impact === STORY_BALANCE.adminAccess.jitIdentityMitigation)).toBe(true)
  })

  it('controlled access charges the balance cost and occupies Ilya', () => {
    useTeamStore.setState({ hires: WITH_ILYA, panelOpen: false })
    resolve('developer-admin-access', 'configure-controlled-access')
    const tx = txs().find((t) => t.id === 'story-decision:developer-admin-access:configure-controlled-access')
    expect(tx).toMatchObject({ category: 'security-investment', amount: STORY_BALANCE.adminAccess.controlledCostRub })
    expect(work().isEmployeeBusy('ilya-vlasov')).toBe(true)
  })
})

describe('idempotency (17B: repeated/partial resolve applies nothing twice)', () => {
  it('a second resolve never duplicates money, signals, tasks or assignments', () => {
    resolve('security-baseline-path', 'commission-security-audit')
    const txCount = txs().length
    const signalCount = signals().length
    const tasksTotal = useGameStore.getState().tasks.length

    resolve('security-baseline-path', 'hire-security-specialist-first') // ignored - already resolved
    expect(txs().length).toBe(txCount)
    expect(signals().length).toBe(signalCount)
    expect(useGameStore.getState().tasks.length).toBe(tasksTotal)
    expect(story().decisions['security-baseline-path'].selectedChoiceId).toBe('commission-security-audit')
  })

  it('a partial resolve (effects flag lost) re-runs the handler without duplicates', () => {
    resolve('backup-and-restore-strategy', 'run-full-restore-drill')
    const txCount = txs().length
    useStoryDecisionStore.setState({
      decisions: {
        ...story().decisions,
        'backup-and-restore-strategy': { ...story().decisions['backup-and-restore-strategy'], effectsApplied: false },
      },
    })
    resolve('backup-and-restore-strategy', 'run-full-restore-drill')
    expect(story().decisions['backup-and-restore-strategy'].effectsApplied).toBe(true)
    expect(txs().length).toBe(txCount) // applyOneTimeExpense is id-guarded
    expect(work().assignments.filter((a) => a.employeeId === 'kirill-morozov')).toHaveLength(1)
  })
})

describe('architecture handler (scene 6)', () => {
  it('keep-shared reduces Kirill remaining product effort by the balance days', () => {
    // plan one backend task so there is effort to reduce
    const states = initialTaskStates().map((s) => (s.taskId === 'auth-api' ? { ...s, status: 'planned' as const, plannedSprintNumber: 2, planOrder: 1 } : s))
    useProductStore.setState({ taskStates: states })
    const before = useProductStore.getState().taskStates.find((s) => s.taskId === 'auth-api')!.progressDays
    resolve('architecture-boundary', 'keep-shared-architecture')
    const after = useProductStore.getState().taskStates.find((s) => s.taskId === 'auth-api')!.progressDays
    expect(after - before).toBe(STORY_BALANCE.architecture.sharedBackendEffortReductionDays)
    expect(signals().some((x) => x.id.endsWith('keep-shared-architecture:identity-access'))).toBe(true)
  })

  it('separate boundaries occupies Kirill and creates the visible work task', () => {
    resolve('architecture-boundary', 'separate-security-boundaries')
    expect(work().isEmployeeBusy('kirill-morozov')).toBe(true)
    expect(taskCount('separate-security-boundaries-work')).toBe(1)
  })
})

describe('disclosure handler (scene 7)', () => {
  it('reporting clears the leadership complaint and charges the check', () => {
    useSecurityAuditStore.setState({ leadershipComplaint: true })
    resolve('suspicious-activity-disclosure', 'report-activity-immediately')
    expect(useSecurityAuditStore.getState().leadershipComplaint).toBe(false)
    const tx = txs().find((t) => t.id === 'story-decision:suspicious-activity-disclosure:report-activity-immediately')
    expect(tx?.amount).toBe(STORY_BALANCE.disclosure.reportCostRub)
  })

  it('quiet investigation occupies Kirill when Ilya is not hired, Ilya when he is', () => {
    resolve('suspicious-activity-disclosure', 'investigate-quietly')
    expect(work().isEmployeeBusy('kirill-morozov')).toBe(true)
    story().resetLevel1Story()
    work().resetStoryWork()
    story().unlockDecision('suspicious-activity-disclosure', M)
    useTeamStore.setState({ hires: WITH_ILYA, panelOpen: false })
    resolve('suspicious-activity-disclosure', 'investigate-quietly')
    expect(work().isEmployeeBusy('ilya-vlasov')).toBe(true)
    expect(work().isEmployeeBusy('kirill-morozov')).toBe(false)
  })

  it('dismissing raises governance and the warning domain', () => {
    resolve('suspicious-activity-disclosure', 'dismiss-as-false-positive')
    expect(signals().some((x) => x.impact === STORY_BALANCE.disclosure.dismissGovernanceImpact && x.domain === 'governance')).toBe(true)
    expect(signals().some((x) => x.impact === STORY_BALANCE.disclosure.dismissDomainImpact)).toBe(true)
  })
})

describe('migrated records never re-apply effects', () => {
  it('a legacy-migrated baseline changes no money, signals or tasks', () => {
    story().resetLevel1Story()
    story().recordLegacyBaselineResolution('decline-security-hire', M)
    expect(balance()).toBe(INITIAL_BUDGET)
    expect(signals()).toHaveLength(0)
    expect(taskCount(BASELINE_AUDIT_RESULT_TASK.id)).toBe(0)
  })
})
