import { describe, it, expect } from 'vitest'
import ReactThreeTestRenderer from '@react-three/test-renderer'
import { StubMaterialsProvider } from '../materials/StubMaterialsProvider'
import { SceneLights } from './lighting/Lighting'
import { Office } from './Office'

describe('Office', () => {
  it('mounts the full building with all 7 rooms and the camera without throwing', async () => {
    const renderer = await ReactThreeTestRenderer.create(
      <Office MaterialsProvider={StubMaterialsProvider} LightingComponent={SceneLights} />,
    )
    await renderer.advanceFrames(2, 16)
    expect(renderer.scene.findAllByType('Mesh').length).toBeGreaterThan(400)
    expect(renderer.scene.findAllByType('OrthographicCamera').length).toBe(1)
  })
})
