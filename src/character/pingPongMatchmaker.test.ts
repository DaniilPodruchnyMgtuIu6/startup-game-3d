import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { renderHook } from '@testing-library/react'
import { usePingPongMatchmaker, shuffledPairFrom } from './pingPongMatchmaker'
import { useCharacterStore, PLAYER_ID } from './characterStore'
import { usePingPongRallyStore } from './pingPongRallyStore'
import { useGameStore } from '../game/gameStore'
import { registerInteraction, isTargetFree, releaseClaims } from '../interaction/interactionRegistry'
import type { TriggerTarget } from '../interaction/triggerPayload'

const SIDE_A: TriggerTarget = { point: [-1.8, 0, 5], facing: -Math.PI / 2 }
const SIDE_B: TriggerTarget = { point: [1.8, 0, 5], facing: Math.PI / 2 }

// rng stub yielding a fixed sequence (repeats the last value when exhausted) -
// same convention as npcBehavior.test.ts's seq().
function seq(...values: number[]): () => number {
  let i = 0
  return () => values[Math.min(i++, values.length - 1)]
}

describe('shuffledPairFrom', () => {
  it('returns null with fewer than 2 candidates', () => {
    expect(shuffledPairFrom([], seq(0.5))).toBeNull()
    expect(shuffledPairFrom(['a'], seq(0.5))).toBeNull()
  })

  it('returns two distinct ids from the pool', () => {
    const pair = shuffledPairFrom(['a', 'b', 'c'], seq(0.1, 0.9))
    expect(pair).not.toBeNull()
    expect(pair![0]).not.toBe(pair![1])
    expect(['a', 'b', 'c']).toContain(pair![0])
    expect(['a', 'b', 'c']).toContain(pair![1])
  })
})

describe('usePingPongMatchmaker (18H §17)', () => {
  let unregisterA: () => void
  let unregisterB: () => void

  beforeEach(() => {
    useCharacterStore.setState({ characters: {}, sceneOwned: new Set() })
    useGameStore.setState({ phase: 'free' })
    unregisterA = registerInteraction('ping-pong', SIDE_A)
    unregisterB = registerInteraction('ping-pong', SIDE_B)
    releaseClaims('npc-a')
    releaseClaims('npc-b')
  })

  afterEach(() => {
    unregisterA()
    unregisterB()
  })

  it('reserves two idle NPCs, walks them to both sides, then releases them back to idle', async () => {
    vi.useFakeTimers()
    try {
      useCharacterStore.getState().spawnCharacter('npc-a', SIDE_A.point, 0)
      useCharacterStore.getState().spawnCharacter('npc-b', SIDE_B.point, 0)
      // roll #1 (match chance, <=0.3): triggers; shuffle uses the 2nd value
      renderHook(() => usePingPongMatchmaker(seq(0.1, 0.5)))

      await vi.advanceTimersByTimeAsync(5000) // CHECK_INTERVAL_MS
      expect(useCharacterStore.getState().characters['npc-a'].state.kind).toBe('walking')
      expect(useCharacterStore.getState().characters['npc-b'].state.kind).toBe('walking')
      expect(isTargetFree(SIDE_A, 'npc-c')).toBe(false)
      expect(isTargetFree(SIDE_B, 'npc-c')).toBe(false)

      // No per-frame ticker runs in a unit test - a real game loop supplies
      // WAYPOINT_REACHED once a walking character reaches its next point
      // (useCharacterTransform); drive that transition here explicitly.
      useCharacterStore.getState().dispatchTo('npc-a', { type: 'WAYPOINT_REACHED' })
      useCharacterStore.getState().dispatchTo('npc-b', { type: 'WAYPOINT_REACHED' })
      const chars = useCharacterStore.getState().characters
      expect(chars['npc-a'].state.kind).toBe('performing')
      expect(chars['npc-b'].state.kind).toBe('performing')

      // socialActivityDurationSeconds tops out at 35s - advance well past it
      await vi.advanceTimersByTimeAsync(40000)
      const after = useCharacterStore.getState().characters
      expect(after['npc-a'].state.kind).toBe('idle')
      expect(after['npc-b'].state.kind).toBe('idle')
      expect(isTargetFree(SIDE_A, 'npc-c')).toBe(true)
      expect(isTargetFree(SIDE_B, 'npc-c')).toBe(true)
    } finally {
      vi.useRealTimers()
    }
  })

  it('never matches when fewer than two NPCs are idle', async () => {
    vi.useFakeTimers()
    try {
      useCharacterStore.getState().spawnCharacter('npc-a', SIDE_A.point, 0)
      renderHook(() => usePingPongMatchmaker(seq(0.1, 0.5)))
      await vi.advanceTimersByTimeAsync(5000)
      expect(useCharacterStore.getState().characters['npc-a'].state.kind).toBe('idle')
      expect(isTargetFree(SIDE_A, 'npc-c')).toBe(true)
    } finally {
      vi.useRealTimers()
    }
  })

  it('recruits a free NPC to the far side when the PLAYER walks up to play, and ends the rally when the player leaves', async () => {
    vi.useFakeTimers()
    try {
      releaseClaims(PLAYER_ID)
      useCharacterStore.getState().spawnCharacter(PLAYER_ID, SIDE_A.point, 0)
      useCharacterStore.getState().spawnCharacter('npc-a', SIDE_B.point, 0)
      // NPC-NPC chance roll never fires (0.99 > MATCH_CHANCE) - only the
      // player watch can start this match.
      renderHook(() => usePingPongMatchmaker(seq(0.99)))

      useCharacterStore.getState().clickPingPong(SIDE_A)
      // the player watch reacts synchronously to the walk dispatch: the far
      // side is claimed and the NPC is already on its way
      expect(useCharacterStore.getState().characters['npc-a'].state.kind).toBe('walking')
      expect(isTargetFree(SIDE_B, 'npc-x')).toBe(false)

      useCharacterStore.getState().dispatchTo(PLAYER_ID, { type: 'WAYPOINT_REACHED' })
      useCharacterStore.getState().dispatchTo('npc-a', { type: 'WAYPOINT_REACHED' })
      expect(useCharacterStore.getState().characters[PLAYER_ID].state.kind).toBe('performing')
      expect(useCharacterStore.getState().characters['npc-a'].state.kind).toBe('performing')
      // both arrived -> the rally (and its ball) is live
      expect(usePingPongRallyStore.getState().participants).toEqual([PLAYER_ID, 'npc-a'])

      // the player walks away mid-rally: the rally ends NOW - the NPC is
      // released back to the planner and both side claims are freed
      useCharacterStore.getState().clickFloor([5, 0, 5])
      expect(usePingPongRallyStore.getState().participants).toBeNull()
      expect(useCharacterStore.getState().characters['npc-a'].state.kind).toBe('idle')
      expect(isTargetFree(SIDE_A, 'npc-x')).toBe(true)
      expect(isTargetFree(SIDE_B, 'npc-x')).toBe(true)
    } finally {
      vi.useRealTimers()
    }
  })

  it('redirects a still-walking straggler when the arrival timeout fires, instead of leaving it to self-transition into an orphaned performing state (§17 regression)', async () => {
    vi.useFakeTimers()
    try {
      useCharacterStore.getState().spawnCharacter('npc-a', SIDE_A.point, 0)
      useCharacterStore.getState().spawnCharacter('npc-b', SIDE_B.point, 0)
      renderHook(() => usePingPongMatchmaker(seq(0.1, 0.5)))
      await vi.advanceTimersByTimeAsync(5000) // CHECK_INTERVAL_MS - both start walking

      // npc-a arrives quickly; npc-b is a slow walker that never gets its
      // WAYPOINT_REACHED before the arrival timeout gives up on the rally.
      useCharacterStore.getState().dispatchTo('npc-a', { type: 'WAYPOINT_REACHED' })
      expect(useCharacterStore.getState().characters['npc-a'].state.kind).toBe('performing')
      expect(useCharacterStore.getState().characters['npc-b'].state.kind).toBe('walking')

      await vi.advanceTimersByTimeAsync(22000) // ARRIVAL_TIMEOUT_MS - finish() gives up
      expect(useCharacterStore.getState().characters['npc-a'].state.kind).toBe('idle') // PERFORM_END
      expect(usePingPongRallyStore.getState().participants).toBeNull()
      expect(isTargetFree(SIDE_A, 'npc-x')).toBe(true)
      expect(isTargetFree(SIDE_B, 'npc-x')).toBe(true)

      // npc-b's stale "walk then perform pingPongRally" goal must have been
      // replaced (CLICK_FLOOR) - when it finally "arrives" it lands on
      // idle, NOT performing. Before the fix this dispatch would have put
      // it into 'performing' forever, with no ball and nobody left to end it.
      useCharacterStore.getState().dispatchTo('npc-b', { type: 'WAYPOINT_REACHED' })
      expect(useCharacterStore.getState().characters['npc-b'].state.kind).toBe('idle')
    } finally {
      vi.useRealTimers()
    }
  })

  it('skips the check outside free play (does not touch idle NPCs mid-cutscene)', async () => {
    vi.useFakeTimers()
    try {
      useGameStore.setState({ phase: 'intro' })
      useCharacterStore.getState().spawnCharacter('npc-a', SIDE_A.point, 0)
      useCharacterStore.getState().spawnCharacter('npc-b', SIDE_B.point, 0)
      renderHook(() => usePingPongMatchmaker(seq(0.1, 0.5)))
      await vi.advanceTimersByTimeAsync(5000)
      expect(useCharacterStore.getState().characters['npc-a'].state.kind).toBe('idle')
      expect(useCharacterStore.getState().characters['npc-b'].state.kind).toBe('idle')
    } finally {
      vi.useRealTimers()
    }
  })
})
