import { describe, it, expect, beforeEach } from 'vitest'
import { useSprintStore } from '../sprintStore'
import { useEconomyStore } from '../economyStore'
import { useTeamStore } from '../teamStore'
import { useProductStore } from '../productStore'
import { useGameStore } from '../gameStore'
import { useSecurityStoryStore } from '../securityStoryStore'
import { useStoryDecisionStore } from './storyDecisionStore'
import { completeWorkday } from '../completeWorkday'
import { canStartSprintWithPlan } from '../startSprintWithPlan'
import { hireDeveloper } from '../hireDeveloper'
import { npcRequiredInteractionPending } from '../freeNpcConversation'
import { getCurrentObjective } from '../currentObjective'
import { canAutoAdvanceWorkday } from '../workdayFlow'
import { currentFlowContext } from '../WorkdayFlowController'
import { INITIAL_SPRINT_STATE } from '../sprintRules'
import { INITIAL_SECURITY_BREACH } from '../securityStoryRules'
import { initialTransactions } from '../economyRules'
import { initialTaskStates } from '../productRules'
import { BOARD_TASKS } from '../tasks'

const M = { sprintNumber: 1, day: 1 }
const story = () => useStoryDecisionStore.getState()

beforeEach(() => {
  window.localStorage.clear()
  useSprintStore.setState({ ...INITIAL_SPRINT_STATE, confirmingEndDay: false })
  useEconomyStore.setState({ transactions: initialTransactions(), panelOpen: false })
  useTeamStore.setState({ hires: [], panelOpen: false })
  useProductStore.setState({ taskStates: initialTaskStates(), boardOpen: false, activeReport: null, prototypeOpen: false, releaseCheckOpen: false })
  useGameStore.setState({ phase: 'free', activeDialogue: null, activeChoice: null, tasks: BOARD_TASKS.map((t) => ({ ...t })) })
  useSecurityStoryStore.setState({
    securityBreach: { ...INITIAL_SECURITY_BREACH },
    postAuditConversation: { status: 'locked', effectsApplied: false },
    hasIntroducedSecuritySpecialist: false,
  })
  story().resetLevel1Story()
})

describe('workday flow blocking (17A §7)', () => {
  it('an available blocking decision stops completeWorkday with required-story-decision', () => {
    useSprintStore.setState({ sprintNumber: 1, day: 2, phase: 'active', confirmingEndDay: true })
    story().unlockDecision('security-baseline-path', M)
    const result = completeWorkday()
    expect(result).toEqual({ completed: false, reason: 'required-story-decision' })
    expect(useSprintStore.getState().day).toBe(2) // the clock did not move
  })

  it('the auto-advance context reports requiredStoryPending while the decision waits', () => {
    useSprintStore.setState({ sprintNumber: 1, day: 2, phase: 'active', confirmingEndDay: false })
    story().unlockDecision('security-baseline-path', M)
    const ctx = currentFlowContext()
    expect(ctx.requiredStoryPending).toBe(true)
    expect(canAutoAdvanceWorkday(ctx)).toBe(false)
  })

  it('after the decision resolves the day completes again', () => {
    useSprintStore.setState({ sprintNumber: 1, day: 2, phase: 'active', confirmingEndDay: true })
    story().unlockDecision('security-baseline-path', M)
    story().resolveDecision('security-baseline-path', 'commission-security-audit', M)
    expect(completeWorkday().completed).toBe(true)
  })
})

describe('story marker vs DeepSeek (17A/17B §7)', () => {
  it('a pending decision hides the chat of every scene participant, not of outsiders', () => {
    story().unlockDecision('security-baseline-path', M)
    // Sonya, Kirill and Alina take part in the baseline scene - their optional
    // chats hide; Ilya is not a participant.
    expect(npcRequiredInteractionPending('sonya-sokolova')).toBe(true)
    expect(npcRequiredInteractionPending('kirill-morozov')).toBe(true)
    expect(npcRequiredInteractionPending('ilya-vlasov')).toBe(true) // his own onboarding gate, not the scene
    story().resolveDecision('security-baseline-path', 'commission-security-audit', M)
    expect(npcRequiredInteractionPending('sonya-sokolova')).toBe(false)
    expect(npcRequiredInteractionPending('kirill-morozov')).toBe(false)
  })
})

describe('objective (17A §7)', () => {
  it('the mandatory decision becomes the single resolve-story-dialogue objective', () => {
    const objective = getCurrentObjective({
      gamePhase: 'free',
      sprintPhase: 'planning',
      outcomeBlocking: false,
      storyDecisionText: 'Поговорите с Соней',
      postAuditPending: false,
      unassignedFindings: false,
      accessControlActionable: false,
      unacknowledgedRisks: false,
      devsHired: true,
      anyTaskPlanned: true,
      mvpReleaseReady: false,
    })
    expect(objective).toEqual({ id: 'resolve-story-dialogue', text: 'Поговорите с Соней', target: 'sonya' })
  })
})

describe('first sprint gate & live unlock (17A §9)', () => {
  it('hiring both developers unlocks the baseline decision and blocks the sprint start', () => {
    hireDeveloper('kirill-morozov')
    expect(story().decisions['security-baseline-path'].status).toBe('locked')
    hireDeveloper('alina-belova')
    expect(story().decisions['security-baseline-path'].status).toBe('available')

    const check = canStartSprintWithPlan()
    expect(check).toEqual({ started: false, reason: 'story-decision-pending' })

    story().resolveDecision('security-baseline-path', 'hire-security-specialist-first', M)
    // now only the plan checks remain (no tasks planned yet)
    expect(canStartSprintWithPlan()).toEqual({ started: false, reason: 'first-sprint-needs-both-roles' })
  })

  it('an old save whose legacy fork is already decided never unlocks the baseline on hire', () => {
    useSecurityStoryStore.setState({
      securityBreach: { ...INITIAL_SECURITY_BREACH, status: 'completed', completedAt: { sprintNumber: 2, day: 3 }, effectsApplied: true },
      postAuditConversation: { status: 'completed', staffingDecision: 'decline-security-hire', completedAt: { sprintNumber: 2, day: 4 }, effectsApplied: true },
      hasIntroducedSecuritySpecialist: false,
    })
    hireDeveloper('kirill-morozov')
    hireDeveloper('alina-belova')
    expect(story().decisions['security-baseline-path'].status).toBe('locked')
    expect(canStartSprintWithPlan().started === false && canStartSprintWithPlan()).not.toMatchObject({ reason: 'story-decision-pending' })
  })
})
