// Feature 18C §6: pure gaze math. Given my position/body yaw and the partner's
// position, produce clamped head yaw/pitch offsets - or "inactive" when the
// partner is too far behind (no neck-breaking, no staring through walls: gaze
// pairs are only ever set for face-to-face conversations).

export const GAZE_LIMITS = {
  yaw: 1.0, // rad, ±57° head turn
  pitch: 0.35, // rad, ±20° up/down
  behindThreshold: Math.PI * 0.75, // beyond ±135° the head gives up and re-centers
} as const

// Standing eye height of the stylized rigs; seated characters hold their head
// noticeably lower.
export const EYE_HEIGHT_STANDING = 1.55
export const EYE_HEIGHT_SEATED = 1.15

export function wrapAngle(a: number): number {
  while (a > Math.PI) a -= 2 * Math.PI
  while (a < -Math.PI) a += 2 * Math.PI
  return a
}

export interface GazeAngles {
  yaw: number
  pitch: number
  active: boolean
}

export function gazeAnglesToward(
  myPos: readonly [number, number, number],
  myRotationY: number,
  myEyeHeight: number,
  targetPos: readonly [number, number, number],
  targetEyeHeight: number,
): GazeAngles {
  const dx = targetPos[0] - myPos[0]
  const dz = targetPos[2] - myPos[2]
  const dy = targetPos[1] + targetEyeHeight - (myPos[1] + myEyeHeight)
  const horizontal = Math.hypot(dx, dz)
  if (horizontal < 0.05) return { yaw: 0, pitch: 0, active: false }
  const relYaw = wrapAngle(Math.atan2(dx, dz) - myRotationY)
  if (Math.abs(relYaw) > GAZE_LIMITS.behindThreshold) return { yaw: 0, pitch: 0, active: false }
  const yaw = Math.max(-GAZE_LIMITS.yaw, Math.min(GAZE_LIMITS.yaw, relYaw))
  // negative pitch offset = look up in bone space (positive X pitch nods down)
  const rawPitch = -Math.atan2(dy, horizontal)
  const pitch = Math.max(-GAZE_LIMITS.pitch, Math.min(GAZE_LIMITS.pitch, rawPitch))
  return { yaw, pitch, active: true }
}
