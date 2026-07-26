import { describe, it, expect, beforeEach } from 'vitest'
import { SONYA, beginApproachToSonyaForBaseline, runBaselineDecisionConversation } from './baselineInteraction'
import { runPostAuditConversation } from '../postAuditInteraction'
import { useStoryDecisionStore } from './storyDecisionStore'
import { useSecurityStoryStore, HIRE_SECURITY_TASK, CLOSE_FINDINGS_TASK } from '../securityStoryStore'
import { useGameStore } from '../gameStore'
import { useSprintStore } from '../sprintStore'
import { useRiskStore } from '../riskStore'
import { useCharacterStore, PLAYER_ID } from '../../character/characterStore'
import { INITIAL_SPRINT_STATE } from '../sprintRules'
import { INITIAL_SECURITY_BREACH } from '../securityStoryRules'
import { BOARD_TASKS } from '../tasks'

const tick = () => new Promise((r) => setTimeout(r, 0))
const chars = () => useCharacterStore.getState()
const story = () => useStoryDecisionStore.getState()
const baseline = () => story().decisions['security-baseline-path']
const taskCount = (id: string) => useGameStore.getState().tasks.filter((t) => t.id === id).length

// Drives an async scripted conversation to completion, recording whether a
// choice was ever presented (same harness postAuditInteraction.test uses).
async function play(run: () => Promise<void>, pick: string): Promise<{ choiceShown: boolean }> {
  let done = false
  let choiceShown = false
  const promise = run().then(() => {
    done = true
  })
  for (let i = 0; i < 200 && !done; i++) {
    await tick()
    const g = useGameStore.getState()
    if (g.activeChoice) {
      choiceShown = true
      g.chooseOption(pick)
    } else if (g.activeDialogue) {
      g.advanceDialogue()
    }
  }
  await promise
  return { choiceShown }
}

beforeEach(() => {
  window.localStorage.clear()
  useSprintStore.setState({ ...INITIAL_SPRINT_STATE, confirmingEndDay: false })
  useGameStore.setState({ phase: 'free', activeDialogue: null, activeChoice: null, tasks: BOARD_TASKS.map((t) => ({ ...t })) })
  useRiskStore.setState({ signals: [] })
  useSecurityStoryStore.setState({
    securityBreach: { ...INITIAL_SECURITY_BREACH },
    postAuditConversation: { status: 'locked', effectsApplied: false },
    hasIntroducedSecuritySpecialist: false,
  })
  useCharacterStore.setState({
    characters: { [PLAYER_ID]: { state: { kind: 'idle' }, position: [-2, 0, 5.3], rotationY: 0 } },
    sceneOwned: new Set(),
    inputLocked: false,
  })
  chars().spawnCharacter(SONYA, [-2, 0, 6.3], Math.PI)
  story().resetLevel1Story()
  story().unlockDecision('security-baseline-path', { sprintNumber: 1, day: 1 })
})

describe('baseline scene (17A demo node)', () => {
  it('approach walks the player without opening a dialogue', () => {
    expect(beginApproachToSonyaForBaseline()).toBe(true)
    expect(chars().characters[PLAYER_ID].state.kind).toBe('walking')
    expect(useGameStore.getState().activeDialogue).toBeNull()
    expect(baseline().status).toBe('available') // not running until arrival
  })

  it('runs to completion, records the choice and applies NO gameplay effects', async () => {
    const tasksBefore = useGameStore.getState().tasks.length
    const { choiceShown } = await play(runBaselineDecisionConversation, 'order-external-audit')
    expect(choiceShown).toBe(true)
    expect(baseline().status).toBe('resolved')
    expect(baseline().selectedChoiceId).toBe('order-external-audit')
    expect(baseline().effectsApplied).toBe(true)
    // no money/tasks/risk changes in 17A - the demo node only records the choice
    expect(useGameStore.getState().tasks.length).toBe(tasksBefore)
    expect(useRiskStore.getState().signals).toEqual([])
    // control handed back
    expect(chars().inputLocked).toBe(false)
    expect(chars().sceneOwned.has(SONYA)).toBe(false)
  })

  it('an interrupted run reuses the saved choice without asking again', async () => {
    await play(runBaselineDecisionConversation, 'hire-security-specialist-first')
    // replay the scene (e.g. stale marker click after a reload race)
    useStoryDecisionStore.setState({
      decisions: { ...story().decisions, 'security-baseline-path': { ...baseline(), status: 'available' } },
    })
    const second = await play(runBaselineDecisionConversation, 'order-external-audit')
    expect(second.choiceShown).toBe(false)
    expect(baseline().selectedChoiceId).toBe('hire-security-specialist-first')
  })
})

describe('old post-breach fork is not duplicated (17A §9)', () => {
  function completeBreachAndUnlockTalk() {
    useSecurityStoryStore.setState({
      securityBreach: { ...INITIAL_SECURITY_BREACH, status: 'completed', completedAt: { sprintNumber: 2, day: 3 }, decision: 'take-responsibility', effectsApplied: true },
      postAuditConversation: { status: 'locked', effectsApplied: false },
      hasIntroducedSecuritySpecialist: false,
    })
    useSecurityStoryStore.getState().unlockPostAuditConversation()
    useSprintStore.setState({ sprintNumber: 2, day: 3, phase: 'active', confirmingEndDay: false })
  }

  it('with the baseline already decided, the post-audit talk shows NO second fork and applies the legacy effects once', async () => {
    await play(runBaselineDecisionConversation, 'hire-security-specialist-first')
    completeBreachAndUnlockTalk()

    const { choiceShown } = await play(runPostAuditConversation, 'decline-security-hire') // pick would be ignored
    expect(choiceShown).toBe(false) // the same fork is never asked twice
    const pa = useSecurityStoryStore.getState().postAuditConversation
    expect(pa.status).toBe('completed')
    expect(pa.staffingDecision).toBe('approve-security-hire') // follows the baseline choice
    expect(taskCount(HIRE_SECURITY_TASK.id)).toBe(1) // legacy effects applied exactly once
    expect(taskCount(CLOSE_FINDINGS_TASK.id)).toBe(0)
  })

  it('an old save that never saw the baseline scene keeps the legacy fork and syncs the record', async () => {
    story().resetLevel1Story() // baseline locked - the scene never existed for this save
    completeBreachAndUnlockTalk()

    const { choiceShown } = await play(runPostAuditConversation, 'decline-security-hire')
    expect(choiceShown).toBe(true) // the legacy fork is still the one asked
    expect(baseline().status).toBe('resolved')
    expect(baseline().selectedChoiceId).toBe('order-external-audit')
    expect(baseline().migratedFromLegacy).toBe(true)
    expect(taskCount(CLOSE_FINDINGS_TASK.id)).toBe(1)
  })
})
