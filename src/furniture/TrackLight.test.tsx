import { describe, it, expect } from 'vitest'
import ReactThreeTestRenderer from '@react-three/test-renderer'
import { StubMaterialsProvider } from '../materials/StubMaterialsProvider'
import { TrackLight } from './TrackLight'

describe('TrackLight', () => {
  it('renders a rail and 3 fixture heads (4 meshes) with no real light by default', async () => {
    const renderer = await ReactThreeTestRenderer.create(
      <StubMaterialsProvider>
        <TrackLight />
      </StubMaterialsProvider>,
    )
    expect(renderer.scene.findAllByType('Mesh').length).toBe(4)
    expect(renderer.scene.findAllByType('SpotLight').length).toBe(0)
  })

  it('adds a real spot light when withSpot is true', async () => {
    const renderer = await ReactThreeTestRenderer.create(
      <StubMaterialsProvider>
        <TrackLight withSpot />
      </StubMaterialsProvider>,
    )
    expect(renderer.scene.findAllByType('SpotLight').length).toBe(1)
  })
})
