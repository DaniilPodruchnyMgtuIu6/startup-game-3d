import { useRef } from 'react'
import type { Group } from 'three'
import { useMaterials } from '../materials/MaterialsContext'
import { useObstacle } from '../character/useObstacle'
import { InteractionTrigger } from '../interaction/InteractionTrigger'
import type { TriggerTarget } from '../interaction/triggerPayload'

export interface SofaProps {
  position?: [number, number, number]
  rotation?: [number, number, number]
  onSelect?: (target: TriggerTarget) => void
}

const WIDTH = 1.6
const DEPTH = 0.75
const SEAT_HEIGHT = 0.42
const BACK_HEIGHT = 0.55
const ARM_WIDTH = 0.15
const LEG_HEIGHT = 0.12

export function Sofa({ position = [0, 0, 0], rotation = [0, 0, 0], onSelect }: SofaProps) {
  const materials = useMaterials()
  const group = useRef<Group>(null)
  useObstacle(group)
  const legX = WIDTH / 2 - 0.08
  const legZ = DEPTH / 2 - 0.08

  return (
    <group ref={group} position={position} rotation={rotation}>
      <mesh position={[0, LEG_HEIGHT + 0.18, 0]} castShadow receiveShadow>
        <boxGeometry args={[WIDTH - ARM_WIDTH * 2, 0.36, DEPTH]} />
        <meshStandardMaterial {...materials.fabricLounge} />
      </mesh>
      <mesh position={[0, LEG_HEIGHT + SEAT_HEIGHT + BACK_HEIGHT / 2, -DEPTH / 2 + 0.08]} castShadow>
        <boxGeometry args={[WIDTH - ARM_WIDTH * 2, BACK_HEIGHT, 0.16]} />
        <meshStandardMaterial {...materials.fabricLounge} />
      </mesh>
      <mesh position={[-WIDTH / 2 + ARM_WIDTH / 2, LEG_HEIGHT + 0.28, 0]} castShadow>
        <boxGeometry args={[ARM_WIDTH, 0.56, DEPTH]} />
        <meshStandardMaterial {...materials.fabricLounge} />
      </mesh>
      <mesh position={[WIDTH / 2 - ARM_WIDTH / 2, LEG_HEIGHT + 0.28, 0]} castShadow>
        <boxGeometry args={[ARM_WIDTH, 0.56, DEPTH]} />
        <meshStandardMaterial {...materials.fabricLounge} />
      </mesh>
      {[
        [-legX, -legZ],
        [legX, -legZ],
        [-legX, legZ],
        [legX, legZ],
      ].map(([x, z], i) => (
        <mesh key={i} position={[x, LEG_HEIGHT / 2, z]} castShadow>
          <cylinderGeometry args={[0.025, 0.02, LEG_HEIGHT, 8]} />
          <meshStandardMaterial {...materials.metalFrame} />
        </mesh>
      ))}
      {/* the trigger sits over the seat cushion, slightly forward, so the
          resolved sit point is on the seat rather than inside the backrest */}
      <InteractionTrigger
        position={[0, 0.6, 0.05]}
        size={[WIDTH - ARM_WIDTH * 2, 1.0, DEPTH]}
        onTrigger={onSelect}
        kind={onSelect ? 'sofa' : undefined}
      />
    </group>
  )
}
