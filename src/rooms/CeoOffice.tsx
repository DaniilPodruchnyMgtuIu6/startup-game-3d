import { Wall } from '../scene/Wall'
import { GlassPartitionWithDoor } from '../furniture/GlassPartitionWithDoor'
import { CeoDesk } from '../furniture/CeoDesk'
import { CaptainChair } from '../furniture/CaptainChair'
import { WindowSkyline } from '../furniture/WindowSkyline'
import { Bookshelf } from '../furniture/Bookshelf'
import { Sofa } from '../furniture/Sofa'
import { CoffeeTable } from '../furniture/CoffeeTable'
import { Plant } from '../furniture/Plant'
import { ROOMS, roomCenter, roomSize } from '../scene/layout'

export function CeoOffice() {
  const bounds = ROOMS.ceoOffice
  const center = roomCenter(bounds)
  const { width, depth } = roomSize(bounds)

  return (
    <group position={center}>
      <GlassPartitionWithDoor axis="z" length={depth} position={[-width / 2, 0, 0]} />
      <Wall
        axis="x"
        length={width}
        center={[0, 1.4, depth / 2]}
        height={2.8}
        thickness={0.2}
        material="paint"
        doorway={{ offset: width / 2, width: 0.9 }}
      />
      <WindowSkyline position={[0, 2.5, -depth / 2 - 0.5]} />
      <CeoDesk position={[0, 0, -1.6]} />
      <CaptainChair position={[0, 0, -2.2]} />
      <Bookshelf position={[width / 2 - 0.4, 0, -1.8]} rotation={[0, -Math.PI / 2, 0]} />
      <Sofa position={[-1.6, 0, 1.6]} rotation={[0, Math.PI / 4, 0]} />
      <CoffeeTable position={[-0.6, 0, 1.9]} />
      <Plant position={[width / 2 - 0.6, 0, depth / 2 - 0.6]} />
    </group>
  )
}
