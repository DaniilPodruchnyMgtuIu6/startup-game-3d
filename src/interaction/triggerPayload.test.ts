import { describe, it, expect } from 'vitest'
import { Object3D, Group } from 'three'
import { computeTriggerPayload } from './triggerPayload'

describe('computeTriggerPayload', () => {
  it('resolves world position and facing through a parent transform', () => {
    const parent = new Group()
    parent.position.set(2, 0, 3)
    parent.rotation.y = Math.PI / 2
    const child = new Object3D()
    child.position.set(1, 0, 0)
    parent.add(child)
    parent.updateMatrixWorld(true)

    const payload = computeTriggerPayload(child)
    expect(payload.point[0]).toBeCloseTo(2)
    expect(payload.point[1]).toBeCloseTo(0)
    expect(payload.point[2]).toBeCloseTo(2)
    expect(payload.facing).toBeCloseTo(Math.PI / 2)
  })
})
