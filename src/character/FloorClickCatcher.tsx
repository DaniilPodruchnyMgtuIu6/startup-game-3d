import type { ThreeEvent } from '@react-three/fiber'
import { BUILDING } from '../scene/layout'
import { useCharacterStore } from './characterStore'

export function FloorClickCatcher() {
  const width = BUILDING.maxX - BUILDING.minX
  const depth = BUILDING.maxZ - BUILDING.minZ

  const handleClick = (event: ThreeEvent<MouseEvent>) => {
    event.stopPropagation()
    useCharacterStore.getState().clickFloor([event.point.x, 0, event.point.z])
  }

  return (
    <mesh position={[0, 0.001, 0]} rotation={[-Math.PI / 2, 0, 0]} onClick={handleClick}>
      <planeGeometry args={[width, depth]} />
      <meshBasicMaterial transparent opacity={0} depthWrite={false} />
    </mesh>
  )
}
