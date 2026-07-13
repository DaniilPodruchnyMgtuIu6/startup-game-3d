import { GlassPartition } from './GlassPartition'
import { GlassDoor } from './GlassDoor'

export interface GlassPartitionWithDoorProps {
  axis: 'x' | 'z'
  length: number
  position: [number, number, number]
}

const DOOR_WIDTH = 0.9

export function GlassPartitionWithDoor({ axis, length, position }: GlassPartitionWithDoorProps) {
  const segmentLength = (length - DOOR_WIDTH) / 2
  const offset = segmentLength / 2 + DOOR_WIDTH / 2
  const segA: [number, number, number] =
    axis === 'x' ? [position[0] - offset, position[1], position[2]] : [position[0], position[1], position[2] - offset]
  const segB: [number, number, number] =
    axis === 'x' ? [position[0] + offset, position[1], position[2]] : [position[0], position[1], position[2] + offset]
  const doorRotationY = axis === 'x' ? 0 : Math.PI / 2

  return (
    <group>
      <GlassPartition axis={axis} length={segmentLength} position={segA} />
      <GlassPartition axis={axis} length={segmentLength} position={segB} />
      <GlassDoor position={position} rotation={[0, doorRotationY, 0]} />
    </group>
  )
}
