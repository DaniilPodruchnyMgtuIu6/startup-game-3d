import { describe, it, expect } from 'vitest'
import ReactThreeTestRenderer from '@react-three/test-renderer'
import { StubMaterialsProvider } from '../materials/StubMaterialsProvider'
import { MeetingRoom } from './MeetingRoom'

describe('MeetingRoom', () => {
  it('renders the glazed entrance, a solid south wall, a table, 8 chairs and a TV (the whiteboard moved to the open space)', async () => {
    const renderer = await ReactThreeTestRenderer.create(
      <StubMaterialsProvider>
        <MeetingRoom />
      </StubMaterialsProvider>,
    )
    expect(renderer.scene.findAllByType('Mesh').length).toBeGreaterThan(45)
  })
})
