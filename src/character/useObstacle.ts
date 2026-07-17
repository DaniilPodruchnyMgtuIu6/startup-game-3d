import { useEffect, type RefObject } from 'react'
import { Box3, type Object3D } from 'three'
import { registerObstacle } from './obstacles'

// Registers the referenced object's ground footprint as a navigation obstacle
// for as long as the component stays mounted. Furniture components attach this
// to their root group, so navigation always avoids exactly what is rendered.
// Deliberately no dependency array: a repositioned piece (HMR edit, changed
// props) re-renders and must re-register, or the obstacle goes stale and
// characters walk through the visible mesh. Furniture re-renders are rare,
// so the re-registration is effectively free.
export function useObstacle(ref: RefObject<Object3D | null>) {
  useEffect(() => {
    const object = ref.current
    if (!object) return
    object.updateWorldMatrix(true, true)
    const bounds = new Box3().setFromObject(object)
    return registerObstacle({ minX: bounds.min.x, maxX: bounds.max.x, minZ: bounds.min.z, maxZ: bounds.max.z })
  })
}
