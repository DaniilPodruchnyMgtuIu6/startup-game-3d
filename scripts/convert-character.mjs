import convert from 'fbx2gltf'
import { NodeIO } from '@gltf-transform/core'
import { ALL_EXTENSIONS } from '@gltf-transform/extensions'
import { prune } from '@gltf-transform/functions'
import path from 'node:path'
import fs from 'node:fs/promises'

// One folder per character in character-source/ and public/character/.
// file = FBX path in character-source/, out = output GLB path in
// public/character/, name = clip name inside the GLB. Entries with keepMesh
// are the character "base" files that keep skin/mesh data; the rest are
// stripped to animation-only files.
const ALL_CLIPS = [
  { file: 'business_man/idle', name: 'idle', out: 'business_man/idle', keepMesh: true },
  { file: 'business_man/walk', name: 'walk', out: 'business_man/walk' },
  { file: 'business_man/sit', name: 'sit', out: 'business_man/sit' },
  { file: 'business_man/type', name: 'type', out: 'business_man/type' },
  { file: 'business_man/drink', name: 'drink', out: 'business_man/drink' },
  { file: 'business_man/sitting_idle', name: 'sitIdle', out: 'business_man/sitIdle' },
  { file: 'business_man/sofa_sitting_pose', name: 'sofaSit', out: 'business_man/sofaSit' },
  { file: 'business_man/talking_businessman', name: 'talk', out: 'business_man/talk' },
  { file: 'female_pm/female_idle', name: 'idle', out: 'female_pm/idle', keepMesh: true },
  { file: 'female_pm/female_walking', name: 'walk', out: 'female_pm/walk' },
  { file: 'female_pm/female_typing', name: 'type', out: 'female_pm/type' },
  { file: 'female_pm/female_metting_room_sitting', name: 'sitIdle', out: 'female_pm/sitIdle' },
  { file: 'female_pm/female_sofa_sitting', name: 'sofaSit', out: 'female_pm/sofaSit' },
  { file: 'female_pm/female_drinking', name: 'drink', out: 'female_pm/drink' },
  { file: 'female_pm/female_talking', name: 'talk', out: 'female_pm/talk' },
]
// pass name fragments as CLI args to convert a subset, e.g.
//   node scripts/convert-character.mjs female_pm
const requested = process.argv.slice(2)
const CLIPS = requested.length
  ? ALL_CLIPS.filter((c) => requested.some((r) => c.file.includes(r) || c.out.includes(r) || c.name === r))
  : ALL_CLIPS
const SRC_DIR = path.resolve('character-source')
const OUT_DIR = path.resolve('public/character')
const TMP_DIR = path.resolve('.character-tmp')

const io = new NodeIO().registerExtensions(ALL_EXTENSIONS)

await fs.mkdir(OUT_DIR, { recursive: true })
await fs.mkdir(TMP_DIR, { recursive: true })

for (const { file, name: clip, out, keepMesh } of CLIPS) {
  const srcFbx = path.join(SRC_DIR, `${file}.fbx`)
  const tmpGlb = path.join(TMP_DIR, `${out.replaceAll('/', '_')}.raw.glb`)
  const outGlb = path.join(OUT_DIR, `${out}.glb`)
  await fs.mkdir(path.dirname(outGlb), { recursive: true })

  console.log(`[${out}] converting FBX -> GLB...`)
  await convert(srcFbx, tmpGlb, [])

  const document = await io.read(tmpGlb)
  const root = document.getRoot()

  const hipsNode = root.listNodes().find((n) => n.getName().endsWith(':Hips'))
  if (!hipsNode) throw new Error(`[${out}] Hips node not found`)

  console.log(`[${out}] stripping root motion, renaming clip...`)
  for (const anim of root.listAnimations()) {
    anim.setName(clip)
    for (const channel of anim.listChannels()) {
      if (channel.getTargetNode() === hipsNode && channel.getTargetPath() === 'translation') {
        const sampler = channel.getSampler()
        const output = sampler.getOutput()
        const array = output.getArray().slice()
        const x0 = array[0]
        const z0 = array[2]
        for (let i = 0; i < array.length; i += 3) {
          array[i] = x0
          array[i + 2] = z0
        }
        output.setArray(array)
      }
    }
  }

  if (!keepMesh) {
    console.log(`[${out}] stripping mesh/material/texture data (animation-only file)...`)
    for (const mesh of root.listMeshes()) mesh.dispose()
    await document.transform(prune())
  }

  await io.write(outGlb, document)
  const stat = await fs.stat(outGlb)
  console.log(`[${out}] wrote ${outGlb} (${(stat.size / 1024).toFixed(0)} KB)`)
}

await fs.rm(TMP_DIR, { recursive: true, force: true })
console.log('done')
