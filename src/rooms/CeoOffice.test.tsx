import { describe, it, expect } from 'vitest'
import ReactThreeTestRenderer from '@react-three/test-renderer'
import { StubMaterialsProvider } from '../materials/StubMaterialsProvider'
import { CeoOffice } from './CeoOffice'

describe('CeoOffice', () => {
  it('renders the glazed entrance, desk, chair, skyline, bookshelf, and visitor seating', async () => {
    const renderer = await ReactThreeTestRenderer.create(
      <StubMaterialsProvider>
        <CeoOffice />
      </StubMaterialsProvider>,
    )
    expect(renderer.scene.findAllByType('Mesh').length).toBeGreaterThan(50)
  })
})
