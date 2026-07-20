import { describe, it, expect } from 'vitest'
import { conversationApproachPoint, separatedMoverPosition, horizontalDistance, TALK_DISTANCE, MIN_SEPARATION } from './conversationStaging'
import type { Point } from '../character/navigation'

const host: Point = [0, 0, 0]

describe('conversationApproachPoint', () => {
  it('stops TALK_DISTANCE short of the host, on the mover’s own side', () => {
    const mover: Point = [5, 0, 0] // approaching from +x
    const ap = conversationApproachPoint(mover, host, 0)
    expect(horizontalDistance(ap, host)).toBeCloseTo(TALK_DISTANCE, 5)
    expect(ap[0]).toBeCloseTo(TALK_DISTANCE, 5) // same side as the mover (+x)
    expect(ap[2]).toBeCloseTo(0, 5)
  })

  it('falls back to the host’s facing direction when the two overlap', () => {
    const onTop: Point = [0.05, 0, 0.05] // basically the same spot
    const ap = conversationApproachPoint(onTop, host, 0) // host faces +z
    expect(horizontalDistance(ap, host)).toBeCloseTo(TALK_DISTANCE, 5)
    expect(ap[2]).toBeCloseTo(TALK_DISTANCE, 5) // pushed out along +z, not left near the host
  })
})

describe('separatedMoverPosition', () => {
  it('leaves a well-spaced mover where it is (no teleport)', () => {
    const mover: Point = [TALK_DISTANCE, 0, 0]
    expect(separatedMoverPosition(mover, host, 0)).toEqual(mover)
  })

  it('pushes an overlapping mover out to a clean speaking distance', () => {
    const tooClose: Point = [0.3, 0, 0] // < MIN_SEPARATION
    const fixed = separatedMoverPosition(tooClose, host, 0)
    expect(horizontalDistance(fixed, host)).toBeGreaterThanOrEqual(MIN_SEPARATION)
    expect(horizontalDistance(fixed, host)).toBeCloseTo(TALK_DISTANCE, 5)
  })
})
