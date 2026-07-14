import { describe, it, expect } from 'vitest'
import ReactThreeTestRenderer from '@react-three/test-renderer'
import { StubMaterialsProvider } from '../materials/StubMaterialsProvider'
import { CableTray } from './CableTray'

describe('CableTray', () => {
  it('renders base + 2 rails + 3 cable runs (6 meshes) without drops', async () => {
    const renderer = await ReactThreeTestRenderer.create(
      <StubMaterialsProvider>
        <CableTray length={4} />
      </StubMaterialsProvider>,
    )
    expect(renderer.scene.findAllByType('Mesh').length).toBe(6)
  })

  it('adds one drop cable per requested offset', async () => {
    const renderer = await ReactThreeTestRenderer.create(
      <StubMaterialsProvider>
        <CableTray length={4} drops={[-1.5, 0, 1.5]} />
      </StubMaterialsProvider>,
    )
    expect(renderer.scene.findAllByType('Mesh').length).toBe(9)
  })
})
