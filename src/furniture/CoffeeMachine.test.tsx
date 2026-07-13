import { describe, it, expect, vi } from 'vitest'
import ReactThreeTestRenderer from '@react-three/test-renderer'
import { StubMaterialsProvider } from '../materials/StubMaterialsProvider'
import { CoffeeMachine } from './CoffeeMachine'

describe('CoffeeMachine', () => {
  it('renders body + tank + tray + display + spout + trigger (6 meshes)', async () => {
    const renderer = await ReactThreeTestRenderer.create(
      <StubMaterialsProvider>
        <CoffeeMachine onSelect={vi.fn()} />
      </StubMaterialsProvider>,
    )
    expect(renderer.scene.findAllByType('Mesh').length).toBe(6)
  })

  it('renders 5 meshes (no trigger) when onSelect is not provided', async () => {
    const renderer = await ReactThreeTestRenderer.create(
      <StubMaterialsProvider>
        <CoffeeMachine />
      </StubMaterialsProvider>,
    )
    expect(renderer.scene.findAllByType('Mesh').length).toBe(5)
  })
})
