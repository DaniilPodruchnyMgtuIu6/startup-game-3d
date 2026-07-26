// Feature 18B §3/§7: deterministic audit of every character GLB. Parses the
// glTF JSON chunk directly (no three.js needed): triangles, materials,
// textures + estimated GPU memory, bones, morph targets, animations, file
// size. Run: node tools/art/auditCharacterModels.mjs [--json]
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'

const ROOT = process.cwd()
const CHAR_DIR = join(ROOT, 'public', 'character')

function parseGlbJson(file) {
  const buf = readFileSync(file)
  if (buf.readUInt32LE(0) !== 0x46546c67) throw new Error(`${file}: not a GLB`)
  const jsonLength = buf.readUInt32LE(12)
  return JSON.parse(buf.subarray(20, 20 + jsonLength).toString('utf8'))
}

function auditGlb(file) {
  const gltf = parseGlbJson(file)
  const accessors = gltf.accessors ?? []
  let triangles = 0
  let morphTargets = 0
  for (const mesh of gltf.meshes ?? []) {
    for (const prim of mesh.primitives ?? []) {
      if (prim.indices !== undefined) triangles += Math.floor((accessors[prim.indices]?.count ?? 0) / 3)
      else if (prim.attributes?.POSITION !== undefined) triangles += Math.floor((accessors[prim.attributes.POSITION]?.count ?? 0) / 3)
      morphTargets += (prim.targets ?? []).length
    }
  }
  const bones = (gltf.skins ?? []).reduce((sum, s) => sum + (s.joints?.length ?? 0), 0)
  const images = gltf.images ?? []
  let textureBytes = 0
  for (const img of images) {
    if (img.bufferView !== undefined) textureBytes += gltf.bufferViews?.[img.bufferView]?.byteLength ?? 0
  }
  return {
    file: file.replace(ROOT, '').replace(/\\/g, '/'),
    fileKB: Math.round(statSync(file).size / 1024),
    triangles,
    meshes: (gltf.meshes ?? []).length,
    materials: (gltf.materials ?? []).length,
    materialNames: (gltf.materials ?? []).map((m) => m.name ?? '?'),
    textures: images.length,
    textureKB: Math.round(textureBytes / 1024),
    bones,
    morphTargets,
    animations: (gltf.animations ?? []).map((a) => a.name ?? '?'),
  }
}

const results = {}
for (const character of readdirSync(CHAR_DIR)) {
  const dir = join(CHAR_DIR, character)
  if (!statSync(dir).isDirectory()) continue
  results[character] = []
  for (const entry of readdirSync(dir).filter((f) => f.endsWith('.glb'))) {
    results[character].push(auditGlb(join(dir, entry)))
  }
}

if (process.argv.includes('--json')) {
  console.log(JSON.stringify(results, null, 1))
} else {
  for (const [character, files] of Object.entries(results)) {
    const total = files.reduce((s, f) => s + f.fileKB, 0)
    const base = files.find((f) => f.file.endsWith('idle.glb')) ?? files[0]
    console.log(`\n## ${character} (${files.length} clips, ${Math.round(total / 1024 * 10) / 10} MB total)`)
    console.log(`base: ${base.triangles} tris, ${base.materials} materials [${base.materialNames.join(', ')}], ${base.textures} tex ${base.textureKB} KB, ${base.bones} bones, ${base.morphTargets} morphs`)
    for (const f of files) {
      console.log(`  ${f.file.split('/').pop()}: ${f.fileKB} KB, ${f.triangles} tris, anims [${f.animations.join(', ')}]`)
    }
  }
}
