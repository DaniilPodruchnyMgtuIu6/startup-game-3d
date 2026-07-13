import { useMaterials } from '../materials/MaterialsContext'
import { InteractionTrigger } from '../interaction/InteractionTrigger'
import type { TriggerTarget } from '../interaction/triggerPayload'

export interface CoffeeMachineProps {
  position?: [number, number, number]
  rotation?: [number, number, number]
  onSelect?: (target: TriggerTarget) => void
}

export function CoffeeMachine({ position = [0, 0, 0], rotation = [0, 0, 0], onSelect }: CoffeeMachineProps) {
  const materials = useMaterials()
  return (
    <group position={position} rotation={rotation}>
      <mesh position={[0, 0.2, 0]} castShadow receiveShadow>
        <boxGeometry args={[0.3, 0.4, 0.4]} />
        <meshStandardMaterial {...materials.metalChrome} />
      </mesh>
      <mesh position={[-0.12, 0.38, -0.15]} castShadow>
        <boxGeometry args={[0.06, 0.22, 0.1]} />
        <meshStandardMaterial color="#8fb8d9" roughness={0.15} metalness={0} transparent opacity={0.6} />
      </mesh>
      <mesh position={[0, 0.02, 0.05]}>
        <boxGeometry args={[0.24, 0.02, 0.25]} />
        <meshStandardMaterial {...materials.metalChrome} />
      </mesh>
      <mesh position={[0.05, 0.32, 0.201]}>
        <boxGeometry args={[0.08, 0.04, 0.002]} />
        <meshStandardMaterial {...materials.screenEmissive} />
      </mesh>
      <mesh position={[0, 0.22, 0.15]} castShadow>
        <cylinderGeometry args={[0.012, 0.012, 0.12, 8]} />
        <meshStandardMaterial {...materials.plasticBlack} />
      </mesh>
      <InteractionTrigger position={[0, 0.3, 0.4]} size={[0.5, 0.8, 0.5]} onTrigger={onSelect} />
    </group>
  )
}
