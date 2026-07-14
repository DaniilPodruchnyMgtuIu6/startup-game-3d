import { describe, it, expect } from 'vitest'
import { Group, Mesh, BoxGeometry, MeshStandardMaterial, MeshBasicMaterial } from 'three'
import { attachHoverOutline } from './hoverOutline'

describe('attachHoverOutline', () => {
  it('adds a shell to every visible mesh and removes them on cleanup', () => {
    const group = new Group()
    const desk = new Mesh(new BoxGeometry(1.4, 0.04, 0.7), new MeshStandardMaterial())
    const leg = new Mesh(new BoxGeometry(0.05, 0.7, 0.05), new MeshStandardMaterial())
    // invisible interaction hitbox must NOT get an outline
    const hitbox = new Mesh(new BoxGeometry(0.6, 0.6, 0.6), new MeshBasicMaterial({ transparent: true, opacity: 0 }))
    group.add(desk, leg, hitbox)

    const cleanup = attachHoverOutline(group)
    expect(desk.children.filter((c) => c.userData.isHoverOutline).length).toBe(1)
    expect(leg.children.filter((c) => c.userData.isHoverOutline).length).toBe(1)
    expect(hitbox.children.length).toBe(0)

    cleanup()
    expect(desk.children.length).toBe(0)
    expect(leg.children.length).toBe(0)
  })
})
