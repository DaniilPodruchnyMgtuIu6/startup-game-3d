import { useFrame } from '@react-three/fiber'
import { useRef, type RefObject } from 'react'
import type { Group } from 'three'
import { useCharacterStore } from './characterStore'
import { stepTowards } from './movement'
import type { SeatLift } from './characters/definition'

// Real walking pace. The walk animations play at WALK_SPEED / walkPace of the
// character (see CharacterModel), keeping planted feet pinned to the floor -
// but the further this drifts from the clips' natural ~1.0-1.6 m/s, the more
// hurried/slowed the stride itself looks.
export const WALK_SPEED = 1.4
// Fallback for rigs without a measured per-character seat lift: the
// downloaded sit/type clips reach for a lower surface than our desks.
const DEFAULT_CHAIR_LIFT = 0.05

export interface CharacterTransformOptions {
  walkLift?: number
  // 18H §11 (live feedback «девочки ниже - другая высота посадки»): the five
  // rigs' seated Hips land 8-12cm apart on the SAME furniture. Per-character
  // lifts (measured per pose family, see each character definition) put every
  // body on the same seat plane - shorter rigs must NOT sink into cushions.
  seatLift?: SeatLift
}

// Per-frame walking integration and position/rotation application, shared by
// every rendered body (skinned models and placeholder boxes alike) so they
// all move through the exact same pathfinding/state machine loop.
export function useCharacterTransform(
  characterId: string,
  group: RefObject<Group | null>,
  options: CharacterTransformOptions = {},
) {
  // smoothed vertical correction: the sit-down clip STARTS standing, so the
  // seat lift ramps in over the transition instead of floating the character
  // the moment the walk ends; standing back up sheds it quickly.
  const appliedLift = useRef(0)

  useFrame((_, delta) => {
    const store = useCharacterStore.getState()
    const entity = store.characters[characterId]
    if (!entity) return
    if (entity.state.kind === 'walking') {
      const target = entity.state.path[entity.state.nextIndex]
      const speed = WALK_SPEED * (entity.speedMultiplier ?? 1)
      const result = stepTowards(entity.position, target, speed, delta, entity.rotationY)
      store.setTransform(characterId, result.position, result.rotationY)
      if (result.reachedTarget) store.dispatchTo(characterId, { type: 'WAYPOINT_REACHED' })
    }
    if (group.current) {
      const kind = entity.state.kind
      const seat = options.seatLift
      let targetLift = 0
      if (kind === 'sittingDown' || kind === 'working') targetLift = seat?.sit ?? DEFAULT_CHAIR_LIFT
      else if (kind === 'sittingIdle') targetLift = seat?.sitIdle ?? DEFAULT_CHAIR_LIFT
      else if (kind === 'sofaSitting') targetLift = seat?.sofa ?? 0
      else if (kind === 'walking') targetLift = options.walkLift ?? 0
      // slow ramp INTO a seat (the one-shot clip is still standing at first),
      // quick release everywhere else
      const rate = targetLift > appliedLift.current && kind === 'sittingDown' ? 1.2 : 8
      appliedLift.current += (targetLift - appliedLift.current) * (1 - Math.exp(-delta * rate))
      if (Math.abs(targetLift - appliedLift.current) < 0.002) appliedLift.current = targetLift
      const [x, y, z] = entity.position
      group.current.position.set(x, y + appliedLift.current, z)
      group.current.rotation.y = entity.rotationY
    }
  })
}
