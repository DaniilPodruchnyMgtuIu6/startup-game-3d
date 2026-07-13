import { useMaterials } from '../materials/MaterialsContext'

export interface PullUpBarProps {
  position?: [number, number, number]
  rotation?: [number, number, number]
}

const WIDTH = 1.2
const HEIGHT = 2.2
const BAR_Y = 2.0
const POST_RADIUS = 0.035

export function PullUpBar({ position = [0, 0, 0], rotation = [0, 0, 0] }: PullUpBarProps) {
  const materials = useMaterials()
  const postX = WIDTH / 2

  return (
    <group position={position} rotation={rotation}>
      {[-1, 1].map((side) => (
        <mesh key={side} position={[side * postX, HEIGHT / 2, 0]} castShadow>
          <cylinderGeometry args={[POST_RADIUS, POST_RADIUS, HEIGHT, 12]} />
          <meshStandardMaterial {...materials.metalFrame} />
        </mesh>
      ))}
      <mesh position={[0, BAR_Y, 0]} rotation={[0, 0, Math.PI / 2]} castShadow>
        <cylinderGeometry args={[0.02, 0.02, WIDTH, 12]} />
        <meshStandardMaterial {...materials.metalChrome} />
      </mesh>
      {[-1, 1].map((side) => (
        <mesh key={`foot-${side}`} position={[side * postX, 0.02, 0.3]} castShadow receiveShadow>
          <boxGeometry args={[0.12, 0.04, 0.7]} />
          <meshStandardMaterial {...materials.metalFrame} />
        </mesh>
      ))}
      {[-1, 1].map((side) => (
        <mesh
          key={`brace-${side}`}
          position={[side * postX * 0.6, HEIGHT * 0.35, 0.2]}
          rotation={[Math.PI / 5, 0, 0]}
          castShadow
        >
          <cylinderGeometry args={[0.018, 0.018, 0.9, 8]} />
          <meshStandardMaterial {...materials.metalFrame} />
        </mesh>
      ))}
    </group>
  )
}
