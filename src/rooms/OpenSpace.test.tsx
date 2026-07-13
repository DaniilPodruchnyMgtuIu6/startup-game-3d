import { describe, it, expect } from 'vitest'
import ReactThreeTestRenderer from '@react-three/test-renderer'
import { StubMaterialsProvider } from '../materials/StubMaterialsProvider'
import { OpenSpace } from './OpenSpace'

describe('OpenSpace', () => {
  it('renders 4 desk clusters, a lounge, plants, signage, and ceiling fixtures', async () => {
    const renderer = await ReactThreeTestRenderer.create(
      <StubMaterialsProvider>
        <OpenSpace />
      </StubMaterialsProvider>,
    )
    expect(renderer.scene.findAllByType('Mesh').length).toBeGreaterThan(100)
    expect(renderer.scene.findAllByType('SpotLight').length).toBe(1)
  })
})
