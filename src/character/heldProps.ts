import { Group, Mesh, CylinderGeometry, TorusGeometry, MeshStandardMaterial } from 'three'

// Props characters hold in their hands during activities. Built imperatively
// (not JSX) because they get parented to skeleton hand bones at runtime.

export function buildHeldMug(): Group {
  const group = new Group()
  const ceramic = new MeshStandardMaterial({ color: '#e8e2d5', roughness: 0.4, metalness: 0 })

  const body = new Mesh(new CylinderGeometry(0.04, 0.04, 0.09, 16), ceramic)
  const handle = new Mesh(new TorusGeometry(0.025, 0.007, 8, 16), ceramic)
  handle.position.x = 0.045
  handle.rotation.x = Math.PI / 2

  group.add(body, handle)
  return group
}

// 18H Wave 3: the ping-pong paddle - no Higgsfield generation, same reasoning
// as the mug (a simple held prop doesn't need a generated asset). Blade faces
// the player's forward swing plane; local +x is "toward the ball".
export function buildHeldPaddle(): Group {
  const group = new Group()
  const rubber = new MeshStandardMaterial({ color: '#c23b3b', roughness: 0.6, metalness: 0 })
  const wood = new MeshStandardMaterial({ color: '#caa06a', roughness: 0.7, metalness: 0 })

  const blade = new Mesh(new CylinderGeometry(0.075, 0.075, 0.01, 20), rubber)
  blade.rotation.z = Math.PI / 2
  blade.position.x = 0.11

  const handle = new Mesh(new CylinderGeometry(0.015, 0.018, 0.09, 12), wood)
  handle.rotation.z = Math.PI / 2

  group.add(blade, handle)
  return group
}

export function disposeHeldProp(prop: Group): void {
  prop.traverse((object) => {
    if (object instanceof Mesh) {
      object.geometry.dispose()
      if (object.material instanceof MeshStandardMaterial) object.material.dispose()
    }
  })
}
