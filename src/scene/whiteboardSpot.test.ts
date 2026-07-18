import { describe, it, expect } from 'vitest'
import {
  WHITEBOARD_POSITION,
  WHITEBOARD_ROTATION_Y,
  WHITEBOARD_APPROACH_POINT,
  WHITEBOARD_WIDTH,
  WHITEBOARD_WALL_X,
  SERVER_DOOR_Z,
  SERVER_DOOR_WIDTH,
} from './whiteboardSpot'
import { ROOMS } from './layout'
import { isBlockedAt, isInsideWall } from '../character/grid'
import { isWithinMeetDistance, MEET_DISTANCE } from '../game/meetingGeometry'

// The relocated whiteboard (Feature 15): geometric invariants that don't depend
// on pixels — the board hangs flush on the real server-room partition, clear of
// its doorway, and its approach point is reachable and within interaction range.

describe('whiteboard spot', () => {
  it('hangs just off the server-room partition wall, not inside it', () => {
    expect(WHITEBOARD_WALL_X).toBe(ROOMS.serverRoom.maxX)
    // the wall band exists behind the board...
    expect(isInsideWall(WHITEBOARD_WALL_X, WHITEBOARD_POSITION[2])).toBe(true)
    // ...but the board itself sits in the open space, not intersecting the wall
    expect(isInsideWall(WHITEBOARD_POSITION[0], WHITEBOARD_POSITION[2])).toBe(false)
    expect(WHITEBOARD_POSITION[0]).toBeGreaterThan(WHITEBOARD_WALL_X)
  })

  it('faces the open space (+x), toward the camera and the main route', () => {
    expect(WHITEBOARD_ROTATION_Y).toBe(Math.PI / 2)
  })

  it('its span stays clear of the server-room doorway and the room divider', () => {
    const north = WHITEBOARD_POSITION[2] + WHITEBOARD_WIDTH / 2
    const south = WHITEBOARD_POSITION[2] - WHITEBOARD_WIDTH / 2
    expect(north).toBeLessThan(SERVER_DOOR_Z - SERVER_DOOR_WIDTH / 2) // door stays free
    expect(south).toBeGreaterThan(ROOMS.serverRoom.minZ + 0.1) // clear of the divider wall
  })

  it('the approach point is walkable and within interaction distance', () => {
    // only static walls are baked in a fresh test env — the strip must be free
    expect(isBlockedAt(WHITEBOARD_APPROACH_POINT[0], WHITEBOARD_APPROACH_POINT[2])).toBe(false)
    expect(isWithinMeetDistance(WHITEBOARD_APPROACH_POINT, WHITEBOARD_POSITION)).toBe(true)
    // standing at the approach point the player still has clearance from the wall
    expect(WHITEBOARD_APPROACH_POINT[0] - WHITEBOARD_WALL_X).toBeGreaterThan(0.5)
    expect(WHITEBOARD_APPROACH_POINT[0] - WHITEBOARD_WALL_X).toBeLessThan(MEET_DISTANCE)
  })
})
