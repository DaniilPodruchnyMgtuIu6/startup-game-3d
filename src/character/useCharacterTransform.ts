import { useFrame } from '@react-three/fiber'
import type { RefObject } from 'react'
import type { Group } from 'three'
import { useCharacterStore } from './characterStore'
import { stepTowards } from './movement'

const WALK_SPEED = 1.4
// The downloaded sit/type clips reach for a lower surface than our desks. Lifting
// the seated pose closes most of the gap without visibly lifting off the chair.
const SEATED_LIFT = 0.05

// Per-frame walking integration and position/rotation application, shared by
// every rendered body (skinned models and placeholder boxes alike) so they
// all move through the exact same pathfinding/state machine loop.
export function useCharacterTransform(characterId: string, group: RefObject<Group | null>) {
  useFrame((_, delta) => {
    const store = useCharacterStore.getState()
    const entity = store.characters[characterId]
    if (!entity) return
    if (entity.state.kind === 'walking') {
      const target = entity.state.path[entity.state.nextIndex]
      const result = stepTowards(entity.position, target, WALK_SPEED, delta, entity.rotationY)
      store.setTransform(characterId, result.position, result.rotationY)
      if (result.reachedTarget) store.dispatchTo(characterId, { type: 'WAYPOINT_REACHED' })
    }
    if (group.current) {
      const seated =
        entity.state.kind === 'sittingDown' || entity.state.kind === 'working' || entity.state.kind === 'sittingIdle'
      const [x, y, z] = entity.position
      group.current.position.set(x, y + (seated ? SEATED_LIFT : 0), z)
      group.current.rotation.y = entity.rotationY
    }
  })
}
