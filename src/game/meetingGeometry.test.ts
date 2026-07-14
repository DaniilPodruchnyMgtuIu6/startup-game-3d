import { describe, it, expect } from 'vitest'
import { approachPoint, isWithinMeetDistance, facingBetween } from './meetingGeometry'

describe('meetingGeometry', () => {
  it('approachPoint lies one meter in front of the PM along her facing', () => {
    // facing PI means forward is -z
    const point = approachPoint([-2, 0, 6.3], Math.PI)
    expect(point[0]).toBeCloseTo(-2)
    expect(point[2]).toBeCloseTo(5.3)
  })

  it('isWithinMeetDistance uses the 1.4m threshold on the ground plane', () => {
    expect(isWithinMeetDistance([0, 0, 0], [1, 0, 0.9])).toBe(true)
    expect(isWithinMeetDistance([0, 0, 0], [1.4, 0, 0.9])).toBe(false)
  })

  it('facingBetween points from one character to the other', () => {
    expect(facingBetween([0, 0, 0], [0, 0, 5])).toBeCloseTo(0) // +z
    expect(Math.abs(facingBetween([0, 0, 5], [0, 0, 0]))).toBeCloseTo(Math.PI) // -z
  })
})
