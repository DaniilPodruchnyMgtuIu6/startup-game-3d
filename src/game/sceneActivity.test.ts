import { describe, it, expect } from 'vitest'
import { isSceneIdle } from './sceneActivity'

// The R3F render loop pauses (frameloop 'demand') only on the full-screen non-
// gameplay screens; every gameplay state keeps rendering continuously.
describe('isSceneIdle', () => {
  it('is idle on the full-screen intro / fired / terminal screens', () => {
    expect(isSceneIdle('intro', 'playing')).toBe(true)
    expect(isSceneIdle('fired', 'playing')).toBe(true)
    expect(isSceneIdle('free', 'failed')).toBe(true)
    expect(isSceneIdle('free', 'succeeded')).toBe(true)
  })

  it('keeps rendering during gameplay (free play and pending, non-terminal states)', () => {
    expect(isSceneIdle('free', 'playing')).toBe(false)
    expect(isSceneIdle('meetPm', 'playing')).toBe(false)
    // pending states still show the office (the coordinator scene is running)
    expect(isSceneIdle('free', 'failure-pending')).toBe(false)
    expect(isSceneIdle('free', 'success-pending')).toBe(false)
  })
})
