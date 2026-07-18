import { describe, it, expect } from 'vitest'
import {
  INITIAL_SECURITY_BREACH,
  canTriggerSecurityBreach,
  getSecurityBreachEligibility,
  mapCutsceneChoiceToSecurityDecision,
  normalizeSecurityStoryState,
  type SecurityBreachTriggerContext,
} from './securityStoryRules'

// A fully-eligible context; each test flips one field.
const eligible = (over: Partial<SecurityBreachTriggerContext> = {}): SecurityBreachTriggerContext => ({
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

describe('canTriggerSecurityBreach', () => {
  it('allows a fully eligible context (active, sprint 2, day 2, team, prototype, idle UI)', () => {
    expect(canTriggerSecurityBreach(eligible())).toBe(true)
  })

  it.each<[string, Partial<SecurityBreachTriggerContext>]>([
    ['no prototype', { hasFirstPrototype: false }],
    ['no backend', { hasBackendDeveloper: false }],
    ['no frontend', { hasFrontendDeveloper: false }],
    ['sprint 1', { sprintNumber: 1 }],
    ['planning', { sprintPhase: 'planning' }],
    ['review', { sprintPhase: 'review' }],
    ['sprint 2 day 1', { day: 1 }],
    ['game not free', { gamePhase: 'meetPm' }],
    ['another cutscene running', { isCutsceneRunning: true }],
    ['server minigame open', { isServerMinigameOpen: true }],
    ['blocking overlay open', { isBlockingOverlayOpen: true }],
    ['blocking dialogue open', { isBlockingDialogueOpen: true }],
    ['already completed', { securityBreachStatus: 'completed' }],
    ['already running', { securityBreachStatus: 'running' }],
  ])('is not allowed with %s', (_label, over) => {
    expect(canTriggerSecurityBreach(eligible(over))).toBe(false)
  })

  it('reports the specific blocking reasons', () => {
    const { allowed, blockingReasons } = getSecurityBreachEligibility(eligible({ sprintNumber: 1, day: 1, hasFirstPrototype: false }))
    expect(allowed).toBe(false)
    expect(blockingReasons).toEqual(expect.arrayContaining(['first-sprint', 'first-day', 'prototype-missing']))
  })
})

describe('mapCutsceneChoiceToSecurityDecision', () => {
  it('maps stable and legacy ids, undefined otherwise', () => {
    expect(mapCutsceneChoiceToSecurityDecision('take-responsibility')).toBe('take-responsibility')
    expect(mapCutsceneChoiceToSecurityDecision('blame-project-manager')).toBe('blame-project-manager')
    expect(mapCutsceneChoiceToSecurityDecision('accept')).toBe('take-responsibility')
    expect(mapCutsceneChoiceToSecurityDecision('blame')).toBe('blame-project-manager')
    expect(mapCutsceneChoiceToSecurityDecision('nope')).toBeUndefined()
  })
})

describe('normalizeSecurityStoryState', () => {
  it('missing / non-object gives the initial state', () => {
    expect(normalizeSecurityStoryState(undefined)).toEqual(INITIAL_SECURITY_BREACH)
    expect(normalizeSecurityStoryState({})).toEqual(INITIAL_SECURITY_BREACH)
  })

  it('normalises running to not-started, keeping firstStartedAt / decision / effectsApplied', () => {
    const result = normalizeSecurityStoryState({
      securityBreach: {
        status: 'running',
        firstStartedAt: { sprintNumber: 2, day: 2 },
        decision: 'blame-project-manager',
        effectsApplied: true,
      },
    })
    expect(result.status).toBe('not-started')
    expect(result.firstStartedAt).toEqual({ sprintNumber: 2, day: 2 })
    expect(result.decision).toBe('blame-project-manager')
    expect(result.effectsApplied).toBe(true)
  })

  it('keeps a valid completed state final', () => {
    const result = normalizeSecurityStoryState({
      securityBreach: { status: 'completed', completedAt: { sprintNumber: 2, day: 3 }, decision: 'take-responsibility', effectsApplied: true },
    })
    expect(result.status).toBe('completed')
    expect(result.completedAt).toEqual({ sprintNumber: 2, day: 3 })
  })

  it('completed without a valid date is downgraded to not-started (but keeps effectsApplied)', () => {
    const result = normalizeSecurityStoryState({ securityBreach: { status: 'completed', effectsApplied: true, decision: 'blame-project-manager' } })
    expect(result.status).toBe('not-started')
    expect(result.effectsApplied).toBe(true)
    expect(result.decision).toBe('blame-project-manager')
  })

  it('drops unknown status/decision and out-of-range moments', () => {
    const result = normalizeSecurityStoryState({
      securityBreach: { status: 'weird', decision: 'sue-everyone', completedAt: { sprintNumber: -1, day: 99 }, effectsApplied: 'yes' },
    })
    expect(result).toEqual(INITIAL_SECURITY_BREACH)
  })
})
