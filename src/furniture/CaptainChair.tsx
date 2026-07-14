import { useRef } from 'react'
import type { Group } from 'three'
import { useMaterials } from '../materials/MaterialsContext'
import { useObstacle } from '../character/useObstacle'
import { InteractionTrigger } from '../interaction/InteractionTrigger'
import type { TriggerTarget } from '../interaction/triggerPayload'

export interface CaptainChairProps {
  position?: [number, number, number]
  rotation?: [number, number, number]
  onSelect?: (target: TriggerTarget) => void
}

const SEAT_SIZE = 0.5
const SEAT_HEIGHT = 0.48
const BACK_HEIGHT = 0.75
const BASE_ARM_LENGTH = 0.3

export function CaptainChair({ position = [0, 0, 0], rotation = [0, 0, 0], onSelect }: CaptainChairProps) {
  const materials = useMaterials()
  const group = useRef<Group>(null)
  useObstacle(group)
  const cylinderHeight = SEAT_HEIGHT - 0.1
  const baseArmAngles = [0, 1, 2, 3, 4].map((i) => (i * Math.PI * 2) / 5)

  return (
    <group ref={group} position={position} rotation={rotation}>
      <mesh position={[0, SEAT_HEIGHT, 0]} castShadow receiveShadow>
        <boxGeometry args={[SEAT_SIZE, 0.08, SEAT_SIZE]} />
        <meshStandardMaterial {...materials.leather} />
      </mesh>
      <mesh position={[0, SEAT_HEIGHT + BACK_HEIGHT / 2, -SEAT_SIZE / 2 + 0.04]} castShadow>
        <boxGeometry args={[SEAT_SIZE * 0.9, BACK_HEIGHT, 0.08]} />
        <meshStandardMaterial {...materials.leather} />
      </mesh>
      <mesh position={[0, SEAT_HEIGHT + BACK_HEIGHT + 0.08, -SEAT_SIZE / 2 + 0.04]} castShadow>
        <boxGeometry args={[SEAT_SIZE * 0.5, 0.16, 0.08]} />
        <meshStandardMaterial {...materials.leather} />
      </mesh>
      <mesh position={[0, SEAT_HEIGHT - cylinderHeight / 2 - 0.05, 0]}>
        <cylinderGeometry args={[0.03, 0.03, cylinderHeight, 12]} />
        <meshStandardMaterial {...materials.metalChrome} />
      </mesh>
      {baseArmAngles.map((angle, i) => (
        <group key={i} rotation={[0, angle, 0]}>
          <mesh position={[BASE_ARM_LENGTH / 2, 0.03, 0]} castShadow>
            <boxGeometry args={[BASE_ARM_LENGTH, 0.03, 0.045]} />
            <meshStandardMaterial {...materials.metalChrome} />
          </mesh>
          <mesh position={[BASE_ARM_LENGTH, 0.015, 0]}>
            <sphereGeometry args={[0.028, 8, 8]} />
            <meshStandardMaterial {...materials.plasticBlack} />
          </mesh>
        </group>
      ))}
      <InteractionTrigger position={[0, 0.6, 0]} size={[0.6, 1.2, 0.6]} onTrigger={onSelect} kind={onSelect ? 'seat' : undefined} />
    </group>
  )
}
