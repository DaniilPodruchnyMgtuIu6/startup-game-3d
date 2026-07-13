import { describe, it, expect } from 'vitest'
import { stepTowards } from './movement'

describe('stepTowards', () => {
  it('moves partway toward the target at the given speed', () => {
    const result = stepTowards([0, 0, 0], [0, 0, 10], 2, 1, 0)
    expect(result.position[0]).toBeCloseTo(0)
    expect(result.position[2]).toBeCloseTo(2)
    expect(result.reachedTarget).toBe(false)
  })

  it('snaps to the target and reports arrival once within the epsilon', () => {
    const result = stepTowards([0, 0, 9.98], [0, 0, 10], 2, 1, 0)
    expect(result.position).toEqual([0, 0, 10])
    expect(result.reachedTarget).toBe(true)
  })

  it('never overshoots even with a large delta', () => {
    const result = stepTowards([0, 0, 0], [0, 0, 1], 100, 1, 0)
    expect(result.position).toEqual([0, 0, 1])
    expect(result.reachedTarget).toBe(true)
  })

  it('faces the direction of travel', () => {
    const result = stepTowards([0, 0, 0], [10, 0, 0], 2, 1, 0)
    expect(result.rotationY).toBeCloseTo(Math.PI / 2, 1)
  })
})
