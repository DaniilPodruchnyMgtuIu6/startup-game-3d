import { describe, it, expect } from 'vitest'
import ReactThreeTestRenderer from '@react-three/test-renderer'
import { StubMaterialsProvider } from '../materials/StubMaterialsProvider'
import { GameRoom } from './GameRoom'

describe('GameRoom', () => {
  it('renders the glazed entrance, a ping pong table, a pull-up bar, and lounge seating', async () => {
    const renderer = await ReactThreeTestRenderer.create(
      <StubMaterialsProvider>
        <GameRoom />
      </StubMaterialsProvider>,
    )
    expect(renderer.scene.findAllByType('Mesh').length).toBeGreaterThan(40)
  })
})
