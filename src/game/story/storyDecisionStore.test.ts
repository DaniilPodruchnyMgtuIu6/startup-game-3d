import { describe, it, expect, beforeEach } from 'vitest'
import { useStoryDecisionStore, loadStoryDecisions, saveStoryDecisions } from './storyDecisionStore'
import { initialStoryDecisionRecords } from './storyDecisionRules'

const store = () => useStoryDecisionStore.getState()
const M = { sprintNumber: 1, day: 1 }

beforeEach(() => {
  window.localStorage.clear()
  store().resetLevel1Story()
})

describe('store init & reset (17A §5/§10)', () => {
  it('holds exactly eight locked records after reset, idempotently', () => {
    store().resetLevel1Story()
    store().resetLevel1Story()
    expect(Object.keys(store().decisions)).toHaveLength(8)
    expect(Object.values(store().decisions).every((r) => r.status === 'locked')).toBe(true)
    expect(store().activeDecisionId).toBeUndefined()
    expect(store().completedCheckpointIds).toEqual([])
  })

  it('reset clears an unlocked/resolved campaign back to locked', () => {
    store().unlockDecision('security-baseline-path', M)
    store().resolveDecision('security-baseline-path', 'order-external-audit', M)
    store().markCheckpointCompleted('cp-1')
    store().resetLevel1Story()
    expect(store().decisions['security-baseline-path']).toEqual(initialStoryDecisionRecords()['security-baseline-path'])
    expect(store().completedCheckpointIds).toEqual([])
    expect(store().activeDecisionId).toBeUndefined()
  })
})

describe('unlock/start/resolve lifecycle', () => {
  it('unlock -> available (with moment) and becomes the single active decision', () => {
    store().unlockDecision('security-baseline-path', M)
    const r = store().decisions['security-baseline-path']
    expect(r.status).toBe('available')
    expect(r.availableAt).toEqual(M)
    expect(store().activeDecisionId).toBe('security-baseline-path')
  })

  it('unlock is idempotent and never rewinds a resolved decision', () => {
    store().unlockDecision('security-baseline-path', M)
    store().resolveDecision('security-baseline-path', 'order-external-audit', M)
    store().unlockDecision('security-baseline-path', { sprintNumber: 2, day: 2 })
    expect(store().decisions['security-baseline-path'].status).toBe('resolved')
  })

  it('start requires available; interrupted running rolls back to available', () => {
    store().startDecision('security-baseline-path', M) // locked -> no-op
    expect(store().decisions['security-baseline-path'].status).toBe('locked')
    store().unlockDecision('security-baseline-path', M)
    store().startDecision('security-baseline-path', M)
    expect(store().decisions['security-baseline-path'].status).toBe('running')
    store().markDecisionInterrupted('security-baseline-path')
    expect(store().decisions['security-baseline-path'].status).toBe('available')
  })

  it('resolve records the choice, applies effects and clears the active id', () => {
    store().unlockDecision('security-baseline-path', M)
    const res = store().resolveDecision('security-baseline-path', 'hire-security-specialist-first', M)
    expect(res).toEqual({
      applied: true,
      decisionId: 'security-baseline-path',
      choiceId: 'hire-security-specialist-first',
      operationId: 'story-decision:security-baseline-path:hire-security-specialist-first',
    })
    const r = store().decisions['security-baseline-path']
    expect(r.status).toBe('resolved')
    expect(r.effectsApplied).toBe(true)
    expect(r.resolvedAt).toEqual(M)
    expect(store().activeDecisionId).toBeUndefined()
  })

  it('an unknown choice id is rejected without state change', () => {
    store().unlockDecision('security-baseline-path', M)
    const res = store().resolveDecision('security-baseline-path', 'hack-the-planet', M)
    expect(res.applied).toBe(false)
    expect(store().decisions['security-baseline-path'].status).toBe('available')
  })
})

describe('repeated & partial resolve (17A §8)', () => {
  it('a repeated resolve returns the EXISTING choice and applies nothing', () => {
    store().unlockDecision('security-baseline-path', M)
    store().resolveDecision('security-baseline-path', 'order-external-audit', M)
    const again = store().resolveDecision('security-baseline-path', 'hire-security-specialist-first', { sprintNumber: 2, day: 2 })
    expect(again.applied).toBe(false)
    expect(again.choiceId).toBe('order-external-audit') // the original choice is the truth
    expect(store().decisions['security-baseline-path'].selectedChoiceId).toBe('order-external-audit')
    expect(store().decisions['security-baseline-path'].resolvedAt).toEqual(M)
  })

  it('a partially-applied resolve (choice saved, effects flag off) completes safely', () => {
    store().unlockDecision('security-baseline-path', M)
    store().resolveDecision('security-baseline-path', 'order-external-audit', M)
    // simulate the crash between saving the choice and marking effects applied
    useStoryDecisionStore.setState({
      decisions: {
        ...store().decisions,
        'security-baseline-path': { ...store().decisions['security-baseline-path'], effectsApplied: false },
      },
    })
    const retry = store().resolveDecision('security-baseline-path', 'order-external-audit', M)
    expect(retry.applied).toBe(false)
    expect(store().decisions['security-baseline-path'].effectsApplied).toBe(true)
    expect(store().decisions['security-baseline-path'].selectedChoiceId).toBe('order-external-audit')
  })
})

describe('legacy sync & checkpoints', () => {
  it('recordLegacyBaselineResolution marks the node resolved without effects work', () => {
    store().recordLegacyBaselineResolution('approve-security-hire', M)
    const r = store().decisions['security-baseline-path']
    expect(r.status).toBe('resolved')
    expect(r.selectedChoiceId).toBe('hire-security-specialist-first')
    expect(r.migratedFromLegacy).toBe(true)
    expect(r.effectsApplied).toBe(true)
    // a second call (repeat migration) changes nothing
    store().recordLegacyBaselineResolution('decline-security-hire', { sprintNumber: 3, day: 3 })
    expect(store().decisions['security-baseline-path'].selectedChoiceId).toBe('hire-security-specialist-first')
  })

  it('checkpoints record once', () => {
    store().markCheckpointCompleted('cp-1')
    store().markCheckpointCompleted('cp-1')
    expect(store().completedCheckpointIds).toEqual(['cp-1'])
  })
})

describe('persistence (17A §9/§10)', () => {
  it('save/load round-trips and ?intro returns the fresh state', () => {
    store().unlockDecision('security-baseline-path', M)
    store().resolveDecision('security-baseline-path', 'order-external-audit', M)
    saveStoryDecisions(window.localStorage, {
      decisions: store().decisions,
      activeDecisionId: store().activeDecisionId,
      completedCheckpointIds: store().completedCheckpointIds,
    })

    const loaded = loadStoryDecisions(window.localStorage, '')
    expect(loaded.decisions['security-baseline-path'].status).toBe('resolved')
    expect(loaded.decisions['security-baseline-path'].selectedChoiceId).toBe('order-external-audit')

    const reset = loadStoryDecisions(window.localStorage, '?intro')
    expect(Object.values(reset.decisions).every((r) => r.status === 'locked')).toBe(true)
    expect(window.localStorage.getItem('startup-office-story-decisions')).toBeNull()
  })

  it('a corrupt save hydrates fresh without throwing', () => {
    window.localStorage.setItem('startup-office-story-decisions', '{not json')
    const loaded = loadStoryDecisions(window.localStorage, '')
    expect(Object.values(loaded.decisions).every((r) => r.status === 'locked')).toBe(true)
  })
})
