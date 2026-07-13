import { describe, it, expect } from 'vitest'
import ReactThreeTestRenderer from '@react-three/test-renderer'
import { StubMaterialsProvider } from '../materials/StubMaterialsProvider'
import { ServerRack } from './ServerRack'

describe('ServerRack', () => {
  it('renders body + 2 side panels + 8 unit slots + 8 LEDs (19 meshes)', async () => {
    const renderer = await ReactThreeTestRenderer.create(
      <StubMaterialsProvider>
        <ServerRack />
      </StubMaterialsProvider>,
    )
    expect(renderer.scene.findAllByType('Mesh').length).toBe(19)
  })
})
