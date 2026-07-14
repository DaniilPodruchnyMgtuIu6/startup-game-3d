import { GlassPartitionWithDoor } from '../furniture/GlassPartitionWithDoor'
import { PingPongTable } from '../furniture/PingPongTable'
import { PullUpBar } from '../furniture/PullUpBar'
import { Sofa } from '../furniture/Sofa'
import { CoffeeTable } from '../furniture/CoffeeTable'
import { Bookshelf } from '../furniture/Bookshelf'
import { useCharacterStore } from '../character/characterStore'
import { ROOMS, roomCenter, roomSize } from '../scene/layout'

export function GameRoom() {
  const bounds = ROOMS.gameRoom
  const center = roomCenter(bounds)
  const { width, depth } = roomSize(bounds)

  return (
    <group position={center}>
      <GlassPartitionWithDoor axis="z" length={depth} position={[-width / 2, 0, 0]} />
      <PingPongTable position={[0, 0, -1]} />
      <PullUpBar position={[width / 2 - 0.5, 0, 1.6]} rotation={[0, Math.PI / 2, 0]} />
      <Sofa
        position={[-1.8, 0, 2.15]}
        rotation={[0, 59.7, 0]}
        onSelect={(target) => useCharacterStore.getState().clickSofa(target)}
      />
      <CoffeeTable position={[-1.8, 0, 1.2]} />
      <Bookshelf position={[-width / 2 + 0.4, 0, -1.8]} rotation={[0, Math.PI / 2, 0]} />
    </group>
  )
}
