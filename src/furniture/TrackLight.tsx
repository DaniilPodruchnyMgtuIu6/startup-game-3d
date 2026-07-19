import { useMaterials } from '../materials/MaterialsContext'

export interface TrackLightProps {
  position?: [number, number, number]
  rotation?: [number, number, number]
  withSpot?: boolean
}

const RAIL_LENGTH = 1.6
const FIXTURE_OFFSETS = [-0.55, 0, 0.55]

export function TrackLight({ position = [0, 0, 0], rotation = [0, 0, 0], withSpot = false }: TrackLightProps) {
  const materials = useMaterials()
  return (
    <group position={position} rotation={rotation}>
      <mesh castShadow>
        <boxGeometry args={[RAIL_LENGTH, 0.04, 0.06]} />
        <meshStandardMaterial {...materials.metalFrame} />
      </mesh>
      {FIXTURE_OFFSETS.map((x, i) => (
        <mesh key={i} position={[x, -0.06, 0]} castShadow>
          <cylinderGeometry args={[0.03, 0.04, 0.08, 12]} />
          <meshStandardMaterial {...materials.metalChrome} />
        </mesh>
      ))}
      {/* No castShadow on the accent spotlight: the scene's directional light
          already casts the primary shadows, and a per-light shadow pass every
          frame is a big cost on integrated GPUs for little visual gain. */}
      {withSpot && <spotLight position={[0, -0.1, 0]} angle={0.5} penumbra={0.6} intensity={8} distance={6} />}
    </group>
  )
}
