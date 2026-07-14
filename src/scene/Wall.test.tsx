import { describe, it, expect } from 'vitest'
import ReactThreeTestRenderer from '@react-three/test-renderer'
import { StubMaterialsProvider } from '../materials/StubMaterialsProvider'
import { Wall } from './Wall'

describe('Wall', () => {
  it('renders a single solid slab when there is no doorway', async () => {
    const renderer = await ReactThreeTestRenderer.create(
      <StubMaterialsProvider>
        <Wall axis="x" length={6} center={[0, 1.4, -8]} height={2.8} thickness={0.2} material="paint" />
      </StubMaterialsProvider>,
    )
    expect(renderer.scene.findAllByType('Mesh').length).toBe(1)
  })

  it('renders three segments (left pier, lintel, right pier) when a doorway is given', async () => {
    const renderer = await ReactThreeTestRenderer.create(
      <StubMaterialsProvider>
        <Wall
          axis="x"
          length={6}
          center={[0, 1.4, -2.667]}
          height={2.8}
          thickness={0.2}
          material="paint"
          doorway={{ offset: 1, width: 0.9 }}
        />
      </StubMaterialsProvider>,
    )
    expect(renderer.scene.findAllByType('Mesh').length).toBe(3)
  })

  it('sizes the lintel to only span from the door head to the wall top', async () => {
    // The lintel fills the band between the 2.1m door opening and the 2.8m
    // wall top - 0.7m tall. Rendering it at full wall height would sag into
    // the opening and poke out above the roofline.
    const renderer = await ReactThreeTestRenderer.create(
      <StubMaterialsProvider>
        <Wall
          axis="z"
          length={5.333}
          center={[3, 1.4, 0]}
          height={2.8}
          thickness={0.2}
          material="paint"
          doorway={{ offset: 5.333 / 2, width: 0.9 }}
        />
      </StubMaterialsProvider>,
    )
    const meshes = renderer.scene.findAllByType('Mesh')
    const geometries = meshes.map(
      (m) => (m.instance as unknown as { geometry: { parameters: { height: number } } }).geometry.parameters,
    )
    const lintel = geometries.find((g) => Math.abs(g.height - 0.7) < 1e-6)
    expect(lintel).toBeDefined()
    // and nothing in a doorway wall may be taller than the wall itself
    for (const g of geometries) {
      expect(g.height).toBeLessThanOrEqual(2.8)
    }
  })
})
