import { describe, it, expect, beforeEach } from 'vitest'
import {
  useSecurityStoryStore,
  loadSecurityStory,
  saveSecurityStory,
  SECURITY_TRAINING_TASK,
  DISCUSS_AUDIT_TASK,
  HIRE_SECURITY_TASK,
  CLOSE_FINDINGS_TASK,
} from './securityStoryStore'
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
  useSecurityStoryStore.setState({ securityBreach: { ...INITIAL_SECURITY_BREACH }, postAuditConversation: { status: 'locked', effectsApplied: false }, hasIntroducedSecuritySpecialist: false })
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
  it('old save without story state loads the initial breach + locked conversation', () => {
    const loaded = loadSecurityStory(fakeStorage(), '')
    expect(loaded.securityBreach).toEqual(INITIAL_SECURITY_BREACH)
    expect(loaded.postAuditConversation.status).toBe('locked')
  })

  it('a persisted running breach hydrates to not-started, keeping decision/effects', () => {
    const saved = { securityBreach: { status: 'running', firstStartedAt: { sprintNumber: 2, day: 2 }, decision: 'blame-project-manager', effectsApplied: true } }
    const loaded = loadSecurityStory(fakeStorage({ [KEY]: JSON.stringify(saved) }), '').securityBreach
    expect(loaded.status).toBe('not-started')
    expect(loaded.effectsApplied).toBe(true)
    expect(loaded.decision).toBe('blame-project-manager')
  })

  it('completed breach survives reload and migrates the conversation to pending', () => {
    const saved = { securityBreach: { status: 'completed', completedAt: { sprintNumber: 2, day: 3 }, effectsApplied: true } }
    const loaded = loadSecurityStory(fakeStorage({ [KEY]: JSON.stringify(saved) }), '')
    expect(loaded.securityBreach.status).toBe('completed')
    expect(loaded.postAuditConversation.status).toBe('pending') // Feature 05 -> 06 migration
  })

  it('?intro wipes the story', () => {
    const storage = fakeStorage({ [KEY]: JSON.stringify({ securityBreach: { status: 'completed', completedAt: { sprintNumber: 2, day: 3 }, effectsApplied: true } }) })
    const loaded = loadSecurityStory(storage, '?intro')
    expect(loaded.securityBreach).toEqual(INITIAL_SECURITY_BREACH)
    expect(loaded.postAuditConversation.status).toBe('locked')
    expect(storage.dump()).toEqual({})
  })

  it('corrupt JSON and no storage are safe', () => {
    expect(loadSecurityStory(fakeStorage({ [KEY]: '{oops' }), '').securityBreach).toEqual(INITIAL_SECURITY_BREACH)
    expect(loadSecurityStory(null, '').securityBreach).toEqual(INITIAL_SECURITY_BREACH)
    expect(() =>
      saveSecurityStory(null, {
        securityBreach: INITIAL_SECURITY_BREACH,
        postAuditConversation: { status: 'locked', effectsApplied: false },
        hasIntroducedSecuritySpecialist: false,
      }),
    ).not.toThrow()
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

// ---------------------------------------------------------------------------
// Feature 06 - post-audit conversation with Sonya & staffing decision
// ---------------------------------------------------------------------------
const pa = () => useSecurityStoryStore.getState().postAuditConversation
const taskCount = (id: string) => useGameStore.getState().tasks.filter((t) => t.id === id).length
const taskDone = (id: string) => useGameStore.getState().tasks.find((t) => t.id === id)?.done

describe('post-audit conversation lifecycle', () => {
  beforeEach(resetStores)

  it('completing the breach unlocks the conversation and adds the discuss task', () => {
    useSecurityStoryStore.getState().markSecurityBreachRunning(moment(2))
    useSecurityStoryStore.getState().markSecurityBreachCompleted(moment(3))
    expect(pa().status).toBe('pending')
    expect(taskCount(DISCUSS_AUDIT_TASK.id)).toBe(1)
  })

  it('unlock is idempotent - no duplicate discuss task', () => {
    useSecurityStoryStore.getState().markSecurityBreachCompleted(moment(3))
    useSecurityStoryStore.getState().unlockPostAuditConversation()
    useSecurityStoryStore.getState().unlockPostAuditConversation()
    expect(taskCount(DISCUSS_AUDIT_TASK.id)).toBe(1)
  })

  it('markRunning moves pending -> running and records startedAt', () => {
    useSecurityStoryStore.getState().markSecurityBreachCompleted(moment(3))
    useSecurityStoryStore.getState().markPostAuditConversationRunning(moment(4))
    expect(pa()).toMatchObject({ status: 'running', startedAt: { sprintNumber: 2, day: 4 } })
  })

  it('markRunning does nothing while still locked', () => {
    useSecurityStoryStore.getState().markPostAuditConversationRunning(moment(4))
    expect(pa().status).toBe('locked')
  })

  it('markFailed returns a running conversation to pending', () => {
    useSecurityStoryStore.getState().markSecurityBreachCompleted(moment(3))
    useSecurityStoryStore.getState().markPostAuditConversationRunning(moment(4))
    useSecurityStoryStore.getState().markPostAuditConversationFailed()
    expect(pa().status).toBe('pending')
  })
})

describe('staffing decision side-effects (idempotent)', () => {
  beforeEach(() => {
    resetStores()
    useSecurityStoryStore.getState().markSecurityBreachCompleted(moment(3))
    useSecurityStoryStore.getState().markPostAuditConversationRunning(moment(4))
  })

  it('approve adds the hire task, completes the discuss task, once', () => {
    const res = useSecurityStoryStore.getState().resolveSecurityStaffingDecision('approve-security-hire')
    expect(res).toEqual({ applied: true, decision: 'approve-security-hire' })
    expect(taskCount(HIRE_SECURITY_TASK.id)).toBe(1)
    expect(taskCount(CLOSE_FINDINGS_TASK.id)).toBe(0)
    expect(taskDone(DISCUSS_AUDIT_TASK.id)).toBe(true)
    expect(pa().staffingDecision).toBe('approve-security-hire')
  })

  it('decline adds the close-findings task instead', () => {
    useSecurityStoryStore.getState().resolveSecurityStaffingDecision('decline-security-hire')
    expect(taskCount(CLOSE_FINDINGS_TASK.id)).toBe(1)
    expect(taskCount(HIRE_SECURITY_TASK.id)).toBe(0)
    expect(taskDone(DISCUSS_AUDIT_TASK.id)).toBe(true)
  })

  it('re-resolving keeps the first decision and does not duplicate tasks', () => {
    useSecurityStoryStore.getState().resolveSecurityStaffingDecision('approve-security-hire')
    const second = useSecurityStoryStore.getState().resolveSecurityStaffingDecision('decline-security-hire')
    expect(second.applied).toBe(false)
    expect(second.decision).toBe('approve-security-hire')
    expect(taskCount(HIRE_SECURITY_TASK.id)).toBe(1)
    expect(taskCount(CLOSE_FINDINGS_TASK.id)).toBe(0)
  })

  it('markCompleted saves completedAt and is final', () => {
    useSecurityStoryStore.getState().resolveSecurityStaffingDecision('approve-security-hire')
    useSecurityStoryStore.getState().markPostAuditConversationCompleted(moment(5))
    expect(pa()).toMatchObject({ status: 'completed', completedAt: { sprintNumber: 2, day: 5 } })
    useSecurityStoryStore.getState().markPostAuditConversationCompleted(moment(9)) // final - ignored
    expect(pa().completedAt).toEqual({ sprintNumber: 2, day: 5 })
  })
})

describe('post-audit reload & reset', () => {
  beforeEach(resetStores)

  it('a completed conversation with a decision survives a reload', () => {
    useSecurityStoryStore.getState().markSecurityBreachCompleted(moment(3))
    useSecurityStoryStore.getState().markPostAuditConversationRunning(moment(4))
    useSecurityStoryStore.getState().resolveSecurityStaffingDecision('approve-security-hire')
    useSecurityStoryStore.getState().markPostAuditConversationCompleted(moment(5))
    saveSecurityStory(window.localStorage, useSecurityStoryStore.getState())
    const loaded = loadSecurityStory(window.localStorage, '')
    expect(loaded.postAuditConversation).toMatchObject({ status: 'completed', staffingDecision: 'approve-security-hire', effectsApplied: true })
  })

  it('a running conversation hydrates back to pending', () => {
    useSecurityStoryStore.getState().markSecurityBreachCompleted(moment(3))
    useSecurityStoryStore.getState().markPostAuditConversationRunning(moment(4))
    saveSecurityStory(window.localStorage, useSecurityStoryStore.getState())
    expect(loadSecurityStory(window.localStorage, '').postAuditConversation.status).toBe('pending')
  })

  it('reset clears the conversation back to locked', () => {
    useSecurityStoryStore.getState().markSecurityBreachCompleted(moment(3))
    useSecurityStoryStore.getState().resetSecurityStory()
    expect(pa().status).toBe('locked')
    expect(sb().status).toBe('not-started')
  })
})

describe('security specialist introduction flag (Feature 07)', () => {
  beforeEach(resetStores)

  it('defaults to false and is set once, idempotently', () => {
    expect(useSecurityStoryStore.getState().hasIntroducedSecuritySpecialist).toBe(false)
    useSecurityStoryStore.getState().markSecuritySpecialistIntroduced()
    useSecurityStoryStore.getState().markSecuritySpecialistIntroduced()
    expect(useSecurityStoryStore.getState().hasIntroducedSecuritySpecialist).toBe(true)
  })

  it('survives a reload and is wiped by reset', () => {
    useSecurityStoryStore.getState().markSecuritySpecialistIntroduced()
    saveSecurityStory(window.localStorage, useSecurityStoryStore.getState())
    expect(loadSecurityStory(window.localStorage, '').hasIntroducedSecuritySpecialist).toBe(true)
    useSecurityStoryStore.getState().resetSecurityStory()
    expect(useSecurityStoryStore.getState().hasIntroducedSecuritySpecialist).toBe(false)
  })

  it('an old save without the flag loads it as false', () => {
    const saved = { securityBreach: { status: 'completed', completedAt: { sprintNumber: 2, day: 3 }, effectsApplied: true } }
    expect(loadSecurityStory(fakeStorage({ [KEY]: JSON.stringify(saved) }), '').hasIntroducedSecuritySpecialist).toBe(false)
  })
})
