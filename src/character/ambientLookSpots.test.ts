import { describe, it, expect } from 'vitest'
import { WHITEBOARD_GLANCE_TARGET, WINDOW_LOOK_TARGET } from './ambientLookSpots'
import { ROOMS } from '../scene/layout'
import { KICKOFF_SLOTS } from '../game/cinematics/meetingSlots'

describe('ambient look spots (18H §14)', () => {
  it('whiteboard-glance stands inside the open space, clear of the board wall', () => {
    const room = ROOMS.openSpace
    const [x, , z] = WHITEBOARD_GLANCE_TARGET.point
    expect(x).toBeGreaterThan(room.minX)
    expect(x).toBeLessThan(room.maxX)
    expect(z).toBeGreaterThan(room.minZ)
    expect(z).toBeLessThan(room.maxZ)
  })

  it('whiteboard-glance does not sit on top of any kickoff meeting slot', () => {
    const [gx, , gz] = WHITEBOARD_GLANCE_TARGET.point
    for (const slot of KICKOFF_SLOTS) {
      const distance = Math.hypot(gx - slot.position[0], gz - slot.position[2])
      expect(distance, slot.id).toBeGreaterThan(0.9)
    }
  })

  it('window-look stands inside the open space, near the real south glass wall', () => {
    const room = ROOMS.openSpace
    const [x, , z] = WINDOW_LOOK_TARGET.point
    expect(x).toBeGreaterThan(room.minX)
    expect(x).toBeLessThan(room.maxX)
    expect(z).toBeGreaterThan(room.minZ)
    expect(z).toBeLessThan(room.minZ + 1.5) // "near" the wall, not mid-room
  })

  it('window-look faces outward (south, -Z) toward the glass', () => {
    expect(WINDOW_LOOK_TARGET.facing).toBeCloseTo(Math.PI)
  })
})
