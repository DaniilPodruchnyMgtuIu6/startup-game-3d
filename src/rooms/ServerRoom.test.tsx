import { describe, it, expect } from 'vitest'
import ReactThreeTestRenderer from '@react-three/test-renderer'
import { StubMaterialsProvider } from '../materials/StubMaterialsProvider'
import { ServerRoom } from './ServerRoom'

describe('ServerRoom', () => {
  it('renders a concrete floor patch, a solid access wall, and 4 server racks', async () => {
    const renderer = await ReactThreeTestRenderer.create(
      <StubMaterialsProvider>
        <ServerRoom />
      </StubMaterialsProvider>,
    )
    expect(renderer.scene.findAllByType('Mesh').length).toBeGreaterThan(60)
  })
})
