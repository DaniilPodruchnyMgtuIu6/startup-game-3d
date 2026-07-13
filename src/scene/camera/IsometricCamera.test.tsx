import { describe, it, expect } from 'vitest'
import ReactThreeTestRenderer from '@react-three/test-renderer'
import { IsometricCamera } from './IsometricCamera'

describe('IsometricCamera', () => {
  it('mounts exactly one orthographic camera', async () => {
    const renderer = await ReactThreeTestRenderer.create(<IsometricCamera />)
    const cameras = renderer.scene.findAllByType('OrthographicCamera')
    expect(cameras.length).toBe(1)
  })
})
