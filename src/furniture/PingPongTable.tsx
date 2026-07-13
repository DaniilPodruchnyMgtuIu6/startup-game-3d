import { useMaterials } from '../materials/MaterialsContext'

export interface PingPongTableProps {
  position?: [number, number, number]
  rotation?: [number, number, number]
}

const LENGTH = 2.74
const WIDTH = 1.525
const HEIGHT = 0.76
const TOP_THICKNESS = 0.03
const NET_HEIGHT = 0.15

export function PingPongTable({ position = [0, 0, 0], rotation = [0, 0, 0] }: PingPongTableProps) {
  const materials = useMaterials()
  const legHeight = HEIGHT - TOP_THICKNESS
  const legX = LENGTH / 2 - 0.1
  const legZ = WIDTH / 2 - 0.1

  return (
    <group position={position} rotation={rotation}>
      <mesh position={[0, HEIGHT - TOP_THICKNESS / 2, 0]} castShadow receiveShadow>
        <boxGeometry args={[LENGTH, TOP_THICKNESS, WIDTH]} />
        <meshStandardMaterial color="#1d5f8a" roughness={0.5} metalness={0} />
      </mesh>
      <mesh position={[0, HEIGHT + 0.001, 0]}>
        <boxGeometry args={[0.02, 0.001, WIDTH]} />
        <meshStandardMaterial color="#ffffff" roughness={0.6} metalness={0} />
      </mesh>
      <mesh position={[0, HEIGHT + NET_HEIGHT / 2, 0]}>
        <boxGeometry args={[0.01, NET_HEIGHT, WIDTH + 0.1]} />
        <meshStandardMaterial color="#1a1a1a" roughness={0.9} metalness={0} transparent opacity={0.75} />
      </mesh>
      {[-1, 1].map((side) => (
        <mesh key={side} position={[0, HEIGHT + NET_HEIGHT / 2, (side * (WIDTH + 0.1)) / 2]}>
          <cylinderGeometry args={[0.012, 0.012, NET_HEIGHT, 8]} />
          <meshStandardMaterial {...materials.metalChrome} />
        </mesh>
      ))}
      {[
        [-legX, -legZ],
        [legX, -legZ],
        [-legX, legZ],
        [legX, legZ],
      ].map(([x, z], i) => (
        <mesh key={i} position={[x, legHeight / 2, z]} castShadow>
          <boxGeometry args={[0.06, legHeight, 0.06]} />
          <meshStandardMaterial {...materials.metalFrame} />
        </mesh>
      ))}
    </group>
  )
}
