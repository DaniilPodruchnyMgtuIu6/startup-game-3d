import { describe, it, expect } from 'vitest'
import { Vector3 } from 'three'
import ReactThreeTestRenderer from '@react-three/test-renderer'
import { StubMaterialsProvider } from '../materials/StubMaterialsProvider'
import { GlassPartitionWithDoor } from './GlassPartitionWithDoor'

describe('GlassPartitionWithDoor', () => {
  it('renders two glass segments plus a 3-mesh transom over the open doorway (15 meshes)', async () => {
    const renderer = await ReactThreeTestRenderer.create(
      <StubMaterialsProvider>
        <GlassPartitionWithDoor axis="z" length={6} position={[0, 0, 0]} />
      </StubMaterialsProvider>,
    )
    expect(renderer.scene.findAllByType('Mesh').length).toBe(15)
  })

  it('keeps the doorway itself clear below the transom', async () => {
    const renderer = await ReactThreeTestRenderer.create(
      <StubMaterialsProvider>
        <GlassPartitionWithDoor axis="z" length={6} position={[0, 0, 0]} />
      </StubMaterialsProvider>,
    )
    // no mesh whose world position falls inside the doorway opening
    // (|z| < 0.45) may dip below the 2.1m door head
    renderer.scene.instance.updateMatrixWorld(true)
    const meshes = renderer.scene.findAllByType('Mesh')
    const world = new Vector3()
    for (const mesh of meshes) {
      const m = mesh.instance as unknown as {
        getWorldPosition: (v: Vector3) => Vector3
        geometry: { parameters: { height: number } }
      }
      m.getWorldPosition(world)
      // strictly inside the opening - the segments' edge mullions sit exactly
      // on the 0.45 boundary and act as door jambs
      if (Math.abs(world.z) < 0.44) {
        expect(world.y - m.geometry.parameters.height / 2).toBeGreaterThanOrEqual(2.1 - 1e-6)
      }
    }
  })
})
