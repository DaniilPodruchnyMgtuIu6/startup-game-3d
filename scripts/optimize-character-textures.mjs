// Feature 15 perf: character idle GLBs shipped 4096² uncompressed textures
// (46–91 MB each), exhausting GPU memory → WebGLRenderer context loss + lag.
// This downsizes every texture to at most 1024² (16× less GPU memory) and
// dedups/prunes, without touching geometry or animations. Run on the exported
// GLBs; also wired into convert-character.mjs for future re-exports.
import { NodeIO } from '@gltf-transform/core'
import { ALL_EXTENSIONS } from '@gltf-transform/extensions'
import { dedup, prune, textureCompress } from '@gltf-transform/functions'
import sharp from 'sharp'

const MAX = 1024
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS)

for (const f of process.argv.slice(2)) {
  const doc = await io.read(f)
  await doc.transform(
    dedup(),
    prune(),
    // keep each texture's original format (png/jpeg) — just downscale
    textureCompress({ encoder: sharp, resize: [MAX, MAX] }),
  )
  await io.write(f, doc)
}
console.log('done')
