import { describe, it, expect } from 'vitest'
import ReactThreeTestRenderer from '@react-three/test-renderer'
import { StubMaterialsProvider } from '../materials/StubMaterialsProvider'
import { CaptainChair } from './CaptainChair'

describe('CaptainChair', () => {
  it('renders cushions + headrest + 2 armrests + gas lift stack + 5-star base = 21 meshes', async () => {
    const renderer = await ReactThreeTestRenderer.create(
      <StubMaterialsProvider>
        <CaptainChair />
      </StubMaterialsProvider>,
    )
    expect(renderer.scene.findAllByType('Mesh').length).toBe(21)
  })
})
