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
// CRITICAL: Meshy names its spine chain TOP-DOWN - the hierarchy is
// Hips -> Spine02 -> Spine01 -> Spine (which carries the shoulders/neck),
// verified by the children arrays of every v2 rig. Mixamo is BOTTOM-UP
// (Hips -> Spine -> Spine1 -> Spine2). The original map paired Spine02 with
// Spine2 and left Spine=Spine, swapping the top and bottom vertebra rotations
// on every retarget - a latent zig-zag on all rigs that turned into a full
// "paperclip" fold on the taller founder model.
const MESHY_NAME_MAP = { Spine02: 'Spine', Spine01: 'Spine1', Spine: 'Spine2', neck: 'Neck' }

// Fingerless Meshy rigs render the baked open A-pose palm ("shovel hands").
// When the DST skeleton has no finger bones, every retargeted clip gets a
// constant relaxed-wrist curl baked into the hand tracks: slight inward roll
// plus a curl toward the palm, mirrored per side.
const WRIST_RELAX = { curlX: 0.18, rollZ: 0.22 }

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
// shortest-arc rotation taking unit vector a onto unit vector b
function qFromUnitVectors(a, b) {
  const d = a[0] * b[0] + a[1] * b[1] + a[2] * b[2]
  if (d > 0.99999) return [0, 0, 0, 1]
  if (d < -0.99999) {
    // opposite: rotate 180° around any axis orthogonal to a
    const axis = Math.abs(a[0]) < 0.9 ? [1, 0, 0] : [0, 1, 0]
    const c = [a[1] * axis[2] - a[2] * axis[1], a[2] * axis[0] - a[0] * axis[2], a[0] * axis[1] - a[1] * axis[0]]
    const l = Math.hypot(...c) || 1
    return [c[0] / l, c[1] / l, c[2] / l, 0]
  }
  const c = [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]
  return qnorm([c[0], c[1], c[2], 1 + d])
}

// bone -> the child that defines its direction (both rigs, canonical names)
const DIRECTION_CHILD = {
  Hips: 'Spine', Spine: 'Spine1', Spine1: 'Spine2', Spine2: 'Neck', Neck: 'Head',
  LeftShoulder: 'LeftArm', LeftArm: 'LeftForeArm', LeftForeArm: 'LeftHand',
  RightShoulder: 'RightArm', RightArm: 'RightForeArm', RightForeArm: 'RightHand',
  LeftUpLeg: 'LeftLeg', LeftLeg: 'LeftFoot', LeftFoot: 'LeftToeBase',
  RightUpLeg: 'RightLeg', RightLeg: 'RightFoot', RightFoot: 'RightToeBase',
}

function qFromEuler(x, y, z) {
  const cx = Math.cos(x / 2), sx = Math.sin(x / 2)
  const cy = Math.cos(y / 2), sy = Math.sin(y / 2)
  const cz = Math.cos(z / 2), sz = Math.sin(z / 2)
  return [
    sx * cy * cz + cx * sy * sz,
    cx * sy * cz - sx * cy * sz,
    cx * cy * sz + sx * sy * cz,
    cx * cy * cz - sx * sy * sz,
  ]
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

// Canonicalization is RIG-AWARE: Mixamo names only need the prefix stripped
// ('mixamorig7:Spine' IS the canonical bottom Spine), while bare Meshy names
// need the top-down spine remap above. Applying the Meshy map to a Mixamo
// rig would corrupt its (already canonical) spine names, so each rig gets a
// canonicalizer picked from its own naming style.
function canonicalizerFor(rig) {
  const isMixamo = rig.nodes.some((n) => /^mixamorig\d*:/.test(n.name ?? ''))
  if (isMixamo) return (name) => name.replace(/^mixamorig\d*:/, '')
  return (name) => MESHY_NAME_MAP[name] ?? name
}

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
  const srcCanonical = canonicalizerFor(src)
  const dstCanonical = canonicalizerFor(dst)

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
    if (n.name) srcByCanonical[srcCanonical(n.name)] = i
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

  // fingerless rig -> bake the relaxed-wrist curl into the hand tracks
  const fingerless = !dst.nodes.some((n) => /HandIndex|HandThumb|HandMiddle/.test(n.name ?? ''))
  const relaxLeft = qFromEuler(WRIST_RELAX.curlX, 0, WRIST_RELAX.rollZ)
  const relaxRight = qFromEuler(WRIST_RELAX.curlX, 0, -WRIST_RELAX.rollZ)

  // ---- rest-pose calibration -------------------------------------------
  // The rigs bind in DIFFERENT rest poses (Mixamo T-pose vs Meshy A-pose), so
  // delta transfer alone lowers every arm by the rest difference. Rotate the
  // dst rest, chain-top-down, so each bone POINTS the same way as the src
  // rest bone; transferring against this calibrated rest makes clip poses
  // absolute (typing hands reach the keyboard again).
  const srcDirWorld = (i, childIdx) => {
    const d = [
      src.worldP[childIdx][0] - src.worldP[i][0],
      src.worldP[childIdx][1] - src.worldP[i][1],
      src.worldP[childIdx][2] - src.worldP[i][2],
    ]
    const l = Math.hypot(...d) || 1
    return [d[0] / l, d[1] / l, d[2] / l]
  }
  const dstByCanonical = {}
  dst.nodes.forEach((n, i) => {
    if (n.name) dstByCanonical[dstCanonical(n.name)] = i
  })
  const calWorldR = dst.worldR.slice()
  for (const i of dst.order) {
    const p = dst.parent[i]
    const parentCal = p === -1 ? [0, 0, 0, 1] : calWorldR[p]
    // recompute this node's world rotation under the calibrated parent chain
    calWorldR[i] = qnorm(qmul(parentCal, dst.rest[i].r))
    const name = dst.nodes[i].name ? dstCanonical(dst.nodes[i].name) : undefined
    const childName = name ? DIRECTION_CHILD[name] : undefined
    const sIdx = name ? srcByCanonical[name] : undefined
    const sChild = childName ? srcByCanonical[childName] : undefined
    const dChild = childName ? dstByCanonical[childName] : undefined
    if (sIdx === undefined || sChild === undefined || dChild === undefined) continue
    // current dst bone direction under the calibrated chain
    const childLocal = dst.rest[dChild].t
    const dirNow = vrot(calWorldR[i], childLocal)
    const lNow = Math.hypot(...dirNow) || 1
    const fix = qFromUnitVectors([dirNow[0] / lNow, dirNow[1] / lNow, dirNow[2] / lNow], srcDirWorld(sIdx, sChild))
    calWorldR[i] = qnorm(qmul(fix, calWorldR[i]))
  }

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
      const name = dst.nodes[i].name ? dstCanonical(dst.nodes[i].name) : undefined
      const s = name !== undefined ? srcByCanonical[name] : undefined
      let local
      if (s !== undefined && rotTracks.has(s)) {
        // transfer against the CALIBRATED rest: clip poses land absolutely
        const want = qnorm(qmul(qmul(srcWorld[s], qinv(src.worldR[s])), calWorldR[i]))
        local = qnorm(qmul(qinv(parentWorld), want))
      } else {
        local = dst.rest[i].r
      }
      if (fingerless && name === 'LeftHand') local = qnorm(qmul(local, relaxLeft))
      if (fingerless && name === 'RightHand') local = qnorm(qmul(local, relaxRight))
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
