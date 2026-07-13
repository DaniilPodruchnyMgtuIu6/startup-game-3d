import { useMaterials } from '../materials/MaterialsContext'

export interface BarStoolProps {
  position?: [number, number, number]
  rotation?: [number, number, number]
}

const SEAT_HEIGHT = 0.75
const SEAT_RADIUS = 0.16

export function BarStool({ position = [0, 0, 0], rotation = [0, 0, 0] }: BarStoolProps) {
  const materials = useMaterials()
  return (
    <group position={position} rotation={rotation}>
      <mesh position={[0, SEAT_HEIGHT, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[SEAT_RADIUS, SEAT_RADIUS, 0.05, 20]} />
        <meshStandardMaterial {...materials.plasticBlack} />
      </mesh>
      <mesh position={[0, SEAT_HEIGHT / 2, 0]}>
        <cylinderGeometry args={[0.03, 0.03, SEAT_HEIGHT, 12]} />
        <meshStandardMaterial {...materials.metalChrome} />
      </mesh>
      <mesh position={[0, SEAT_HEIGHT * 0.35, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.14, 0.012, 8, 20]} />
        <meshStandardMaterial {...materials.metalChrome} />
      </mesh>
      <mesh position={[0, 0.01, 0]}>
        <cylinderGeometry args={[0.14, 0.14, 0.02, 20]} />
        <meshStandardMaterial {...materials.metalFrame} />
      </mesh>
    </group>
  )
}
