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

  it('resolves facing for a trigger rotated a full 180 degrees', () => {
    // Euler-angle extraction is degenerate for a pure 180-degree Y rotation
    // (it decomposes as x=PI, y=0, z=PI), which silently produced facing=0
    // and made the character sit backwards on turned-around chairs.
    const parent = new Group()
    parent.rotation.y = Math.PI
    const child = new Object3D()
    parent.add(child)
    parent.updateMatrixWorld(true)

    const payload = computeTriggerPayload(child)
    expect(Math.abs(payload.facing)).toBeCloseTo(Math.PI)
  })

  it('floor-projects the point even when the clicked hitbox sits above the floor', () => {
    // Interaction hitboxes are often raised off the floor for easier clicking
    // (e.g. a desk trigger at y=0.3). The character always stands on the floor,
    // so the resolved target must ignore the hitbox's own elevation.
    const object = new Object3D()
    object.position.set(-4.1, 0.3, -5.45)
    object.updateMatrixWorld(true)

    const payload = computeTriggerPayload(object)
    expect(payload.point[1]).toBe(0)
  })
})
