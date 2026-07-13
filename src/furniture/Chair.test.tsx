import { describe, it, expect } from 'vitest'
import ReactThreeTestRenderer from '@react-three/test-renderer'
import { StubMaterialsProvider } from '../materials/StubMaterialsProvider'
import { Chair } from './Chair'

describe('Chair', () => {
  it('renders seat + back + gas cylinder + 5-star base (2 meshes per arm) = 13 meshes', async () => {
    const renderer = await ReactThreeTestRenderer.create(
      <StubMaterialsProvider>
        <Chair position={[0, 0, 0]} color="#c0392b" />
      </StubMaterialsProvider>,
    )
    expect(renderer.scene.findAllByType('Mesh').length).toBe(13)
  })
})
