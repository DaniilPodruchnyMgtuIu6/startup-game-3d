import { describe, it, expect } from 'vitest'
import ReactThreeTestRenderer from '@react-three/test-renderer'
import { StubMaterialsProvider } from '../materials/StubMaterialsProvider'
import { AcousticCeilingPanel } from './AcousticCeilingPanel'

describe('AcousticCeilingPanel', () => {
  it('renders a panel and 2 suspension cables (3 meshes)', async () => {
    const renderer = await ReactThreeTestRenderer.create(
      <StubMaterialsProvider>
        <AcousticCeilingPanel />
      </StubMaterialsProvider>,
    )
    expect(renderer.scene.findAllByType('Mesh').length).toBe(3)
  })
})
