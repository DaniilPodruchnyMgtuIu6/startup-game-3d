import { describe, it, expect } from 'vitest'
import ReactThreeTestRenderer from '@react-three/test-renderer'
import { StubMaterialsProvider } from '../materials/StubMaterialsProvider'
import { KitchenIsland } from './KitchenIsland'

describe('KitchenIsland', () => {
  it('renders top + 3 cabinet doors + sink + 2-piece faucet (7 meshes)', async () => {
    const renderer = await ReactThreeTestRenderer.create(
      <StubMaterialsProvider>
        <KitchenIsland />
      </StubMaterialsProvider>,
    )
    expect(renderer.scene.findAllByType('Mesh').length).toBe(7)
  })
})
