import { Wall } from '../scene/Wall'
import { GlassPartitionWithDoor } from '../furniture/GlassPartitionWithDoor'
import { Workstation } from '../furniture/Workstation'
import { useCharacterStore } from '../character/characterStore'
import type { TriggerTarget } from '../interaction/triggerPayload'
import { ROOMS, roomCenter, roomSize } from '../scene/layout'

export function FocusRoom() {
  const bounds = ROOMS.focusRoom
  const center = roomCenter(bounds)
  const { width, depth } = roomSize(bounds)
  const onSelect = (target: TriggerTarget) => useCharacterStore.getState().clickWorkstation(target)

  return (
    <group position={center}>
      <GlassPartitionWithDoor axis="z" length={depth} position={[width / 2, 0, 0]} />
      <Wall axis="x" length={width} center={[0, 1.4, depth / 2]} height={2.8} thickness={0.2} material="paint" />
      <Workstation position={[-1.5, 0, 0]} chairColor="#5c6b78" onSelect={onSelect} />
      <Workstation position={[1.5, 0, 0]} rotation={[0, Math.PI, 0]} chairColor="#5c6b78" onSelect={onSelect} />
    </group>
  )
}
