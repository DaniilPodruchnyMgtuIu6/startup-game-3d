import { useMaterials } from '../materials/MaterialsContext'

export interface AccessoryProps {
  position?: [number, number, number]
  rotation?: [number, number, number]
}

export function Keyboard({ position = [0, 0, 0], rotation = [0, 0, 0] }: AccessoryProps) {
  const materials = useMaterials()
  return (
    <mesh position={position} rotation={rotation} castShadow>
      <boxGeometry args={[0.44, 0.02, 0.14]} />
      <meshStandardMaterial {...materials.plasticBlack} />
    </mesh>
  )
}

export function Mouse({ position = [0, 0, 0], rotation = [0, 0, 0] }: AccessoryProps) {
  const materials = useMaterials()
  return (
    <mesh position={position} rotation={rotation} castShadow>
      <boxGeometry args={[0.06, 0.03, 0.1]} />
      <meshStandardMaterial {...materials.plasticBlack} />
    </mesh>
  )
}

export interface MugProps extends AccessoryProps {
  color?: string
}

export function Mug({ position = [0, 0, 0], rotation = [0, 0, 0], color = '#e8e2d5' }: MugProps) {
  return (
    <group position={position} rotation={rotation}>
      <mesh position={[0, 0.045, 0]} castShadow>
        <cylinderGeometry args={[0.04, 0.04, 0.09, 16]} />
        <meshStandardMaterial color={color} roughness={0.4} metalness={0} />
      </mesh>
      <mesh position={[0.045, 0.045, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.025, 0.007, 8, 16]} />
        <meshStandardMaterial color={color} roughness={0.4} metalness={0} />
      </mesh>
    </group>
  )
}
