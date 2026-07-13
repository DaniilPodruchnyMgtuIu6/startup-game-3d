import { useMaterials } from '../materials/MaterialsContext'

export interface KitchenIslandProps {
  position?: [number, number, number]
  rotation?: [number, number, number]
}

const WIDTH = 2.0
const DEPTH = 1.0
const HEIGHT = 0.9
const TOP_THICKNESS = 0.04

export function KitchenIsland({ position = [0, 0, 0], rotation = [0, 0, 0] }: KitchenIslandProps) {
  const materials = useMaterials()
  const doorWidth = WIDTH / 3 - 0.03

  return (
    <group position={position} rotation={rotation}>
      <mesh position={[0, HEIGHT - TOP_THICKNESS / 2, 0]} castShadow receiveShadow>
        <boxGeometry args={[WIDTH, TOP_THICKNESS, DEPTH]} />
        <meshStandardMaterial {...materials.metalChrome} />
      </mesh>
      {[-1, 0, 1].map((i) => (
        <mesh key={i} position={[i * (WIDTH / 3), (HEIGHT - TOP_THICKNESS) / 2, DEPTH / 2 - 0.01]} castShadow>
          <boxGeometry args={[doorWidth, HEIGHT - TOP_THICKNESS - 0.05, 0.02]} />
          <meshStandardMaterial {...materials.wallAccentBlue} />
        </mesh>
      ))}
      <mesh position={[0.5, HEIGHT - TOP_THICKNESS - 0.03, 0]}>
        <boxGeometry args={[0.4, 0.05, 0.3]} />
        <meshStandardMaterial {...materials.metalChrome} />
      </mesh>
      <mesh position={[0.5, HEIGHT + 0.15, -0.1]}>
        <cylinderGeometry args={[0.01, 0.01, 0.3, 8]} />
        <meshStandardMaterial {...materials.metalChrome} />
      </mesh>
      <mesh position={[0.5, HEIGHT + 0.28, -0.02]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.01, 0.01, 0.16, 8]} />
        <meshStandardMaterial {...materials.metalChrome} />
      </mesh>
    </group>
  )
}
