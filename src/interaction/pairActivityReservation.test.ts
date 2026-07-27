import { describe, it, expect, beforeEach } from 'vitest'
import { tryReservePairActivity, releasePairActivity } from './pairActivityReservation'
import { isTargetFree, claimTarget, releaseClaims } from './interactionRegistry'
import type { TriggerTarget } from './triggerPayload'

const SIDE_A: TriggerTarget = { point: [-1.5, 0, 4], facing: -Math.PI / 2 }
const SIDE_B: TriggerTarget = { point: [1.5, 0, 4], facing: Math.PI / 2 }

beforeEach(() => {
  releaseClaims('npc-a')
  releaseClaims('npc-b')
  releaseClaims('npc-c')
})

describe('pair activity reservation (18H §17)', () => {
  it('reserves both sides atomically when both are free', () => {
    expect(tryReservePairActivity('npc-a', 'npc-b', SIDE_A, SIDE_B)).toBe(true)
    expect(isTargetFree(SIDE_A, 'npc-a')).toBe(true)
    expect(isTargetFree(SIDE_B, 'npc-b')).toBe(true)
    expect(isTargetFree(SIDE_A, 'npc-c')).toBe(false)
    expect(isTargetFree(SIDE_B, 'npc-c')).toBe(false)
  })

  it('refuses (and claims nothing) when one side is already taken', () => {
    claimTarget('npc-c', SIDE_B)
    expect(tryReservePairActivity('npc-a', 'npc-b', SIDE_A, SIDE_B)).toBe(false)
    // side A must NOT be left half-claimed by the failed attempt
    expect(isTargetFree(SIDE_A, 'npc-a')).toBe(true)
    expect(isTargetFree(SIDE_A, 'npc-b')).toBe(true)
  })

  it('refuses a participant pairing with itself', () => {
    expect(tryReservePairActivity('npc-a', 'npc-a', SIDE_A, SIDE_B)).toBe(false)
  })

  it('releasePairActivity frees both participants claims', () => {
    tryReservePairActivity('npc-a', 'npc-b', SIDE_A, SIDE_B)
    releasePairActivity('npc-a', 'npc-b')
    expect(isTargetFree(SIDE_A, 'npc-c')).toBe(true)
    expect(isTargetFree(SIDE_B, 'npc-c')).toBe(true)
  })
})
