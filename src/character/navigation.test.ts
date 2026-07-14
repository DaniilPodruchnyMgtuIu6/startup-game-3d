import { describe, it, expect } from 'vitest'
import { buildPath, type Point } from './navigation'
import { registerObstacle } from './obstacles'

// Samples every leg of a path (including the entry leg from `from`) and
// reports whether any sampled point falls inside the given box.
function pathCrossesBox(
  from: Point,
  path: Point[],
  box: { minX: number; maxX: number; minZ: number; maxZ: number },
): boolean {
  let prev = from
  for (const p of path) {
    const dist = Math.hypot(p[0] - prev[0], p[2] - prev[2])
    const steps = Math.max(1, Math.ceil(dist / 0.05))
    for (let s = 1; s <= steps; s++) {
      const t = s / steps
      const x = prev[0] + (p[0] - prev[0]) * t
      const z = prev[2] + (p[2] - prev[2]) * t
      if (x > box.minX && x < box.maxX && z > box.minZ && z < box.maxZ) return true
    }
    prev = p
  }
  return false
}

describe('buildPath', () => {
  it('returns a direct single-waypoint path when the way is clear', () => {
    expect(buildPath([3, 0, -6], [4, 0, -6])).toEqual([[4, 0, -6]])
  })

  it('routes into a side room through its doorway gap, not through the partition', () => {
    const target: Point = [-9, 0, 1]
    const path = buildPath([3, 0, -6], target)
    expect(path.at(-1)).toEqual(target)
    // the focus room partition runs along x=-6 with its gap centered at z=0;
    // the path must never cross the solid parts of that partition
    expect(pathCrossesBox([3, 0, -6], path, { minX: -6.1, maxX: -5.9, minZ: -2.667, maxZ: -0.45 })).toBe(false)
    expect(pathCrossesBox([3, 0, -6], path, { minX: -6.1, maxX: -5.9, minZ: 0.45, maxZ: 2.667 })).toBe(false)
    // and it must actually pass through the doorway region
    const throughDoor = pathCrossesBox([3, 0, -6], path, { minX: -6.3, maxX: -5.7, minZ: -0.45, maxZ: 0.45 })
    expect(throughDoor).toBe(true)
  })

  it('detours around registered furniture crossing the straight line', () => {
    const unregister = registerObstacle({ minX: -1, maxX: 1, minZ: -6.7, maxZ: -5.3 })
    try {
      const from: Point = [-3, 0, -6]
      const target: Point = [3, 0, -6]
      const path = buildPath(from, target)
      expect(path.at(-1)).toEqual(target)
      expect(pathCrossesBox(from, path, { minX: -1, maxX: 1, minZ: -6.7, maxZ: -5.3 })).toBe(false)
    } finally {
      unregister()
    }
  })

  it('still ends exactly at a target inside a furniture margin (walk-up interactions)', () => {
    const unregister = registerObstacle({ minX: 8, maxX: 10, minZ: -1.1, maxZ: -0.1 })
    try {
      const target: Point = [9.5, 0, 0.05]
      const path = buildPath([3, 0, -6], target)
      expect(path.at(-1)).toEqual(target)
    } finally {
      unregister()
    }
  })

  // Fixture mirroring the open-space sofa: seat boxed in by its own body and a
  // coffee table in front, with the only clean entry over the front edge.
  const SOFA = { minX: -1.4, maxX: -0.6, minZ: -0.8, maxZ: 0.8 }
  const TABLE = { minX: -0.15, maxX: 0.35, minZ: -0.45, maxZ: 0.45 }
  const BEHIND_SOFA = { minX: -1.9, maxX: -1.4, minZ: -0.8, maxZ: 0.8 }
  const SEAT: Point = [-1, 0, 0]
  const SEAT_FACING = Math.PI / 2 // sofa faces +x, toward the table

  it('enters a boxed-in sofa over its front edge, never through the backrest', () => {
    const cleanupSofa = registerObstacle(SOFA)
    const cleanupTable = registerObstacle(TABLE)
    try {
      const path = buildPath([3, 0, -6], SEAT, { entryFacing: SEAT_FACING })
      expect(path.at(-1)).toEqual(SEAT)
      expect(pathCrossesBox([3, 0, -6], path, BEHIND_SOFA)).toBe(false)
      expect(pathCrossesBox([3, 0, -6], path, TABLE)).toBe(false)
    } finally {
      cleanupSofa()
      cleanupTable()
    }
  })

  it('stands up forward off a seat instead of through the backrest', () => {
    const cleanupSofa = registerObstacle(SOFA)
    const cleanupTable = registerObstacle(TABLE)
    try {
      const path = buildPath(SEAT, [3, 0, -6], { exitFacing: SEAT_FACING })
      expect(path.at(-1)).toEqual([3, 0, -6])
      // the first waypoint is in front of the seat (stood up forward)
      expect(path[0][0]).toBeGreaterThan(SOFA.maxX)
      expect(pathCrossesBox(SEAT, path, BEHIND_SOFA)).toBe(false)
      expect(pathCrossesBox(SEAT, path, TABLE)).toBe(false)
    } finally {
      cleanupSofa()
      cleanupTable()
    }
  })

  // Fixture mirroring a workstation: desk with the chair in front of it, chair
  // facing the desk. The only correct way in and out of the chair is from
  // BEHIND the chair - never across the desk.
  const DESK = { minX: 2.3, maxX: 3.7, minZ: -5.85, maxZ: -5.15 }
  const CHAIR = { minX: 2.7, maxX: 3.3, minZ: -6.35, maxZ: -5.75 }
  const CHAIR_SEAT: Point = [3, 0, -6.05]
  const CHAIR_FACING = 0 // chair faces +z, toward the desk

  it('sits down on a desk chair from behind it, never across the desk', () => {
    const cleanupDesk = registerObstacle(DESK)
    const cleanupChair = registerObstacle(CHAIR)
    try {
      // approach STARTS on the desk side, so the lazy straight line would cross the desk
      const path = buildPath([3, 0, -3], CHAIR_SEAT, { entryFacing: CHAIR_FACING })
      expect(path.at(-1)).toEqual(CHAIR_SEAT)
      expect(pathCrossesBox([3, 0, -3], path, DESK)).toBe(false)
    } finally {
      cleanupDesk()
      cleanupChair()
    }
  })

  it('stands up from a desk chair without crossing the desk', () => {
    const cleanupDesk = registerObstacle(DESK)
    const cleanupChair = registerObstacle(CHAIR)
    try {
      const path = buildPath(CHAIR_SEAT, [3, 0, -3], { exitFacing: CHAIR_FACING })
      expect(path.at(-1)).toEqual([3, 0, -3])
      expect(pathCrossesBox(CHAIR_SEAT, path, DESK)).toBe(false)
    } finally {
      cleanupDesk()
      cleanupChair()
    }
  })
})
