import { useMaterials } from '../materials/MaterialsContext'

export interface CoffeeTableProps {
  position?: [number, number, number]
  rotation?: [number, number, number]
}

const WIDTH = 0.9
const DEPTH = 0.5
const HEIGHT = 0.4
const TOP_THICKNESS = 0.03

export function CoffeeTable({ position = [0, 0, 0], rotation = [0, 0, 0] }: CoffeeTableProps) {
  const materials = useMaterials()
  const legHeight = HEIGHT - TOP_THICKNESS
  const legX = WIDTH / 2 - 0.06
  const legZ = DEPTH / 2 - 0.06

  return (
    <group position={position} rotation={rotation}>
      <mesh position={[0, HEIGHT - TOP_THICKNESS / 2, 0]} castShadow receiveShadow>
        <boxGeometry args={[WIDTH, TOP_THICKNESS, DEPTH]} />
        <meshStandardMaterial {...materials.woodDesktop} />
      </mesh>
      {[
        [-legX, -legZ],
        [legX, -legZ],
        [-legX, legZ],
        [legX, legZ],
      ].map(([x, z], i) => (
        <mesh key={i} position={[x, legHeight / 2, z]} castShadow>
          <cylinderGeometry args={[0.02, 0.02, legHeight, 8]} />
          <meshStandardMaterial {...materials.metalChrome} />
        </mesh>
      ))}
    </group>
  )
}
