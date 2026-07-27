// 18G §1: shrink embedded GLB textures. Opaque PNG atlases become JPEG q85
// (3-4x smaller, no visual delta at game distances); images WITH alpha (hair
// cards) stay PNG (recompressed). Rebuilds the BIN chunk with fresh offsets.
// glTF allows image/jpeg for any texture source, so only mimeType changes.
// Usage: node tools/art/optimizeGlbTextures.mjs <char>/idle.glb ...
import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { createRequire } from 'node:module'

const sharp = createRequire(join(process.cwd(), 'package.json'))('sharp')
const CHAR_DIR = join(process.cwd(), 'public', 'character')

async function optimize(file) {
  const buf = readFileSync(file)
  const jsonLength = buf.readUInt32LE(12)
  const json = JSON.parse(buf.subarray(20, 20 + jsonLength).toString('utf8'))
  const binStart = 20 + jsonLength
  const bin = buf.subarray(binStart + 8, binStart + 8 + buf.readUInt32LE(binStart))

  const imageOfView = new Map()
  ;(json.images ?? []).forEach((im, i) => imageOfView.set(im.bufferView, i))
  const pieces = []
  for (let i = 0; i < (json.bufferViews ?? []).length; i++) {
    const view = json.bufferViews[i]
    const bytes = Buffer.from(bin.subarray(view.byteOffset ?? 0, (view.byteOffset ?? 0) + view.byteLength))
    if (imageOfView.has(i)) {
      const meta = await sharp(bytes).metadata()
      if (meta.hasAlpha) {
        pieces.push(await sharp(bytes).png({ compressionLevel: 9, palette: false }).toBuffer())
      } else {
        pieces.push(await sharp(bytes).jpeg({ quality: 85, mozjpeg: true }).toBuffer())
        json.images[imageOfView.get(i)].mimeType = 'image/jpeg'
      }
    } else {
      pieces.push(bytes)
    }
  }
  let offset = 0
  const chunks = []
  pieces.forEach((piece, i) => {
    const view = json.bufferViews[i]
    view.byteOffset = offset
    view.byteLength = piece.length
    chunks.push(piece)
    offset += piece.length
    const pad = (4 - (offset % 4)) % 4
    if (pad) {
      chunks.push(Buffer.alloc(pad))
      offset += pad
    }
  })
  const newBin = Buffer.concat(chunks)
  json.buffers[0].byteLength = newBin.length

  let jsonBuf = Buffer.from(JSON.stringify(json), 'utf8')
  while (jsonBuf.length % 4 !== 0) jsonBuf = Buffer.concat([jsonBuf, Buffer.from(' ')])
  let binBuf = newBin
  while (binBuf.length % 4 !== 0) binBuf = Buffer.concat([binBuf, Buffer.alloc(1)])
  const total = 12 + 8 + jsonBuf.length + 8 + binBuf.length
  const out = Buffer.alloc(total)
  out.writeUInt32LE(0x46546c67, 0)
  out.writeUInt32LE(2, 4)
  out.writeUInt32LE(total, 8)
  out.writeUInt32LE(jsonBuf.length, 12)
  out.writeUInt32LE(0x4e4f534a, 16)
  jsonBuf.copy(out, 20)
  const at = 20 + jsonBuf.length
  out.writeUInt32LE(binBuf.length, at)
  out.writeUInt32LE(0x004e4942, at + 4)
  binBuf.copy(out, at + 8)
  writeFileSync(file, out)
  console.log(`${file.split(/[\\/]/).slice(-2).join('/')}: ${Math.round(buf.length / 1024)} KB -> ${Math.round(total / 1024)} KB`)
}

for (const rel of process.argv.slice(2)) {
  await optimize(join(CHAR_DIR, rel))
}
console.log('OPTIMIZE_DONE')
