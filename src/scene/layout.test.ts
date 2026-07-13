import { describe, it, expect } from 'vitest'
import { BUILDING, ROOMS, roomCenter, roomSize, type RoomName } from './layout'

describe('layout', () => {
  it('every room stays within the building envelope', () => {
    for (const name of Object.keys(ROOMS) as RoomName[]) {
      const b = ROOMS[name]
      expect(b.minX).toBeGreaterThanOrEqual(BUILDING.minX)
      expect(b.maxX).toBeLessThanOrEqual(BUILDING.maxX)
      expect(b.minZ).toBeGreaterThanOrEqual(BUILDING.minZ)
      expect(b.maxZ).toBeLessThanOrEqual(BUILDING.maxZ)
    }
  })

  it('no two rooms overlap', () => {
    const names = Object.keys(ROOMS) as RoomName[]
    const eps = 1e-6
    for (let i = 0; i < names.length; i++) {
      for (let j = i + 1; j < names.length; j++) {
        const a = ROOMS[names[i]]
        const b = ROOMS[names[j]]
        const overlaps =
          a.minX < b.maxX - eps && a.maxX > b.minX + eps && a.minZ < b.maxZ - eps && a.maxZ > b.minZ + eps
        expect(overlaps).toBe(false)
      }
    }
  })

  it('room areas sum to the full building footprint', () => {
    const names = Object.keys(ROOMS) as RoomName[]
    const totalArea = names.reduce((sum, name) => {
      const { width, depth } = roomSize(ROOMS[name])
      return sum + width * depth
    }, 0)
    const footprint = (BUILDING.maxX - BUILDING.minX) * (BUILDING.maxZ - BUILDING.minZ)
    expect(totalArea).toBeCloseTo(footprint, 6)
  })

  it('roomCenter returns the midpoint at floor level', () => {
    expect(roomCenter(ROOMS.openSpace)).toEqual([0, 0, 0])
  })
})
