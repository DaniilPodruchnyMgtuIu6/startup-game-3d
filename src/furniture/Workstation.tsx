import { useLayoutEffect, useRef, useState } from 'react'
import { Vector3, type Group } from 'three'
import { Desk } from './Desk'
import { Chair } from './Chair'
import { Monitor } from './Monitor'
import { Keyboard, Mouse, Mug } from './DeskAccessories'
import { InteractionTrigger } from '../interaction/InteractionTrigger'
import type { TriggerTarget } from '../interaction/triggerPayload'
import { useCharacterStore } from '../character/characterStore'

export interface WorkstationProps {
  position?: [number, number, number]
  rotation?: [number, number, number]
  chairColor?: string
  onSelect?: (target: TriggerTarget) => void
}

// Matches the Chair's own local offset below.
const CHAIR_LOCAL: [number, number, number] = [0, 0, -0.55]
const OCCUPIED_RADIUS = 0.4
// The monitor should already be lit while someone is mid-sit (not just once
// fully settled into 'working') so it doesn't flick on a beat late.
const SEATED_STATES = new Set(['sittingDown', 'working'])

function measureChair(group: Group): [number, number] {
  group.updateWorldMatrix(true, false)
  const v = group.localToWorld(new Vector3(...CHAIR_LOCAL))
  return [v.x, v.z]
}

function nearChair(chair: [number, number], x: number, z: number): boolean {
  return Math.abs(x - chair[0]) <= OCCUPIED_RADIUS && Math.abs(z - chair[1]) <= OCCUPIED_RADIUS
}

// The screen should read as "on" while someone is seated (or actively
// settling into) this specific desk, OR while a scripted scene has marked it
// left-unlocked despite nobody being there - two independent facts, checked
// by proximity to the chair's *world* position. That position can't be read
// off the `position`/`rotation` props directly - Workstation is nested
// inside a cluster group (and that inside a room group), so the props are
// only a local offset. A group ref + updateWorldMatrix/localToWorld (the
// same pattern InteractionTrigger already uses for its own world-space
// target) resolves the real position through however many ancestors exist.
function useIsOn(group: React.RefObject<Group | null>): boolean {
  const chairRef = useRef<[number, number] | null>(null)
  const [chair, setChair] = useState<[number, number] | null>(null)

  useLayoutEffect(() => {
    if (!group.current) return
    const next = measureChair(group.current)
    chairRef.current = next
    setChair((prev) => (prev && prev[0] === next[0] && prev[1] === next[1] ? prev : next))
  }, [group])

  // Own slice: a scripted unlock must always re-render this monitor. Folding it
  // into a boolean occupancy selector with Object.is meant a remounted Monitor
  // could stay dark when the seat was already unlocked and nobody is sitting.
  const unlockedScreens = useCharacterStore((s) => s.unlockedScreens)

  const occupied = useCharacterStore((s) => {
    const c = chairRef.current
    if (!c) return false
    for (const entity of Object.values(s.characters)) {
      if (SEATED_STATES.has(entity.state.kind) && nearChair(c, entity.position[0], entity.position[2])) {
        return true
      }
    }
    return false
  })

  if (chair) {
    for (const [x, , z] of unlockedScreens) {
      if (nearChair(chair, x, z)) return true
    }
  }

  return occupied
}

export function Workstation({
  position = [0, 0, 0],
  rotation = [0, 0, 0],
  chairColor = '#3b3f46',
  onSelect,
}: WorkstationProps) {
  const group = useRef<Group>(null)
  const on = useIsOn(group)

  return (
    <group ref={group} position={position} rotation={rotation}>
      <Desk />
      <Chair position={CHAIR_LOCAL} color={chairColor} />
      <Monitor position={[0, 0.7, 0.2]} rotation={[0, Math.PI, 0]} on={on} />
      {/* Keyboard/mouse pulled closer to the chair (and down to the lowered
          desktop) to sit under the seated character's hands during typing. */}
      <Keyboard position={[0, 0.71, -0.05]} />
      <Mouse position={[-0.28, 0.715, -0.05]} />
      <Mug position={[0.28, 0.7, -0.05]} />
      <InteractionTrigger
        position={[0, 0.3, -0.55]}
        size={[0.6, 0.6, 0.6]}
        onTrigger={onSelect}
        kind={onSelect ? 'workstation' : undefined}
      />
    </group>
  )
}
