// Feature 18D §2/§4: pure shot grammar. Given where the subjects stand, every
// shot type resolves to ONE deterministic camera frame (position + target) at
// character eye level - the isometric top-down look is banned for emotional
// lines (§3) and survives only as a brief establishing option. No three.js
// here: plain vector math, fully unit-testable.
import { EYE_HEIGHT_STANDING, EYE_HEIGHT_SEATED } from '../../character/performance/gaze'

export type Point = [number, number, number]

export type CinematicShotType =
  | 'establishing'
  | 'wide'
  | 'medium'
  | 'medium-close'
  | 'close-up'
  | 'over-the-shoulder'
  | 'two-shot'
  | 'three-shot'
  | 'insert'
  | 'reaction'
  | 'tracking'
  | 'dolly-in'
  | 'dolly-out'

export interface SubjectPose {
  position: Point
  rotationY: number
  seated?: boolean
}

export interface ShotFrame {
  position: Point
  target: Point
  durationMs: number
}

// Camera distance per shot type (meters from the subject's eyes). Tuned on
// in-game captures: closer than this cuts the hairline at the rig's 40° FOV.
const SHOT_DISTANCE: Partial<Record<CinematicShotType, number>> = {
  'close-up': 1.35,
  'medium-close': 1.9,
  medium: 2.6,
  reaction: 1.9,
  'over-the-shoulder': 2.0,
  wide: 4.5,
  establishing: 6.5,
}

export function eyeHeightOf(subject: SubjectPose): number {
  return subject.seated ? EYE_HEIGHT_SEATED : EYE_HEIGHT_STANDING
}

export function eyePoint(subject: SubjectPose): Point {
  const [x, y, z] = subject.position
  return [x, y + eyeHeightOf(subject), z]
}

// A point `distance` away from the subject's eyes, rotated `azimuthOffset`
// radians from the direction the subject FACES (0 = straight in front).
function orbitPoint(subject: SubjectPose, distance: number, azimuthOffset: number, height: number): Point {
  const yaw = subject.rotationY + azimuthOffset
  const [x, , z] = subject.position
  return [x + Math.sin(yaw) * distance, height, z + Math.cos(yaw) * distance]
}

// 18H §6: the safe-wide group shot must show EVERY present participant - a
// two-shot spanning the two farthest-apart members covers the whole group
// (everyone else stands between them), and the wider axis pushes the camera
// further back (distance scales with the pair separation). Pure; ties keep
// the earliest pair, so the result is deterministic for a fixed cast order.
export function widestPairIndices(positions: Point[]): [number, number] {
  let best: [number, number] = [0, positions.length - 1]
  let bestDistance = -1
  for (let i = 0; i < positions.length; i++) {
    for (let j = i + 1; j < positions.length; j++) {
      const distance = Math.hypot(positions[i][0] - positions[j][0], positions[i][2] - positions[j][2])
      if (distance > bestDistance) {
        bestDistance = distance
        best = [i, j]
      }
    }
  }
  return best
}

export interface ShotOptions {
  // The conversation partner: OTS/two-shot frames need both people.
  partner?: SubjectPose
  // Alternate shot sides between lines so reverse angles feel like coverage,
  // not a static camera: +1 = camera right of the eyeline, -1 = left.
  side?: 1 | -1
  durationMs?: number
}

// Resolve one shot to a camera frame. Every branch produces finite numbers for
// finite inputs; safety clamping (rooms/walls) happens in cinematicSafety.
export function computeShot(type: CinematicShotType, subject: SubjectPose, opts: ShotOptions = {}): ShotFrame {
  const side = opts.side ?? 1
  const durationMs = opts.durationMs ?? 900
  const eye = eyePoint(subject)
  const eyeY = eye[1]

  switch (type) {
    case 'close-up':
    case 'medium-close':
    case 'medium':
    case 'reaction': {
      // Frontal coverage, offset ~30° off the nose toward the chosen side.
      // Seated subjects sit behind desks/monitors: swing wider around the
      // furniture and lift the lens over it; slight down-angle with the target
      // a touch below the eyes keeps natural headroom (no cropped hairlines).
      const seated = subject.seated === true
      const distance = SHOT_DISTANCE[type]! + (seated ? 0.35 : 0)
      const azimuth = side * (seated ? 0.95 : 0.55)
      const height = eyeY + (seated ? 0.35 : type === 'medium' ? 0.16 : 0.12)
      const position = orbitPoint(subject, distance, azimuth, height)
      const target: Point = [eye[0], eye[1] - 0.07, eye[2]]
      return { position, target, durationMs }
    }
    case 'over-the-shoulder': {
      const partner = opts.partner ?? subject
      // camera sits behind/over the partner's shoulder, looking at the subject
      const partnerEye = eyePoint(partner)
      const dx = eye[0] - partnerEye[0]
      const dz = eye[2] - partnerEye[2]
      const len = Math.hypot(dx, dz) || 1
      const back = 0.85 // behind the partner
      const lateral = 0.42 * side // over one shoulder
      const position: Point = [
        partnerEye[0] - (dx / len) * back + (-dz / len) * lateral,
        partnerEye[1] + 0.12,
        partnerEye[2] - (dz / len) * back + (dx / len) * lateral,
      ]
      return { position, target: eye, durationMs }
    }
    case 'two-shot':
    case 'three-shot': {
      const partner = opts.partner ?? subject
      const a = eyePoint(subject)
      const b = eyePoint(partner)
      const mid: Point = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2 - 0.1, (a[2] + b[2]) / 2]
      const dx = b[0] - a[0]
      const dz = b[2] - a[2]
      const len = Math.hypot(dx, dz) || 1
      const distance = Math.max(2.4, len * 1.6)
      // perpendicular to the A-B axis, eye level
      const position: Point = [mid[0] + (-dz / len) * distance * side, mid[1] + 0.15, mid[2] + (dx / len) * distance * side]
      return { position, target: mid, durationMs }
    }
    case 'insert': {
      // tight look at a prop point: subject.position IS the prop here
      const position: Point = [subject.position[0] + 0.7 * side, subject.position[1] + 0.75, subject.position[2] + 0.7]
      return { position, target: subject.position, durationMs }
    }
    case 'dolly-in': {
      const position = orbitPoint(subject, 1.35, side * 0.4, eyeY)
      return { position, target: eye, durationMs: opts.durationMs ?? 2400 }
    }
    case 'dolly-out':
    case 'tracking':
    case 'wide': {
      const position = orbitPoint(subject, SHOT_DISTANCE.wide!, side * 0.7, eyeY + 1.1)
      return { position, target: [subject.position[0], 1.0, subject.position[2]], durationMs: opts.durationMs ?? 1600 }
    }
    case 'establishing': {
      // the ONLY legally high shot - a brief orienting view (§3)
      const position = orbitPoint(subject, SHOT_DISTANCE.establishing!, side * 0.9, eyeY + 3.2)
      return { position, target: [subject.position[0], 0.9, subject.position[2]], durationMs: opts.durationMs ?? 1400 }
    }
  }
}
