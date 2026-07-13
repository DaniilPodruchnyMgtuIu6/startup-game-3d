import { useMaterials } from '../materials/MaterialsContext'

export interface SignageProps {
  position?: [number, number, number]
  rotation?: [number, number, number]
}

export function Signage({ position = [0, 0, 0], rotation = [0, 0, 0] }: SignageProps) {
  const materials = useMaterials()
  return (
    <group position={position} rotation={rotation}>
      <mesh castShadow>
        <boxGeometry args={[1.4, 0.9, 0.04]} />
        <meshStandardMaterial {...materials.wallAccentBlue} />
      </mesh>
      <mesh position={[0, 0, 0.05]}>
        <torusGeometry args={[0.22, 0.03, 12, 32]} />
        <meshStandardMaterial {...materials.metalChrome} />
      </mesh>
      <mesh position={[0.28, 0.1, 0.06]}>
        <sphereGeometry args={[0.05, 16, 16]} />
        <meshStandardMaterial color="#ffb020" emissive="#ffb020" emissiveIntensity={1.5} roughness={0.4} />
      </mesh>
    </group>
  )
}
