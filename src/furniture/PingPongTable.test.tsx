import { describe, it, expect } from 'vitest'
import ReactThreeTestRenderer from '@react-three/test-renderer'
import { StubMaterialsProvider } from '../materials/StubMaterialsProvider'
import { PingPongTable } from './PingPongTable'

describe('PingPongTable', () => {
  it('renders top + line + net + 2 posts + 4 legs + 2 side triggers (11 meshes)', async () => {
    const renderer = await ReactThreeTestRenderer.create(
      <StubMaterialsProvider>
        <PingPongTable />
      </StubMaterialsProvider>,
    )
    expect(renderer.scene.findAllByType('Mesh').length).toBe(11)
  })
})
