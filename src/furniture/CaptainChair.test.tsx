import { describe, it, expect } from 'vitest'
import ReactThreeTestRenderer from '@react-three/test-renderer'
import { StubMaterialsProvider } from '../materials/StubMaterialsProvider'
import { CaptainChair } from './CaptainChair'

describe('CaptainChair', () => {
  it('renders seat + back + headrest + cylinder + 5-star base (2 meshes per arm) = 14 meshes', async () => {
    const renderer = await ReactThreeTestRenderer.create(
      <StubMaterialsProvider>
        <CaptainChair />
      </StubMaterialsProvider>,
    )
    expect(renderer.scene.findAllByType('Mesh').length).toBe(14)
  })
})
