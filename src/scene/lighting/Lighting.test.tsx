import { describe, it, expect } from 'vitest'
import ReactThreeTestRenderer from '@react-three/test-renderer'
import { SceneLights } from './Lighting'

describe('SceneLights', () => {
  it('mounts an ambient light and 2 directional lights (key + fill)', async () => {
    const renderer = await ReactThreeTestRenderer.create(<SceneLights />)
    expect(renderer.scene.findAllByType('DirectionalLight').length).toBe(2)
    expect(renderer.scene.findAllByType('AmbientLight').length).toBe(1)
  })
})
