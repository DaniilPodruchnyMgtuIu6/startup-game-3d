// Model-fix pass: multiply the root (Armature) scale of a v2 idle.glb by a
// calibration factor (line-up against the player model), then re-retarget the
// whole clip library from the Mixamo backup so hips heights and furniture
// alignment follow the new size (heightRatio recomputes automatically).
// Usage: node tools/art/rescaleCharacter.mjs <charFolder> <factor>
import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { retargetMeshyClip } from './retargetMeshyClip.mjs'

const ROOT = process.cwd()
const CHAR_DIR = join(ROOT, 'public', 'character')

const [charFolder, factorArg] = process.argv.slice(2)
const factor = Number(factorArg)
if (!charFolder || !Number.isFinite(factor)) {
  console.error('usage: node tools/art/rescaleCharacter.mjs <charFolder> <factor>')
  process.exit(1)
}

const idlePath = join(CHAR_DIR, charFolder, 'idle.glb')
const buf = readFileSync(idlePath)
const jsonLength = buf.readUInt32LE(12)
const json = JSON.parse(buf.subarray(20, 20 + jsonLength).toString('utf8'))
const binStart = 20 + jsonLength
const bin = buf.subarray(binStart + 8, binStart + 8 + buf.readUInt32LE(binStart))

// the scaled root is the ancestor node carrying the unit conversion (~0.01)
const nodes = json.nodes ?? []
const isChild = new Set()
nodes.forEach((n) => (n.children ?? []).forEach((c) => isChild.add(c)))
const root = nodes.findIndex((n, i) => !isChild.has(i) && n.scale)
if (root === -1) throw new Error('no scaled root node found')
nodes[root].scale = nodes[root].scale.map((v) => v * factor)
console.log(`${charFolder}: root '${nodes[root].name}' scale x${factor} -> [${nodes[root].scale.map((v) => v.toFixed(5)).join(', ')}]`)

// write back
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
writeFileSync(idlePath, out)

// re-retarget every clip against the rescaled skeleton
const backupDir = join(ROOT, 'assets', 'source', 'models-mixamo-backup', charFolder)
const CLIPS = ['walk', 'sit', 'type', 'drink', 'sitIdle', 'sofaSit', 'talk', 'look', 'agree', 'celebrate', 'explain', 'facepalm']
for (const clip of CLIPS) {
  const src = join(backupDir, `${clip}.glb`)
  if (!existsSync(src)) continue
  const r = retargetMeshyClip(src, idlePath, join(CHAR_DIR, charFolder, `${clip}.glb`), clip)
  console.log(`  ${clip}: x${r.heightRatio}`)
}
console.log('RESCALE_DONE')
