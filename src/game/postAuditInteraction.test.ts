import { describe, it, expect, beforeEach } from 'vitest'
import {
  SONYA,
  beginApproachToSonya,
  pausePlanner,
  resumePlanner,
  isPlannerPaused,
  runPostAuditConversation,
} from './postAuditInteraction'
import { useGameStore } from './gameStore'
import { useSprintStore } from './sprintStore'
import { useSecurityStoryStore, HIRE_SECURITY_TASK, CLOSE_FINDINGS_TASK, DISCUSS_AUDIT_TASK } from './securityStoryStore'
import { useCharacterStore, PLAYER_ID } from '../character/characterStore'
import { INITIAL_SECURITY_BREACH, type SecurityBreachDecision } from './securityStoryRules'
import { BOARD_TASKS } from './tasks'

const tick = () => new Promise((r) => setTimeout(r, 0))
const chars = () => useCharacterStore.getState()
const story = () => useSecurityStoryStore.getState()
const tasks = () => useGameStore.getState().tasks
const taskCount = (id: string) => tasks().filter((t) => t.id === id).length
const taskDone = (id: string) => tasks().find((t) => t.id === id)?.done

// Puts the story just after the breach: conversation pending with the given
// past decision, Sonya and the player spawned a step apart.
function arriveAtSonya(breachDecision: SecurityBreachDecision = 'take-responsibility') {
  useSecurityStoryStore.setState({
    securityBreach: { ...INITIAL_SECURITY_BREACH, status: 'completed', completedAt: { sprintNumber: 2, day: 3 }, decision: breachDecision, effectsApplied: true },
    postAuditConversation: { status: 'locked', effectsApplied: false },
  })
  useSecurityStoryStore.getState().unlockPostAuditConversation() // pending + adds the discuss task
  chars().spawnCharacter(SONYA, [-2, 0, 6.3], Math.PI)
  chars().setTransform(PLAYER_ID, [-2, 0, 5.3], 0)
}

// Drives the async conversation to completion: advance every line and pick the
// given staffing option when the choice appears. Records whether a choice was
// ever presented (used to prove the reload path skips it).
async function play(pick: string): Promise<{ choiceShown: boolean }> {
  let done = false
  let choiceShown = false
  const promise = runPostAuditConversation().then(() => {
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
  useSecurityStoryStore.setState({
    securityBreach: { ...INITIAL_SECURITY_BREACH },
    postAuditConversation: { status: 'locked', effectsApplied: false },
  })
  useGameStore.setState({ activeDialogue: null, activeChoice: null, tasks: BOARD_TASKS.map((t) => ({ ...t })) })
  useCharacterStore.setState({
    characters: { [PLAYER_ID]: { state: { kind: 'idle' }, position: [2, 0, 6], rotationY: Math.PI } },
    sceneOwned: new Set(),
    inputLocked: false,
  })
  window.localStorage.clear()
})

describe('planner pause/resume', () => {
  it('pause marks Sonya scene-owned and resume clears it', () => {
    expect(isPlannerPaused()).toBe(false)
    pausePlanner()
    expect(isPlannerPaused()).toBe(true)
    expect(chars().sceneOwned.has(SONYA)).toBe(true)
    resumePlanner()
    expect(isPlannerPaused()).toBe(false)
  })

  it('pause does not clobber ids a cutscene already owns', () => {
    useCharacterStore.setState({ sceneOwned: new Set(['guard1']) })
    pausePlanner()
    expect(chars().sceneOwned.has('guard1')).toBe(true)
    expect(chars().sceneOwned.has(SONYA)).toBe(true)
    resumePlanner()
    expect(chars().sceneOwned.has('guard1')).toBe(true)
    expect(chars().sceneOwned.has(SONYA)).toBe(false)
  })
})

describe('beginApproachToSonya', () => {
  beforeEach(() => arriveAtSonya())

  it('sends the player walking and pauses Sonya, without opening a dialogue', () => {
    expect(beginApproachToSonya()).toBe(true)
    expect(chars().characters[PLAYER_ID].state.kind).toBe('walking') // approach, not teleport
    expect(isPlannerPaused()).toBe(true)
    expect(useGameStore.getState().activeDialogue).toBeNull() // no instant dialogue
    expect(story().postAuditConversation.status).toBe('pending') // not running yet
  })

  it('does nothing while input is locked', () => {
    chars().setInputLocked(true)
    expect(beginApproachToSonya()).toBe(false)
    expect(isPlannerPaused()).toBe(false)
  })

  it('does nothing when Sonya is not spawned', () => {
    chars().removeCharacter(SONYA)
    expect(beginApproachToSonya()).toBe(false)
  })
})

describe('runPostAuditConversation - constructive branch, approve', () => {
  beforeEach(() => arriveAtSonya('take-responsibility'))

  it('runs to completion, saves approve, and unblocks the day', async () => {
    useSprintStore.setState({ sprintNumber: 2, day: 3 })
    const { choiceShown } = await play('approve-security-hire')
    expect(choiceShown).toBe(true)

    const pa = story().postAuditConversation
    expect(pa.status).toBe('completed')
    expect(pa.staffingDecision).toBe('approve-security-hire')
    expect(pa.completedAt).toEqual({ sprintNumber: 2, day: 3 })

    expect(taskCount(HIRE_SECURITY_TASK.id)).toBe(1)
    expect(taskCount(CLOSE_FINDINGS_TASK.id)).toBe(0)
    expect(taskDone(DISCUSS_AUDIT_TASK.id)).toBe(true)

    // control handed back, Sonya released and no longer talking
    expect(chars().inputLocked).toBe(false)
    expect(isPlannerPaused()).toBe(false)
    expect(chars().characters[SONYA].state.kind).toBe('idle')
    expect(chars().characters[PLAYER_ID].state.kind).toBe('idle')
  })
})

describe('runPostAuditConversation - conflict branch, decline', () => {
  beforeEach(() => arriveAtSonya('blame-project-manager'))

  it('saves decline and creates the close-findings task', async () => {
    await play('decline-security-hire')
    const pa = story().postAuditConversation
    expect(pa.status).toBe('completed')
    expect(pa.staffingDecision).toBe('decline-security-hire')
    expect(taskCount(CLOSE_FINDINGS_TASK.id)).toBe(1)
    expect(taskCount(HIRE_SECURITY_TASK.id)).toBe(0)
    expect(taskDone(DISCUSS_AUDIT_TASK.id)).toBe(true)
  })
})

describe('runPostAuditConversation - reload with a saved decision', () => {
  it('skips the choice and does not re-apply effects', async () => {
    arriveAtSonya('take-responsibility')
    // simulate a reload after the decision was made but before completion:
    // decision saved + effects already applied, conversation back to pending
    story().markPostAuditConversationRunning({ sprintNumber: 2, day: 3 })
    story().resolveSecurityStaffingDecision('approve-security-hire')
    useSecurityStoryStore.setState({
      postAuditConversation: { ...story().postAuditConversation, status: 'pending', startedAt: undefined },
    })
    expect(taskCount(HIRE_SECURITY_TASK.id)).toBe(1)

    const { choiceShown } = await play('decline-security-hire') // pick is ignored
    expect(choiceShown).toBe(false) // choice skipped - saved decision is the truth
    expect(story().postAuditConversation.staffingDecision).toBe('approve-security-hire')
    expect(story().postAuditConversation.status).toBe('completed')
    expect(taskCount(HIRE_SECURITY_TASK.id)).toBe(1) // not duplicated
    expect(taskCount(CLOSE_FINDINGS_TASK.id)).toBe(0)
  })
})
