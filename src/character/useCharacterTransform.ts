import { useFrame } from '@react-three/fiber'
import { useRef, type RefObject } from 'react'
import type { Group } from 'three'
import { useCharacterStore } from './characterStore'
import { stepTowards } from './movement'
import type { SeatLift } from './characters/definition'

// Fallback travel speed for bodies without a measured clip pace (placeholder
// cutscene actors). Real characters travel at walkSpeedFor(walkPace) instead.
export const WALK_SPEED = 1.4

// 18H (live feedback «дёрганная»): a character TRAVELS at (close to) its walk
// clip's own authored pace, so the clip plays near timeScale 1 and the stride
// looks calm and natural. The old single global speed fast-forwarded every
// clip (up to 2x for the slowest rig) - hurried, jittery legs. The clamp
// keeps gameplay pacing reasonable for outlier clips; the residual ratio is
// still applied as timeScale in CharacterModel so feet never skate.
export function walkSpeedFor(walkPace: number): number {
  return Math.min(1.45, Math.max(0.8, walkPace))
}
// Fallback for rigs without a measured per-character seat lift: the
// downloaded sit/type clips reach for a lower surface than our desks.
const DEFAULT_CHAIR_LIFT = 0.05

export interface CharacterTransformOptions {
  walkLift?: number
  // the walk clip's own authored pace (m/s) - drives the travel speed, see
  // walkSpeedFor above
  walkPace?: number
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
      const base = options.walkPace !== undefined ? walkSpeedFor(options.walkPace) : WALK_SPEED
      const speed = base * (entity.speedMultiplier ?? 1)
      const result = stepTowards(entity.position, target, speed, delta, entity.rotationY)
      if (result.reachedTarget) {
        // settle exactly on the waypoint and notify (state transition follows)
        store.setTransform(characterId, result.position, result.rotationY)
        store.dispatchTo(characterId, { type: 'WAYPOINT_REACHED' })
      } else {
        // HOT PATH (fps): mutate the entity in place - a per-frame immutable
        // store update for every walking body allocated a fresh characters
        // record each frame and woke every store selector; nothing reads
        // positions reactively (arrival/story checks all run on STATE-change
        // notifications, renders read via refs/useFrame), so plain mutation
        // is safe and removes the per-frame GC churn.
        entity.position[0] = result.position[0]
        entity.position[1] = result.position[1]
        entity.position[2] = result.position[2]
        entity.rotationY = result.rotationY
      }
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
