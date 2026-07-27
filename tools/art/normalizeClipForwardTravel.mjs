// 18H: normalizes a mount clip's FORWARD root travel so the hands' mean final
// Z lands exactly at the furniture contact plane (the pull-up crossbar sits
// `targetHandZ` metres in front of the stand point). Companion to
// liftClipToHandHeight.mjs (same GLB surgery, different axis): instead of a
// constant offset (which would also shift the standing FIRST frame and pop
// the character backward at clip start), the correction is a LINEAR RAMP over
// the clip time - frame 0 unchanged, final frame fully corrected. The jump
// simply travels the difference; no scale anywhere (§11/§27).
//
// Usage: node tools/art/normalizeClipForwardTravel.mjs <clip.glb> <targetHandZ>
import { readFileSync, writeFileSync } from 'node:fs'

function readGlb(file) {
  const buf = readFileSync(file)
  const jsonLength = buf.readUInt32LE(12)
  const json = JSON.parse(buf.subarray(20, 20 + jsonLength).toString('utf8'))
  const bin = buf.subarray(20 + jsonLength + 8)
  return { json, bin }
}
function readFloats(json, bin, accessorIdx) {
  const acc = json.accessors[accessorIdx]
  const bv = json.bufferViews[acc.bufferView]
  const start = (bv.byteOffset ?? 0) + (acc.byteOffset ?? 0)
  const compCount = { SCALAR: 1, VEC3: 3, VEC4: 4 }[acc.type]
  const out = []
  for (let i = 0; i < acc.count; i++) {
    const row = []
    for (let c = 0; c < compCount; c++) row.push(bin.readFloatLE(start + (i * compCount + c) * 4))
    out.push(compCount === 1 ? row[0] : row)
  }
  return out
}
const qmul = (a, b) => [
  a[3] * b[0] + a[0] * b[3] + a[1] * b[2] - a[2] * b[1],
  a[3] * b[1] - a[0] * b[2] + a[1] * b[3] + a[2] * b[0],
  a[3] * b[2] + a[0] * b[1] - a[1] * b[0] + a[2] * b[3],
  a[3] * b[3] - a[0] * b[0] - a[1] * b[1] - a[2] * b[2],
]
const vrot = (q, v) => {
  const u = [q[0], q[1], q[2]]
  const s = q[3]
  const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]
  const c1 = cross(u, v)
  const c2 = cross(u, c1)
  return [v[0] + 2 * (s * c1[0] + c2[0]), v[1] + 2 * (s * c1[1] + c2[1]), v[2] + 2 * (s * c1[2] + c2[2])]
}

// FK at the LAST frame: mean hand world Z + the Hips parent scale (same
// cm-rig caveat as liftClipToHandHeight.mjs).
function worldHandZ(json, bin) {
  const nodes = json.nodes
  const parent = new Array(nodes.length).fill(-1)
  nodes.forEach((n, i) => (n.children ?? []).forEach((c) => (parent[c] = i)))
  const anim = json.animations[0]
  const localRot = nodes.map((n) => n.rotation ?? [0, 0, 0, 1])
  const localTra = nodes.map((n) => n.translation ?? [0, 0, 0])
  for (const ch of anim.channels) {
    const values = readFloats(json, bin, anim.samplers[ch.sampler].output)
    const last = values[values.length - 1]
    if (ch.target.path === 'rotation') localRot[ch.target.node] = last
    if (ch.target.path === 'translation') localTra[ch.target.node] = last
  }
  const worldP = new Array(nodes.length)
  const worldR = new Array(nodes.length)
  const worldS = new Array(nodes.length)
  const order = []
  const visit = (i) => {
    order.push(i)
    for (const c of nodes[i].children ?? []) visit(c)
  }
  for (let i = 0; i < nodes.length; i++) if (parent[i] === -1) visit(i)
  for (const i of order) {
    const p = parent[i]
    const pr = p === -1 ? [0, 0, 0, 1] : worldR[p]
    const pp = p === -1 ? [0, 0, 0] : worldP[p]
    const ps = p === -1 ? 1 : worldS[p]
    const t = localTra[i].map((v) => v * ps)
    const off = vrot(pr, t)
    worldP[i] = [pp[0] + off[0], pp[1] + off[1], pp[2] + off[2]]
    worldR[i] = qmul(pr, localRot[i])
    worldS[i] = ps * (nodes[i].scale?.[0] ?? 1)
  }
  const findBone = (suffix) => nodes.findIndex((n) => n.name === suffix || n.name?.endsWith(':' + suffix))
  const li = findBone('LeftHand')
  const ri = findBone('RightHand')
  const hipsIdx = findBone('Hips')
  const hipsParentScale = parent[hipsIdx] === -1 ? 1 : worldS[parent[hipsIdx]]
  return { handZ: (worldP[li][2] + worldP[ri][2]) / 2, hipsIdx, hipsParentScale }
}

export function normalizeClipForwardTravel(file, targetHandZ) {
  const { json, bin } = readGlb(file)
  const { handZ: currentHandZ, hipsIdx, hipsParentScale } = worldHandZ(json, bin)
  const deltaZ = targetHandZ - currentHandZ
  const localDeltaZ = deltaZ / hipsParentScale

  const anim = json.animations[0]
  const hipsChannel = anim.channels.find((c) => c.target.node === hipsIdx && c.target.path === 'translation')
  const sampler = anim.samplers[hipsChannel.sampler]
  const times = readFloats(json, bin, sampler.input)
  const lastTime = times[times.length - 1] || 1
  const acc = json.accessors[sampler.output]
  const bv = json.bufferViews[acc.bufferView]
  const start = (bv.byteOffset ?? 0) + (acc.byteOffset ?? 0)
  const outBuf = Buffer.from(bin)
  for (let i = 0; i < acc.count; i++) {
    const zOffset = start + (i * 3 + 2) * 4
    const z = outBuf.readFloatLE(zOffset)
    outBuf.writeFloatLE(z + localDeltaZ * (times[i] / lastTime), zOffset)
  }

  const orig = readFileSync(file)
  const jsonLength = orig.readUInt32LE(12)
  const binChunkStart = 20 + jsonLength + 8
  const out = Buffer.concat([orig.subarray(0, binChunkStart), outBuf, orig.subarray(binChunkStart + outBuf.length)])
  writeFileSync(file, out)
  return { currentHandZ, targetHandZ, deltaZ, hipsParentScale }
}

const [file, targetZ] = process.argv.slice(2)
if (file) {
  const r = normalizeClipForwardTravel(file, Number(targetZ))
  console.log(
    `${file}: mean hand z was ${r.currentHandZ.toFixed(3)}, ramped world-z by ${r.deltaZ.toFixed(3)} ` +
      `(track scale ${r.hipsParentScale}) to end at z=${r.targetHandZ}`,
  )
}
