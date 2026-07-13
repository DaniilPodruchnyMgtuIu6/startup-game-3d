import convert from 'fbx2gltf'
import { NodeIO } from '@gltf-transform/core'
import { ALL_EXTENSIONS } from '@gltf-transform/extensions'
import { prune } from '@gltf-transform/functions'
import path from 'node:path'
import fs from 'node:fs/promises'

const BASE_CLIP = 'idle'
const CLIPS = ['idle', 'walk', 'sit', 'type', 'drink']
const SRC_DIR = path.resolve('character-source')
const OUT_DIR = path.resolve('public/character')
const TMP_DIR = path.resolve('.character-tmp')

const io = new NodeIO().registerExtensions(ALL_EXTENSIONS)

await fs.mkdir(OUT_DIR, { recursive: true })
await fs.mkdir(TMP_DIR, { recursive: true })

for (const clip of CLIPS) {
  const srcFbx = path.join(SRC_DIR, `${clip}.fbx`)
  const tmpGlb = path.join(TMP_DIR, `${clip}.raw.glb`)
  const outGlb = path.join(OUT_DIR, `${clip}.glb`)

  console.log(`[${clip}] converting FBX -> GLB...`)
  await convert(srcFbx, tmpGlb, [])

  const document = await io.read(tmpGlb)
  const root = document.getRoot()

  const hipsNode = root.listNodes().find((n) => n.getName().endsWith(':Hips'))
  if (!hipsNode) throw new Error(`[${clip}] Hips node not found`)

  console.log(`[${clip}] stripping root motion, renaming clip...`)
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

  if (clip !== BASE_CLIP) {
    console.log(`[${clip}] stripping mesh/material/texture data (animation-only file)...`)
    for (const mesh of root.listMeshes()) mesh.dispose()
    await document.transform(prune())
  }

  await io.write(outGlb, document)
  const stat = await fs.stat(outGlb)
  console.log(`[${clip}] wrote ${outGlb} (${(stat.size / 1024).toFixed(0)} KB)`)
}

await fs.rm(TMP_DIR, { recursive: true, force: true })
console.log('done')
