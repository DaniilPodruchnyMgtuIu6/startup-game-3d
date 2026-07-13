import { describe, it, expect } from 'vitest'
import ReactThreeTestRenderer from '@react-three/test-renderer'
import { PlaceholderScene } from './App'

describe('PlaceholderScene', () => {
  it('mounts and renders one mesh', async () => {
    const renderer = await ReactThreeTestRenderer.create(<PlaceholderScene />)
    const meshes = renderer.scene.findAllByType('Mesh')
    expect(meshes.length).toBe(1)
  })
})
