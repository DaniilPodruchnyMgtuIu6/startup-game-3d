import { useMaterials } from '../materials/MaterialsContext'

export interface WallPosterProps {
  position?: [number, number, number]
  rotation?: [number, number, number]
  variant: 'officeFlow' | 'lockScreen'
}

const WIDTH = 0.62
const HEIGHT = 0.82
const FRAME_DEPTH = 0.02

// Framed printed poster hung on a wall (open-space decor). Pure visual - it
// registers no obstacle and no interaction, like the acoustic ceiling panels.
export function WallPoster({ position = [0, 0, 0], rotation = [0, 0, 0], variant }: WallPosterProps) {
  const materials = useMaterials()
  const poster = variant === 'officeFlow' ? materials.posterOfficeFlow : materials.posterLockScreen
  return (
    <group position={position} rotation={rotation}>
      <mesh castShadow>
        <boxGeometry args={[WIDTH + 0.05, HEIGHT + 0.05, FRAME_DEPTH]} />
        <meshStandardMaterial {...materials.plasticBlack} />
      </mesh>
      <mesh position={[0, 0, FRAME_DEPTH / 2 + 0.002]}>
        <planeGeometry args={[WIDTH, HEIGHT]} />
        <meshStandardMaterial {...poster} />
      </mesh>
    </group>
  )
}
