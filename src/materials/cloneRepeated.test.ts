import { describe, it, expect } from 'vitest'
import { Texture, RepeatWrapping } from 'three'
import { cloneRepeated } from './cloneRepeated'

describe('cloneRepeated', () => {
  it('returns a distinct texture with repeat wrapping and the requested repeat', () => {
    const source = new Texture()
    const result = cloneRepeated(source, 4, 6)
    expect(result).not.toBe(source)
    expect(result.wrapS).toBe(RepeatWrapping)
    expect(result.wrapT).toBe(RepeatWrapping)
    expect(result.repeat.x).toBe(4)
    expect(result.repeat.y).toBe(6)
  })
})
