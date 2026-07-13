import { Vector3, Quaternion, Euler, type Object3D } from 'three'

export interface TriggerTarget {
  point: [number, number, number]
  facing: number
}

const tempVec = new Vector3()
const tempQuat = new Quaternion()
const tempEuler = new Euler()

export function computeTriggerPayload(object: Object3D): TriggerTarget {
  object.getWorldPosition(tempVec)
  object.getWorldQuaternion(tempQuat)
  tempEuler.setFromQuaternion(tempQuat)
  return { point: [tempVec.x, tempVec.y, tempVec.z], facing: tempEuler.y }
}
