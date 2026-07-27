// Model-fix pass: measure the WORLD height of a character GLB from its skinned
// mesh bind-pose bounds (POSITION accessor min/max Y x the mesh node's world
// scale). Usage: node tools/art/measureCharacterHeight.mjs <file...>
import { readFileSync } from 'node:fs'

function readGlb(file) {
  const buf = readFileSync(file)
  const jsonLength = buf.readUInt32LE(12)
  const json = JSON.parse(buf.subarray(20, 20 + jsonLength).toString('utf8'))
  return { json }
}

function worldScaleOfMeshNode(json) {
  const nodes = json.nodes ?? []
  const parent = new Array(nodes.length).fill(-1)
  nodes.forEach((n, i) => (n.children ?? []).forEach((c) => (parent[c] = i)))
  const meshNode = nodes.findIndex((n) => n.mesh !== undefined)
  let scale = 1
  for (let i = meshNode; i !== -1; i = parent[i]) scale *= nodes[i]?.scale?.[0] ?? 1
  return scale
}

export function measureHeight(file) {
  const { json } = readGlb(file)
  let minY = Infinity
  let maxY = -Infinity
  for (const mesh of json.meshes ?? []) {
    for (const prim of mesh.primitives ?? []) {
      const acc = json.accessors[prim.attributes?.POSITION]
      if (acc?.min && acc?.max) {
        minY = Math.min(minY, acc.min[1])
        maxY = Math.max(maxY, acc.max[1])
      }
    }
  }
  const scale = worldScaleOfMeshNode(json)
  return { height: (maxY - minY) * scale, minY: minY * scale, maxY: maxY * scale, meshScale: scale }
}

for (const file of process.argv.slice(2)) {
  const m = measureHeight(file)
  console.log(`${file}: height ${m.height.toFixed(3)} m (feet ${m.minY.toFixed(3)}, top ${m.maxY.toFixed(3)}, scale ${m.meshScale})`)
}
