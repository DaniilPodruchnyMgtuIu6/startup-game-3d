import { describe, it, expect } from 'vitest'
import ReactThreeTestRenderer from '@react-three/test-renderer'
import { FloorClickCatcher } from './FloorClickCatcher'

describe('FloorClickCatcher', () => {
  it('renders a single invisible floor plane', async () => {
    const renderer = await ReactThreeTestRenderer.create(<FloorClickCatcher />)
    expect(renderer.scene.findAllByType('Mesh').length).toBe(1)
  })
})
