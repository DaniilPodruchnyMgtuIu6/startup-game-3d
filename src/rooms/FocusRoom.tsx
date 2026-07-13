import { Wall } from '../scene/Wall'
import { GlassPartitionWithDoor } from '../furniture/GlassPartitionWithDoor'
import { Workstation } from '../furniture/Workstation'
import { ROOMS, roomCenter, roomSize } from '../scene/layout'

export function FocusRoom() {
  const bounds = ROOMS.focusRoom
  const center = roomCenter(bounds)
  const { width, depth } = roomSize(bounds)

  return (
    <group position={center}>
      <GlassPartitionWithDoor axis="z" length={depth} position={[width / 2, 0, 0]} />
      <Wall
        axis="x"
        length={width}
        center={[0, 1.4, depth / 2]}
        height={2.8}
        thickness={0.2}
        material="paint"
        doorway={{ offset: width / 2, width: 0.9 }}
      />
      <Workstation position={[-1.5, 0, 0]} chairColor="#5c6b78" />
      <Workstation position={[1.5, 0, 0]} rotation={[0, Math.PI, 0]} chairColor="#5c6b78" />
    </group>
  )
}
