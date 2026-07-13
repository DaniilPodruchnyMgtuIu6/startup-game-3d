import { describe, it, expect, vi } from 'vitest'
import ReactThreeTestRenderer from '@react-three/test-renderer'
import { StubMaterialsProvider } from '../materials/StubMaterialsProvider'
import { Workstation } from './Workstation'

describe('Workstation', () => {
  it('renders desk + chair + monitor + keyboard + mouse + mug + trigger (27 meshes)', async () => {
    const renderer = await ReactThreeTestRenderer.create(
      <StubMaterialsProvider>
        <Workstation chairColor="#c0392b" onSelect={vi.fn()} />
      </StubMaterialsProvider>,
    )
    expect(renderer.scene.findAllByType('Mesh').length).toBe(27)
  })

  it('renders 26 meshes (no trigger) when onSelect is not provided', async () => {
    const renderer = await ReactThreeTestRenderer.create(
      <StubMaterialsProvider>
        <Workstation chairColor="#c0392b" />
      </StubMaterialsProvider>,
    )
    expect(renderer.scene.findAllByType('Mesh').length).toBe(26)
  })
})
