import { GlassPartition } from './GlassPartition'
import { useMaterials } from '../materials/MaterialsContext'
import { BUILDING } from '../scene/layout'

export interface GlassPartitionWithDoorProps {
  axis: 'x' | 'z'
  length: number
  position: [number, number, number]
}

const DOOR_WIDTH = 0.9
const DOOR_HEIGHT = 2.1
const BAR_HEIGHT = 0.05
const THICKNESS = 0.05

// A glazed partition with an open doorway: two glass runs, a clear
// walk-through opening (no door leaf), and a glazed transom above it so the
// glass line continues over the doorway.
export function GlassPartitionWithDoor({ axis, length, position }: GlassPartitionWithDoorProps) {
  const materials = useMaterials()
  const segmentLength = (length - DOOR_WIDTH) / 2
  const offset = segmentLength / 2 + DOOR_WIDTH / 2
  const segA: [number, number, number] =
    axis === 'x' ? [position[0] - offset, position[1], position[2]] : [position[0], position[1], position[2] - offset]
  const segB: [number, number, number] =
    axis === 'x' ? [position[0] + offset, position[1], position[2]] : [position[0], position[1], position[2] + offset]

  const size = (span: number, h: number): [number, number, number] =>
    axis === 'x' ? [span, h, THICKNESS] : [THICKNESS, h, span]
  const transomGlassHeight = BUILDING.wallHeight - DOOR_HEIGHT - BAR_HEIGHT * 2

  return (
    <group>
      <GlassPartition axis={axis} length={segmentLength} position={segA} />
      <GlassPartition axis={axis} length={segmentLength} position={segB} />
      {/* transom over the doorway: head bar, glass, top header */}
      <mesh position={[position[0], DOOR_HEIGHT + BAR_HEIGHT / 2, position[2]]} castShadow>
        <boxGeometry args={size(DOOR_WIDTH, BAR_HEIGHT)} />
        <meshStandardMaterial {...materials.metalFrame} />
      </mesh>
      <mesh position={[position[0], DOOR_HEIGHT + BAR_HEIGHT + transomGlassHeight / 2, position[2]]}>
        <boxGeometry args={size(DOOR_WIDTH, transomGlassHeight)} />
        <meshPhysicalMaterial {...materials.glass} />
      </mesh>
      <mesh position={[position[0], BUILDING.wallHeight - BAR_HEIGHT / 2, position[2]]} castShadow>
        <boxGeometry args={size(DOOR_WIDTH, BAR_HEIGHT)} />
        <meshStandardMaterial {...materials.metalFrame} />
      </mesh>
    </group>
  )
}
