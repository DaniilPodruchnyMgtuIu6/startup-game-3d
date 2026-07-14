import { describe, it, expect } from 'vitest'
import { registerObstacle, getObstacles, getObstaclesVersion } from './obstacles'

describe('obstacle registry', () => {
  it('registers a footprint and removes it again on unregister', () => {
    const before = getObstacles().length
    const unregister = registerObstacle({ minX: 0, maxX: 1, minZ: 0, maxZ: 1 })
    expect(getObstacles().length).toBe(before + 1)
    unregister()
    expect(getObstacles().length).toBe(before)
  })

  it('bumps the version on every registration change so grid caches invalidate', () => {
    const v0 = getObstaclesVersion()
    const unregister = registerObstacle({ minX: 0, maxX: 1, minZ: 0, maxZ: 1 })
    expect(getObstaclesVersion()).toBe(v0 + 1)
    unregister()
    expect(getObstaclesVersion()).toBe(v0 + 2)
  })
})
