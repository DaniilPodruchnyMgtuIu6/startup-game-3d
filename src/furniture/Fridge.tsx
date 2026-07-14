import { useRef } from 'react'
import type { Group } from 'three'
import { useMaterials } from '../materials/MaterialsContext'
import { useObstacle } from '../character/useObstacle'

export interface FridgeProps {
  position?: [number, number, number]
  rotation?: [number, number, number]
}

const WIDTH = 0.7
const DEPTH = 0.7
const HEIGHT = 1.8

export function Fridge({ position = [0, 0, 0], rotation = [0, 0, 0] }: FridgeProps) {
  const materials = useMaterials()
  const group = useRef<Group>(null)
  useObstacle(group)
  return (
    <group ref={group} position={position} rotation={rotation}>
      <mesh position={[0, HEIGHT / 2, 0]} castShadow receiveShadow>
        <boxGeometry args={[WIDTH, HEIGHT, DEPTH]} />
        <meshStandardMaterial {...materials.metalChrome} />
      </mesh>
      <mesh position={[0, HEIGHT * 0.72, DEPTH / 2 + 0.002]}>
        <boxGeometry args={[WIDTH, 0.015, 0.004]} />
        <meshStandardMaterial {...materials.plasticBlack} />
      </mesh>
      <mesh position={[WIDTH / 2 - 0.05, HEIGHT * 0.55, DEPTH / 2 + 0.02]} castShadow>
        <boxGeometry args={[0.03, 0.35, 0.03]} />
        <meshStandardMaterial {...materials.plasticBlack} />
      </mesh>
    </group>
  )
}
