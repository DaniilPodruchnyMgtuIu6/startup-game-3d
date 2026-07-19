import { describe, it, expect, beforeEach, vi } from 'vitest'
import { createDirector } from './director'
import { useCharacterStore } from '../character/characterStore'

// Feature 16 §8: cutscene actors move faster than normal, and a stuck actor
// never hangs the scene — after the walk timeout it snaps to its destination.

beforeEach(() => {
  useCharacterStore.setState({ characters: {} })
})

describe('director', () => {
  it('setSpeed applies a per-actor walk multiplier', () => {
    const d = createDirector()
    useCharacterStore.getState().spawnCharacter('guard1', [0, 0, 0], 0)
    d.setSpeed('guard1', 2.4)
    expect(useCharacterStore.getState().characters['guard1'].speedMultiplier).toBe(2.4)
  })

  it('walk resolves and lands a stuck actor on its mark after the timeout (no frame loop)', async () => {
    vi.useFakeTimers()
    try {
      const d = createDirector()
      useCharacterStore.getState().spawnCharacter('guard1', [0, 0, 0], 0)
      // no useFrame runs in a unit test, so the actor stays 'walking' forever
      const walk = d.walk('guard1', [4, 0, 4], 100)
      expect(useCharacterStore.getState().characters['guard1'].state.kind).toBe('walking')
      await vi.advanceTimersByTimeAsync(150)
      await walk // must not hang
      const g = useCharacterStore.getState().characters['guard1']
      // snapped toward the destination rather than left at the origin
      expect(Math.hypot(g.position[0] - 4, g.position[2] - 4)).toBeLessThan(1.5)
    } finally {
      vi.useRealTimers()
    }
  })
})
