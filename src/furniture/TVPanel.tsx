import { useMaterials } from '../materials/MaterialsContext'

export interface TVPanelProps {
  position?: [number, number, number]
  rotation?: [number, number, number]
}

const WIDTH = 1.4
const HEIGHT = 0.8
const THICKNESS = 0.04

export function TVPanel({ position = [0, 0, 0], rotation = [0, 0, 0] }: TVPanelProps) {
  const materials = useMaterials()
  return (
    <group position={position} rotation={rotation}>
      <mesh castShadow>
        <boxGeometry args={[WIDTH, HEIGHT, THICKNESS]} />
        <meshStandardMaterial {...materials.plasticBlack} />
      </mesh>
      <mesh position={[0, 0, THICKNESS / 2 + 0.002]}>
        <boxGeometry args={[WIDTH - 0.04, HEIGHT - 0.04, 0.002]} />
        <meshStandardMaterial {...materials.screenDashboard} />
      </mesh>
      <mesh position={[0, 0, -THICKNESS / 2 - 0.03]}>
        <boxGeometry args={[0.3, 0.2, 0.06]} />
        <meshStandardMaterial {...materials.metalFrame} />
      </mesh>
    </group>
  )
}
