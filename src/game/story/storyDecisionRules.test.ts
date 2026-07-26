import { describe, it, expect } from 'vitest'
import {
  canUnlockSecurityBaseline,
  getActiveBlockingDecisionId,
  initialStoryDecisionRecords,
  isBlockingStoryDecisionPending,
  mapBaselineChoiceToStaffingDecision,
  mapStaffingDecisionToBaselineChoice,
  normalizeStoryDecisionState,
  storyDecisionOperationId,
  type StoryDecisionRecords,
} from './storyDecisionRules'

function withStatus(records: StoryDecisionRecords, over: Partial<Record<keyof StoryDecisionRecords, 'available' | 'running' | 'resolved'>>): StoryDecisionRecords {
  const next = { ...records }
  for (const [id, status] of Object.entries(over)) {
    const key = id as keyof StoryDecisionRecords
    next[key] = { ...next[key], status: status!, ...(status === 'resolved' ? { selectedChoiceId: 'x', effectsApplied: true } : {}) }
  }
  return next
}

describe('priority & single active decision (17A §6)', () => {
  it('no available decisions -> nothing pending', () => {
    const records = initialStoryDecisionRecords()
    expect(getActiveBlockingDecisionId(records)).toBeUndefined()
    expect(isBlockingStoryDecisionPending(records)).toBe(false)
  })

  it('several available decisions -> the fixed priority order wins, stably', () => {
    const records = withStatus(initialStoryDecisionRecords(), {
      'backup-and-restore-strategy': 'available',
      'developer-admin-access': 'available',
      'release-risk-decision': 'available',
    })
    for (let i = 0; i < 5; i++) {
      expect(getActiveBlockingDecisionId(records)).toBe('developer-admin-access')
    }
  })

  it('a running decision wins over an earlier-priority available one', () => {
    const records = withStatus(initialStoryDecisionRecords(), {
      'security-baseline-path': 'available',
      'frontend-test-data': 'running',
    })
    expect(getActiveBlockingDecisionId(records)).toBe('frontend-test-data')
  })

  it('resolved decisions never block', () => {
    const records = withStatus(initialStoryDecisionRecords(), { 'security-baseline-path': 'resolved' })
    expect(isBlockingStoryDecisionPending(records)).toBe(false)
  })
})

describe('operation id (17A §8)', () => {
  it('follows story-decision:{decisionId}:{choiceId}', () => {
    expect(storyDecisionOperationId('security-baseline-path', 'order-external-audit')).toBe(
      'story-decision:security-baseline-path:order-external-audit',
    )
  })
})

describe('baseline eligibility (17A §9)', () => {
  it('unlocks only with both developers, sprint 1 planning, and no legacy decision', () => {
    const base = { bothDevelopersHired: true, sprintNumber: 1, sprintPhase: 'planning', legacyStaffingDecided: false }
    expect(canUnlockSecurityBaseline(base)).toBe(true)
    expect(canUnlockSecurityBaseline({ ...base, bothDevelopersHired: false })).toBe(false)
    expect(canUnlockSecurityBaseline({ ...base, sprintNumber: 2 })).toBe(false)
    expect(canUnlockSecurityBaseline({ ...base, sprintPhase: 'active' })).toBe(false)
    expect(canUnlockSecurityBaseline({ ...base, legacyStaffingDecided: true })).toBe(false)
  })
})

describe('legacy fork mapping', () => {
  it('maps both directions consistently, accepting the 17A legacy alias', () => {
    expect(mapBaselineChoiceToStaffingDecision('commission-security-audit')).toBe('decline-security-hire')
    expect(mapBaselineChoiceToStaffingDecision('order-external-audit')).toBe('decline-security-hire') // 17A alias
    expect(mapBaselineChoiceToStaffingDecision('hire-security-specialist-first')).toBe('approve-security-hire')
    expect(mapBaselineChoiceToStaffingDecision('nonsense')).toBeUndefined()
    expect(mapStaffingDecisionToBaselineChoice('approve-security-hire')).toBe('hire-security-specialist-first')
    expect(mapStaffingDecisionToBaselineChoice('decline-security-hire')).toBe('commission-security-audit')
  })
})

describe('persistence normalisation', () => {
  it('a corrupt blob hydrates to eight locked records', () => {
    const n = normalizeStoryDecisionState('garbage')
    expect(Object.keys(n.decisions)).toHaveLength(8)
    expect(Object.values(n.decisions).every((r) => r.status === 'locked' && !r.effectsApplied)).toBe(true)
    expect(n.activeDecisionId).toBeUndefined()
    expect(n.completedCheckpointIds).toEqual([])
  })

  it('running rolls back to available; resolved without a valid choice rolls back too', () => {
    const n = normalizeStoryDecisionState({
      decisions: {
        'security-baseline-path': { status: 'running', startedAt: { sprintNumber: 1, day: 1 }, effectsApplied: false },
        'developer-admin-access': { status: 'resolved', effectsApplied: true },
        'frontend-test-data': { status: 'resolved', selectedChoiceId: 'not-a-real-choice', effectsApplied: true },
      },
    })
    expect(n.decisions['security-baseline-path'].status).toBe('available')
    expect(n.decisions['developer-admin-access'].status).toBe('available')
    expect(n.decisions['developer-admin-access'].effectsApplied).toBe(false)
    expect(n.decisions['frontend-test-data'].status).toBe('available')
    expect(n.decisions['frontend-test-data'].selectedChoiceId).toBeUndefined()
  })

  it('a valid resolved record is preserved and the active id is re-derived, idempotently', () => {
    const raw = {
      decisions: {
        'security-baseline-path': {
          status: 'resolved',
          selectedChoiceId: 'order-external-audit',
          resolvedAt: { sprintNumber: 1, day: 1 },
          effectsApplied: true,
          migratedFromLegacy: true,
        },
        'developer-admin-access': { status: 'available', availableAt: { sprintNumber: 1, day: 2 }, effectsApplied: false },
      },
      completedCheckpointIds: ['cp-1', 'cp-1', 42],
    }
    const once = normalizeStoryDecisionState(raw)
    expect(once.decisions['security-baseline-path'].status).toBe('resolved')
    expect(once.decisions['security-baseline-path'].migratedFromLegacy).toBe(true)
    expect(once.activeDecisionId).toBe('developer-admin-access')
    expect(once.completedCheckpointIds).toEqual(['cp-1'])
    expect(normalizeStoryDecisionState(once)).toEqual(once)
  })
})
