import type { Point } from './navigation'

export interface MoveResult {
  position: Point
  rotationY: number
  reachedTarget: boolean
}

const ARRIVE_EPSILON = 0.05
const TURN_RATE = 10

export function stepTowards(
  current: Point,
  target: Point,
  speed: number,
  deltaSeconds: number,
  currentRotationY: number,
): MoveResult {
  const dx = target[0] - current[0]
  const dz = target[2] - current[2]
  const distance = Math.sqrt(dx * dx + dz * dz)

  if (distance <= ARRIVE_EPSILON) {
    return { position: target, rotationY: currentRotationY, reachedTarget: true }
  }

  const travel = Math.min(distance, speed * deltaSeconds)
  const t = travel / distance
  const position: Point = [current[0] + dx * t, target[1], current[2] + dz * t]

  const reachedTarget = travel >= distance
  const targetRotationY = Math.atan2(dx, dz)
  const rotationY = reachedTarget
    ? targetRotationY
    : turnToward(currentRotationY, targetRotationY, Math.min(1, deltaSeconds * TURN_RATE))

  return { position: reachedTarget ? target : position, rotationY, reachedTarget }
}

function turnToward(from: number, to: number, t: number): number {
  let diff = to - from
  while (diff > Math.PI) diff -= Math.PI * 2
  while (diff < -Math.PI) diff += Math.PI * 2
  return from + diff * t
}
