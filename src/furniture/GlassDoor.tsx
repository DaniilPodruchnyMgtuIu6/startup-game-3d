import { useMaterials } from '../materials/MaterialsContext'

export interface GlassDoorProps {
  position?: [number, number, number]
  rotation?: [number, number, number]
}

const DOOR_WIDTH = 0.9
const DOOR_HEIGHT = 2.1
const FRAME_WIDTH = 0.05
const THICKNESS = 0.04

export function GlassDoor({ position = [0, 0, 0], rotation = [0, 0, 0] }: GlassDoorProps) {
  const materials = useMaterials()
  const innerWidth = DOOR_WIDTH - FRAME_WIDTH * 2
  const innerHeight = DOOR_HEIGHT - FRAME_WIDTH * 2

  return (
    <group position={position} rotation={rotation}>
      <mesh position={[0, DOOR_HEIGHT / 2, 0]}>
        <boxGeometry args={[innerWidth, innerHeight, THICKNESS]} />
        <meshPhysicalMaterial {...materials.glass} />
      </mesh>
      <mesh position={[0, FRAME_WIDTH / 2, 0]} castShadow>
        <boxGeometry args={[DOOR_WIDTH, FRAME_WIDTH, THICKNESS]} />
        <meshStandardMaterial {...materials.metalFrame} />
      </mesh>
      <mesh position={[0, DOOR_HEIGHT - FRAME_WIDTH / 2, 0]} castShadow>
        <boxGeometry args={[DOOR_WIDTH, FRAME_WIDTH, THICKNESS]} />
        <meshStandardMaterial {...materials.metalFrame} />
      </mesh>
      <mesh position={[-DOOR_WIDTH / 2 + FRAME_WIDTH / 2, DOOR_HEIGHT / 2, 0]} castShadow>
        <boxGeometry args={[FRAME_WIDTH, DOOR_HEIGHT, THICKNESS]} />
        <meshStandardMaterial {...materials.metalFrame} />
      </mesh>
      <mesh position={[DOOR_WIDTH / 2 - FRAME_WIDTH / 2, DOOR_HEIGHT / 2, 0]} castShadow>
        <boxGeometry args={[FRAME_WIDTH, DOOR_HEIGHT, THICKNESS]} />
        <meshStandardMaterial {...materials.metalFrame} />
      </mesh>
      <mesh position={[DOOR_WIDTH / 2 - 0.12, DOOR_HEIGHT / 2, THICKNESS / 2 + 0.01]}>
        <cylinderGeometry args={[0.012, 0.012, 0.25, 8]} />
        <meshStandardMaterial {...materials.metalChrome} />
      </mesh>
    </group>
  )
}
