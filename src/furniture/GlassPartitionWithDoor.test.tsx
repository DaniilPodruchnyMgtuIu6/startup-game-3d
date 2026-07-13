import { describe, it, expect } from 'vitest'
import ReactThreeTestRenderer from '@react-three/test-renderer'
import { StubMaterialsProvider } from '../materials/StubMaterialsProvider'
import { GlassPartitionWithDoor } from './GlassPartitionWithDoor'

describe('GlassPartitionWithDoor', () => {
  it('renders two glass segments (6 meshes each for a 6m run split by a 0.9m door) plus a 6-mesh door = 18 meshes', async () => {
    const renderer = await ReactThreeTestRenderer.create(
      <StubMaterialsProvider>
        <GlassPartitionWithDoor axis="z" length={6} position={[0, 0, 0]} />
      </StubMaterialsProvider>,
    )
    expect(renderer.scene.findAllByType('Mesh').length).toBe(18)
  })
})
