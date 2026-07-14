import { Wall } from '../scene/Wall'
import { GlassPartitionWithDoor } from '../furniture/GlassPartitionWithDoor'
import { CeoDesk } from '../furniture/CeoDesk'
import { CaptainChair } from '../furniture/CaptainChair'
import { Bookshelf } from '../furniture/Bookshelf'
import { Sofa } from '../furniture/Sofa'
import { CoffeeTable } from '../furniture/CoffeeTable'
import { Plant } from '../furniture/Plant'
import { useCharacterStore } from '../character/characterStore'
import { ROOMS, roomCenter, roomSize } from '../scene/layout'

export function CeoOffice() {
  const bounds = ROOMS.ceoOffice
  const center = roomCenter(bounds)
  const { width, depth } = roomSize(bounds)

  return (
    <group position={center}>
      <GlassPartitionWithDoor axis="z" length={depth} position={[-width / 2, 0, 0]} />
      <Wall axis="x" length={width} center={[0, 1.4, depth / 2]} height={2.8} thickness={0.2} material="paint" />
      <CeoDesk position={[0, 0, -1.6]} />
      <CaptainChair position={[0, 0, -2.2]} onSelect={(target) => useCharacterStore.getState().clickSeat(target)} />
      <Bookshelf position={[width / 2 - 0.4, 0, -1.8]} rotation={[0, -Math.PI / 2, 0]} />
      <Sofa
        position={[-1.6, 0, 2.15]}
        rotation={[0, 59.7, 0]}
        onSelect={(target) => useCharacterStore.getState().clickSofa(target)}
      />
      <CoffeeTable position={[-1.6, 0, 1.3]} />
      <Plant position={[width / 2 - 0.6, 0, depth / 2 - 0.6]} />
    </group>
  )
}
