import { Group, Mesh, CylinderGeometry, TorusGeometry, BoxGeometry, MeshStandardMaterial } from 'three'

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
// as the mug (a simple held prop doesn't need a generated asset). Handle runs
// along local +x (the finger axis of the hand bone it attaches to); the BLADE
// disc lies in the handle's plane with its face normal on ±z - the original
// build rotated the disc's axis onto +x, which capped the handle end-on like
// a plunger instead of continuing it as a blade (the "криво держат ракетку"
// defect: no orientation reads as a proper grip when the blade itself is
// perpendicular to the handle).
export function buildHeldPaddle(): Group {
  const group = new Group()
  const rubber = new MeshStandardMaterial({ color: '#c23b3b', roughness: 0.6, metalness: 0 })
  const wood = new MeshStandardMaterial({ color: '#caa06a', roughness: 0.7, metalness: 0 })

  const blade = new Mesh(new CylinderGeometry(0.075, 0.075, 0.01, 20), rubber)
  blade.rotation.x = Math.PI / 2 // disc face normal on ±z: blade plane CONTAINS the handle axis
  blade.position.x = 0.11

  const handle = new Mesh(new CylinderGeometry(0.015, 0.018, 0.09, 12), wood)
  handle.rotation.z = Math.PI / 2

  group.add(blade, handle)
  return group
}

// 18H Wave 3: the phone-check prop - a slim dark rectangle with a lit screen
// face, held roughly flat in the palm and tilted toward the character's own
// (procedurally dipped) head, same "no Higgsfield needed" reasoning as the
// mug and paddle.
export function buildHeldPhone(): Group {
  const group = new Group()
  const body = new MeshStandardMaterial({ color: '#1b1c1f', roughness: 0.35, metalness: 0.1 })
  const screen = new MeshStandardMaterial({ color: '#bfe3ff', roughness: 0.2, metalness: 0, emissive: '#3f8fd1', emissiveIntensity: 0.6 })

  const shell = new Mesh(new BoxGeometry(0.035, 0.072, 0.006), body)
  const face = new Mesh(new BoxGeometry(0.028, 0.062, 0.001), screen)
  face.position.z = 0.0035

  group.add(shell, face)
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
