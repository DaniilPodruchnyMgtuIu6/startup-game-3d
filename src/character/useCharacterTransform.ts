import { useFrame } from '@react-three/fiber'
import type { RefObject } from 'react'
import type { Group } from 'three'
import { useCharacterStore } from './characterStore'
import { stepTowards } from './movement'

// Real walking pace. The walk animations play at WALK_SPEED / walkPace of the
// character (see CharacterModel), keeping planted feet pinned to the floor -
// but the further this drifts from the clips' natural ~1.0-1.6 m/s, the more
// hurried/slowed the stride itself looks.
export const WALK_SPEED = 1.4
// The downloaded sit/type clips reach for a lower surface than our desks. Lifting
// the seated pose closes most of the gap without visibly lifting off the chair.
const SEATED_LIFT = 0.05

// Per-frame walking integration and position/rotation application, shared by
// every rendered body (skinned models and placeholder boxes alike) so they
// all move through the exact same pathfinding/state machine loop.
// `walkLift` raises the model while walking for clips whose stance foot dips
// below the idle ground level (it would clip through the floor otherwise).
export function useCharacterTransform(characterId: string, group: RefObject<Group | null>, walkLift = 0) {
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
      const seated =
        entity.state.kind === 'sittingDown' || entity.state.kind === 'working' || entity.state.kind === 'sittingIdle'
      const lift = seated ? SEATED_LIFT : entity.state.kind === 'walking' ? walkLift : 0
      const [x, y, z] = entity.position
      group.current.position.set(x, y + lift, z)
      group.current.rotation.y = entity.rotationY
    }
  })
}
