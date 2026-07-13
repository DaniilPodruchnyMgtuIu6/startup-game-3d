import { describe, it, expect } from 'vitest'
import ReactThreeTestRenderer from '@react-three/test-renderer'
import { useMaterials } from './MaterialsContext'
import { StubMaterialsProvider } from './StubMaterialsProvider'

function Probe() {
  const materials = useMaterials()
  return (
    <mesh>
      <boxGeometry args={[1, 1, 1]} />
      <meshStandardMaterial {...materials.wallPaint} />
    </mesh>
  )
}

describe('MaterialsContext', () => {
  it('throws when used outside a provider', async () => {
    await expect(ReactThreeTestRenderer.create(<Probe />)).rejects.toThrow(
      'useMaterials must be used within a MaterialsContext provider',
    )
  })

  it('provides materials via StubMaterialsProvider', async () => {
    const renderer = await ReactThreeTestRenderer.create(
      <StubMaterialsProvider>
        <Probe />
      </StubMaterialsProvider>,
    )
    expect(renderer.scene.findAllByType('Mesh').length).toBe(1)
  })
})
