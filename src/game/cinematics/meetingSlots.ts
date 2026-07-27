// 18H Wave 1 (§3-§4): meeting slots and the participant readiness barrier for
// group scenes. Pure data + store-driven helpers - the conversation cinematic
// and WorkdayFlow use these to GATHER the cast before the first line.
import { useCharacterStore, PLAYER_ID } from '../../character/characterStore'
import { nearestWalkable } from '../../character/grid'
import { releaseClaims } from '../../interaction/interactionRegistry'
import { WHITEBOARD_POSITION } from '../../scene/whiteboardSpot'

export interface CinematicMeetingSlot {
  id: string
  characterId: string
  position: [number, number, number]
  // yaw the participant faces once arrived (radians, game convention)
  facingY: number
  required: boolean
  minSeparationMeters: number
}

// The kickoff semicircle in front of the whiteboard (board at x≈-5.85,z=3.7,
// facing +x). Sonya presents beside the board; the others fan out facing it.
// Slots sit in open floor (walkable strip checked against the nav grid at
// runtime via nearestWalkable) and keep >=0.9m separation.
const BOARD_X = WHITEBOARD_POSITION[0]
const BOARD_Z = WHITEBOARD_POSITION[2]
const faceBoard = (x: number, z: number) => Math.atan2(BOARD_X - x, BOARD_Z - z)

export const KICKOFF_SLOTS: CinematicMeetingSlot[] = [
  { id: 'meeting-slot-sonya', characterId: 'npc-female-pm', position: [BOARD_X + 0.8, 0, BOARD_Z - 0.9], facingY: Math.PI * 0.15, required: true, minSeparationMeters: 0.9 },
  { id: 'meeting-slot-player', characterId: PLAYER_ID, position: [BOARD_X + 2.6, 0, BOARD_Z + 0.5], facingY: faceBoard(BOARD_X + 2.6, BOARD_Z + 0.5), required: false, minSeparationMeters: 0.9 },
  // NB x+2.9/z-0.9 (was x+2.2/z-0.6): the original mark sat inside the
  // [-3,4]-cluster desk footprint+margin - found by the walkability test,
  // gather was silently diverting Kirill via nearestWalkable every kickoff.
  { id: 'meeting-slot-kirill', characterId: 'npc-kirill-morozov', position: [BOARD_X + 2.9, 0, BOARD_Z - 0.9], facingY: faceBoard(BOARD_X + 2.9, BOARD_Z - 0.9), required: true, minSeparationMeters: 0.9 },
  // NB x+1.0/z+0.4 (was x+2.0/z+1.5): the original mark sat inside the other
  // [-3,4]-cluster desk - same walkability finding as Kirill's slot above.
  // Now in the wall-side walkable strip (same strip as the board approach
  // point), north of the board mirroring Sonya presenting on its south side.
  { id: 'meeting-slot-alina', characterId: 'npc-alina-belova', position: [BOARD_X + 1.0, 0, BOARD_Z + 0.4], facingY: faceBoard(BOARD_X + 1.0, BOARD_Z + 0.4), required: true, minSeparationMeters: 0.9 },
  { id: 'meeting-slot-ilya', characterId: 'npc-ilya-vlasov', position: [BOARD_X + 3.1, 0, BOARD_Z + 1.7], facingY: faceBoard(BOARD_X + 3.1, BOARD_Z + 1.7), required: false, minSeparationMeters: 0.9 },
]

export function slotSeparationViolations(slots: CinematicMeetingSlot[]): string[] {
  const violations: string[] = []
  for (let i = 0; i < slots.length; i++) {
    for (let j = i + 1; j < slots.length; j++) {
      const a = slots[i]
      const b = slots[j]
      const distance = Math.hypot(a.position[0] - b.position[0], a.position[2] - b.position[2])
      const min = Math.max(a.minSeparationMeters, b.minSeparationMeters)
      if (distance < min) violations.push(`${a.id}<->${b.id}: ${distance.toFixed(2)}m < ${min}m`)
    }
  }
  return violations
}

export const ARRIVAL_TOLERANCE_M = 0.55
// Navigation-failure guard, not a sync mechanism: after this the laggard is
// snapped onto its slot (same policy as the cutscene director's walk timeout).
const GATHER_TIMEOUT_MS = 9000
// Settled states a participant may hold while "standing at the slot".
const READY_STATES = new Set(['idle', 'talking', 'performing', 'looking'])

export function isParticipantReady(characterId: string, slot: CinematicMeetingSlot): boolean {
  const entity = useCharacterStore.getState().characters[characterId]
  if (!entity) return false
  const distance = Math.hypot(entity.position[0] - slot.position[0], entity.position[2] - slot.position[2])
  return distance <= ARRIVAL_TOLERANCE_M && READY_STATES.has(entity.state.kind)
}

// Walk every participant to its slot and resolve when the required ones are
// ready. Presence is evaluated LIVE, not snapshotted at call time: on a day-1
// reload the kickoff effect runs before the NPC controllers mount and spawn
// the cast, and a start-time snapshot saw an EMPTY office - the gather
// resolved vacuously and the first line opened over people still walking in.
// A missing OPTIONAL participant (Ilya without a hire) is skippable; a
// missing REQUIRED one keeps the gather open until the timeout guard, then
// resolves with a diagnostic rather than hanging or silently dropping (§4).
export function gatherParticipants(slots: CinematicMeetingSlot[]): Promise<{ gathered: string[]; timedOut: string[] }> {
  const ordered = new Set<string>()
  const orderWalks = () => {
    const store = useCharacterStore.getState()
    for (const slot of slots) {
      if (ordered.has(slot.characterId)) continue
      if (!store.characters[slot.characterId]) continue // not spawned yet - re-checked on every store change
      ordered.add(slot.characterId)
      // Already standing on the slot in a settled state: skip the walk order.
      // Re-issuing CLICK_FLOOR here would still bounce idle->walking->idle once
      // the per-frame loop ticks WAYPOINT_REACHED - harmless but pointless churn.
      if (isParticipantReady(slot.characterId, slot)) continue
      releaseClaims(slot.characterId)
      store.dispatchTo(slot.characterId, { type: 'CLICK_FLOOR', point: nearestWalkable(slot.position) })
    }
  }
  const settledOrSkippable = (slot: CinematicMeetingSlot) => {
    if (!useCharacterStore.getState().characters[slot.characterId]) return !slot.required
    return isParticipantReady(slot.characterId, slot)
  }
  orderWalks()
  return new Promise((resolve) => {
    const finish = (timedOut: string[]) => {
      // Unsubscribe first: the setTransform calls below notify this same
      // listener, and re-entering finish() while still subscribed recurses
      // (every slot is already "ready", so check() would call finish() again
      // for each setTransform, and again, until the call stack overflows).
      cleanup()
      // snap stragglers onto their slot (never start a scene on an empty mark)
      // and align everyone's facing toward the board/group
      const chars = useCharacterStore.getState()
      for (const slot of slots) {
        const entity = chars.characters[slot.characterId]
        if (!entity) continue
        if (!isParticipantReady(slot.characterId, slot)) {
          chars.setTransform(slot.characterId, nearestWalkable(slot.position), slot.facingY)
          chars.dispatchTo(slot.characterId, { type: 'TALK_END' }) // no-op unless mid-talk
        } else {
          chars.setTransform(slot.characterId, entity.position, slot.facingY)
        }
      }
      resolve({
        gathered: slots.filter((s) => chars.characters[s.characterId]).map((s) => s.characterId),
        timedOut,
      })
    }
    const check = () => {
      orderWalks() // late spawners get their walk order the moment they appear
      if (slots.every(settledOrSkippable)) finish([])
    }
    const unsubscribe = useCharacterStore.subscribe(check)
    const timer = setTimeout(() => finish(slots.filter((slot) => !settledOrSkippable(slot)).map((s) => s.characterId)), GATHER_TIMEOUT_MS)
    const cleanup = () => {
      unsubscribe()
      clearTimeout(timer)
    }
    check()
  })
}
