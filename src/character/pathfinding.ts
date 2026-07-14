import { getBlockedGrid, cellOf, cellCenter, isBlockedAt, isInsideWall, nearestWalkable, NX, NZ } from './grid'
import { getObstacles, type Obstacle } from './obstacles'
import { BUILDING } from '../scene/layout'
import type { Point } from './navigation'

export interface PathHints {
  // Facing of the seat being entered (walk in over its front edge).
  entryFacing?: number
  // Facing of the seat being left (stand up forward, not through the backrest).
  exitFacing?: number
}

const ORTHO_COST = 1
const DIAG_COST = Math.SQRT2
const LOS_STEP = 0.1

// A* over the walkability grid, 8-directional with corner-cutting disallowed.
function astar(blocked: Uint8Array, start: [number, number], goal: [number, number]): Array<[number, number]> | null {
  const startIdx = start[1] * NX + start[0]
  const goalIdx = goal[1] * NX + goal[0]
  if (startIdx === goalIdx) return [start]

  const gScore = new Float64Array(NX * NZ).fill(Infinity)
  const cameFrom = new Int32Array(NX * NZ).fill(-1)
  const inOpen = new Uint8Array(NX * NZ)
  gScore[startIdx] = 0

  // binary min-heap of [fScore, idx]
  const heap: Array<[number, number]> = []
  const push = (entry: [number, number]) => {
    heap.push(entry)
    let k = heap.length - 1
    while (k > 0) {
      const parent = (k - 1) >> 1
      if (heap[parent][0] <= heap[k][0]) break
      ;[heap[parent], heap[k]] = [heap[k], heap[parent]]
      k = parent
    }
  }
  const pop = (): [number, number] | undefined => {
    const top = heap[0]
    const last = heap.pop()
    if (heap.length > 0 && last) {
      heap[0] = last
      let k = 0
      for (;;) {
        const l = k * 2 + 1
        const r = l + 1
        let smallest = k
        if (l < heap.length && heap[l][0] < heap[smallest][0]) smallest = l
        if (r < heap.length && heap[r][0] < heap[smallest][0]) smallest = r
        if (smallest === k) break
        ;[heap[smallest], heap[k]] = [heap[k], heap[smallest]]
        k = smallest
      }
    }
    return top
  }
  const heuristic = (i: number, j: number) => {
    const dx = Math.abs(i - goal[0])
    const dz = Math.abs(j - goal[1])
    return ORTHO_COST * Math.max(dx, dz) + (DIAG_COST - ORTHO_COST) * Math.min(dx, dz)
  }

  push([heuristic(start[0], start[1]), startIdx])
  inOpen[startIdx] = 1

  while (heap.length > 0) {
    const current = pop()
    if (!current) break
    const idx = current[1]
    if (idx === goalIdx) {
      const cells: Array<[number, number]> = []
      for (let at = goalIdx; at !== -1; at = cameFrom[at]) cells.push([at % NX, Math.floor(at / NX)])
      cells.reverse()
      return cells
    }
    inOpen[idx] = 0
    const i = idx % NX
    const j = Math.floor(idx / NX)

    for (let dj = -1; dj <= 1; dj++) {
      for (let di = -1; di <= 1; di++) {
        if (di === 0 && dj === 0) continue
        const ni = i + di
        const nj = j + dj
        if (ni < 0 || ni >= NX || nj < 0 || nj >= NZ) continue
        const nIdx = nj * NX + ni
        if (blocked[nIdx] === 1) continue
        // no cutting corners diagonally past a blocked cell
        if (di !== 0 && dj !== 0 && (blocked[j * NX + ni] === 1 || blocked[nj * NX + i] === 1)) continue
        const step = di !== 0 && dj !== 0 ? DIAG_COST : ORTHO_COST
        const tentative = gScore[idx] + step
        if (tentative >= gScore[nIdx]) continue
        gScore[nIdx] = tentative
        cameFrom[nIdx] = idx
        if (inOpen[nIdx] === 0) {
          push([tentative + heuristic(ni, nj), nIdx])
          inOpen[nIdx] = 1
        } else {
          push([tentative + heuristic(ni, nj), nIdx]) // lazy decrease-key: stale entries are skipped by cost check
        }
      }
    }
  }
  return null
}

function hasLineOfSight(a: Point, b: Point): boolean {
  const dist = Math.hypot(b[0] - a[0], b[2] - a[2])
  const steps = Math.max(1, Math.ceil(dist / LOS_STEP))
  for (let s = 1; s <= steps; s++) {
    const t = s / steps
    if (isBlockedAt(a[0] + (b[0] - a[0]) * t, a[2] + (b[2] - a[2]) * t)) return false
  }
  return true
}

// Greedy string-pulling: from each point jump to the furthest later waypoint
// that is directly visible on the grid.
function smooth(from: Point, waypoints: Point[]): Point[] {
  const all = [from, ...waypoints]
  const result: Point[] = []
  let cur = 0
  while (cur < all.length - 1) {
    let next = cur + 1
    for (let k = all.length - 1; k > cur + 1; k--) {
      if (hasLineOfSight(all[cur], all[k])) {
        next = k
        break
      }
    }
    result.push(all[next])
    cur = next
  }
  return result
}

function insideBox(x: number, z: number, box: Obstacle): boolean {
  return x > box.minX && x < box.maxX && z > box.minZ && z < box.maxZ
}

// Walks outward from a seat point in one direction until clear of the seat's
// own RAW furniture footprint. Crossing walk margins is fine (they are
// buffers, not geometry); the direction FAILS as soon as the probe would pass
// into other furniture (e.g. the desk in front of a chair) or a wall.
function probeDirection(point: Point, angle: number, ownBoxes: readonly Obstacle[]): Point | null {
  const fx = Math.sin(angle)
  const fz = Math.cos(angle)
  for (let d = 0.45; d <= 1.35; d += 0.15) {
    const x = point[0] + fx * d
    const z = point[2] + fz * d
    if (x < BUILDING.minX || x > BUILDING.maxX || z < BUILDING.minZ || z > BUILDING.maxZ) return null
    if (isInsideWall(x, z)) return null
    const boxes = getObstacles().filter((box) => insideBox(x, z, box))
    if (boxes.some((box) => !ownBoxes.includes(box))) return null // ran into other furniture
    if (boxes.length === 0) return [x, point[1], z]
  }
  return null
}

// The natural spot to step onto/off a seat: straight ahead of it when clear
// (sofas - over the front edge), otherwise behind it (chairs at desks and
// tables), otherwise to a side.
function probeAround(point: Point, facing: number): Point | null {
  const ownBoxes = getObstacles().filter((box) => insideBox(point[0], point[2], box))
  for (const angle of [facing, facing + Math.PI, facing + Math.PI / 2, facing - Math.PI / 2]) {
    const found = probeDirection(point, angle, ownBoxes)
    if (found) return found
  }
  return null
}

// Builds the walkable waypoint list from `from` to `to`. The path always ends
// exactly at `to` - when `to` sits inside a blocked margin (e.g. a chair the
// character is about to sit on), the grid path runs to a walkable cell and the
// final approach legs are appended verbatim. Facing hints route those first /
// last legs over the seat's front edge instead of the euclidean-nearest side,
// which may be behind a backrest.
export function findPath(from: Point, to: Point, hints: PathHints = {}): Point[] {
  const blocked = getBlockedGrid()

  // stand up forward off the current seat when leaving one
  const prefix: Point[] = []
  let start = from
  if (hints.exitFacing !== undefined && isBlockedAt(from[0], from[2])) {
    const exitPoint = probeAround(from, hints.exitFacing)
    if (exitPoint) {
      prefix.push(exitPoint)
      start = exitPoint
    }
  }
  const startPoint = nearestWalkable(start)
  const startCell = cellOf(startPoint[0], startPoint[2])

  // approach a blocked target over its front edge when a facing is known
  const goalWalkable = !isBlockedAt(to[0], to[2])
  let suffix: Point[] = []
  let goalPoint: Point = to
  if (!goalWalkable) {
    const entryPoint = hints.entryFacing !== undefined ? probeAround(to, hints.entryFacing) : null
    if (entryPoint) {
      goalPoint = nearestWalkable(entryPoint)
      suffix = [entryPoint, to]
    } else {
      goalPoint = nearestWalkable(to)
      suffix = [to]
    }
  }
  const goalCell = cellOf(goalPoint[0], goalPoint[2])

  const cells = astar(blocked, startCell, goalCell)
  if (!cells) return [...prefix, to]

  const waypoints: Point[] = cells.map(([i, j]) => {
    const [x, z] = cellCenter(i, j)
    return [x, to[1], z]
  })
  if (goalWalkable) waypoints[waypoints.length - 1] = to // land exactly on the goal

  const path = [...prefix, ...smooth(start, waypoints), ...suffix]
  const last = path[path.length - 1]
  if (last[0] !== to[0] || last[2] !== to[2]) path.push(to)
  return path
}
