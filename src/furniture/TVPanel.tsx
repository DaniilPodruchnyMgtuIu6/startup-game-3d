import { useMaterials } from '../materials/MaterialsContext'
import { useGameOutcomeStore } from '../game/gameOutcomeStore'

export interface TVPanelProps {
  position?: [number, number, number]
  rotation?: [number, number, number]
}

const WIDTH = 1.4
const HEIGHT = 0.8
const THICKNESS = 0.04

export function TVPanel({ position = [0, 0, 0], rotation = [0, 0, 0] }: TVPanelProps) {
  const materials = useMaterials()
  // 18E §5: after a campaign failure the shared TV goes dark with the rest of
  // the office; it keeps the dashboard in every other state (incl. success).
  const failed = useGameOutcomeStore((s) => s.status.includes('fail'))
  return (
    <group position={position} rotation={rotation}>
      <mesh castShadow>
        <boxGeometry args={[WIDTH, HEIGHT, THICKNESS]} />
        <meshStandardMaterial {...materials.plasticBlack} />
      </mesh>
      {/* StaticMerge: the screen material swaps on the campaign outcome */}
      <mesh position={[0, 0, THICKNESS / 2 + 0.002]} userData={{ noMerge: true }}>
        <boxGeometry args={[WIDTH - 0.04, HEIGHT - 0.04, 0.002]} />
        <meshStandardMaterial {...(failed ? materials.screenOff : materials.screenDashboard)} />
      </mesh>
      <mesh position={[0, 0, -THICKNESS / 2 - 0.03]}>
        <boxGeometry args={[0.3, 0.2, 0.06]} />
        <meshStandardMaterial {...materials.metalFrame} />
      </mesh>
    </group>
  )
}
