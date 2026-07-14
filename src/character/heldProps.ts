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

export function disposeHeldProp(prop: Group): void {
  prop.traverse((object) => {
    if (object instanceof Mesh) {
      object.geometry.dispose()
      if (object.material instanceof MeshStandardMaterial) object.material.dispose()
    }
  })
}
