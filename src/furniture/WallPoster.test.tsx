import { describe, it, expect } from 'vitest'
import ReactThreeTestRenderer from '@react-three/test-renderer'
import { StubMaterialsProvider } from '../materials/StubMaterialsProvider'
import { WallPoster } from './WallPoster'

describe('WallPoster', () => {
  it('renders frame + print (2 meshes) for both variants', async () => {
    for (const variant of ['officeFlow', 'lockScreen'] as const) {
      const renderer = await ReactThreeTestRenderer.create(
        <StubMaterialsProvider>
          <WallPoster variant={variant} />
        </StubMaterialsProvider>,
      )
      expect(renderer.scene.findAllByType('Mesh').length).toBe(2)
    }
  })
})
