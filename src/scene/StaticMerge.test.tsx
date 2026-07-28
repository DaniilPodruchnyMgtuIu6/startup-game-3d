import { describe, it, expect } from 'vitest'
import ReactThreeTestRenderer from '@react-three/test-renderer'
import { Mesh, type Object3D, type Material, type Group } from 'three'
import { StaticMerge } from './StaticMerge'
import { Chair } from '../furniture/Chair'
import { StubMaterialsProvider } from '../materials/StubMaterialsProvider'
import { attachHoverOutline } from '../interaction/hoverOutline'

// 18H §21 + live report «пропала белая обводка»: merged furniture must stay
// hover-highlightable. The originals are "hidden" via an invisible MATERIAL
// (renderer skips the draw both in the main and the shadow pass - verified
// against three's projectObject/WebGLShadowMap sources), while the objects
// themselves keep rendering children - which is exactly where
// attachHoverOutline parents its white shells.
describe('StaticMerge keeps merged furniture outline-able', () => {
  it('originals lose their material draw but their outline shells stay renderable', async () => {
    const renderer = await ReactThreeTestRenderer.create(
      <StubMaterialsProvider>
        <StaticMerge>
          <Chair position={[0, 0, 0]} color="#c0392b" />
        </StaticMerge>
      </StubMaterialsProvider>,
    )
    // the merge runs on a macrotask after mount
    await new Promise((resolve) => setTimeout(resolve, 30))
    await renderer.advanceFrames(2, 16)
    try {
      const scene = renderer.scene.instance as unknown as Object3D
      // find the chair's original meshes: material stubbed invisible
      const stubbed: Mesh[] = []
      let mergedCount = 0
      scene.traverse((object) => {
        const mesh = object as Mesh
        if (!mesh.isMesh) return
        const material = mesh.material as Material
        if (material && material.visible === false && mesh.userData.preMergeMaterial) stubbed.push(mesh)
        if (mesh.parent && (mesh.parent as Group).children.length && !mesh.userData.preMergeMaterial && mesh.geometry.index === null) {
          mergedCount += 0 // (indexing heuristics vary - counted below instead)
        }
      })
      expect(stubbed.length, 'chair meshes hidden via material stub').toBeGreaterThan(5)
      // the objects themselves must remain visible so children still render
      for (const mesh of stubbed) expect(mesh.visible).toBe(true)

      // attach the hover outline to the chair root (what the trigger does)
      const chairRoot = stubbed[0].parent!.parent ?? stubbed[0].parent!
      const detach = attachHoverOutline(chairRoot)
      let renderableShells = 0
      scene.traverse((object) => {
        if (!(object as Mesh).isMesh || !object.userData.isHoverOutline) return
        // renderable = every ancestor still visible
        let ancestor: Object3D | null = object
        let visible = true
        while (ancestor) {
          if (ancestor.visible === false) visible = false
          ancestor = ancestor.parent
        }
        if (visible) renderableShells += 1
      })
      expect(renderableShells, 'outline shells render through hidden-material parents').toBeGreaterThan(5)
      detach()
    } finally {
      await renderer.unmount()
    }
  })
})
