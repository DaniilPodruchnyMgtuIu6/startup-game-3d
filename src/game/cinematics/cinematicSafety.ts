// Feature 18D §5: camera safety. The office is a grid of RECTANGULAR rooms
// (scene/layout ROOMS), so the one rule that guarantees "no wall between
// camera and subject" is: the camera stays inside the SAME room as its target
// (rooms are convex). A frame that cannot keep a workable distance after
// clamping falls back to a higher over-the-cutaway shot that always works.
// Pure math - unit-testable, never produces NaN for finite inputs.
import { BUILDING, ROOMS, type RoomBounds } from '../../scene/layout'
import type { Point, ShotFrame } from './cinematicShots'

const WALL_MARGIN = 0.45 // keep the lens out of wall/glass geometry
const MIN_CAMERA_DISTANCE = 0.9 // never enter a character's head (§5)
const FALLBACK_HEIGHT = 2.4 // above furniture, below the 2.8m wall top

export function roomOf(point: Point): RoomBounds {
  for (const bounds of Object.values(ROOMS)) {
    if (point[0] >= bounds.minX && point[0] <= bounds.maxX && point[2] >= bounds.minZ && point[2] <= bounds.maxZ) {
      return bounds
    }
  }
  return BUILDING // outside every room (doorways): clamp to the building shell
}

function clampInto(point: Point, bounds: RoomBounds, height: number): Point {
  return [
    Math.min(bounds.maxX - WALL_MARGIN, Math.max(bounds.minX + WALL_MARGIN, point[0])),
    height,
    Math.min(bounds.maxZ - WALL_MARGIN, Math.max(bounds.minZ + WALL_MARGIN, point[2])),
  ]
}

export interface SafeShot extends ShotFrame {
  usedFallback: boolean
}

// Clamp a computed frame into the target's room. If clamping crushed the
// camera into the subject (tight room corner), fall back to a raised shot
// pulled diagonally away - still inside the room, above desks/heads.
export function makeShotSafe(frame: ShotFrame): SafeShot {
  const room = roomOf(frame.target)
  const clamped = clampInto(frame.position, room, frame.position[1])
  const dx = clamped[0] - frame.target[0]
  const dz = clamped[2] - frame.target[2]
  if (Math.hypot(dx, dz) >= MIN_CAMERA_DISTANCE) {
    return { ...frame, position: clamped, usedFallback: false }
  }
  // fallback: retreat toward the farthest room corner at safe height
  const corners: Point[] = [
    [room.minX + WALL_MARGIN, FALLBACK_HEIGHT, room.minZ + WALL_MARGIN],
    [room.minX + WALL_MARGIN, FALLBACK_HEIGHT, room.maxZ - WALL_MARGIN],
    [room.maxX - WALL_MARGIN, FALLBACK_HEIGHT, room.minZ + WALL_MARGIN],
    [room.maxX - WALL_MARGIN, FALLBACK_HEIGHT, room.maxZ - WALL_MARGIN],
  ]
  let best = corners[0]
  let bestDistance = -1
  for (const corner of corners) {
    const distance = Math.hypot(corner[0] - frame.target[0], corner[2] - frame.target[2])
    if (distance > bestDistance) {
      bestDistance = distance
      best = corner
    }
  }
  // step from the corner toward the target to a comfortable medium distance
  const distance = Math.min(2.6, bestDistance)
  const t = bestDistance === 0 ? 0 : distance / bestDistance
  const position: Point = [
    frame.target[0] + (best[0] - frame.target[0]) * t,
    FALLBACK_HEIGHT,
    frame.target[2] + (best[2] - frame.target[2]) * t,
  ]
  return { ...frame, position, usedFallback: true }
}
