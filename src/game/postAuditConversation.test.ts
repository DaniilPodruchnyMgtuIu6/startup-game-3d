import { describe, it, expect } from 'vitest'
import {
  INITIAL_POST_AUDIT,
  canStartPostAuditConversation,
  getInitialPostAuditConversationState,
  getPostAuditConversationEligibility,
  getPostAuditDialogueBranch,
  isPostAuditConversationRequired,
  mapPostAuditChoiceToStaffingDecision,
  normalizePostAuditConversationState,
  type PostAuditConversationContext,
} from './securityStoryRules'

describe('post-audit initial state & migration', () => {
  it('a fresh game (breach not completed) is locked', () => {
    expect(getInitialPostAuditConversationState('not-started')).toEqual(INITIAL_POST_AUDIT)
    expect(getInitialPostAuditConversationState('running')).toEqual(INITIAL_POST_AUDIT)
  })

  it('an old save with a completed breach becomes pending', () => {
    expect(getInitialPostAuditConversationState('completed')).toEqual({ status: 'pending', effectsApplied: false })
  })
})

describe('normalizePostAuditConversationState', () => {
  it('missing state derives from breach status (migration)', () => {
    expect(normalizePostAuditConversationState(undefined, 'not-started').status).toBe('locked')
    expect(normalizePostAuditConversationState(undefined, 'completed').status).toBe('pending')
  })

  it('running hydrates to pending', () => {
    const r = normalizePostAuditConversationState({ postAuditConversation: { status: 'running', effectsApplied: false } }, 'completed')
    expect(r.status).toBe('pending')
  })

  it('completed with a valid decision is kept', () => {
    const r = normalizePostAuditConversationState(
      { postAuditConversation: { status: 'completed', completedAt: { sprintNumber: 2, day: 3 }, staffingDecision: 'approve-security-hire', effectsApplied: true } },
      'completed',
    )
    expect(r.status).toBe('completed')
    expect(r.staffingDecision).toBe('approve-security-hire')
    expect(r.effectsApplied).toBe(true)
  })

  it('completed without a decision downgrades to pending; effectsApplied without decision becomes false', () => {
    const r = normalizePostAuditConversationState({ postAuditConversation: { status: 'completed', effectsApplied: true } }, 'completed')
    expect(r.status).toBe('pending')
    expect(r.effectsApplied).toBe(false)
  })

  it('pending is forced to locked when the breach is not completed', () => {
    const r = normalizePostAuditConversationState({ postAuditConversation: { status: 'pending', effectsApplied: false } }, 'not-started')
    expect(r.status).toBe('locked')
  })

  it('malformed data is safe', () => {
    const r = normalizePostAuditConversationState({ postAuditConversation: { status: 'weird', staffingDecision: 'sue', completedAt: { sprintNumber: -1, day: 99 } } }, 'completed')
    expect(r.status).toBe('pending')
    expect(r.staffingDecision).toBeUndefined()
  })
})

describe('post-audit eligibility', () => {
  const eligible = (over: Partial<PostAuditConversationContext> = {}): PostAuditConversationContext => ({
    gamePhase: 'free',
    sprintPhase: 'active',
    conversationStatus: 'pending',
    securityBreachStatus: 'completed',
    isCutsceneRunning: false,
    isServerMinigameOpen: false,
    isBlockingOverlayOpen: false,
    isBlockingDialogueOpen: false,
    ...over,
  })

  it('allows a pending conversation in active or planning', () => {
    expect(canStartPostAuditConversation(eligible())).toBe(true)
    expect(canStartPostAuditConversation(eligible({ sprintPhase: 'planning' }))).toBe(true)
  })

  it.each<[string, Partial<PostAuditConversationContext>]>([
    ['locked', { conversationStatus: 'locked' }],
    ['running', { conversationStatus: 'running' }],
    ['completed', { conversationStatus: 'completed' }],
    ['review', { sprintPhase: 'review' }],
    ['game not free', { gamePhase: 'meetPm' }],
    ['breach not completed', { securityBreachStatus: 'not-started' }],
    ['cutscene running', { isCutsceneRunning: true }],
    ['minigame open', { isServerMinigameOpen: true }],
    ['overlay open', { isBlockingOverlayOpen: true }],
    ['dialogue open', { isBlockingDialogueOpen: true }],
  ])('is blocked when %s', (_l, over) => {
    expect(canStartPostAuditConversation(eligible(over))).toBe(false)
  })

  it('reports blocking reasons', () => {
    const { allowed, blockingReasons } = getPostAuditConversationEligibility(eligible({ sprintPhase: 'review', conversationStatus: 'locked' }))
    expect(allowed).toBe(false)
    expect(blockingReasons).toEqual(expect.arrayContaining(['sprint-phase', 'not-pending']))
  })

  it('isPostAuditConversationRequired: pending/running only', () => {
    expect(isPostAuditConversationRequired({ status: 'pending', effectsApplied: false })).toBe(true)
    expect(isPostAuditConversationRequired({ status: 'running', effectsApplied: false })).toBe(true)
    expect(isPostAuditConversationRequired({ status: 'locked', effectsApplied: false })).toBe(false)
    expect(isPostAuditConversationRequired({ status: 'completed', effectsApplied: true })).toBe(false)
  })
})

describe('choice mapping & dialogue branch', () => {
  it('maps staffing choice ids', () => {
    expect(mapPostAuditChoiceToStaffingDecision('approve-security-hire')).toBe('approve-security-hire')
    expect(mapPostAuditChoiceToStaffingDecision('decline-security-hire')).toBe('decline-security-hire')
    expect(mapPostAuditChoiceToStaffingDecision('hire-consultant')).toBeUndefined()
  })

  it('dialogue branch follows the breach decision', () => {
    expect(getPostAuditDialogueBranch('take-responsibility')).toBe('constructive')
    expect(getPostAuditDialogueBranch('blame-project-manager')).toBe('conflict')
    expect(getPostAuditDialogueBranch(undefined)).toBe('neutral')
  })
})
