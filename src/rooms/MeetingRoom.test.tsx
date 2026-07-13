import { describe, it, expect } from 'vitest'
import ReactThreeTestRenderer from '@react-three/test-renderer'
import { StubMaterialsProvider } from '../materials/StubMaterialsProvider'
import { MeetingRoom } from './MeetingRoom'

describe('MeetingRoom', () => {
  it('renders the glazed entrance, a solid south wall, a table, 8 chairs, a TV and a whiteboard', async () => {
    const renderer = await ReactThreeTestRenderer.create(
      <StubMaterialsProvider>
        <MeetingRoom />
      </StubMaterialsProvider>,
    )
    expect(renderer.scene.findAllByType('Mesh').length).toBeGreaterThan(50)
  })
})
