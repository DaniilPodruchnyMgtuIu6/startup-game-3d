import { useMaterials } from '../materials/MaterialsContext'
import { BUILDING } from '../scene/layout'

export interface GlassPartitionProps {
  axis: 'x' | 'z'
  length: number
  position: [number, number, number]
  rotation?: [number, number, number]
}

const KICK_HEIGHT = 0.1
const HEADER_HEIGHT = 0.05
const MULLION_WIDTH = 0.06
const MULLION_SPACING = 1.2
const THICKNESS = 0.05

export function GlassPartition({ axis, length, position, rotation = [0, 0, 0] }: GlassPartitionProps) {
  const materials = useMaterials()
  const glassHeight = BUILDING.wallHeight - KICK_HEIGHT - HEADER_HEIGHT
  const size = (span: number, h: number): [number, number, number] =>
    axis === 'x' ? [span, h, THICKNESS] : [THICKNESS, h, span]

  const mullionCount = Math.max(1, Math.floor(length / MULLION_SPACING))
  const mullionOffsets = Array.from({ length: mullionCount + 1 }, (_, i) => (i / mullionCount - 0.5) * length)

  return (
    <group position={position} rotation={rotation}>
      <mesh position={[0, KICK_HEIGHT / 2, 0]} castShadow receiveShadow>
        <boxGeometry args={size(length, KICK_HEIGHT)} />
        <meshStandardMaterial {...materials.metalFrame} />
      </mesh>
      <mesh position={[0, KICK_HEIGHT + glassHeight / 2, 0]}>
        <boxGeometry args={size(length - MULLION_WIDTH, glassHeight)} />
        <meshPhysicalMaterial {...materials.glass} />
      </mesh>
      <mesh position={[0, BUILDING.wallHeight - HEADER_HEIGHT / 2, 0]} castShadow>
        <boxGeometry args={size(length, HEADER_HEIGHT)} />
        <meshStandardMaterial {...materials.metalFrame} />
      </mesh>
      {mullionOffsets.map((offset, i) => (
        <mesh
          key={i}
          position={axis === 'x' ? [offset, KICK_HEIGHT + glassHeight / 2, 0] : [0, KICK_HEIGHT + glassHeight / 2, offset]}
          castShadow
        >
          <boxGeometry args={size(MULLION_WIDTH, glassHeight)} />
          <meshStandardMaterial {...materials.metalFrame} />
        </mesh>
      ))}
    </group>
  )
}
