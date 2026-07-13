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
})
