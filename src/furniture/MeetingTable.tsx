import { useRef } from 'react'
import type { Group } from 'three'
import { useMaterials } from '../materials/MaterialsContext'
import { useObstacle } from '../character/useObstacle'

export interface MeetingTableProps {
  position?: [number, number, number]
  rotation?: [number, number, number]
}

const LENGTH = 3.2
const WIDTH = 1.2
const HEIGHT = 0.75
const TOP_THICKNESS = 0.04

export function MeetingTable({ position = [0, 0, 0], rotation = [0, 0, 0] }: MeetingTableProps) {
  const materials = useMaterials()
  const group = useRef<Group>(null)
  useObstacle(group)
  const legHeight = HEIGHT - TOP_THICKNESS
  const legX = LENGTH / 2 - 0.15
  const legZ = WIDTH / 2 - 0.15

  return (
    <group ref={group} position={position} rotation={rotation}>
      <mesh position={[0, HEIGHT - TOP_THICKNESS / 2, 0]} castShadow receiveShadow>
        <boxGeometry args={[LENGTH, TOP_THICKNESS, WIDTH]} />
        <meshStandardMaterial {...materials.woodDesktop} />
      </mesh>
      {[
        [-legX, -legZ],
        [legX, -legZ],
        [-legX, legZ],
        [legX, legZ],
      ].map(([x, z], i) => (
        <mesh key={i} position={[x, legHeight / 2, z]} castShadow>
          <boxGeometry args={[0.08, legHeight, 0.08]} />
          <meshStandardMaterial {...materials.metalFrame} />
        </mesh>
      ))}
    </group>
  )
}
