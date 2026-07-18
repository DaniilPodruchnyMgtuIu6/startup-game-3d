import { describe, it, expect, beforeEach } from 'vitest'
import { useSecurityStoryStore, loadSecurityStory, saveSecurityStory, SECURITY_TRAINING_TASK } from './securityStoryStore'
import { tryStartSecurityBreach } from './tryStartSecurityBreach'
import { useGameStore } from './gameStore'
import { useCutsceneStore } from '../cutscenes/cutsceneStore'
import { INITIAL_SECURITY_BREACH, type SecurityBreachTriggerContext } from './securityStoryRules'
import { BOARD_TASKS } from './tasks'

const KEY = 'startup-office-security'
const moment = (day = 2) => ({ sprintNumber: 2, day })
const sb = () => useSecurityStoryStore.getState().securityBreach
const reprimands = () => useGameStore.getState().reprimands
const trainingCount = () => useGameStore.getState().tasks.filter((t) => t.id === SECURITY_TRAINING_TASK.id).length

function fakeStorage(initial: Record<string, string> = {}) {
  const data = new Map(Object.entries(initial))
  return {
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => void data.set(k, v),
    removeItem: (k: string) => void data.delete(k),
    dump: () => Object.fromEntries(data),
  }
}

function resetStores() {
  useSecurityStoryStore.setState({ securityBreach: { ...INITIAL_SECURITY_BREACH } })
  useGameStore.setState({ reprimands: 0, tasks: BOARD_TASKS.map((t) => ({ ...t })) })
  useCutsceneStore.setState({ activeSceneId: null, actors: {} })
  window.localStorage.clear()
}

describe('securityStoryStore lifecycle', () => {
  beforeEach(resetStores)

  it('starts not-started', () => {
    expect(sb().status).toBe('not-started')
  })

  it('markRunning records firstStartedAt; a second run does not change it', () => {
    useSecurityStoryStore.getState().markSecurityBreachRunning(moment(2))
    expect(sb()).toMatchObject({ status: 'running', firstStartedAt: { sprintNumber: 2, day: 2 } })
    useSecurityStoryStore.getState().markSecurityBreachFailed()
    useSecurityStoryStore.getState().markSecurityBreachRunning(moment(5))
    expect(sb().firstStartedAt).toEqual({ sprintNumber: 2, day: 2 })
  })

  it('markCompleted saves completedAt and is final', () => {
    useSecurityStoryStore.getState().markSecurityBreachRunning(moment(2))
    useSecurityStoryStore.getState().markSecurityBreachCompleted(moment(3))
    expect(sb()).toMatchObject({ status: 'completed', completedAt: { sprintNumber: 2, day: 3 } })
    useSecurityStoryStore.getState().markSecurityBreachCompleted(moment(9)) // final - ignored
    expect(sb().completedAt).toEqual({ sprintNumber: 2, day: 3 })
  })

  it('markFailed returns a running scene to not-started', () => {
    useSecurityStoryStore.getState().markSecurityBreachRunning(moment(2))
    useSecurityStoryStore.getState().markSecurityBreachFailed()
    expect(sb().status).toBe('not-started')
  })

  it('reset clears the story', () => {
    useSecurityStoryStore.getState().markSecurityBreachRunning(moment(2))
    useSecurityStoryStore.getState().resolveSecurityBreachDecision('blame-project-manager')
    useSecurityStoryStore.getState().resetSecurityStory()
    expect(sb()).toEqual(INITIAL_SECURITY_BREACH)
  })
})

describe('decision side-effects (idempotent)', () => {
  beforeEach(resetStores)

  it('take-responsibility saves the decision and adds no reprimand', () => {
    const res = useSecurityStoryStore.getState().resolveSecurityBreachDecision('take-responsibility')
    expect(res).toEqual({ applied: true, decision: 'take-responsibility' })
    expect(reprimands()).toBe(0)
    expect(trainingCount()).toBe(1)
    expect(sb().decision).toBe('take-responsibility')
  })

  it('blame adds exactly one reprimand and one training task', () => {
    useSecurityStoryStore.getState().resolveSecurityBreachDecision('blame-project-manager')
    expect(reprimands()).toBe(1)
    expect(trainingCount()).toBe(1)
  })

  it('re-resolving does not double the reprimand, task, or overwrite the decision', () => {
    useSecurityStoryStore.getState().resolveSecurityBreachDecision('blame-project-manager')
    const second = useSecurityStoryStore.getState().resolveSecurityBreachDecision('take-responsibility')
    expect(second.applied).toBe(false)
    expect(second.decision).toBe('blame-project-manager') // first decision is the truth
    expect(reprimands()).toBe(1)
    expect(trainingCount()).toBe(1)
  })

  it('does not duplicate an already-present training task', () => {
    useGameStore.setState({ tasks: [...useGameStore.getState().tasks, { ...SECURITY_TRAINING_TASK }] })
    useSecurityStoryStore.getState().resolveSecurityBreachDecision('take-responsibility')
    expect(trainingCount()).toBe(1)
  })
})

describe('persistence & hydration', () => {
  it('old save without story state loads the initial state', () => {
    expect(loadSecurityStory(fakeStorage(), '')).toEqual(INITIAL_SECURITY_BREACH)
  })

  it('a persisted running status hydrates to not-started, keeping decision/effects', () => {
    const saved = { securityBreach: { status: 'running', firstStartedAt: { sprintNumber: 2, day: 2 }, decision: 'blame-project-manager', effectsApplied: true } }
    const loaded = loadSecurityStory(fakeStorage({ [KEY]: JSON.stringify(saved) }), '')
    expect(loaded.status).toBe('not-started')
    expect(loaded.effectsApplied).toBe(true)
    expect(loaded.decision).toBe('blame-project-manager')
  })

  it('completed survives reload', () => {
    const saved = { securityBreach: { status: 'completed', completedAt: { sprintNumber: 2, day: 3 }, effectsApplied: true } }
    expect(loadSecurityStory(fakeStorage({ [KEY]: JSON.stringify(saved) }), '').status).toBe('completed')
  })

  it('?intro wipes the story', () => {
    const storage = fakeStorage({ [KEY]: JSON.stringify({ securityBreach: { status: 'completed', completedAt: { sprintNumber: 2, day: 3 }, effectsApplied: true } }) })
    expect(loadSecurityStory(storage, '?intro')).toEqual(INITIAL_SECURITY_BREACH)
    expect(storage.dump()).toEqual({})
  })

  it('corrupt JSON and no storage are safe', () => {
    expect(loadSecurityStory(fakeStorage({ [KEY]: '{oops' }), '')).toEqual(INITIAL_SECURITY_BREACH)
    expect(loadSecurityStory(null, '')).toEqual(INITIAL_SECURITY_BREACH)
    expect(() => saveSecurityStory(null, INITIAL_SECURITY_BREACH)).not.toThrow()
  })
})

describe('tryStartSecurityBreach use-case', () => {
  beforeEach(resetStores)

  const ctx = (over: Partial<SecurityBreachTriggerContext> = {}): SecurityBreachTriggerContext => ({
    gamePhase: 'free',
    sprintPhase: 'active',
    sprintNumber: 2,
    day: 2,
    hasBackendDeveloper: true,
    hasFrontendDeveloper: true,
    hasFirstPrototype: true,
    securityBreachStatus: 'not-started',
    isCutsceneRunning: false,
    isServerMinigameOpen: false,
    isBlockingOverlayOpen: false,
    isBlockingDialogueOpen: false,
    ...over,
  })

  it('starts the scene when eligible', () => {
    expect(tryStartSecurityBreach(ctx())).toEqual({ started: true })
    expect(useCutsceneStore.getState().activeSceneId).toBe('security-breach')
  })

  it('does not start under a blocking overlay', () => {
    expect(tryStartSecurityBreach(ctx({ isBlockingOverlayOpen: true }))).toEqual({ started: false, reason: 'not-eligible' })
    expect(useCutsceneStore.getState().activeSceneId).toBeNull()
  })

  it('reports already-running / already-completed', () => {
    expect(tryStartSecurityBreach(ctx({ securityBreachStatus: 'running' }))).toEqual({ started: false, reason: 'already-running' })
    expect(tryStartSecurityBreach(ctx({ securityBreachStatus: 'completed' }))).toEqual({ started: false, reason: 'already-completed' })
  })
})
