import { useRef } from 'react'
import type { Group } from 'three'
import { RoundedBox } from '@react-three/drei'
import { useMaterials } from '../materials/MaterialsContext'
import { useObstacle } from '../character/useObstacle'
import { InteractionTrigger } from '../interaction/InteractionTrigger'
import type { TriggerTarget } from '../interaction/triggerPayload'

export interface CaptainChairProps {
  position?: [number, number, number]
  rotation?: [number, number, number]
  onSelect?: (target: TriggerTarget) => void
}

// Seat top matches the standard office Chair (0.46 + 0.03 cushion half) so the
// shared sit animation lands the character on the cushion, not inside it.
const SEAT_TOP = 0.49
const SEAT_THICKNESS = 0.09
const SEAT_WIDTH = 0.52
const SEAT_DEPTH = 0.5
// Slight recline reads as "executive" without opening a gap behind the
// character's back, which the sit clips keep near vertical.
const BACK_RECLINE = 0.09
// Armrest pads sit outside the seated character's elbows (~±0.2).
const ARM_X = 0.3
const ARM_TOP = 0.675
const BASE_ARM_LENGTH = 0.28

export function CaptainChair({ position = [0, 0, 0], rotation = [0, 0, 0], onSelect }: CaptainChairProps) {
  const materials = useMaterials()
  const group = useRef<Group>(null)
  useObstacle(group)
  const baseArmAngles = [0, 1, 2, 3, 4].map((i) => (i * Math.PI * 2) / 5)

  return (
    <group ref={group} position={position} rotation={rotation}>
      <RoundedBox
        args={[SEAT_WIDTH, SEAT_THICKNESS, SEAT_DEPTH]}
        radius={0.03}
        smoothness={4}
        position={[0, SEAT_TOP - SEAT_THICKNESS / 2, 0]}
        castShadow
        receiveShadow
      >
        <meshStandardMaterial {...materials.leather} />
      </RoundedBox>
      <group position={[0, SEAT_TOP - 0.02, -SEAT_DEPTH / 2 + 0.04]} rotation={[-BACK_RECLINE, 0, 0]}>
        <RoundedBox args={[0.5, 0.64, 0.1]} radius={0.04} smoothness={4} position={[0, 0.32, 0]} castShadow>
          <meshStandardMaterial {...materials.leather} />
        </RoundedBox>
        <RoundedBox args={[0.36, 0.2, 0.09]} radius={0.035} smoothness={4} position={[0, 0.75, 0.015]} castShadow>
          <meshStandardMaterial {...materials.leather} />
        </RoundedBox>
      </group>
      {[-1, 1].map((side) => (
        <group key={side} position={[side * ARM_X, 0, 0.02]}>
          <mesh position={[0, 0.53, 0]} castShadow>
            <cylinderGeometry args={[0.02, 0.02, 0.22, 10]} />
            <meshStandardMaterial {...materials.metalChrome} />
          </mesh>
          <RoundedBox args={[0.08, 0.04, 0.28]} radius={0.015} smoothness={4} position={[0, ARM_TOP - 0.02, 0]} castShadow>
            <meshStandardMaterial {...materials.plasticBlack} />
          </RoundedBox>
        </group>
      ))}
      <mesh position={[0, 0.4, 0]} castShadow>
        <boxGeometry args={[0.2, 0.06, 0.24]} />
        <meshStandardMaterial {...materials.plasticBlack} />
      </mesh>
      <mesh position={[0, 0.26, 0]}>
        <cylinderGeometry args={[0.024, 0.024, 0.24, 12]} />
        <meshStandardMaterial {...materials.metalChrome} />
      </mesh>
      <mesh position={[0, 0.13, 0]}>
        <cylinderGeometry args={[0.036, 0.048, 0.14, 12]} />
        <meshStandardMaterial {...materials.plasticBlack} />
      </mesh>
      <mesh position={[0, 0.05, 0]} castShadow>
        <cylinderGeometry args={[0.05, 0.06, 0.06, 12]} />
        <meshStandardMaterial {...materials.metalChrome} />
      </mesh>
      {baseArmAngles.map((angle, i) => (
        <group key={i} rotation={[0, angle, 0]}>
          <mesh position={[BASE_ARM_LENGTH / 2 + 0.02, 0.055, 0]} rotation={[0, 0, -0.14]} castShadow>
            <boxGeometry args={[BASE_ARM_LENGTH, 0.032, 0.05]} />
            <meshStandardMaterial {...materials.metalChrome} />
          </mesh>
          <mesh position={[BASE_ARM_LENGTH + 0.01, 0.032, 0]}>
            <sphereGeometry args={[0.032, 10, 10]} />
            <meshStandardMaterial {...materials.plasticBlack} />
          </mesh>
        </group>
      ))}
      <InteractionTrigger position={[0, 0.65, 0]} size={[0.6, 1.3, 0.6]} onTrigger={onSelect} kind={onSelect ? 'seat' : undefined} />
    </group>
  )
}
