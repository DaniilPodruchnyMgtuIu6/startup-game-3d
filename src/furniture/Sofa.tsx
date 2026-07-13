import { useMaterials } from '../materials/MaterialsContext'

export interface SofaProps {
  position?: [number, number, number]
  rotation?: [number, number, number]
}

const WIDTH = 1.6
const DEPTH = 0.75
const SEAT_HEIGHT = 0.42
const BACK_HEIGHT = 0.55
const ARM_WIDTH = 0.15
const LEG_HEIGHT = 0.12

export function Sofa({ position = [0, 0, 0], rotation = [0, 0, 0] }: SofaProps) {
  const materials = useMaterials()
  const legX = WIDTH / 2 - 0.08
  const legZ = DEPTH / 2 - 0.08

  return (
    <group position={position} rotation={rotation}>
      <mesh position={[0, LEG_HEIGHT + 0.18, 0]} castShadow receiveShadow>
        <boxGeometry args={[WIDTH - ARM_WIDTH * 2, 0.36, DEPTH]} />
        <meshStandardMaterial {...materials.fabricLounge} />
      </mesh>
      <mesh position={[0, LEG_HEIGHT + SEAT_HEIGHT + BACK_HEIGHT / 2, -DEPTH / 2 + 0.08]} castShadow>
        <boxGeometry args={[WIDTH - ARM_WIDTH * 2, BACK_HEIGHT, 0.16]} />
        <meshStandardMaterial {...materials.fabricLounge} />
      </mesh>
      <mesh position={[-WIDTH / 2 + ARM_WIDTH / 2, LEG_HEIGHT + 0.28, 0]} castShadow>
        <boxGeometry args={[ARM_WIDTH, 0.56, DEPTH]} />
        <meshStandardMaterial {...materials.fabricLounge} />
      </mesh>
      <mesh position={[WIDTH / 2 - ARM_WIDTH / 2, LEG_HEIGHT + 0.28, 0]} castShadow>
        <boxGeometry args={[ARM_WIDTH, 0.56, DEPTH]} />
        <meshStandardMaterial {...materials.fabricLounge} />
      </mesh>
      {[
        [-legX, -legZ],
        [legX, -legZ],
        [-legX, legZ],
        [legX, legZ],
      ].map(([x, z], i) => (
        <mesh key={i} position={[x, LEG_HEIGHT / 2, z]} castShadow>
          <cylinderGeometry args={[0.025, 0.02, LEG_HEIGHT, 8]} />
          <meshStandardMaterial {...materials.metalFrame} />
        </mesh>
      ))}
    </group>
  )
}
