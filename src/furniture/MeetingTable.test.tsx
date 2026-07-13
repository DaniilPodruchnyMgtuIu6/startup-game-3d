import { describe, it, expect } from 'vitest'
import ReactThreeTestRenderer from '@react-three/test-renderer'
import { StubMaterialsProvider } from '../materials/StubMaterialsProvider'
import { MeetingTable } from './MeetingTable'

describe('MeetingTable', () => {
  it('renders a top and 4 legs (5 meshes)', async () => {
    const renderer = await ReactThreeTestRenderer.create(
      <StubMaterialsProvider>
        <MeetingTable />
      </StubMaterialsProvider>,
    )
    expect(renderer.scene.findAllByType('Mesh').length).toBe(5)
  })
})
