import { describe, it, expect } from 'vitest'
import { readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'

// 18H Wave 3: guards the hand-to-bar contact fix in liftClipToHandHeight.mjs.
// The retargeted 'Jump_and_Hang_on_Bar' clip's own authored hand height
// does not match this project's PullUpBar (BAR_Y=2.0m in PullUpBar.tsx,
// mirrored in src/interaction/interactionAnchors.ts's PULL_UP_BAR_ANCHORS) -
// a real Higgsfield/furniture mismatch found and fixed once. Without this
// guard a future re-generation or re-retarget of pullUp.glb could silently
// reintroduce the same ~0.2-0.5m grip-below-the-bar gap.
const ROOT = process.cwd()
const TEAM = ['business_man', 'female_pm', 'kirill_morozov', 'alina_belova', 'cybersecurity']
const TARGET_HAND_Y = 2.0
const TOLERANCE_M = 0.05

interface GltfJson {
  nodes: { name?: string; children?: number[]; translation?: number[]; rotation?: number[]; scale?: number[] }[]
  animations: { channels: { sampler: number; target: { node: number; path: string } }[]; samplers: { output: number }[] }[]
  accessors: { bufferView: number; byteOffset?: number; count: number; type: string }[]
  bufferViews: { byteOffset?: number }[]
}

function readGlb(file: string) {
  const buf = readFileSync(file)
  const jsonLength = buf.readUInt32LE(12)
  const json: GltfJson = JSON.parse(buf.subarray(20, 20 + jsonLength).toString('utf8'))
  const bin = buf.subarray(20 + jsonLength + 8)
  return { json, bin }
}

function readFloats(json: GltfJson, bin: Buffer, accessorIdx: number): number[][] | number[] {
  const acc = json.accessors[accessorIdx]
  const bv = json.bufferViews[acc.bufferView]
  // Both the bufferView AND the accessor itself carry a byteOffset - glTF
  // packers (glTF-Transform in particular) interleave several accessors
  // into one shared bufferView, so skipping the accessor's own offset reads
  // whichever OTHER accessor happens to start at the bufferView's origin.
  // pullUp.glb (the only file this file measures today) gives each channel
  // its own bufferView, so this never showed up here - caught while reusing
  // this exact helper for a 18H §10 furniture audit against sit.glb/
  // sofaSit.glb, which DO pack multiple accessors per bufferView.
  const start = (bv.byteOffset ?? 0) + (acc.byteOffset ?? 0)
  const compCount = { SCALAR: 1, VEC3: 3, VEC4: 4 }[acc.type]!
  const out: number[][] = []
  for (let i = 0; i < acc.count; i++) {
    const row: number[] = []
    for (let c = 0; c < compCount; c++) row.push(bin.readFloatLE(start + (i * compCount + c) * 4))
    out.push(row)
  }
  return compCount === 1 ? out.map((r) => r[0]) : out
}

type Quat = [number, number, number, number]
const qmul = (a: Quat, b: Quat): Quat => [
  a[3] * b[0] + a[0] * b[3] + a[1] * b[2] - a[2] * b[1],
  a[3] * b[1] - a[0] * b[2] + a[1] * b[3] + a[2] * b[0],
  a[3] * b[2] + a[0] * b[1] - a[1] * b[0] + a[2] * b[3],
  a[3] * b[3] - a[0] * b[0] - a[1] * b[1] - a[2] * b[2],
]
const vrot = (q: Quat, v: number[]): number[] => {
  const u = [q[0], q[1], q[2]]
  const s = q[3]
  const cross = (a: number[], b: number[]) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]
  const c1 = cross(u, v)
  const c2 = cross(u, c1)
  return [v[0] + 2 * (s * c1[0] + c2[0]), v[1] + 2 * (s * c1[1] + c2[1]), v[2] + 2 * (s * c1[2] + c2[2])]
}

function meanHandHeightAtLastFrame(file: string): number {
  const { json, bin } = readGlb(file)
  const nodes = json.nodes
  const parent = new Array(nodes.length).fill(-1)
  nodes.forEach((n, i) => (n.children ?? []).forEach((c) => (parent[c] = i)))
  const anim = json.animations[0]
  const localRot: Quat[] = nodes.map((n) => (n.rotation as Quat) ?? [0, 0, 0, 1])
  const localTra: number[][] = nodes.map((n) => n.translation ?? [0, 0, 0])
  for (const ch of anim.channels) {
    const values = readFloats(json, bin, anim.samplers[ch.sampler].output) as number[][]
    const last = values[values.length - 1]
    if (ch.target.path === 'rotation') localRot[ch.target.node] = last as Quat
    if (ch.target.path === 'translation') localTra[ch.target.node] = last
  }
  const worldP: number[][] = new Array(nodes.length)
  const worldR: Quat[] = new Array(nodes.length)
  const worldS: number[] = new Array(nodes.length)
  const order: number[] = []
  const visit = (i: number) => {
    order.push(i)
    for (const c of nodes[i].children ?? []) visit(c)
  }
  for (let i = 0; i < nodes.length; i++) if (parent[i] === -1) visit(i)
  for (const i of order) {
    const p = parent[i]
    const pr: Quat = p === -1 ? [0, 0, 0, 1] : worldR[p]
    const pp = p === -1 ? [0, 0, 0] : worldP[p]
    const ps = p === -1 ? 1 : worldS[p]
    const t = localTra[i].map((v) => v * ps)
    const off = vrot(pr, t)
    worldP[i] = [pp[0] + off[0], pp[1] + off[1], pp[2] + off[2]]
    worldR[i] = qmul(pr, localRot[i])
    worldS[i] = ps * (nodes[i].scale?.[0] ?? 1)
  }
  const findBone = (suffix: string) => nodes.findIndex((n) => n.name === suffix || n.name?.endsWith(':' + suffix))
  const li = findBone('LeftHand')
  const ri = findBone('RightHand')
  return (worldP[li][1] + worldP[ri][1]) / 2
}

describe('pullUp clip hand contact matches the real pull-up bar (18H Wave 3)', () => {
  for (const character of TEAM) {
    const file = join(ROOT, 'public', 'character', character, 'pullUp.glb')
    it(`${character}: both hands land within ${TOLERANCE_M}m of the bar (y=${TARGET_HAND_Y})`, () => {
      expect(existsSync(file), file).toBe(true)
      const handY = meanHandHeightAtLastFrame(file)
      expect(Math.abs(handY - TARGET_HAND_Y), `${character} hand y=${handY.toFixed(3)}`).toBeLessThan(TOLERANCE_M)
    })
  }
})
