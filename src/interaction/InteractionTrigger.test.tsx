import { describe, it, expect, vi } from 'vitest'
import ReactThreeTestRenderer from '@react-three/test-renderer'
import { InteractionTrigger } from './InteractionTrigger'

describe('InteractionTrigger', () => {
  it('renders nothing when onTrigger is not provided', async () => {
    const renderer = await ReactThreeTestRenderer.create(<InteractionTrigger />)
    expect(renderer.scene.findAllByType('Mesh').length).toBe(0)
  })

  it('renders one mesh when onTrigger is provided', async () => {
    const renderer = await ReactThreeTestRenderer.create(<InteractionTrigger onTrigger={vi.fn()} />)
    expect(renderer.scene.findAllByType('Mesh').length).toBe(1)
  })
})
