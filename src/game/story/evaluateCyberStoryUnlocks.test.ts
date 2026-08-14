import { describe, it, expect, beforeEach } from 'vitest'
import { useCyberStoryStore } from './cyberStoryStore'
import { useStoryDecisionStore } from './storyDecisionStore'
import { initialStoryDecisionRecords } from './storyDecisionRules'
import { useSprintStore } from '../sprintStore'
import { useTeamStore } from '../teamStore'
import { useProductStore } from '../productStore'
import { useGameOutcomeStore } from '../gameOutcomeStore'
import { INITIAL_SPRINT_STATE, SPRINT_DAYS } from '../sprintRules'
import { initialTaskStates } from '../productRules'
import { FIRST_PROTOTYPE_TASK_IDS } from '../productTaskCatalog'
import { evaluateCyberStoryUnlocks } from './evaluateCyberStoryUnlocks'

const cyber = () => useCyberStoryStore.getState()

function hire(...ids: string[]) {
  useTeamStore.setState({ hires: ids.map((employeeId) => ({ employeeId, hiredAtSprint: 1, hiredAtDay: 1 })) })
}

function doneTaskStates(ids: string[]) {
  return initialTaskStates().map((s) => (ids.includes(s.taskId) ? { ...s, status: 'done' as const, progressDays: 999 } : s))
}

beforeEach(() => {
  window.localStorage.clear()
  cyber().resetCyberStory()
  useStoryDecisionStore.setState({ decisions: initialStoryDecisionRecords(), activeDecisionId: undefined, completedCheckpointIds: [] })
  useSprintStore.setState({ ...INITIAL_SPRINT_STATE })
  useTeamStore.setState({ hires: [] })
  useProductStore.setState({ taskStates: initialTaskStates() })
  useGameOutcomeStore.getState().resetGameOutcome()
})

describe('evaluateCyberStoryUnlocks', () => {
  it('unlocks executive-phishing-request once both developers are hired, active sprint, past kickoff day', () => {
    hire('kirill-morozov', 'alina-belova')
    useSprintStore.setState({ sprintNumber: 1, day: 2, phase: 'active' })
    const unlocked = evaluateCyberStoryUnlocks()
    expect(unlocked).toContain('executive-phishing-request')
    expect(cyber().incidents['executive-phishing-request'].status).toBe('available')
  })

  it('does not unlock executive-phishing-request on the kickoff day (day 1)', () => {
    hire('kirill-morozov', 'alina-belova')
    useSprintStore.setState({ sprintNumber: 1, day: 1, phase: 'active' })
    evaluateCyberStoryUnlocks()
    expect(cyber().incidents['executive-phishing-request'].status).toBe('locked')
  })

  it('unlocks supply-chain-update once Kirill is hired, >=3 tasks done, 1-2 days before review, AUTH active', () => {
    hire('kirill-morozov')
    useProductStore.setState({
      taskStates: doneTaskStates(['rooms-api', 'booking-api', 'login-screen']).map((s) => (s.taskId === 'auth-api' ? { ...s, status: 'in-progress', progressDays: 2 } : s)),
    })
    useSprintStore.setState({ sprintNumber: 1, day: SPRINT_DAYS - 1, phase: 'active' })
    const unlocked = evaluateCyberStoryUnlocks()
    expect(unlocked).toContain('supply-chain-update')
  })

  it('does not unlock supply-chain-update too early in the sprint', () => {
    hire('kirill-morozov')
    useProductStore.setState({ taskStates: doneTaskStates(['rooms-api', 'booking-api', 'login-screen']) })
    useSprintStore.setState({ sprintNumber: 1, day: 3, phase: 'active' })
    evaluateCyberStoryUnlocks()
    expect(cyber().incidents['supply-chain-update'].status).toBe('locked')
  })

  it('unlocks shadow-it-log-upload once both developers are hired, frontend-test-data resolved, prototype ready', () => {
    hire('kirill-morozov', 'alina-belova')
    useStoryDecisionStore.setState({
      decisions: { ...initialStoryDecisionRecords(), 'frontend-test-data': { decisionId: 'frontend-test-data', status: 'resolved', selectedChoiceId: 'create-synthetic-data', effectsApplied: true } },
    })
    useProductStore.setState({ taskStates: doneTaskStates(['auth-api', 'rooms-api', 'booking-api', 'login-screen', 'rooms-screen', 'booking-form']) })
    const unlocked = evaluateCyberStoryUnlocks()
    expect(unlocked).toContain('shadow-it-log-upload')
  })

  it('never unlocks anything once the campaign has ended', () => {
    hire('kirill-morozov', 'alina-belova')
    useSprintStore.setState({ sprintNumber: 1, day: 2, phase: 'active' })
    useGameOutcomeStore.setState({ status: 'failed' })
    const unlocked = evaluateCyberStoryUnlocks()
    expect(unlocked).toEqual([])
  })

  it('is idempotent - a second call does not re-unlock or duplicate', () => {
    hire('kirill-morozov', 'alina-belova')
    useSprintStore.setState({ sprintNumber: 1, day: 2, phase: 'active' })
    evaluateCyberStoryUnlocks()
    const second = evaluateCyberStoryUnlocks()
    expect(second).toEqual([])
  })

  it('unlocks secret-committed-to-repository once Kirill is hired and a real backend task is done', () => {
    hire('kirill-morozov')
    useProductStore.setState({ taskStates: doneTaskStates(['auth-api']) })
    const unlocked = evaluateCyberStoryUnlocks()
    expect(unlocked).toContain('secret-committed-to-repository')
  })

  it('does not unlock secret-committed-to-repository without any completed backend task', () => {
    hire('kirill-morozov')
    evaluateCyberStoryUnlocks()
    expect(cyber().incidents['secret-committed-to-repository'].status).toBe('locked')
  })

  it('unlocks mfa-fatigue-attack once Kirill is hired, the first prototype is real, and executive-phishing-request is resolved', () => {
    hire('kirill-morozov', 'alina-belova')
    useProductStore.setState({ taskStates: doneTaskStates(FIRST_PROTOTYPE_TASK_IDS) })
    useSprintStore.setState({ sprintNumber: 1, day: 1, phase: 'active' })
    cyber().unlockIncident('executive-phishing-request', { sprintNumber: 1, day: 1 })
    cyber().resolveIncident('executive-phishing-request', 'send-requested-data', { sprintNumber: 1, day: 1 })
    // a completed prototype ALSO satisfies secret-committed-to-repository's
    // own trigger (hasBackendProgress) - resolve it on an earlier day so it
    // does not win the same-day spacing race and mask this assertion.
    cyber().unlockIncident('secret-committed-to-repository', { sprintNumber: 1, day: 1 })
    cyber().resolveIncident('secret-committed-to-repository', 'remove-secret-in-new-commit', { sprintNumber: 1, day: 1 })
    useSprintStore.setState({ sprintNumber: 1, day: 2, phase: 'active' })
    const unlocked = evaluateCyberStoryUnlocks()
    expect(unlocked).toContain('mfa-fatigue-attack')
  })

  it('unlocks mfa-fatigue-attack from sprint 2 on even if phishing never triggered (still requires a real prototype)', () => {
    hire('kirill-morozov')
    useProductStore.setState({ taskStates: doneTaskStates(FIRST_PROTOTYPE_TASK_IDS) })
    cyber().unlockIncident('secret-committed-to-repository', { sprintNumber: 2, day: 1 })
    cyber().resolveIncident('secret-committed-to-repository', 'remove-secret-in-new-commit', { sprintNumber: 2, day: 1 })
    useSprintStore.setState({ sprintNumber: 2, day: 3, phase: 'active' })
    const unlocked = evaluateCyberStoryUnlocks()
    expect(unlocked).toContain('mfa-fatigue-attack')
  })

  it('does not unlock mfa-fatigue-attack in sprint 1 before phishing is resolved', () => {
    hire('kirill-morozov')
    useProductStore.setState({ taskStates: doneTaskStates(FIRST_PROTOTYPE_TASK_IDS) })
    useSprintStore.setState({ sprintNumber: 1, day: 2, phase: 'active' })
    evaluateCyberStoryUnlocks()
    expect(cyber().incidents['mfa-fatigue-attack'].status).toBe('locked')
  })

  it('does not unlock mfa-fatigue-attack without a real first prototype, even past sprint 2 with phishing resolved', () => {
    hire('kirill-morozov', 'alina-belova')
    useSprintStore.setState({ sprintNumber: 1, day: 2, phase: 'active' })
    cyber().unlockIncident('executive-phishing-request', { sprintNumber: 1, day: 1 })
    cyber().resolveIncident('executive-phishing-request', 'send-requested-data', { sprintNumber: 1, day: 1 })
    useSprintStore.setState({ sprintNumber: 2, day: 1, phase: 'active' })
    evaluateCyberStoryUnlocks()
    expect(cyber().incidents['mfa-fatigue-attack'].status).toBe('locked')
  })

  it('does not unlock mfa-fatigue-attack on the sprint kickoff day even with a real prototype and phishing resolved', () => {
    hire('kirill-morozov', 'alina-belova')
    useProductStore.setState({ taskStates: doneTaskStates(FIRST_PROTOTYPE_TASK_IDS) })
    useSprintStore.setState({ sprintNumber: 1, day: 1, phase: 'active' })
    cyber().unlockIncident('executive-phishing-request', { sprintNumber: 1, day: 1 })
    cyber().resolveIncident('executive-phishing-request', 'send-requested-data', { sprintNumber: 1, day: 1 })
    evaluateCyberStoryUnlocks()
    expect(cyber().incidents['mfa-fatigue-attack'].status).toBe('locked')
  })

  it('unlocks external-ai-data-disclosure once Alina is hired, real frontend progress exists, sprint <= 5', () => {
    hire('alina-belova')
    useProductStore.setState({ taskStates: doneTaskStates(['login-screen']) })
    useSprintStore.setState({ sprintNumber: 3, day: 4 })
    const unlocked = evaluateCyberStoryUnlocks()
    expect(unlocked).toContain('external-ai-data-disclosure')
  })

  it('does not unlock external-ai-data-disclosure past sprint 5', () => {
    hire('alina-belova')
    useProductStore.setState({ taskStates: doneTaskStates(['login-screen']) })
    useSprintStore.setState({ sprintNumber: 6, day: 1 })
    evaluateCyberStoryUnlocks()
    expect(cyber().incidents['external-ai-data-disclosure'].status).toBe('locked')
  })

  it('event spacing: two otherwise-eligible cyber scenes never both unlock on the same relative workday', () => {
    // Kirill has a real completed prototype (backend progress AND a working
    // login system) eligible the same day for both secret-committed-to-repository
    // and mfa-fatigue-attack - only the higher-priority one (catalog order)
    // unlocks; the other waits.
    hire('kirill-morozov')
    useProductStore.setState({ taskStates: doneTaskStates(FIRST_PROTOTYPE_TASK_IDS) })
    useSprintStore.setState({ sprintNumber: 2, day: 3, phase: 'active' })
    const unlocked = evaluateCyberStoryUnlocks()
    expect(unlocked).toContain('secret-committed-to-repository')
    expect(unlocked).not.toContain('mfa-fatigue-attack')
    expect(cyber().incidents['mfa-fatigue-attack'].status).toBe('locked')
  })

  it('event spacing: the delayed scene becomes eligible again on a later call once the other has an availableAt on a different day', () => {
    hire('kirill-morozov')
    useProductStore.setState({ taskStates: doneTaskStates(FIRST_PROTOTYPE_TASK_IDS) })
    useSprintStore.setState({ sprintNumber: 2, day: 3, phase: 'active' })
    evaluateCyberStoryUnlocks()
    expect(cyber().incidents['secret-committed-to-repository'].status).toBe('available')
    expect(cyber().incidents['mfa-fatigue-attack'].status).toBe('locked')
    useSprintStore.setState({ sprintNumber: 2, day: 4, phase: 'active' })
    const unlocked = evaluateCyberStoryUnlocks()
    expect(unlocked).toContain('mfa-fatigue-attack')
  })
})
