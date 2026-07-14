import { Vector3, Quaternion, type Object3D } from 'three'

export interface TriggerTarget {
  point: [number, number, number]
  facing: number
}

const tempVec = new Vector3()
const tempQuat = new Quaternion()
const tempForward = new Vector3()

export function computeTriggerPayload(object: Object3D): TriggerTarget {
  object.getWorldPosition(tempVec)
  object.getWorldQuaternion(tempQuat)
  // Facing comes from the world forward direction, not from Euler angles -
  // Euler extraction is degenerate at a 180-degree Y rotation (decomposes as
  // x=PI, y=0, z=PI) and would report facing=0 for turned-around furniture.
  // atan2(x, z) matches the character's convention: rotationY 0 faces +Z.
  tempForward.set(0, 0, 1).applyQuaternion(tempQuat)
  const facing = Math.atan2(tempForward.x, tempForward.z)
  // Hitboxes are often raised off the floor for easier clicking (e.g. desk
  // triggers at y=0.3, counter-mounted ones higher still). The character
  // always stands on the floor, so its target must ignore that elevation.
  return { point: [tempVec.x, 0, tempVec.z], facing }
}
