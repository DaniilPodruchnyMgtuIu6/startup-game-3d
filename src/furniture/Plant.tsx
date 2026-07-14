import { useRef } from 'react'
import type { Group } from 'three'
import { useObstacle } from '../character/useObstacle'

export interface PlantProps {
  position?: [number, number, number]
  rotation?: [number, number, number]
  scale?: number
}

const POT_HEIGHT = 0.3
const POT_TOP_RADIUS = 0.2
const POT_BOTTOM_RADIUS = 0.15

const FOLIAGE_CLUSTERS: { position: [number, number, number]; radius: number }[] = [
  { position: [0, 0.75, 0], radius: 0.28 },
  { position: [0.15, 0.6, 0.1], radius: 0.2 },
  { position: [-0.18, 0.55, -0.08], radius: 0.22 },
  { position: [0.05, 0.95, -0.15], radius: 0.18 },
  { position: [-0.1, 0.9, 0.16], radius: 0.17 },
  { position: [0.02, 1.1, 0.02], radius: 0.14 },
]

export function Plant({ position = [0, 0, 0], rotation = [0, 0, 0], scale = 1 }: PlantProps) {
  const group = useRef<Group>(null)
  useObstacle(group)
  return (
    <group ref={group} position={position} rotation={rotation} scale={scale}>
      <mesh position={[0, POT_HEIGHT / 2, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[POT_TOP_RADIUS, POT_BOTTOM_RADIUS, POT_HEIGHT, 16]} />
        <meshStandardMaterial color="#5c4a3a" roughness={0.85} metalness={0} />
      </mesh>
      {FOLIAGE_CLUSTERS.map((cluster, i) => (
        <mesh key={i} position={cluster.position} castShadow>
          <sphereGeometry args={[cluster.radius, 10, 8]} />
          <meshStandardMaterial color={i % 2 === 0 ? '#2f6b3a' : '#3c8248'} roughness={0.9} metalness={0} />
        </mesh>
      ))}
    </group>
  )
}
