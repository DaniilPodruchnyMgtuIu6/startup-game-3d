import type { Point } from '../character/navigation'

export const MEET_DISTANCE = 1.4

// A spot one step in front of the PM (along her facing) for the player to
// walk to. rotationY 0 faces +z, matching the character convention.
export function approachPoint(pmSpawn: Point, pmRotationY: number, distance = 1.0): Point {
  return [pmSpawn[0] + Math.sin(pmRotationY) * distance, 0, pmSpawn[2] + Math.cos(pmRotationY) * distance]
}

export function isWithinMeetDistance(a: Point, b: Point): boolean {
  return Math.hypot(a[0] - b[0], a[2] - b[2]) < MEET_DISTANCE
}

export function facingBetween(from: Point, to: Point): number {
  return Math.atan2(to[0] - from[0], to[2] - from[2])
}
