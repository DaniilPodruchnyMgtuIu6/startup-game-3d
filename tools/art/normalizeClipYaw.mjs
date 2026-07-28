// 18H: straightens a mount clip's body yaw. The Meshy 'Jump_and_Hang_on_Bar'
// action twists the torso during the leap, so the character lands on the bar
// DIAGONALLY - one hand well past the crossbar, one short («попадает одной
// рукой»). This measures the Hips' final world yaw and bakes a linear
// counter-yaw ramp into the hips ROTATION track (frame 0 untouched, final
// frame fully squared up to face -Z... i.e. yaw 0 relative to the clip's
// authored forward). Companion to liftClipToHandHeight/
// normalizeClipForwardTravel - same in-place GLB surgery, rotation axis.
//
// Usage: node tools/art/normalizeClipYaw.mjs <clip.glb>
import { readFileSync, writeFileSync } from 'node:fs'

function readGlb(file) {
  const buf = readFileSync(file)
  const jsonLength = buf.readUInt32LE(12)
  const json = JSON.parse(buf.subarray(20, 20 + jsonLength).toString('utf8'))
  const bin = buf.subarray(20 + jsonLength + 8)
  return { json, bin }
}
const qmul = (a, b) => [
  a[3] * b[0] + a[0] * b[3] + a[1] * b[2] - a[2] * b[1],
  a[3] * b[1] - a[0] * b[2] + a[1] * b[3] + a[2] * b[0],
  a[3] * b[2] + a[0] * b[1] - a[1] * b[0] + a[2] * b[3],
  a[3] * b[3] - a[0] * b[0] - a[1] * b[1] - a[2] * b[2],
]
const qinv = (q) => [-q[0], -q[1], -q[2], q[3]]
const vrot = (q, v) => {
  const u = [q[0], q[1], q[2]]
  const s = q[3]
  const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]
  const c1 = cross(u, v)
  const c2 = cross(u, c1)
  return [v[0] + 2 * (s * c1[0] + c2[0]), v[1] + 2 * (s * c1[1] + c2[1]), v[2] + 2 * (s * c1[2] + c2[2])]
}
const yawQuat = (angle) => [0, Math.sin(angle / 2), 0, Math.cos(angle / 2)]

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

export function normalizeClipYaw(file) {
  const { json, bin } = readGlb(file)
  const nodes = json.nodes
  const parent = new Array(nodes.length).fill(-1)
  nodes.forEach((n, i) => (n.children ?? []).forEach((c) => (parent[c] = i)))
  const find = (suffix) => nodes.findIndex((n) => n.name === suffix || n.name?.endsWith(':' + suffix))
  const hipsIdx = find('Hips')

  // parent chain world rotation at REST (parents of Hips are not animated)
  let parentWorld = [0, 0, 0, 1]
  const chain = []
  for (let p = parent[hipsIdx]; p !== -1; p = parent[p]) chain.unshift(p)
  for (const i of chain) parentWorld = qmul(parentWorld, nodes[i].rotation ?? [0, 0, 0, 1])

  const anim = json.animations[0]
  const hipsChannel = anim.channels.find((c) => c.target.node === hipsIdx && c.target.path === 'rotation')
  if (!hipsChannel) throw new Error('no hips rotation track')
  const sampler = anim.samplers[hipsChannel.sampler]
  const times = readFloats(json, bin, sampler.input)
  const lastTime = times[times.length - 1] || 1
  const acc = json.accessors[sampler.output]
  const bv = json.bufferViews[acc.bufferView]
  const start = (bv.byteOffset ?? 0) + (acc.byteOffset ?? 0)
  const outBuf = Buffer.from(bin)

  // final world yaw of the hips forward axis
  const readQuat = (i) => [
    outBuf.readFloatLE(start + (i * 4 + 0) * 4),
    outBuf.readFloatLE(start + (i * 4 + 1) * 4),
    outBuf.readFloatLE(start + (i * 4 + 2) * 4),
    outBuf.readFloatLE(start + (i * 4 + 3) * 4),
  ]
  const finalWorld = qmul(parentWorld, readQuat(acc.count - 1))
  const fwd = vrot(finalWorld, [0, 0, 1])
  const finalYaw = Math.atan2(fwd[0], fwd[2])

  // bake: local'(t) = P^-1 * Yaw(-finalYaw * t/T) * P * local(t)
  const pInv = qinv(parentWorld)
  for (let i = 0; i < acc.count; i++) {
    const w = (times[Math.min(i, times.length - 1)] ?? lastTime) / lastTime
    const corr = qmul(pInv, qmul(yawQuat(-finalYaw * w), parentWorld))
    const q = qmul(corr, readQuat(i))
    for (let c = 0; c < 4; c++) outBuf.writeFloatLE(q[c], start + (i * 4 + c) * 4)
  }

  const orig = readFileSync(file)
  const jsonLength = orig.readUInt32LE(12)
  const binChunkStart = 20 + jsonLength + 8
  const out = Buffer.concat([orig.subarray(0, binChunkStart), outBuf, orig.subarray(binChunkStart + outBuf.length)])
  writeFileSync(file, out)
  return { finalYawDeg: Math.round((finalYaw * 180) / Math.PI) }
}

const [file] = process.argv.slice(2)
if (file) console.log(file, JSON.stringify(normalizeClipYaw(file)))
