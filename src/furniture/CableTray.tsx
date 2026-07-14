import { useMaterials } from '../materials/MaterialsContext'

export interface CableTrayProps {
  length: number
  position?: [number, number, number]
  rotation?: [number, number, number]
  // Local x offsets where cable bundles drop down out of the tray (e.g. one
  // per server rack below).
  drops?: number[]
  dropLength?: number
}

const TRAY_WIDTH = 0.24
const RAIL_HEIGHT = 0.06
const CABLE_COLORS = ['#d97b29', '#2166c9', '#d9c22b']

// An open overhead cable tray: base plate, two side rails, colored cable runs
// inside, and optional cable drops down to equipment below.
export function CableTray({ length, position = [0, 0, 0], rotation = [0, 0, 0], drops = [], dropLength = 0.4 }: CableTrayProps) {
  const materials = useMaterials()
  return (
    <group position={position} rotation={rotation}>
      <mesh castShadow>
        <boxGeometry args={[length, 0.02, TRAY_WIDTH]} />
        <meshStandardMaterial {...materials.metalFrame} />
      </mesh>
      {[-1, 1].map((side) => (
        <mesh key={side} position={[0, RAIL_HEIGHT / 2, (side * TRAY_WIDTH) / 2]} castShadow>
          <boxGeometry args={[length, RAIL_HEIGHT, 0.015]} />
          <meshStandardMaterial {...materials.metalFrame} />
        </mesh>
      ))}
      {CABLE_COLORS.map((color, i) => (
        <mesh
          key={color}
          position={[0, 0.03, -TRAY_WIDTH / 2 + 0.05 + i * 0.07]}
          rotation={[0, 0, Math.PI / 2]}
        >
          <cylinderGeometry args={[0.012, 0.012, length - 0.05, 8]} />
          <meshStandardMaterial color={color} roughness={0.65} metalness={0} />
        </mesh>
      ))}
      {drops.map((x, i) => (
        <mesh key={i} position={[x, -dropLength / 2, 0]}>
          <cylinderGeometry args={[0.016, 0.016, dropLength, 8]} />
          <meshStandardMaterial color={CABLE_COLORS[i % CABLE_COLORS.length]} roughness={0.65} metalness={0} />
        </mesh>
      ))}
    </group>
  )
}
