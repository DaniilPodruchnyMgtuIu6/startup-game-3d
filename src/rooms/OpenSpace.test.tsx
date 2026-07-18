import { describe, it, expect } from 'vitest'
import ReactThreeTestRenderer from '@react-three/test-renderer'
import { StubMaterialsProvider } from '../materials/StubMaterialsProvider'
import { OpenSpace } from './OpenSpace'
import { WHITEBOARD_POSITION } from '../scene/whiteboardSpot'

describe('OpenSpace', () => {
  it('renders 4 desk clusters, a lounge, plants, the whiteboard and ceiling fixtures', async () => {
    const renderer = await ReactThreeTestRenderer.create(
      <StubMaterialsProvider>
        <OpenSpace />
      </StubMaterialsProvider>,
    )
    expect(renderer.scene.findAllByType('Mesh').length).toBeGreaterThan(100)
    expect(renderer.scene.findAllByType('SpotLight').length).toBe(1)
    // exactly one whiteboard, at the shared spot (its face is the 1.5×1.0 panel)
    const boards = renderer.scene.findAllByType('Mesh').filter((m) => {
      const geo = (m.instance as unknown as { geometry?: { parameters?: { width?: number; height?: number; depth?: number } } }).geometry
      return geo?.parameters?.width === 1.5 && geo?.parameters?.height === 1.0 && geo?.parameters?.depth === 0.02
    })
    expect(boards).toHaveLength(1)
    const world = boards[0].instance.getWorldPosition(boards[0].instance.position.clone())
    expect(world.x).toBeCloseTo(WHITEBOARD_POSITION[0], 1)
    expect(world.z).toBeCloseTo(WHITEBOARD_POSITION[2], 1)
  })
})
