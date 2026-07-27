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

// FK-sample the clip at an arbitrary time (linear interpolation between
// keyframes) and return hand/hips world positions. `fraction` is 0..1 of the
// clip duration; 1 = last frame.
function poseAtFraction(file: string, fraction: number): { handY: number; handZ: number; hipsY: number } {
  const { json, bin } = readGlb(file)
  const nodes = json.nodes
  const parent = new Array(nodes.length).fill(-1)
  nodes.forEach((n, i) => (n.children ?? []).forEach((c) => (parent[c] = i)))
  const anim = json.animations[0]
  const channels = anim.channels.map((ch) => ({
    node: ch.target.node,
    path: ch.target.path,
    times: readFloats(json, bin, anim.samplers[ch.sampler].input) as number[],
    values: readFloats(json, bin, anim.samplers[ch.sampler].output) as number[][],
  }))
  const duration = Math.max(...channels.map((c) => c.times[c.times.length - 1]))
  const time = duration * fraction
  const lerp = (a: number[], b: number[], t: number) => a.map((v, i) => v + (b[i] - v) * t)
  const localRot: Quat[] = nodes.map((n) => (n.rotation as Quat) ?? [0, 0, 0, 1])
  const localTra: number[][] = nodes.map((n) => n.translation ?? [0, 0, 0])
  for (const ch of channels) {
    let i = ch.times.findIndex((t) => t >= time)
    if (i === -1) i = ch.times.length - 1
    const prev = Math.max(0, i - 1)
    const span = ch.times[i] - ch.times[prev] || 1
    const f = Math.max(0, Math.min(1, (time - ch.times[prev]) / span))
    const v = lerp(ch.values[prev], ch.values[i], f)
    if (ch.path === 'rotation') localRot[ch.node] = v as Quat
    if (ch.path === 'translation') localTra[ch.node] = v
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
  const hips = findBone('Hips')
  const head = findBone('Head')
  return {
    handY: (worldP[li][1] + worldP[ri][1]) / 2,
    handZ: (worldP[li][2] + worldP[ri][2]) / 2,
    hipsY: worldP[hips][1],
    headY: head >= 0 ? worldP[head][1] : NaN,
  }
}

// The character stands 0.9m in front of the crossbar plane (PullUpBar.tsx's
// trigger / PULL_UP_BAR_ANCHORS.approach) facing it - the clip's forward
// travel is ramp-normalized (normalizeClipForwardTravel.mjs) so the hands
// end exactly over the bar.
const TARGET_HAND_Z = 0.9
const Z_TOLERANCE_M = 0.07
// The procedural rep window (CharacterModel's PULLUP_REP_*): scrubbing
// between these clip fractions must give a real pull-up - hands pinned near
// the bar at BOTH ends of the window, hips visibly higher at the top.
const REP_TOP_FRACTION = 0.5
const REP_BOTTOM_FRACTION = 0.75
const REP_MIN_RISE_M = 0.15
const REP_HAND_TOLERANCE_M = 0.12

// Retarget posture guard: an UPRIGHT standing clip keeps the head well above
// the hips. The Meshy rigs name their spine chain TOP-DOWN (Hips->Spine02->
// Spine01->Spine) while Mixamo goes bottom-up - the original name mapping
// swapped the top and bottom vertebra rotations on every retarget, folding
// the tall founder model "в скрепку" (head 0.26m over the hips instead of
// 0.6m). This pins the fix for every rig and every future re-retarget.
const UPRIGHT_CLIPS = ['walk', 'talk', 'type'] as const
const MIN_HEAD_OVER_HIPS_M = 0.4

describe('retargeted clips keep an upright posture (spine-map regression)', () => {
  for (const character of TEAM) {
    it(`${character}: head stays >=${MIN_HEAD_OVER_HIPS_M}m above the hips in standing clips`, () => {
      for (const clip of UPRIGHT_CLIPS) {
        const file = join(ROOT, 'public', 'character', character, `${clip}.glb`)
        if (!existsSync(file)) continue
        for (const fraction of [0, 0.5]) {
          const { headY, hipsY } = poseAtFraction(file, fraction)
          expect(headY - hipsY, `${character}/${clip} t=${fraction}: head ${headY.toFixed(2)} hips ${hipsY.toFixed(2)}`).toBeGreaterThanOrEqual(
            MIN_HEAD_OVER_HIPS_M,
          )
        }
      }
    })
  }
})

describe('pullUp clip hand contact matches the real pull-up bar (18H Wave 3)', () => {
  for (const character of TEAM) {
    const file = join(ROOT, 'public', 'character', character, 'pullUp.glb')
    it(`${character}: both hands land within ${TOLERANCE_M}m of the bar (y=${TARGET_HAND_Y})`, () => {
      expect(existsSync(file), file).toBe(true)
      const { handY, handZ } = poseAtFraction(file, 1)
      expect(Math.abs(handY - TARGET_HAND_Y), `${character} hand y=${handY.toFixed(3)}`).toBeLessThan(TOLERANCE_M)
      // horizontal contact: the jump must actually REACH the bar plane - the
      // original retarget stopped 0.35-0.55m short and the character hung in
      // mid-air in front of the bar
      expect(Math.abs(handZ - TARGET_HAND_Z), `${character} hand z=${handZ.toFixed(3)}`).toBeLessThan(Z_TOLERANCE_M)
    })

    it(`${character}: the rep-scrub window is a real pull-up (hands on bar, hips rise >=${REP_MIN_RISE_M}m)`, () => {
      const top = poseAtFraction(file, REP_TOP_FRACTION)
      const bottom = poseAtFraction(file, REP_BOTTOM_FRACTION)
      expect(Math.abs(top.handY - TARGET_HAND_Y), `top hand y=${top.handY.toFixed(3)}`).toBeLessThan(REP_HAND_TOLERANCE_M)
      expect(Math.abs(bottom.handY - TARGET_HAND_Y), `bottom hand y=${bottom.handY.toFixed(3)}`).toBeLessThan(REP_HAND_TOLERANCE_M)
      expect(top.hipsY - bottom.hipsY, `rise=${(top.hipsY - bottom.hipsY).toFixed(3)}`).toBeGreaterThanOrEqual(REP_MIN_RISE_M)
    })
  }
})
