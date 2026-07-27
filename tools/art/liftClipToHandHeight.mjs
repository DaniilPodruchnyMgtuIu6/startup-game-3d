// 18H Wave 3: aligns a retargeted clip's hand-grip height to a real furniture
// anchor (e.g. the pull-up bar crossbar) by adding a CONSTANT vertical offset
// to every sample of the clip's Hips translation track. Same technique as
// CharacterModelConfig.walkLift (a measured contact-correction offset) - not
// a scale change (forbidden: "не исправлять посадку изменением масштаба").
//
// Usage: node tools/art/liftClipToHandHeight.mjs <clip.glb> <targetHandY>
import { readFileSync, writeFileSync } from 'node:fs'

function readGlb(file) {
  const buf = readFileSync(file)
  const jsonLength = buf.readUInt32LE(12)
  const json = JSON.parse(buf.subarray(20, 20 + jsonLength).toString('utf8'))
  const binStart = 20 + jsonLength + 8
  const bin = buf.subarray(binStart)
  return { buf, json, bin }
}

function readFloats(json, bin, accessorIdx) {
  const acc = json.accessors[accessorIdx]
  const bv = json.bufferViews[acc.bufferView]
  const start = bv.byteOffset ?? 0
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

function worldHandY(json, bin, nodes, parent) {
  const anim = json.animations[0]
  const localRot = nodes.map((n) => n.rotation ?? [0, 0, 0, 1])
  const localTra = nodes.map((n) => n.translation ?? [0, 0, 0])
  for (const ch of anim.channels) {
    const sampler = anim.samplers[ch.sampler]
    const values = readFloats(json, bin, sampler.output)
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
  // Scale inherited by Hips' own parent (Armature/root) - some rigs carry a
  // ~0.01 factor here (cm-authored skeleton) that the FK pass above already
  // divides out for world-space reads. Writing world-space deltaY straight
  // into the raw (pre-scale) translation track would land ~100x too small on
  // exactly those rigs - convert through this same factor on the way back in.
  const hipsParentScale = parent[hipsIdx] === -1 ? 1 : worldS[parent[hipsIdx]]
  return { handY: (worldP[li][1] + worldP[ri][1]) / 2, hipsIdx, hipsParentScale }
}

export function liftClipToHandHeight(file, targetHandY) {
  const { json, bin } = readGlb(file)
  const nodes = json.nodes
  const parent = new Array(nodes.length).fill(-1)
  nodes.forEach((n, i) => (n.children ?? []).forEach((c) => (parent[c] = i)))
  const { handY: currentHandY, hipsIdx, hipsParentScale } = worldHandY(json, bin, nodes, parent)
  const deltaY = targetHandY - currentHandY
  const localDeltaY = deltaY / hipsParentScale

  const anim = json.animations[0]
  const hipsChannel = anim.channels.find((c) => c.target.node === hipsIdx && c.target.path === 'translation')
  const sampler = anim.samplers[hipsChannel.sampler]
  const acc = json.accessors[sampler.output]
  const bv = json.bufferViews[acc.bufferView]
  const start = bv.byteOffset ?? 0
  // rewrite every sampled Y in place - constant offset, not a scale
  const outBuf = Buffer.from(bin)
  for (let i = 0; i < acc.count; i++) {
    const yOffset = start + (i * 3 + 1) * 4
    const y = outBuf.readFloatLE(yOffset)
    outBuf.writeFloatLE(y + localDeltaY, yOffset)
  }

  // splice the corrected BIN chunk back into the original GLB container
  const orig = readFileSync(file)
  const jsonLength = orig.readUInt32LE(12)
  const binChunkStart = 20 + jsonLength + 8
  const out = Buffer.concat([orig.subarray(0, binChunkStart), outBuf, orig.subarray(binChunkStart + outBuf.length)])
  writeFileSync(file, out)
  return { currentHandY, targetHandY, deltaY, hipsParentScale }
}

const [file, targetY] = process.argv.slice(2)
if (file) {
  const r = liftClipToHandHeight(file, Number(targetY))
  console.log(
    `${file}: hand was y=${r.currentHandY.toFixed(3)}, lifted world-y by ${r.deltaY.toFixed(3)} ` +
      `(local track scale ${r.hipsParentScale}) to reach y=${r.targetHandY}`,
  )
}
