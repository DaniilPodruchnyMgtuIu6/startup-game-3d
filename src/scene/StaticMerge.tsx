import { useEffect, useRef, type ReactNode } from 'react'
import {
  Group,
  Matrix4,
  Mesh,
  MeshPhysicalMaterial,
  MeshStandardMaterial,
  type BufferGeometry,
  type Material,
} from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'

// 18H §21: draw-call batching for NON-INTERACTIVE static decor. The office
// spends its frame budget on ~1000 tiny meshes (2690 draw calls with the
// AO/shadow passes); partitions, ceiling panels, plants, rails and other
// decor never move, never change material and never take pointer events -
// they can render as ONE mesh per material. Interactive furniture (triggers,
// hover outlines, monitors with live screens) stays out of these wrappers.
//
// Mechanics: after mount, meshes under this group are bucketed by a material
// SIGNATURE (same look = same bucket even though JSX created per-mesh
// material instances), their geometries are baked into world space and merged;
// the originals turn invisible but stay in the tree - obstacles, bounds and
// tests keep working (Box3.setFromObject ignores visibility).
function materialSignature(material: Material): string {
  const m = material as MeshStandardMaterial & Partial<MeshPhysicalMaterial>
  return [
    material.type,
    m.color?.getHexString() ?? '',
    m.map?.uuid ?? '',
    m.normalMap?.uuid ?? '',
    m.roughness ?? '',
    m.metalness ?? '',
    m.transparent ? `t${m.opacity}` : '',
    m.transmission ?? '',
    m.emissive?.getHexString() ?? '',
    m.emissiveIntensity ?? '',
  ].join('|')
}

export function StaticMerge({ children }: { children: ReactNode }) {
  const source = useRef<Group>(null)
  const target = useRef<Group>(null)

  useEffect(() => {
    const src = source.current
    const dst = target.current
    if (!src || !dst) return
    // materials/textures resolve through suspense - merge on the next tick,
    // after the subtree has really rendered
    const timer = setTimeout(() => {
      const buckets = new Map<
        string,
        { geometries: BufferGeometry[]; meshes: Mesh[]; material: Material; cast: boolean; receive: boolean }
      >()
      src.updateWorldMatrix(true, true)
      dst.updateWorldMatrix(true, false)
      // bake into the TARGET group's LOCAL space - the wrappers live inside
      // positioned room groups, and baking plain world coordinates applied
      // the room transform twice (the furniture-exploded-outside regression;
      // masked at first because OpenSpace/Building happen to sit at origin)
      const intoTarget = new Matrix4().copy(dst.matrixWorld).invert()
      const bake = new Matrix4()
      const merged: Mesh[] = []
      src.traverse((object) => {
        const mesh = object as Mesh
        if (!mesh.isMesh || mesh.userData.noMerge) return
        if (Array.isArray(mesh.material)) return // multi-material: leave as is
        const key = materialSignature(mesh.material)
        let bucket = buckets.get(key)
        if (!bucket) {
          bucket = { geometries: [], meshes: [], material: mesh.material, cast: false, receive: false }
          buckets.set(key, bucket)
        }
        const geometry = mesh.geometry.clone()
        geometry.applyMatrix4(bake.multiplyMatrices(intoTarget, mesh.matrixWorld))
        bucket.geometries.push(geometry)
        bucket.meshes.push(mesh)
        bucket.cast ||= mesh.castShadow
        bucket.receive ||= mesh.receiveShadow
      })
      for (const { geometries, meshes, material, cast, receive } of buckets.values()) {
        if (!geometries.length) continue
        // mergeGeometries demands identical attribute sets and consistent
        // indexing across the bucket - normalize first (drop attributes not
        // shared by every geometry, de-index when mixed) or THREE logs a
        // console error and drops the bucket
        let shared: Set<string> | null = null
        for (const g of geometries) {
          const names = new Set(Object.keys(g.attributes))
          shared = shared ? new Set([...shared].filter((n) => names.has(n))) : names
        }
        for (const g of geometries) {
          for (const name of Object.keys(g.attributes)) {
            if (!shared!.has(name)) g.deleteAttribute(name)
          }
        }
        const allIndexed = geometries.every((g) => g.index !== null)
        const normalized = allIndexed ? geometries : geometries.map((g) => (g.index ? g.toNonIndexed() : g))
        const geometry = mergeGeometries(normalized, false)
        if (!geometry) continue // still incompatible - leave those originals visible
        for (const g of geometries) g.dispose()
        const mesh = new Mesh(geometry, material)
        mesh.castShadow = cast
        mesh.receiveShadow = receive
        dst.add(mesh)
        merged.push(...meshes) // hide ONLY the meshes whose bucket really merged
      }
      // hide the originals only after the merged copies exist - no flicker
      for (const mesh of merged) mesh.visible = false
    }, 0)
    return () => {
      clearTimeout(timer)
      for (const child of [...dst.children]) {
        dst.remove(child)
        ;(child as Mesh).geometry?.dispose()
      }
    }
  }, [])

  return (
    <>
      <group ref={source}>{children}</group>
      <group ref={target} />
    </>
  )
}
