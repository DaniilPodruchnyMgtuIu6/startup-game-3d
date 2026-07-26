// Feature 18C §2: retarget an animation-only GLB clip from one Mixamo rig to
// another. All project rigs share the same bone TOPOLOGY but carry a per-
// character name prefix (mixamorig:, mixamorig2:, mixamorig7:, ...), so a clip
// transfers by (1) renaming the prefix on every node, (2) dropping channels for
// bones the target skeleton lacks (e.g. finger bones going 144->111), and
// (3) scaling the Hips translation track by the rigs' hip-height ratio
// (project rigs differ by <=6%). Pure JSON+BIN surgery - no three.js.
//
// Usage:
//   node tools/art/retargetClip.mjs <srcChar>/<clip>.glb <dstChar> [outClipName]
//   node tools/art/retargetClip.mjs --batch   (regenerates every 18C clip)
import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const ROOT = process.cwd()
const CHAR_DIR = join(ROOT, 'public', 'character')

function readGlb(file) {
  const buf = readFileSync(file)
  if (buf.readUInt32LE(0) !== 0x46546c67) throw new Error(`${file}: not a GLB`)
  const jsonLength = buf.readUInt32LE(12)
  const json = JSON.parse(buf.subarray(20, 20 + jsonLength).toString('utf8'))
  // BIN chunk (if present) follows the JSON chunk: [length][type 'BIN\0'][data]
  const binHeader = 20 + jsonLength
  let bin = Buffer.alloc(0)
  if (binHeader < buf.length) {
    const binLength = buf.readUInt32LE(binHeader)
    bin = Buffer.from(buf.subarray(binHeader + 8, binHeader + 8 + binLength))
  }
  return { json, bin }
}

function writeGlb(file, json, bin) {
  let jsonBuf = Buffer.from(JSON.stringify(json), 'utf8')
  while (jsonBuf.length % 4 !== 0) jsonBuf = Buffer.concat([jsonBuf, Buffer.from(' ')])
  let binBuf = bin
  while (binBuf.length % 4 !== 0) binBuf = Buffer.concat([binBuf, Buffer.alloc(1)])
  const total = 12 + 8 + jsonBuf.length + (binBuf.length ? 8 + binBuf.length : 0)
  const out = Buffer.alloc(total)
  out.writeUInt32LE(0x46546c67, 0)
  out.writeUInt32LE(2, 4)
  out.writeUInt32LE(total, 8)
  out.writeUInt32LE(jsonBuf.length, 12)
  out.writeUInt32LE(0x4e4f534a, 16) // 'JSON'
  jsonBuf.copy(out, 20)
  if (binBuf.length) {
    const at = 20 + jsonBuf.length
    out.writeUInt32LE(binBuf.length, at)
    out.writeUInt32LE(0x004e4942, at + 4) // 'BIN\0'
    binBuf.copy(out, at + 8)
  }
  writeFileSync(file, out)
  return total
}

// The rig prefix is whatever precedes ':' on the Hips bone ('' when unprefixed).
function rigPrefix(json) {
  const hips = (json.nodes ?? []).find((n) => n.name && /Hips$/.test(n.name))
  if (!hips) throw new Error('no Hips bone found')
  const idx = hips.name.indexOf(':')
  return idx === -1 ? '' : hips.name.slice(0, idx + 1)
}

function hipsHeight(json) {
  const hips = (json.nodes ?? []).find((n) => n.name && /Hips$/.test(n.name))
  return hips?.translation?.[1] ?? 1
}

export function retargetClip(srcFile, dstIdleFile, outFile, clipName) {
  const src = readGlb(srcFile)
  const dstIdle = readGlb(dstIdleFile).json
  const srcPrefix = rigPrefix(src.json)
  const dstPrefix = rigPrefix(dstIdle)
  const dstBones = new Set((dstIdle.nodes ?? []).map((n) => n.name).filter(Boolean))
  const scale = hipsHeight(dstIdle) / hipsHeight(src.json)

  // 1) rename every node onto the destination rig's prefix
  for (const node of src.json.nodes ?? []) {
    if (node.name && node.name.startsWith(srcPrefix)) {
      node.name = dstPrefix + node.name.slice(srcPrefix.length)
    }
  }

  // 2) drop channels whose (renamed) target bone the destination lacks.
  // Samplers/accessors stay in place - channels reference them by index, and
  // unused samplers are valid glTF (just dead weight in an already tiny file).
  const anim = src.json.animations?.[0]
  if (!anim) throw new Error(`${srcFile}: no animation`)
  const nodes = src.json.nodes ?? []
  const before = anim.channels.length
  anim.channels = anim.channels.filter((ch) => {
    const name = nodes[ch.target?.node]?.name
    return name !== undefined && dstBones.has(name)
  })
  anim.name = clipName

  // 3) scale every surviving translation track (in practice only Hips carries
  // one) by the hip-height ratio, patching floats in the BIN chunk in place.
  let scaledTracks = 0
  for (const ch of anim.channels) {
    if (ch.target.path !== 'translation') continue
    const sampler = anim.samplers[ch.sampler]
    const accessor = src.json.accessors[sampler.output]
    const view = src.json.bufferViews[accessor.bufferView]
    const start = (view.byteOffset ?? 0) + (accessor.byteOffset ?? 0)
    for (let i = 0; i < accessor.count * 3; i++) {
      src.bin.writeFloatLE(src.bin.readFloatLE(start + i * 4) * scale, start + i * 4)
    }
    if (accessor.min) accessor.min = accessor.min.map((v) => v * scale)
    if (accessor.max) accessor.max = accessor.max.map((v) => v * scale)
    scaledTracks++
  }

  const total = writeGlb(outFile, src.json, src.bin)
  return { channels: anim.channels.length, dropped: before - anim.channels.length, scaledTracks, scale, bytes: total }
}

// --- batch: the 18C clip transfers -----------------------------------------
const BATCH = [
  // real sit-down transition for every NPC (source: the player's sit)
  ['business_man/sit.glb', 'female_pm', 'sit'],
  ['business_man/sit.glb', 'kirill_morozov', 'sit'],
  ['business_man/sit.glb', 'alina_belova', 'sit'],
  ['business_man/sit.glb', 'cybersecurity', 'sit'],
  // looking/inspection for the whole team + player (source: guard's look)
  ['security_1/look.glb', 'business_man', 'look'],
  ['security_1/look.glb', 'female_pm', 'look'],
  ['security_1/look.glb', 'kirill_morozov', 'look'],
  ['security_1/look.glb', 'alina_belova', 'look'],
  ['security_1/look.glb', 'cybersecurity', 'look'],
  // replace the 0-second static sofaSit placeholders (source: Kirill's real clip)
  ['kirill_morozov/sofaSit.glb', 'business_man', 'sofaSit'],
  ['kirill_morozov/sofaSit.glb', 'cybersecurity', 'sofaSit'],
]

const args = process.argv.slice(2)
if (args[0] === '--batch') {
  for (const [srcRel, dstChar, clip] of BATCH) {
    const out = join(CHAR_DIR, dstChar, `${clip}.glb`)
    const r = retargetClip(join(CHAR_DIR, srcRel), join(CHAR_DIR, dstChar, 'idle.glb'), out, clip)
    console.log(
      `${srcRel} -> ${dstChar}/${clip}.glb: ${r.channels} channels (${r.dropped} dropped), hips x${r.scale.toFixed(3)}, ${Math.round(r.bytes / 1024)} KB`,
    )
  }
} else if (args.length >= 2) {
  const [srcRel, dstChar, outClip] = args
  const clip = outClip ?? srcRel.split('/').pop().replace('.glb', '')
  const out = join(CHAR_DIR, dstChar, `${clip}.glb`)
  const r = retargetClip(join(CHAR_DIR, srcRel), join(CHAR_DIR, dstChar, 'idle.glb'), out, clip)
  console.log(`${srcRel} -> ${dstChar}/${clip}.glb:`, r)
}
