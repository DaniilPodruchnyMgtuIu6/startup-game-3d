export type Point = [number, number, number]

import { findPath, type PathHints } from './pathfinding'

export type { PathHints } from './pathfinding'

// Builds the waypoint list for a walk. All routing decisions - door gaps,
// wall clearance, furniture avoidance, seat entry/exit direction - are
// resolved by grid pathfinding (see grid.ts / pathfinding.ts).
export function buildPath(from: Point, to: Point, hints?: PathHints): Point[] {
  return findPath(from, to, hints)
}
