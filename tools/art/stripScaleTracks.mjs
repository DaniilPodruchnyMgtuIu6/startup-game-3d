// 18H Wave 1 (§9): remove SCALE tracks from a GLB's animations. Meshy bakes
// per-bone scale channels (up to ±17.6%) into its idle clips; our retargeted
// clips animate rotation/translation only, so a crossfade out of idle leaves
// bones at whatever scale the idle last wrote - the "model grows in dialogue"
// P1 bug. Channels are dropped (samplers/accessors stay as dead weight - tiny
// and valid glTF); node rest scale is untouched, so the canonical transform
// is exactly the bind pose.
// Usage: node tools/art/stripScaleTracks.mjs <char>/idle.glb ...
import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const CHAR_DIR = join(process.cwd(), 'public', 'character')

function strip(file) {
  const buf = readFileSync(file)
  const jsonLength = buf.readUInt32LE(12)
  const json = JSON.parse(buf.subarray(20, 20 + jsonLength).toString('utf8'))
  const binStart = 20 + jsonLength
  const bin = buf.subarray(binStart + 8, binStart + 8 + buf.readUInt32LE(binStart))

  let removed = 0
  for (const anim of json.animations ?? []) {
    const before = anim.channels.length
    anim.channels = anim.channels.filter((ch) => ch.target?.path !== 'scale')
    removed += before - anim.channels.length
  }
  if (!removed) {
    console.log(`${file.split(/[\\/]/).slice(-2).join('/')}: no scale tracks`)
    return
  }
  let jsonBuf = Buffer.from(JSON.stringify(json), 'utf8')
  while (jsonBuf.length % 4 !== 0) jsonBuf = Buffer.concat([jsonBuf, Buffer.from(' ')])
  let binBuf = Buffer.from(bin)
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
  console.log(`${file.split(/[\\/]/).slice(-2).join('/')}: removed ${removed} scale channels`)
}

for (const rel of process.argv.slice(2)) strip(join(CHAR_DIR, rel))
console.log('STRIP_DONE')
