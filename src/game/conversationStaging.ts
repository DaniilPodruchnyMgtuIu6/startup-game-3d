// Feature 16 §8: pure geometry for staging an NPC↔NPC conversation so the two
// colleagues end up a clean speaking distance apart, facing each other — never
// standing inside one another. Kept out of React so it is unit-testable.

import type { Point } from '../character/navigation'

// Final gap between the two speakers, the arrival tolerance, and the distance
// below which they count as "overlapping" and must be pushed apart.
export const TALK_DISTANCE = 1.8
export const ARRIVE_EPS = 0.55
export const MIN_SEPARATION = 1.3

export function horizontalDistance(a: Point, b: Point): number {
  return Math.hypot(a[0] - b[0], a[2] - b[2])
}

// Where the mover should stand to talk: `distance` short of the host, ON THE
// MOVER'S OWN SIDE (that space is walkable — the mover is already standing
// there), so it stops in front of the host instead of walking into it. If the two
// are practically on the same spot, fall back to the direction the host faces.
export function conversationApproachPoint(moverPos: Point, hostPos: Point, hostRotationY: number, distance = TALK_DISTANCE): Point {
  const dx = moverPos[0] - hostPos[0]
  const dz = moverPos[2] - hostPos[2]
  const d = Math.hypot(dx, dz)
  const [ux, uz] = d > 0.25 ? [dx / d, dz / d] : [Math.sin(hostRotationY), Math.cos(hostRotationY)]
  return [hostPos[0] + ux * distance, 0, hostPos[2] + uz * distance]
}

// If the mover ended up too close to the host (e.g. the walk was interrupted or
// timed out while they overlapped), push it out to a clean speaking distance along
// their shared axis; otherwise leave it where it walked to. Returns the mover's
// final talk position (no teleport in the common, well-separated case).
export function separatedMoverPosition(moverPos: Point, hostPos: Point, hostRotationY: number): Point {
  if (horizontalDistance(moverPos, hostPos) >= MIN_SEPARATION) return moverPos
  return conversationApproachPoint(moverPos, hostPos, hostRotationY, TALK_DISTANCE)
}
