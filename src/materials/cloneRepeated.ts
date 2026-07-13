import { Texture, RepeatWrapping } from 'three'

export function cloneRepeated(texture: Texture, repeatX: number, repeatY: number): Texture {
  const clone = texture.clone()
  clone.wrapS = RepeatWrapping
  clone.wrapT = RepeatWrapping
  clone.repeat.set(repeatX, repeatY)
  clone.needsUpdate = true
  return clone
}
