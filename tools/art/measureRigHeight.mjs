// Bone-space height: FK world position of every node in bind pose; height =
// max node Y (head end) - min node Y (toes). Works for skinned characters
// where the mesh node transform is irrelevant.
// Usage: node tools/art/measureRigHeight.mjs <file...>
import { readFileSync } from 'node:fs'

function readGlb(file) {
  const buf = readFileSync(file)
  const jsonLength = buf.readUInt32LE(12)
  return JSON.parse(buf.subarray(20, 20 + jsonLength).toString('utf8'))
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
  const dot = u[0] * v[0] + u[1] * v[1] + u[2] * v[2]
  const c1 = cross(u, v)
  const c2 = cross(u, c1)
  return [v[0] + 2 * (s * c1[0] + c2[0]), v[1] + 2 * (s * c1[1] + c2[1]), v[2] + 2 * (s * c1[2] + c2[2])]
}

export function measureRig(file) {
  const json = readGlb(file)
  const nodes = json.nodes ?? []
  const parent = new Array(nodes.length).fill(-1)
  nodes.forEach((n, i) => (n.children ?? []).forEach((c) => (parent[c] = i)))
  const worldP = new Array(nodes.length)
  const worldR = new Array(nodes.length)
  const worldS = new Array(nodes.length)
  const order = []
  const visit = (i) => {
    order.push(i)
    for (const c of nodes[i].children ?? []) visit(c)
  }
  for (let i = 0; i < nodes.length; i++) if (parent[i] === -1) visit(i)
  let minY = Infinity
  let maxY = -Infinity
  for (const i of order) {
    const p = parent[i]
    const pr = p === -1 ? [0, 0, 0, 1] : worldR[p]
    const pp = p === -1 ? [0, 0, 0] : worldP[p]
    const ps = p === -1 ? 1 : worldS[p]
    const t = (nodes[i].translation ?? [0, 0, 0]).map((v) => v * ps)
    const off = vrot(pr, t)
    worldP[i] = [pp[0] + off[0], pp[1] + off[1], pp[2] + off[2]]
    worldR[i] = qmul(pr, nodes[i].rotation ?? [0, 0, 0, 1])
    worldS[i] = ps * (nodes[i].scale?.[0] ?? 1)
    if (nodes[i].name) {
      minY = Math.min(minY, worldP[i][1])
      maxY = Math.max(maxY, worldP[i][1])
    }
  }
  return { minY, maxY, span: maxY - minY }
}

for (const file of process.argv.slice(2)) {
  const m = measureRig(file)
  console.log(`${file}: bones span ${m.span.toFixed(3)} m (top ${m.maxY.toFixed(3)})`)
}
