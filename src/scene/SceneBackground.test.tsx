import { describe, it, expect } from 'vitest'
import type { Scene } from 'three'
import ReactThreeTestRenderer from '@react-three/test-renderer'
import { SceneBackground } from './SceneBackground'

describe('SceneBackground', () => {
  it('sets a background on the scene (gradient texture, or solid fallback without 2D canvas)', async () => {
    const renderer = await ReactThreeTestRenderer.create(<SceneBackground />)
    expect((renderer.scene.instance as Scene).background).not.toBeNull()
  })
})
