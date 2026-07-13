import { describe, it, expect } from 'vitest'
import ReactThreeTestRenderer from '@react-three/test-renderer'
import { StubMaterialsProvider } from '../materials/StubMaterialsProvider'
import { GlassPartition } from './GlassPartition'

describe('GlassPartition', () => {
  it('renders kickplate + glass + header + mullions for a 6m run (9 meshes)', async () => {
    const renderer = await ReactThreeTestRenderer.create(
      <StubMaterialsProvider>
        <GlassPartition axis="x" length={6} position={[0, 0, -2.667]} />
      </StubMaterialsProvider>,
    )
    expect(renderer.scene.findAllByType('Mesh').length).toBe(9)
  })
})
