import { Wall } from '../scene/Wall'
import { GlassPartitionWithDoor } from '../furniture/GlassPartitionWithDoor'
import { KitchenIsland } from '../furniture/KitchenIsland'
import { CoffeeMachine } from '../furniture/CoffeeMachine'
import { BarStool } from '../furniture/BarStool'
import { Fridge } from '../furniture/Fridge'
import { Plant } from '../furniture/Plant'
import { ROOMS, roomCenter, roomSize } from '../scene/layout'

const STOOL_X = [-0.7, 0, 0.7]

export function Kitchen() {
  const bounds = ROOMS.kitchen
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
      <KitchenIsland position={[0, 0, -0.6]} />
      <CoffeeMachine position={[0.7, 0.9, -0.6]} />
      {STOOL_X.map((x) => (
        <BarStool key={x} position={[x, 0, 0.3]} />
      ))}
      <Fridge position={[width / 2 - 0.5, 0, depth / 2 - 0.5]} />
      <Plant position={[-width / 2 + 0.6, 0, depth / 2 - 0.6]} />
    </group>
  )
}
