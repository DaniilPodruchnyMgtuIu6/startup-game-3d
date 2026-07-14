import { useRef } from 'react'
import type { Group } from 'three'
import { useMaterials } from '../materials/MaterialsContext'
import { useObstacle } from '../character/useObstacle'
import { InteractionTrigger } from '../interaction/InteractionTrigger'
import type { TriggerTarget } from '../interaction/triggerPayload'

export interface ChairProps {
  position?: [number, number, number]
  rotation?: [number, number, number]
  color?: string
  onSelect?: (target: TriggerTarget) => void
}

const SEAT_SIZE = 0.46
const SEAT_HEIGHT = 0.46
const SEAT_THICKNESS = 0.06
const BACK_HEIGHT = 0.5
const BACK_THICKNESS = 0.06
const BASE_ARM_LENGTH = 0.28

export function Chair({ position = [0, 0, 0], rotation = [0, 0, 0], color = '#3b3f46', onSelect }: ChairProps) {
  const materials = useMaterials()
  const group = useRef<Group>(null)
  useObstacle(group)
  const fabric = materials.chairFabric(color)
  const cylinderHeight = SEAT_HEIGHT - 0.1
  const baseArmAngles = [0, 1, 2, 3, 4].map((i) => (i * Math.PI * 2) / 5)

  return (
    <group ref={group} position={position} rotation={rotation}>
      <mesh position={[0, SEAT_HEIGHT, 0]} castShadow receiveShadow>
        <boxGeometry args={[SEAT_SIZE, SEAT_THICKNESS, SEAT_SIZE]} />
        <meshStandardMaterial {...fabric} />
      </mesh>
      <mesh position={[0, SEAT_HEIGHT + BACK_HEIGHT / 2, -SEAT_SIZE / 2 + BACK_THICKNESS / 2]} castShadow>
        <boxGeometry args={[SEAT_SIZE * 0.85, BACK_HEIGHT, BACK_THICKNESS]} />
        <meshStandardMaterial {...fabric} />
      </mesh>
      <mesh position={[0, SEAT_HEIGHT - cylinderHeight / 2 - 0.05, 0]}>
        <cylinderGeometry args={[0.025, 0.025, cylinderHeight, 12]} />
        <meshStandardMaterial {...materials.metalChrome} />
      </mesh>
      {baseArmAngles.map((angle, i) => (
        <group key={i} rotation={[0, angle, 0]}>
          <mesh position={[BASE_ARM_LENGTH / 2, 0.03, 0]} castShadow>
            <boxGeometry args={[BASE_ARM_LENGTH, 0.03, 0.04]} />
            <meshStandardMaterial {...materials.metalChrome} />
          </mesh>
          <mesh position={[BASE_ARM_LENGTH, 0.015, 0]}>
            <sphereGeometry args={[0.025, 8, 8]} />
            <meshStandardMaterial {...materials.plasticBlack} />
          </mesh>
        </group>
      ))}
      <InteractionTrigger position={[0, 0.5, 0]} size={[0.55, 1.0, 0.55]} onTrigger={onSelect} kind={onSelect ? 'seat' : undefined} />
    </group>
  )
}
