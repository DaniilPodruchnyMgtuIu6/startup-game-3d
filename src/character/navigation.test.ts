import { describe, it, expect } from 'vitest'
import { roomAt, buildPath, DOORWAYS } from './navigation'
import { ROOMS } from '../scene/layout'

describe('navigation', () => {
  it('identifies which room a point falls in', () => {
    expect(roomAt([0, 0, 0])).toBe('openSpace')
    expect(roomAt([-9, 0, -5.333])).toBe('meetingRoom')
    expect(roomAt([9, 0, 5.333])).toBe('gameRoom')
  })

  it('every side room has a doorway on its shared boundary with open space', () => {
    expect(DOORWAYS.meetingRoom).toEqual([ROOMS.meetingRoom.maxX, 0, (ROOMS.meetingRoom.minZ + ROOMS.meetingRoom.maxZ) / 2])
    expect(DOORWAYS.kitchen).toEqual([ROOMS.kitchen.minX, 0, (ROOMS.kitchen.minZ + ROOMS.kitchen.maxZ) / 2])
  })

  it('paths within the same room are a direct line', () => {
    const path = buildPath([-9, 0, -6], [-9, 0, -4])
    expect(path).toEqual([[-9, 0, -4]])
  })

  it('paths from open space to a side room go via that room doorway', () => {
    const target: [number, number, number] = [-9, 0, -5.333]
    const path = buildPath([0, 0, 0], target)
    expect(path).toEqual([DOORWAYS.meetingRoom, target])
  })

  it('paths between two side rooms go via both doorways', () => {
    const target: [number, number, number] = [9, 0, 5.333]
    const path = buildPath([-9, 0, -5.333], target)
    expect(path).toEqual([DOORWAYS.meetingRoom, DOORWAYS.gameRoom, target])
  })
})
