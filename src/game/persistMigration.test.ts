import { describe, it, expect } from 'vitest'
import { loadGameOutcome } from './gameOutcomeStore'
import { normalizeGameOutcome } from './gameOutcomeRules'
import { loadNpcConversations, normalizeNpcConversationState } from './npcConversationStore'
import { loadEconomy } from './economyStore'
import { loadSprint } from './sprintStore'
import { initialTransactions } from './economyRules'
import { INITIAL_SPRINT_STATE } from './sprintRules'

// Feature 15 §14: consolidated save-migration / dangerous-reload coverage for the
// stores whose normalisers implement the reload-safety rules. Fabricated blobs
// (no invented schema versions) hydrate without throwing, normalise correctly,
// and `?intro` returns the initial state.

function fakeStorage(seed: Record<string, unknown> = {}) {
  const map = new Map<string, string>()
  for (const [k, v] of Object.entries(seed)) map.set(k, JSON.stringify(v))
  return {
    getItem: (k: string) => map.get(k) ?? null,
    setItem: (k: string, v: string) => void map.set(k, v),
    removeItem: (k: string) => void map.delete(k),
  }
}

describe('game outcome dangerous reloads', () => {
  it('a running release rewinds to not-started; success without a snapshot degrades to playing', () => {
    const storage = fakeStorage({
      'startup-office-game-outcome': {
        status: 'success-pending',
        leadershipReview: { status: 'inactive' },
        campaignDeadline: { deadlineSprintNumber: 6, status: 'met' },
        campaignRelease: { status: 'running', startedAt: { sprintNumber: 4, day: 5 } },
      },
    })
    const loaded = loadGameOutcome(storage, '')
    expect(loaded.campaignRelease.status).toBe('not-started')
    expect(loaded.status).toBe('playing') // success-pending had no snapshot
  })
  it('a valid failure wins over a concurrent success', () => {
    const n = normalizeGameOutcome({
      status: 'succeeded',
      success: { reason: 'x', releasedAt: { sprintNumber: 4, day: 5 }, campaignScore: 80, resultTier: 'stable-launch' },
      failure: { reason: 'budget-exhausted', failedAt: { sprintNumber: 4, day: 5 }, contributingReasons: [] },
      leadershipReview: { status: 'inactive' },
      campaignDeadline: { deadlineSprintNumber: 6, status: 'active' },
    })
    expect(n.status).toBe('failed')
  })
  it('normalisation is idempotent (a re-load does not mutate a valid state)', () => {
    const raw = {
      status: 'succeeded',
      success: { releasedAt: { sprintNumber: 4, day: 5 }, campaignScore: 82, resultTier: 'stable-launch', totalProductTasks: 14, completedProductTasks: 14 },
      leadershipReview: { status: 'recovered', recoveredAt: { sprintNumber: 3, day: 4 } },
      campaignDeadline: { deadlineSprintNumber: 6, status: 'met', metAt: { sprintNumber: 4, day: 5 } },
      campaignRelease: { status: 'released', releasedAt: { sprintNumber: 4, day: 5 } },
    }
    const once = normalizeGameOutcome(raw)
    expect(normalizeGameOutcome(once)).toEqual(once)
  })
})

describe('conversation store migration', () => {
  it('an old Feature 13 save (no conversation store) hydrates to empty', () => {
    expect(loadNpcConversations(fakeStorage(), '')).toEqual({ conversations: {} })
  })
  it('malformed conversation state normalises and does not duplicate on re-load', () => {
    const raw = { conversations: { 'kirill-morozov': [{ id: 'a', role: 'user', content: 'hi', createdAt: 1 }, { id: 'a', role: 'assistant', content: 'dup id', createdAt: 2 }] } }
    const once = normalizeNpcConversationState(raw)
    expect(once.conversations['kirill-morozov']).toHaveLength(1) // duplicate id dropped
    expect(normalizeNpcConversationState(once)).toEqual(once)
  })
})

describe('?intro reset returns the initial state', () => {
  it('economy → initial funding only; sprint → initial; conversations → empty', () => {
    const storage = fakeStorage({
      'startup-office-economy': { transactions: [{ id: 'x', kind: 'expense', category: 'operations', title: 't', amount: 5, sprintNumber: 1, day: 1 }] },
      'startup-office-sprint': { sprintNumber: 4, day: 5, phase: 'active' },
      'startup-office-npc-conversations': { conversations: { 'sonya-sokolova': [{ id: 'a', role: 'user', content: 'hi', createdAt: 1 }] } },
    })
    expect(loadEconomy(storage, '?intro')).toEqual(initialTransactions())
    expect(loadSprint(storage, '?intro')).toEqual(INITIAL_SPRINT_STATE)
    expect(loadNpcConversations(storage, '?intro')).toEqual({ conversations: {} })
  })
})
