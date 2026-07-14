import { BackSide, Box3, Mesh, MeshBasicMaterial, Vector3, type Object3D, type Material } from 'three'

// Hover highlight for clickable furniture: every visible mesh of the object
// gets a slightly inflated back-facing white shell, which reads as a clean
// outline around the silhouette - no postprocessing involved.

const OUTLINE_MATERIAL = new MeshBasicMaterial({
  color: '#ffffff',
  side: BackSide,
  transparent: true,
  opacity: 0.85,
  toneMapped: false,
})

const OUTLINE_THICKNESS = 0.025 // ~constant rim in world units
const MAX_FACTOR = 1.4 // keep very thin parts (screens, plates) from ballooning

const tempSize = new Vector3()

function isInvisible(material: Material | Material[]): boolean {
  const first = Array.isArray(material) ? material[0] : material
  return first.transparent && first.opacity < 0.05
}

export function attachHoverOutline(root: Object3D): () => void {
  const added: Mesh[] = []
  root.traverse((object) => {
    if (!(object instanceof Mesh)) return
    if (object.userData.isHoverOutline) return
    if (isInvisible(object.material as Material)) return // interaction hitboxes etc.

    if (!object.geometry.boundingBox) object.geometry.computeBoundingBox()
    const box = object.geometry.boundingBox as Box3
    box.getSize(tempSize)

    const shell = new Mesh(object.geometry, OUTLINE_MATERIAL)
    shell.userData.isHoverOutline = true
    shell.scale.set(
      Math.min(MAX_FACTOR, (tempSize.x + OUTLINE_THICKNESS) / (tempSize.x || 1)),
      Math.min(MAX_FACTOR, (tempSize.y + OUTLINE_THICKNESS) / (tempSize.y || 1)),
      Math.min(MAX_FACTOR, (tempSize.z + OUTLINE_THICKNESS) / (tempSize.z || 1)),
    )
    object.add(shell)
    added.push(shell)
  })
  return () => {
    for (const shell of added) shell.parent?.remove(shell)
  }
}
