import { BUILDING, ROOMS, type RoomName } from '../scene/layout'
import { getObstacles, getObstaclesVersion, type Obstacle } from './obstacles'
import type { Point } from './navigation'

// Walkability is resolved on a coarse occupancy grid over the office floor:
// walls (inflated by a clearance so the character never hugs them) and every
// registered furniture footprint (inflated by a body margin) block cells.
export const CELL = 0.2
const WALL_CLEARANCE = 0.22
const FURNITURE_MARGIN = 0.25
const DOOR_WIDTH = 0.9
const WALL_HALF = 0.1

export const NX = Math.round((BUILDING.maxX - BUILDING.minX) / CELL)
export const NZ = Math.round((BUILDING.maxZ - BUILDING.minZ) / CELL)

type SideRoomName = Exclude<RoomName, 'openSpace'>
const SIDE_ROOMS: SideRoomName[] = ['meetingRoom', 'focusRoom', 'serverRoom', 'ceoOffice', 'kitchen', 'gameRoom']

function buildWallBoxes(): Obstacle[] {
  const { minX, maxX, minZ, maxZ } = BUILDING
  const walls: Obstacle[] = [
    { minX, maxX, minZ: minZ - WALL_HALF, maxZ: minZ + WALL_HALF },
    { minX, maxX, minZ: maxZ - WALL_HALF, maxZ: maxZ + WALL_HALF },
    { minX: minX - WALL_HALF, maxX: minX + WALL_HALF, minZ, maxZ },
    { minX: maxX - WALL_HALF, maxX: maxX + WALL_HALF, minZ, maxZ },
  ]

  // Partitions between each side room and the open space, split by their
  // centered doorway gap.
  for (const name of SIDE_ROOMS) {
    const b = ROOMS[name]
    const doorX = b.maxX <= 0 ? b.maxX : b.minX
    const doorZ = (b.minZ + b.maxZ) / 2
    walls.push({ minX: doorX - WALL_HALF, maxX: doorX + WALL_HALF, minZ: b.minZ, maxZ: doorZ - DOOR_WIDTH / 2 })
    walls.push({ minX: doorX - WALL_HALF, maxX: doorX + WALL_HALF, minZ: doorZ + DOOR_WIDTH / 2, maxZ: b.maxZ })
  }

  // Solid dividers between vertically stacked side rooms (both columns share
  // the same boundary z values).
  for (const colMinX of [BUILDING.minX, ROOMS.ceoOffice.minX]) {
    const colMaxX = colMinX + (ROOMS.meetingRoom.maxX - ROOMS.meetingRoom.minX)
    for (const boundaryZ of [ROOMS.meetingRoom.maxZ, ROOMS.focusRoom.maxZ]) {
      walls.push({ minX: colMinX, maxX: colMaxX, minZ: boundaryZ - WALL_HALF, maxZ: boundaryZ + WALL_HALF })
    }
  }
  return walls
}

const WALLS = buildWallBoxes()

let cache: { version: number; blocked: Uint8Array } | null = null

function markBox(blocked: Uint8Array, box: Obstacle, margin: number) {
  const iMin = Math.max(0, Math.floor((box.minX - margin - BUILDING.minX) / CELL - 0.5))
  const iMax = Math.min(NX - 1, Math.ceil((box.maxX + margin - BUILDING.minX) / CELL - 0.5))
  const jMin = Math.max(0, Math.floor((box.minZ - margin - BUILDING.minZ) / CELL - 0.5))
  const jMax = Math.min(NZ - 1, Math.ceil((box.maxZ + margin - BUILDING.minZ) / CELL - 0.5))
  for (let j = jMin; j <= jMax; j++) {
    for (let i = iMin; i <= iMax; i++) {
      const [cx, cz] = cellCenter(i, j)
      if (cx >= box.minX - margin && cx <= box.maxX + margin && cz >= box.minZ - margin && cz <= box.maxZ + margin) {
        blocked[j * NX + i] = 1
      }
    }
  }
}

export function getBlockedGrid(): Uint8Array {
  const version = getObstaclesVersion()
  if (cache && cache.version === version) return cache.blocked
  const blocked = new Uint8Array(NX * NZ)
  for (const wall of WALLS) markBox(blocked, wall, WALL_CLEARANCE)
  for (const box of getObstacles()) markBox(blocked, box, FURNITURE_MARGIN)
  cache = { version, blocked }
  return blocked
}

export function cellOf(x: number, z: number): [number, number] {
  const i = Math.min(NX - 1, Math.max(0, Math.floor((x - BUILDING.minX) / CELL)))
  const j = Math.min(NZ - 1, Math.max(0, Math.floor((z - BUILDING.minZ) / CELL)))
  return [i, j]
}

export function cellCenter(i: number, j: number): [number, number] {
  return [BUILDING.minX + (i + 0.5) * CELL, BUILDING.minZ + (j + 0.5) * CELL]
}

export function isBlockedAt(x: number, z: number): boolean {
  if (x < BUILDING.minX || x > BUILDING.maxX || z < BUILDING.minZ || z > BUILDING.maxZ) return true
  const [i, j] = cellOf(x, z)
  return getBlockedGrid()[j * NX + i] === 1
}

// Raw wall-band test (no clearance margin). Seat entry/exit probes use it to
// avoid picking points inside actual wall geometry.
export function isInsideWall(x: number, z: number): boolean {
  return WALLS.some((wall) => x > wall.minX && x < wall.maxX && z > wall.minZ && z < wall.maxZ)
}

// Nearest walkable cell center to the given point (ring search), or the point
// itself when it is already walkable. Used to clamp floor clicks off walls and
// furniture, and to snap path endpoints onto the grid.
export function nearestWalkable(point: Point): Point {
  if (!isBlockedAt(point[0], point[2])) return point
  const blocked = getBlockedGrid()
  const [ci, cj] = cellOf(point[0], point[2])
  let best: [number, number] | null = null
  let bestDist = Infinity
  for (let r = 1; r < 45 && best === null; r++) {
    for (let j = Math.max(0, cj - r); j <= Math.min(NZ - 1, cj + r); j++) {
      for (let i = Math.max(0, ci - r); i <= Math.min(NX - 1, ci + r); i++) {
        if (Math.max(Math.abs(i - ci), Math.abs(j - cj)) !== r) continue
        if (blocked[j * NX + i] === 1) continue
        const [cx, cz] = cellCenter(i, j)
        const dist = Math.hypot(cx - point[0], cz - point[2])
        if (dist < bestDist) {
          bestDist = dist
          best = [i, j]
        }
      }
    }
    // finish scanning one extra ring so a diagonal neighbour can't beat an
    // orthogonal one found later
    if (best !== null && r < 44) {
      const rNext = r + 1
      for (let j = Math.max(0, cj - rNext); j <= Math.min(NZ - 1, cj + rNext); j++) {
        for (let i = Math.max(0, ci - rNext); i <= Math.min(NX - 1, ci + rNext); i++) {
          if (Math.max(Math.abs(i - ci), Math.abs(j - cj)) !== rNext) continue
          if (blocked[j * NX + i] === 1) continue
          const [cx, cz] = cellCenter(i, j)
          const dist = Math.hypot(cx - point[0], cz - point[2])
          if (dist < bestDist) {
            bestDist = dist
            best = [i, j]
          }
        }
      }
      break
    }
  }
  if (best === null) return point
  const [x, z] = cellCenter(best[0], best[1])
  return [x, point[1], z]
}
