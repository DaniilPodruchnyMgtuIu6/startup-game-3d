import { describe, it, expect } from 'vitest'
import ReactThreeTestRenderer from '@react-three/test-renderer'
import { StubMaterialsProvider } from '../materials/StubMaterialsProvider'
import { FocusRoom } from './FocusRoom'

describe('FocusRoom', () => {
  it('renders the glazed entrance, a solid south wall, and 2 workstations', async () => {
    const renderer = await ReactThreeTestRenderer.create(
      <StubMaterialsProvider>
        <FocusRoom />
      </StubMaterialsProvider>,
    )
    expect(renderer.scene.findAllByType('Mesh').length).toBeGreaterThan(30)
  })
})
