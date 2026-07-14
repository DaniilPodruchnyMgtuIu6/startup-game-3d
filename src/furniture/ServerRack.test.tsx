import { describe, it, expect } from 'vitest'
import ReactThreeTestRenderer from '@react-three/test-renderer'
import { StubMaterialsProvider } from '../materials/StubMaterialsProvider'
import { ServerRack } from './ServerRack'

describe('ServerRack', () => {
  it('renders body + 2 side panels + 8 unit slots + 8 LEDs + 3 patch cables (22 meshes)', async () => {
    const renderer = await ReactThreeTestRenderer.create(
      <StubMaterialsProvider>
        <ServerRack />
      </StubMaterialsProvider>,
    )
    expect(renderer.scene.findAllByType('Mesh').length).toBe(22)
  })

  it('animates LED emissive intensity over time (blinking)', async () => {
    const renderer = await ReactThreeTestRenderer.create(
      <StubMaterialsProvider>
        <ServerRack seed={1} />
      </StubMaterialsProvider>,
    )
    const readIntensities = () =>
      renderer.scene
        .findAllByType('Mesh')
        .map((m) => (m.instance as unknown as { material: { emissiveIntensity?: number } }).material)
        .filter((mat) => mat.emissiveIntensity !== undefined)
        .map((mat) => mat.emissiveIntensity)

    await renderer.advanceFrames(1, 0.1)
    const before = readIntensities().join(',')
    await renderer.advanceFrames(30, 0.1) // advance ~3 seconds
    const after = readIntensities().join(',')
    expect(after).not.toBe(before)
  })
})
