import { useMaterials } from '../materials/MaterialsContext'

export interface ServerRackProps {
  position?: [number, number, number]
  rotation?: [number, number, number]
}

const WIDTH = 0.6
const DEPTH = 1.0
const HEIGHT = 2.0
const UNIT_COUNT = 8
const UNIT_HEIGHT = 0.18
const UNIT_GAP = 0.02
const LED_COLORS = ['ledGreen', 'ledAmber'] as const

export function ServerRack({ position = [0, 0, 0], rotation = [0, 0, 0] }: ServerRackProps) {
  const materials = useMaterials()
  const stackHeight = UNIT_COUNT * (UNIT_HEIGHT + UNIT_GAP)
  const startY = HEIGHT - 0.15 - stackHeight

  return (
    <group position={position} rotation={rotation}>
      <mesh position={[0, HEIGHT / 2, 0]} castShadow receiveShadow>
        <boxGeometry args={[WIDTH, HEIGHT, DEPTH]} />
        <meshStandardMaterial {...materials.plasticBlack} />
      </mesh>
      {[-1, 1].map((side) => (
        <mesh key={side} position={[(side * WIDTH) / 2 + side * 0.005, HEIGHT / 2, 0]} castShadow>
          <boxGeometry args={[0.01, HEIGHT - 0.02, DEPTH - 0.02]} />
          <meshStandardMaterial {...materials.metalFrame} />
        </mesh>
      ))}
      {Array.from({ length: UNIT_COUNT }, (_, i) => {
        const y = startY + i * (UNIT_HEIGHT + UNIT_GAP)
        const ledKey = LED_COLORS[i % 2]
        return (
          <group key={i}>
            <mesh position={[0, y, DEPTH / 2 + 0.005]} castShadow>
              <boxGeometry args={[WIDTH - 0.04, UNIT_HEIGHT, 0.01]} />
              <meshStandardMaterial {...materials.metalFrame} />
            </mesh>
            <mesh position={[WIDTH / 2 - 0.06, y, DEPTH / 2 + 0.012]}>
              <sphereGeometry args={[0.008, 8, 8]} />
              <meshStandardMaterial {...materials[ledKey]} />
            </mesh>
          </group>
        )
      })}
    </group>
  )
}
