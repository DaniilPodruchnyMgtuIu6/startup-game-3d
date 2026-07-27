import { describe, it, expect } from 'vitest'
import { computeShot, eyePoint, type SubjectPose, type CinematicShotType } from './cinematicShots'
import { makeShotSafe, pickSafeShotSide, roomOf } from './cinematicSafety'
import { KICKOFF_SLOTS } from './meetingSlots'
import { BUILDING, ROOMS } from '../../scene/layout'

const ALL_SHOTS: CinematicShotType[] = [
  'establishing',
  'wide',
  'medium',
  'medium-close',
  'close-up',
  'over-the-shoulder',
  'two-shot',
  'three-shot',
  'insert',
  'reaction',
  'tracking',
  'dolly-in',
  'dolly-out',
]

const STANDING: SubjectPose = { position: [0, 0, 2], rotationY: Math.PI / 3 }
const SEATED: SubjectPose = { position: [2, 0, -1], rotationY: 0, seated: true }
const PARTNER: SubjectPose = { position: [1.2, 0, 2.6], rotationY: Math.PI / 3 + Math.PI }

describe('shot grammar (18D §2/§9)', () => {
  it('every shot type resolves to finite numbers (no NaN camera)', () => {
    for (const type of ALL_SHOTS) {
      const frame = computeShot(type, STANDING, { partner: PARTNER })
      for (const v of [...frame.position, ...frame.target]) {
        expect(Number.isFinite(v), `${type}: ${v}`).toBe(true)
      }
      expect(frame.durationMs).toBeGreaterThan(0)
    }
  })

  it('dialogue shots sit at character eye level, not top-down (§3)', () => {
    for (const type of ['medium', 'medium-close', 'close-up', 'over-the-shoulder', 'reaction'] as const) {
      const frame = computeShot(type, STANDING, { partner: PARTNER })
      expect(frame.position[1], type).toBeGreaterThan(1.2)
      expect(frame.position[1], type).toBeLessThan(2.0)
      expect(frame.target[1], type).toBeGreaterThan(1.2)
    }
  })

  it('a seated subject lowers the framing to seated eye height', () => {
    const seatedShot = computeShot('close-up', SEATED)
    const standingShot = computeShot('close-up', { ...SEATED, seated: false })
    expect(seatedShot.target[1]).toBeLessThan(standingShot.target[1])
    expect(eyePoint(SEATED)[1]).toBeCloseTo(1.15)
  })

  it('OTS puts the camera behind the listener looking at the speaker', () => {
    const frame = computeShot('over-the-shoulder', STANDING, { partner: PARTNER })
    // target is the speaker's eyes
    expect(frame.target[0]).toBeCloseTo(eyePoint(STANDING)[0])
    // camera is on the far side of the partner from the speaker
    const speakerToPartner = Math.hypot(PARTNER.position[0] - STANDING.position[0], PARTNER.position[2] - STANDING.position[2])
    const speakerToCamera = Math.hypot(frame.position[0] - STANDING.position[0], frame.position[2] - STANDING.position[2])
    expect(speakerToCamera).toBeGreaterThan(speakerToPartner)
  })

  it('side ±1 produces mirrored coverage (reverse angles differ)', () => {
    const left = computeShot('medium-close', STANDING, { side: -1 })
    const right = computeShot('medium-close', STANDING, { side: 1 })
    expect(Math.hypot(left.position[0] - right.position[0], left.position[2] - right.position[2])).toBeGreaterThan(0.8)
  })
})

describe('camera safety (18D §5/§9)', () => {
  it('roomOf finds the containing room and falls back to the building shell', () => {
    expect(roomOf([0, 0, 0])).toBe(ROOMS.openSpace)
    expect(roomOf([-9, 0, 7])).toBe(ROOMS.serverRoom)
    expect(roomOf([999, 0, 999])).toBe(BUILDING)
  })

  it('clamps a shot that would leave the subject room back inside it', () => {
    // subject near the server-room wall; a wide shot would exit the room
    const subject: SubjectPose = { position: [-11, 0, 7], rotationY: Math.PI }
    const safe = makeShotSafe(computeShot('wide', subject))
    const room = ROOMS.serverRoom
    expect(safe.position[0]).toBeGreaterThanOrEqual(room.minX)
    expect(safe.position[0]).toBeLessThanOrEqual(room.maxX)
    expect(safe.position[2]).toBeGreaterThanOrEqual(room.minZ)
    expect(safe.position[2]).toBeLessThanOrEqual(room.maxZ)
  })

  it('falls back to a raised in-room shot instead of entering the subject head', () => {
    // corner subject: frontal coverage would clamp into the character
    const subject: SubjectPose = { position: [-11.6, 0, 7.6], rotationY: -Math.PI / 4 }
    const safe = makeShotSafe(computeShot('close-up', subject, { side: 1 }))
    const distance = Math.hypot(safe.position[0] - subject.position[0], safe.position[2] - subject.position[2])
    expect(distance).toBeGreaterThanOrEqual(0.9)
    for (const v of [...safe.position, ...safe.target]) expect(Number.isFinite(v)).toBe(true)
  })

  it('never produces NaN for any shot anywhere in the office', () => {
    for (const room of Object.values(ROOMS)) {
      const subject: SubjectPose = { position: [(room.minX + room.maxX) / 2, 0, (room.minZ + room.maxZ) / 2], rotationY: 1 }
      for (const type of ALL_SHOTS) {
        const safe = makeShotSafe(computeShot(type, subject, { partner: PARTNER }))
        for (const v of [...safe.position, ...safe.target]) expect(Number.isFinite(v)).toBe(true)
      }
    }
  })

  it('picks the two-shot side that backs into open floor, not the whiteboard wall (18H §3/§6)', () => {
    // The REAL kickoff geometry: Sonya and Alina flank the whiteboard, their
    // axis runs almost parallel to the wall - the side=1 perpendicular dives
    // into the wall and its clamped frame stares at plaster from 0.45m (the
    // empty beige frame caught on the first live kickoff capture).
    const sonyaSlot = KICKOFF_SLOTS.find((s) => s.characterId === 'npc-female-pm')!
    const alinaSlot = KICKOFF_SLOTS.find((s) => s.characterId === 'npc-alina-belova')!
    const sonya: SubjectPose = { position: sonyaSlot.position, rotationY: sonyaSlot.facingY }
    const alina: SubjectPose = { position: alinaSlot.position, rotationY: alinaSlot.facingY }
    const side = pickSafeShotSide('two-shot', sonya, { partner: alina, durationMs: 1100 })
    const safe = makeShotSafe(computeShot('two-shot', sonya, { partner: alina, side, durationMs: 1100 }))
    expect(safe.usedFallback).toBe(false)
    const distance = Math.hypot(safe.position[0] - safe.target[0], safe.position[2] - safe.target[2])
    expect(distance).toBeGreaterThanOrEqual(2) // a real composition, not a wall-hug
    // and the rejected side is the one the wall crushes: its clamp cannot keep
    // a workable distance, so it degrades to the raised-corner fallback - the
    // picker must prefer the real eye-level composition over that cutaway
    const rejected = makeShotSafe(computeShot('two-shot', sonya, { partner: alina, side: (side * -1) as 1 | -1, durationMs: 1100 }))
    expect(rejected.usedFallback).toBe(true)
  })
})
