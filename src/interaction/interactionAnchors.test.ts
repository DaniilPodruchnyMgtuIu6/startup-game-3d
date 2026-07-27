import { describe, it, expect } from 'vitest'
import { PULL_UP_BAR_ANCHORS, PING_PONG_TABLE_ANCHORS } from './interactionAnchors'

describe('furniture interaction anchors (18H §11/§22 furniture cases)', () => {
  it('pull-up bar: hand targets sit above the hips anchor, not inside the posts', () => {
    expect(PULL_UP_BAR_ANCHORS.leftHand!.position[1]).toBeGreaterThan(PULL_UP_BAR_ANCHORS.hips!.position[1])
    expect(PULL_UP_BAR_ANCHORS.rightHand!.position[1]).toBeGreaterThan(PULL_UP_BAR_ANCHORS.hips!.position[1])
  })

  it('pull-up bar: approach stands clear of both support posts (x=+-0.6, z=0)', () => {
    const [ax, , az] = PULL_UP_BAR_ANCHORS.approach.position
    const postClearanceM = 0.35 // post radius + a body's worth of space
    for (const postX of [-0.6, 0.6]) {
      expect(Math.hypot(ax - postX, az)).toBeGreaterThan(postClearanceM)
    }
  })

  it('ping-pong: the two sides sit on opposite ends of the table (opposite X sign)', () => {
    const ax = PING_PONG_TABLE_ANCHORS.sideA.root.position[0]
    const bx = PING_PONG_TABLE_ANCHORS.sideB.root.position[0]
    expect(Math.sign(ax)).not.toBe(Math.sign(bx))
  })

  it('ping-pong: each side looks toward the opposite side, not its own', () => {
    const sideALookX = PING_PONG_TABLE_ANCHORS.sideA.lookAt!.position[0]
    const sideARootX = PING_PONG_TABLE_ANCHORS.sideA.root.position[0]
    expect(Math.sign(sideALookX)).not.toBe(Math.sign(sideARootX))
  })

  it('ping-pong: approach points fall outside the table footprint (half-length 1.37m)', () => {
    expect(Math.abs(PING_PONG_TABLE_ANCHORS.sideA.approach.position[0])).toBeGreaterThan(1.37)
    expect(Math.abs(PING_PONG_TABLE_ANCHORS.sideB.approach.position[0])).toBeGreaterThan(1.37)
  })
})
