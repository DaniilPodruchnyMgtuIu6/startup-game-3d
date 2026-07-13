import { describe, it, expect } from 'vitest'
import ReactThreeTestRenderer from '@react-three/test-renderer'
import { StubMaterialsProvider } from '../materials/StubMaterialsProvider'
import { Desk } from './Desk'

describe('Desk', () => {
  it('renders a top and 4 legs (5 meshes) at the given position', async () => {
    const renderer = await ReactThreeTestRenderer.create(
      <StubMaterialsProvider>
        <Desk position={[2, 0, -1]} />
      </StubMaterialsProvider>,
    )
    expect(renderer.scene.findAllByType('Mesh').length).toBe(5)
    const group = renderer.scene.children[0]
    expect(group.instance.position.x).toBeCloseTo(2)
    expect(group.instance.position.z).toBeCloseTo(-1)
  })
})
