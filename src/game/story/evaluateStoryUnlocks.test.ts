import { describe, it, expect, beforeEach } from 'vitest'
import { evaluateStoryUnlocks } from './evaluateStoryUnlocks'
import { useStoryDecisionStore } from './storyDecisionStore'
import { useStoryWorkStore } from './storyWorkStore'
import { useSprintStore } from '../sprintStore'
import { useTeamStore } from '../teamStore'
import { useProductStore } from '../productStore'
import { useRiskStore } from '../riskStore'
import { useGameStore } from '../gameStore'
import { useGameOutcomeStore } from '../gameOutcomeStore'
import { useSecurityStoryStore } from '../securityStoryStore'
import { useServerIncidentStore, INITIAL_SERVER_INCIDENT_DATA } from '../serverIncidentStore'
import { INITIAL_SPRINT_STATE } from '../sprintRules'
import { INITIAL_SECURITY_BREACH } from '../securityStoryRules'
import { initialTaskStates } from '../productRules'
import { PRODUCT_TASK_CATALOG, getProductTask } from '../productTaskCatalog'
import { BOARD_TASKS } from '../tasks'

const story = () => useStoryDecisionStore.getState()
const M = { sprintNumber: 1, day: 1 }

const BOTH_DEVS = [
  { employeeId: 'kirill-morozov', hiredAtSprint: 1, hiredAtDay: 1 },
  { employeeId: 'alina-belova', hiredAtSprint: 1, hiredAtDay: 1 },
]
const WITH_ILYA = [...BOTH_DEVS, { employeeId: 'ilya-vlasov', hiredAtSprint: 2, hiredAtDay: 1 }]

function doneTasks(count: number) {
  const ids = PRODUCT_TASK_CATALOG.slice(0, count).map((d) => d.id)
  return initialTaskStates().map((s) =>
    ids.includes(s.taskId) ? { ...s, status: 'done' as const, progressDays: 99, completedAt: { sprintNumber: 1, day: 5 } } : s,
  )
}

beforeEach(() => {
  window.localStorage.clear()
  useSprintStore.setState({ ...INITIAL_SPRINT_STATE, confirmingEndDay: false })
  useTeamStore.setState({ hires: [], panelOpen: false })
  useProductStore.setState({ taskStates: initialTaskStates(), activeReport: null, boardOpen: false, prototypeOpen: false, releaseCheckOpen: false })
  useRiskStore.setState({ signals: [] })
  useGameStore.setState({ phase: 'free', activeDialogue: null, activeChoice: null, tasks: BOARD_TASKS.map((t) => ({ ...t })) })
  useSecurityStoryStore.setState({
    securityBreach: { ...INITIAL_SECURITY_BREACH },
    postAuditConversation: { status: 'locked', effectsApplied: false },
    hasIntroducedSecuritySpecialist: false,
  })
  useServerIncidentStore.setState({ ...INITIAL_SERVER_INCIDENT_DATA, incidentResultToAcknowledge: null })
  useGameOutcomeStore.getState().resetGameOutcome()
  story().resetLevel1Story()
  useStoryWorkStore.getState().resetStoryWork()
})

function resolveBaseline() {
  story().unlockDecision('security-baseline-path', M)
  story().resolveDecision('security-baseline-path', 'commission-security-audit', M)
}

describe('scene 2 trigger: developer-admin-access', () => {
  it('unlocks in the first active sprint before any backend progress, and never after it', () => {
    useTeamStore.setState({ hires: BOTH_DEVS, panelOpen: false })
    resolveBaseline()
    useSprintStore.setState({ sprintNumber: 1, day: 1, phase: 'active', confirmingEndDay: false })
    evaluateStoryUnlocks()
    expect(story().decisions['developer-admin-access'].status).toBe('available')

    // a save already past first backend progress keeps it locked forever
    story().resetLevel1Story()
    resolveBaseline()
    const backendTask = PRODUCT_TASK_CATALOG.find((d) => d.assigneeEmployeeId === 'kirill-morozov')!
    useProductStore.setState({
      taskStates: initialTaskStates().map((s) => (s.taskId === backendTask.id ? { ...s, status: 'in-progress' as const, progressDays: 1 } : s)),
    })
    evaluateStoryUnlocks()
    expect(story().decisions['developer-admin-access'].status).toBe('locked')
  })
})

describe('scene 3 trigger: frontend-test-data', () => {
  it('unlocks once a frontend task has real progress', () => {
    useTeamStore.setState({ hires: BOTH_DEVS, panelOpen: false })
    resolveBaseline()
    useSprintStore.setState({ sprintNumber: 1, day: 2, phase: 'active', confirmingEndDay: false })
    evaluateStoryUnlocks()
    expect(story().decisions['frontend-test-data'].status).toBe('locked')

    const frontendTask = PRODUCT_TASK_CATALOG.find((d) => d.assigneeEmployeeId === 'alina-belova')!
    useProductStore.setState({
      taskStates: useProductStore.getState().taskStates.map((s) => (s.taskId === frontendTask.id ? { ...s, status: 'in-progress' as const, progressDays: 1 } : s)),
    })
    evaluateStoryUnlocks()
    expect(story().decisions['frontend-test-data'].status).toBe('available')
  })
})

describe('scene 4 trigger: security-first-priority', () => {
  it('unlocks only after a real hire AND the introduction talk', () => {
    useTeamStore.setState({ hires: WITH_ILYA, panelOpen: false })
    evaluateStoryUnlocks()
    expect(story().decisions['security-first-priority'].status).toBe('locked')
    useSecurityStoryStore.setState({ ...useSecurityStoryStore.getState(), hasIntroducedSecuritySpecialist: true })
    evaluateStoryUnlocks()
    expect(story().decisions['security-first-priority'].status).toBe('available')
  })
})

describe('scene 6 trigger: architecture-boundary', () => {
  it('needs six completed product tasks and no resolved AUTH/DATABASE incident', () => {
    useTeamStore.setState({ hires: BOTH_DEVS, panelOpen: false })
    resolveBaseline()
    useProductStore.setState({ taskStates: doneTasks(5) })
    evaluateStoryUnlocks()
    expect(story().decisions['architecture-boundary'].status).toBe('locked')

    useProductStore.setState({ taskStates: doneTasks(6) })
    evaluateStoryUnlocks()
    expect(story().decisions['architecture-boundary'].status).toBe('available')
  })
})

describe('scene 8 trigger: release-risk-decision', () => {
  it('unlocks with all tasks done and a risky-choice history', () => {
    useTeamStore.setState({ hires: BOTH_DEVS, panelOpen: false })
    resolveBaseline()
    story().unlockDecision('backup-and-restore-strategy', M)
    story().resolveDecision('backup-and-restore-strategy', 'postpone-backup-work', M) // risky history
    useProductStore.setState({ taskStates: doneTasks(PRODUCT_TASK_CATALOG.length) })
    evaluateStoryUnlocks()
    expect(story().decisions['release-risk-decision'].status).toBe('available')
  })

  it('stays locked without risk or risky history', () => {
    useTeamStore.setState({ hires: BOTH_DEVS, panelOpen: false })
    resolveBaseline()
    useProductStore.setState({ taskStates: doneTasks(PRODUCT_TASK_CATALOG.length) })
    evaluateStoryUnlocks()
    expect(story().decisions['release-risk-decision'].status).toBe('locked')
  })
})

describe('single blocking scene at a time', () => {
  it('several eligible decisions surface one active id by priority', () => {
    useTeamStore.setState({ hires: BOTH_DEVS, panelOpen: false })
    resolveBaseline()
    useSprintStore.setState({ sprintNumber: 1, day: 1, phase: 'active', confirmingEndDay: false })
    const frontendTask = PRODUCT_TASK_CATALOG.find((d) => d.assigneeEmployeeId === 'alina-belova')!
    useProductStore.setState({
      taskStates: initialTaskStates().map((s) => (s.taskId === frontendTask.id ? { ...s, status: 'in-progress' as const, progressDays: 1 } : s)),
    })
    evaluateStoryUnlocks()
    // both scene 2 and scene 3 are eligible - the priority picks scene 2
    expect(story().decisions['developer-admin-access'].status).toBe('available')
    expect(story().decisions['frontend-test-data'].status).toBe('available')
    expect(story().activeDecisionId).toBe('developer-admin-access')
  })
})

// sanity: getProductTask is used by the trigger - keep the import exercised
it('product catalog exposes assignees for trigger checks', () => {
  expect(getProductTask('auth-api')?.assigneeEmployeeId).toBe('kirill-morozov')
})
