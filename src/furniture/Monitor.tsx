import { useMaterials } from '../materials/MaterialsContext'
import { useGameOutcomeStore } from '../game/gameOutcomeStore'

export interface MonitorProps {
  position?: [number, number, number]
  rotation?: [number, number, number]
  // Whether the screen is lit - off (dark) by default so a monitor nobody
  // configured as occupied doesn't silently glow.
  on?: boolean
}

const SCREEN_WIDTH = 0.6
const SCREEN_HEIGHT = 0.35
const BODY_THICKNESS = 0.025
const NECK_HEIGHT = 0.16
const BASE_RADIUS = 0.12

export function Monitor({ position = [0, 0, 0], rotation = [0, 0, 0], on = false }: MonitorProps) {
  const materials = useMaterials()
  // 18E §5: the campaign outcome reads on the hardware - after a failure every
  // screen in the office goes dark; after the win they all show the dashboard.
  const outcome = useGameOutcomeStore((s) => s.status)
  const lit = outcome.includes('fail') ? false : outcome.includes('succe') || outcome.includes('won') ? true : on
  const baseY = 0.01
  const neckY = baseY + 0.01 + NECK_HEIGHT / 2
  const screenY = neckY + NECK_HEIGHT / 2 + SCREEN_HEIGHT / 2

  return (
    <group position={position} rotation={rotation}>
      <mesh position={[0, baseY, 0]}>
        <cylinderGeometry args={[BASE_RADIUS, BASE_RADIUS, 0.02, 24]} />
        <meshStandardMaterial {...materials.plasticBlack} />
      </mesh>
      <mesh position={[0, neckY, 0]}>
        <cylinderGeometry args={[0.02, 0.02, NECK_HEIGHT, 12]} />
        <meshStandardMaterial {...materials.metalChrome} />
      </mesh>
      <mesh position={[0, screenY, 0]} castShadow>
        <boxGeometry args={[SCREEN_WIDTH, SCREEN_HEIGHT, BODY_THICKNESS]} />
        <meshStandardMaterial {...materials.plasticBlack} />
      </mesh>
      <mesh position={[0, screenY, BODY_THICKNESS / 2 + 0.002]}>
        <boxGeometry args={[SCREEN_WIDTH - 0.03, SCREEN_HEIGHT - 0.03, 0.002]} />
        <meshStandardMaterial {...(lit ? materials.screenDashboard : materials.screenOff)} />
      </mesh>
    </group>
  )
}
