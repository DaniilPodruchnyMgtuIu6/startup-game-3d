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
import { StaticMerge } from '../scene/StaticMerge'

// Feature 16 §7/§16: the exec chair is deeper than a standard chair and its
// backrest reclines, so seating the player at the trigger's geometric centre
// lands them too far back (reads as sitting crooked / into the backrest). Seat
// them slightly forward on the cushion toward the desk instead — a dedicated,
// correct seat anchor with no visible clipping.
const EXEC_SEAT_FORWARD = 0.12

function seatPlayerInExecChair(target: { point: [number, number, number]; facing: number }) {
  const [x, , z] = target.point
  useCharacterStore.getState().clickSeat({
    point: [x + Math.sin(target.facing) * EXEC_SEAT_FORWARD, 0, z + Math.cos(target.facing) * EXEC_SEAT_FORWARD],
    facing: target.facing,
  })
}

export function CeoOffice() {
  const bounds = ROOMS.ceoOffice
  const center = roomCenter(bounds)
  const { width, depth } = roomSize(bounds)

  return (
    <group position={center}>
      {/* the DOOR partition animates - stays outside the merge */}
      <GlassPartitionWithDoor axis="z" length={depth} position={[-width / 2, 0, 0]} />
      <StaticMerge>
        <Wall axis="x" length={width} center={[0, 1.4, depth / 2]} height={2.8} thickness={0.2} material="paint" />
        {/* Desk sits 1.2m off the back wall so there is a walkable corridor
            behind the chair; the chair keeps the workstation-proven 0.2m gap to
            the desk edge so the seated character doesn't clip the top. */}
        <CeoDesk position={[0, 0, -0.85]} />
        <CaptainChair position={[0, 0, -1.55]} onSelect={seatPlayerInExecChair} />
        <Bookshelf position={[width / 2 - 0.4, 0, -1.8]} rotation={[0, -Math.PI / 2, 0]} />
        <Sofa
          position={[-1.6, 0, 2.15]}
          rotation={[0, 59.7, 0]}
          onSelect={(target) => useCharacterStore.getState().clickSofa(target)}
        />
        <CoffeeTable position={[-1.6, 0, 1.3]} />
        <Plant position={[width / 2 - 0.6, 0, depth / 2 - 0.6]} />
      </StaticMerge>
    </group>
  )
}
