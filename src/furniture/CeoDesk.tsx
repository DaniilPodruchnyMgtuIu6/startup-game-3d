import { useRef } from 'react'
import type { Group } from 'three'
import { useMaterials } from '../materials/MaterialsContext'
import { useObstacle } from '../character/useObstacle'

export interface CeoDeskProps {
  position?: [number, number, number]
  rotation?: [number, number, number]
}

const WIDTH = 2.0
const DEPTH = 1.0
const HEIGHT = 0.75
const TOP_THICKNESS = 0.05

export function CeoDesk({ position = [0, 0, 0], rotation = [0, 0, 0] }: CeoDeskProps) {
  const materials = useMaterials()
  const group = useRef<Group>(null)
  useObstacle(group)
  const pedestalWidth = 0.5
  const pedestalHeight = HEIGHT - TOP_THICKNESS
  const pedestalX = WIDTH / 2 - pedestalWidth / 2 - 0.05

  return (
    <group ref={group} position={position} rotation={rotation}>
      <mesh position={[0, HEIGHT - TOP_THICKNESS / 2, 0]} castShadow receiveShadow>
        <boxGeometry args={[WIDTH, TOP_THICKNESS, DEPTH]} />
        <meshStandardMaterial color="#3a2a20" roughness={0.4} metalness={0} />
      </mesh>
      <mesh position={[0, pedestalHeight / 2, -DEPTH / 2 + 0.05]} castShadow>
        <boxGeometry args={[WIDTH - 1.1, pedestalHeight - 0.1, 0.03]} />
        <meshStandardMaterial color="#3a2a20" roughness={0.4} metalness={0} />
      </mesh>
      {[-1, 1].map((side) => (
        <mesh key={side} position={[side * pedestalX, pedestalHeight / 2, 0]} castShadow receiveShadow>
          <boxGeometry args={[pedestalWidth, pedestalHeight, DEPTH - 0.1]} />
          <meshStandardMaterial {...materials.metalFrame} />
        </mesh>
      ))}
    </group>
  )
}
