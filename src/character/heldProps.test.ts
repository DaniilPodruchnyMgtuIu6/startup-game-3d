import { describe, it, expect } from 'vitest'
import { Mesh } from 'three'
import { buildHeldMug, disposeHeldProp } from './heldProps'

describe('buildHeldMug', () => {
  it('builds a mug of body + handle meshes ready to parent to a hand bone', () => {
    const mug = buildHeldMug()
    const meshes = mug.children.filter((c) => c instanceof Mesh)
    expect(meshes.length).toBe(2)
  })

  it('disposes cleanly', () => {
    const mug = buildHeldMug()
    expect(() => disposeHeldProp(mug)).not.toThrow()
  })
})
