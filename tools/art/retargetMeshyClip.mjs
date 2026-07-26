// Feature 18C §2: full world-space retarget of a Higgsfield/Meshy auto-rigged
// animation (3d_rigging, cdn.meshy.ai actions) onto the project's Mixamo rigs.
//
// Unlike retargetClip.mjs (same topology, prefix rename), the Meshy rig has
// DIFFERENT bind-pose joint orientations and units (cm vs m), so rotation
// tracks cannot be copied. Instead, both rigs were built around the SAME
// character standing in the same world pose, which makes the classic
// world-delta transfer exact:
//   worldRot_dst(t)[b] = worldRot_src(t)[b] * inv(worldRestRot_src[b]) * worldRestRot_dst[b]
//   local_dst(t)[b]    = inv(worldRot_dst(t)[parent]) * worldRot_dst(t)[b]
// Hips translation transfers as a world-space delta from rest, scaled by the
// rigs' hip-height ratio. Bones the source does not animate (fingers, etc.)
// get a static rest track so a crossfade cannot leave them in a stale pose.
//
// Usage:
//   node tools/art/retargetMeshyClip.mjs <meshy.glb> <dstChar> <clipName> [--max-sec N]
//   node tools/art/retargetMeshyClip.mjs --batch <scratchDir>
import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const ROOT = process.cwd()
const CHAR_DIR = join(ROOT, 'public', 'character')

// Meshy bone name -> canonical Mixamo name (identical names pass through).
const NAME_MAP = { Spine01: 'Spine1', Spine02: 'Spine2', neck: 'Neck' }

// ---------- quaternion helpers ([x,y,z,w]) ----------
const qmul = (a, b) => [
  a[3] * b[0] + a[0] * b[3] + a[1] * b[2] - a[2] * b[1],
  a[3] * b[1] - a[0] * b[2] + a[1] * b[3] + a[2] * b[0],
  a[3] * b[2] + a[0] * b[1] - a[1] * b[0] + a[2] * b[3],
  a[3] * b[3] - a[0] * b[0] - a[1] * b[1] - a[2] * b[2],
]
const qinv = (q) => [-q[0], -q[1], -q[2], q[3]]
function qnorm(q) {
  const l = Math.hypot(q[0], q[1], q[2], q[3]) || 1
  return [q[0] / l, q[1] / l, q[2] / l, q[3] / l]
}
function qlerp(a, b, t) {
  const dot = a[0] * b[0] + a[1] * b[1] + a[2] * b[2] + a[3] * b[3]
  const s = dot < 0 ? -1 : 1
  return qnorm([a[0] + (s * b[0] - a[0]) * t, a[1] + (s * b[1] - a[1]) * t, a[2] + (s * b[2] - a[2]) * t, a[3] + (s * b[3] - a[3]) * t])
}
const vrot = (q, v) => {
  // rotate vector by quaternion
  const u = [q[0], q[1], q[2]]
  const s = q[3]
  const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]
  const dot = u[0] * v[0] + u[1] * v[1] + u[2] * v[2]
  const c1 = cross(u, v)
  const c2 = cross(u, c1)
  return [v[0] + 2 * (s * c1[0] + c2[0]), v[1] + 2 * (s * c1[1] + c2[1]), v[2] + 2 * (s * c1[2] + c2[2])]
}

// ---------- GLB IO ----------
function readGlb(file) {
  const buf = readFileSync(file)
  if (buf.readUInt32LE(0) !== 0x46546c67) throw new Error(`${file}: not a GLB`)
  const jsonLength = buf.readUInt32LE(12)
  const json = JSON.parse(buf.subarray(20, 20 + jsonLength).toString('utf8'))
  const binHeader = 20 + jsonLength
  let bin = Buffer.alloc(0)
  if (binHeader < buf.length) {
    const binLength = buf.readUInt32LE(binHeader)
    bin = buf.subarray(binHeader + 8, binHeader + 8 + binLength)
  }
  return { json, bin }
}

function writeGlb(file, json, bin) {
  let jsonBuf = Buffer.from(JSON.stringify(json), 'utf8')
  while (jsonBuf.length % 4 !== 0) jsonBuf = Buffer.concat([jsonBuf, Buffer.from(' ')])
  let binBuf = bin
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
  return total
}

function readAccessor(gltf, bin, index) {
  const accessor = gltf.accessors[index]
  const view = gltf.bufferViews[accessor.bufferView]
  const start = (view.byteOffset ?? 0) + (accessor.byteOffset ?? 0)
  const comps = { SCALAR: 1, VEC3: 3, VEC4: 4 }[accessor.type]
  const out = new Array(accessor.count)
  for (let i = 0; i < accessor.count; i++) {
    const v = new Array(comps)
    for (let c = 0; c < comps; c++) v[c] = bin.readFloatLE(start + (i * comps + c) * 4)
    out[i] = comps === 1 ? v[0] : v
  }
  return out
}

// ---------- rig model ----------
function buildRig({ json, bin }) {
  const nodes = json.nodes ?? []
  const parent = new Array(nodes.length).fill(-1)
  nodes.forEach((n, i) => (n.children ?? []).forEach((c) => (parent[c] = i)))
  const rest = nodes.map((n) => ({
    t: n.translation ?? [0, 0, 0],
    r: n.rotation ?? [0, 0, 0, 1],
    s: n.scale ?? [1, 1, 1],
  }))
  // world rest rotation + position via FK (uniform scale assumed per node)
  const worldR = new Array(nodes.length)
  const worldP = new Array(nodes.length)
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
    const off = vrot(pr, rest[i].t.map((v) => v * ps))
    worldP[i] = [pp[0] + off[0], pp[1] + off[1], pp[2] + off[2]]
    worldR[i] = qnorm(qmul(pr, rest[i].r))
    worldS[i] = ps * rest[i].s[0]
  }
  const byName = {}
  nodes.forEach((n, i) => {
    if (n.name) byName[n.name] = i
  })
  return { json, bin, nodes, parent, rest, worldR, worldP, worldS, order, byName }
}

const canonical = (name) => NAME_MAP[name] ?? name.replace(/^mixamorig\d*:/, '')

// sample a track (times[], values[]) at time t with linear/quat interpolation
function sampleTrack(times, values, t, isQuat) {
  if (t <= times[0]) return values[0]
  if (t >= times[times.length - 1]) return values[values.length - 1]
  let i = 1
  while (times[i] < t) i++
  const f = (t - times[i - 1]) / (times[i] - times[i - 1])
  const a = values[i - 1]
  const b = values[i]
  if (isQuat) return qlerp(a, b, f)
  return a.map((v, c) => v + (b[c] - v) * f)
}

export function retargetMeshyClip(meshyFile, dstIdleFile, outFile, clipName, maxSec = Infinity) {
  const src = buildRig(readGlb(meshyFile))
  const dst = buildRig(readGlb(dstIdleFile))

  // source animation tracks per node index
  const anim = src.json.animations?.[0]
  if (!anim) throw new Error(`${meshyFile}: no animation`)
  const rotTracks = new Map()
  const posTracks = new Map()
  for (const ch of anim.channels) {
    const sampler = anim.samplers[ch.sampler]
    const times = readAccessor(src.json, src.bin, sampler.input)
    const values = readAccessor(src.json, src.bin, sampler.output)
    if (ch.target.path === 'rotation') rotTracks.set(ch.target.node, { times, values })
    if (ch.target.path === 'translation') posTracks.set(ch.target.node, { times, values })
  }

  // timeline: densest rotation track, clipped to maxSec
  let master = []
  for (const { times } of rotTracks.values()) if (times.length > master.length) master = times
  const timeline = master.filter((t) => t <= maxSec)
  if (timeline.length < 2) throw new Error('timeline too short')
  const t0 = timeline[0]

  // map dst skeleton bones <-> src nodes by canonical name
  const srcByCanonical = {}
  src.nodes.forEach((n, i) => {
    if (n.name) srcByCanonical[canonical(n.name)] = i
  })
  // union of every skin's joints - converted Mixamo GLBs carry one skin per
  // mesh primitive group, each binding only a subset of the skeleton
  const jointSet = new Set()
  for (const skin of dst.json.skins ?? []) for (const j of skin.joints ?? []) jointSet.add(j)
  const joints = jointSet.size ? [...jointSet] : dst.order.filter((i) => dst.nodes[i].name)
  const hipsDst = joints.find((i) => /Hips$/.test(dst.nodes[i].name ?? ''))
  const hipsSrc = srcByCanonical['Hips']
  if (hipsDst === undefined || hipsSrc === undefined) throw new Error('no Hips')
  const heightRatio = dst.worldP[hipsDst][1] / (src.worldP[hipsSrc][1] || 1)

  // per frame: FK source world rotations, then solve dst locals top-down
  const outRot = new Map(joints.map((j) => [j, []]))
  const outPos = []
  const srcLocalAt = (i, t) => {
    const track = rotTracks.get(i)
    return track ? sampleTrack(track.times, track.values, t, true) : src.rest[i].r
  }
  for (const t of timeline) {
    const srcWorld = new Array(src.nodes.length)
    for (const i of src.order) {
      const p = src.parent[i]
      srcWorld[i] = qnorm(qmul(p === -1 ? [0, 0, 0, 1] : srcWorld[p], srcLocalAt(i, t)))
    }
    const dstWorld = new Array(dst.nodes.length)
    for (const i of dst.order) {
      const p = dst.parent[i]
      const parentWorld = p === -1 ? [0, 0, 0, 1] : dstWorld[p]
      const name = dst.nodes[i].name ? canonical(dst.nodes[i].name) : undefined
      const s = name !== undefined ? srcByCanonical[name] : undefined
      let local
      if (s !== undefined && rotTracks.has(s)) {
        const want = qnorm(qmul(qmul(srcWorld[s], qinv(src.worldR[s])), dst.worldR[i]))
        local = qnorm(qmul(qinv(parentWorld), want))
      } else {
        local = dst.rest[i].r
      }
      dstWorld[i] = qnorm(qmul(parentWorld, local))
      if (outRot.has(i)) outRot.get(i).push(local)
    }
    // hips translation: world delta from rest, scaled, into dst hips-parent frame
    const track = posTracks.get(hipsSrc)
    const lp = track ? sampleTrack(track.times, track.values, t, false) : src.rest[hipsSrc].t
    const pSrc = src.parent[hipsSrc]
    const worldNow = vrot(src.worldR[pSrc] ?? [0, 0, 0, 1], lp.map((v) => v * (src.worldS[pSrc] ?? 1)))
    const worldRest = vrot(src.worldR[pSrc] ?? [0, 0, 0, 1], src.rest[hipsSrc].t.map((v) => v * (src.worldS[pSrc] ?? 1)))
    const delta = worldNow.map((v, c) => (v - worldRest[c]) * heightRatio)
    const pDst = dst.parent[hipsDst]
    const invRot = qinv(pDst === -1 ? [0, 0, 0, 1] : dst.worldR[pDst])
    const localDelta = vrot(invRot, delta).map((v) => v / (pDst === -1 ? 1 : dst.worldS[pDst] || 1))
    outPos.push(dst.rest[hipsDst].t.map((v, c) => v + localDelta[c]))
  }

  // ---------- write an animation-only GLB on the dst node hierarchy ----------
  const outNodes = dst.json.nodes.map((n) => {
    const clean = { name: n.name }
    if (n.children) clean.children = n.children
    if (n.translation) clean.translation = n.translation
    if (n.rotation) clean.rotation = n.rotation
    if (n.scale) clean.scale = n.scale
    return clean
  })
  const chunks = []
  let byteOffset = 0
  const accessors = []
  const bufferViews = []
  const pushData = (floats, type, componentsPerElement) => {
    const buf = Buffer.alloc(floats.length * 4)
    floats.forEach((v, i) => buf.writeFloatLE(v, i * 4))
    bufferViews.push({ buffer: 0, byteOffset, byteLength: buf.length })
    chunks.push(buf)
    byteOffset += buf.length
    const count = floats.length / componentsPerElement
    const accessor = { bufferView: bufferViews.length - 1, componentType: 5126, count, type }
    if (type === 'SCALAR') {
      accessor.min = [floats[0]]
      accessor.max = [floats[floats.length - 1]]
    }
    accessors.push(accessor)
    return accessors.length - 1
  }
  const timeAccessor = pushData(timeline.map((t) => t - t0), 'SCALAR', 1)
  const samplers = []
  const channels = []
  for (const [node, quats] of outRot) {
    const output = pushData(quats.flat(), 'VEC4', 4)
    samplers.push({ input: timeAccessor, output, interpolation: 'LINEAR' })
    channels.push({ sampler: samplers.length - 1, target: { node, path: 'rotation' } })
  }
  const posAccessor = pushData(outPos.flat(), 'VEC3', 3)
  samplers.push({ input: timeAccessor, output: posAccessor, interpolation: 'LINEAR' })
  channels.push({ sampler: samplers.length - 1, target: { node: hipsDst, path: 'translation' } })

  const bin = Buffer.concat(chunks)
  const json = {
    asset: { version: '2.0', generator: 'retargetMeshyClip (Startup Office 18C)' },
    scene: dst.json.scene ?? 0,
    scenes: dst.json.scenes,
    nodes: outNodes,
    animations: [{ name: clipName, samplers, channels }],
    buffers: [{ byteLength: bin.length }],
    bufferViews,
    accessors,
  }
  const total = writeGlb(outFile, json, bin)
  return {
    frames: timeline.length,
    durationSec: Math.round((timeline[timeline.length - 1] - t0) * 100) / 100,
    bones: outRot.size,
    heightRatio: Math.round(heightRatio * 1000) / 1000,
    kb: Math.round(total / 1024),
  }
}

// ---------- CLI ----------
const TEAM = ['business_man', 'female_pm', 'kirill_morozov', 'alina_belova', 'cybersecurity']
const args = process.argv.slice(2)
if (args[0] === '--batch') {
  const scratch = args[1]
  const ACTIONS = [
    ['rigged_agree.glb', 'agree'],
    ['rigged_cheer.glb', 'celebrate'],
    ['rigged_explain.glb', 'explain'],
  ]
  for (const [file, clip] of ACTIONS) {
    for (const character of TEAM) {
      const out = join(CHAR_DIR, character, `${clip}.glb`)
      const r = retargetMeshyClip(join(scratch, file), join(CHAR_DIR, character, 'idle.glb'), out, clip)
      console.log(`${file} -> ${character}/${clip}.glb: ${r.frames}f ${r.durationSec}s ${r.bones} bones x${r.heightRatio} ${r.kb} KB`)
    }
  }
} else if (args.length >= 3) {
  const [meshyFile, dstChar, clipName] = args
  const maxIdx = args.indexOf('--max-sec')
  const maxSec = maxIdx !== -1 ? Number(args[maxIdx + 1]) : Infinity
  const out = join(CHAR_DIR, dstChar, `${clipName}.glb`)
  console.log(retargetMeshyClip(meshyFile, join(CHAR_DIR, dstChar, 'idle.glb'), out, clipName, maxSec))
}
