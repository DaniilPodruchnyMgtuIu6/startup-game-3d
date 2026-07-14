import { describe, it, expect } from 'vitest'
import { nearestWalkable, isBlockedAt } from './grid'
import { registerObstacle } from './obstacles'

describe('walkability grid', () => {
  it('keeps clearance around the perimeter walls', () => {
    // right at the west curtain wall - blocked, even though it is "inside"
    expect(isBlockedAt(-11.95, 0)).toBe(true)
    // open space floor is walkable
    expect(isBlockedAt(3, -6)).toBe(false)
  })

  it('keeps the doorway gaps walkable', () => {
    // focus room doorway is centered at (-6, 0)
    expect(isBlockedAt(-6, 0)).toBe(false)
    // but the partition on either side of the gap is blocked
    expect(isBlockedAt(-6, 1.5)).toBe(true)
  })

  it('leaves walkable points untouched and clamps blocked ones to free space', () => {
    expect(nearestWalkable([3, 0, -6])).toEqual([3, 0, -6])

    const wallClamped = nearestWalkable([-11.95, 0, 0])
    expect(isBlockedAt(wallClamped[0], wallClamped[2])).toBe(false)
    expect(wallClamped[0]).toBeGreaterThan(-11.95)
  })

  it('clamps a click on furniture to a walkable spot beside it', () => {
    const unregister = registerObstacle({ minX: 2, maxX: 4, minZ: -7, maxZ: -5 })
    try {
      const clamped = nearestWalkable([3, 0, -6])
      expect(isBlockedAt(clamped[0], clamped[2])).toBe(false)
      const insideBox = clamped[0] > 2 && clamped[0] < 4 && clamped[2] > -7 && clamped[2] < -5
      expect(insideBox).toBe(false)
    } finally {
      unregister()
    }
  })
})
