import { Wall } from '../scene/Wall'
import { GlassPartitionWithDoor } from '../furniture/GlassPartitionWithDoor'
import { MeetingTable } from '../furniture/MeetingTable'
import { Chair } from '../furniture/Chair'
import { TVPanel } from '../furniture/TVPanel'
import { Whiteboard } from '../furniture/Whiteboard'
import { PlanningMarker } from '../furniture/PlanningMarker'
import { TrackLight } from '../furniture/TrackLight'
import { useCharacterStore } from '../character/characterStore'
import { useGameStore } from '../game/gameStore'
import { useSprintStore } from '../game/sprintStore'
import { useProductStore } from '../game/productStore'
import type { TriggerTarget } from '../interaction/triggerPayload'
import { ROOMS, roomCenter, roomSize } from '../scene/layout'

const CHAIR_X = [-1.1, -0.4, 0.4, 1.1]

export function MeetingRoom() {
  const bounds = ROOMS.meetingRoom
  const center = roomCenter(bounds)
  const { width, depth } = roomSize(bounds)
  const onSeat = (target: TriggerTarget) => useCharacterStore.getState().clickSeat(target)
  // Highlight the whiteboard while the player must plan the sprint.
  const showPlanningMarker = useGameStore((s) => s.phase) === 'free' && useSprintStore((s) => s.phase) === 'planning'

  return (
    <group position={center}>
      <GlassPartitionWithDoor axis="z" length={depth} position={[width / 2, 0, 0]} />
      <Wall axis="x" length={width} center={[0, 1.4, depth / 2]} height={2.8} thickness={0.2} material="paint" />
      {/* solid white wall along the west (window) side - the TV hangs on it */}
      <Wall axis="z" length={depth} center={[-width / 2 + 0.25, 1.4, 0]} height={2.8} thickness={0.2} material="paint" />
      <MeetingTable />
      {CHAIR_X.map((x) => (
        <Chair key={`n-${x}`} position={[x, 0, -1.1]} color="#2c3e50" onSelect={onSeat} />
      ))}
      {CHAIR_X.map((x) => (
        <Chair key={`s-${x}`} position={[x, 0, 1.1]} rotation={[0, Math.PI, 0]} color="#2c3e50" onSelect={onSeat} />
      ))}
      <TVPanel position={[-width / 2 + 0.42, 1.6, 0]} rotation={[0, Math.PI / 2, 0]} />
      <Whiteboard
        position={[0, 1.4, depth / 2 - 0.15]}
        rotation={[0, Math.PI, 0]}
        onSelect={() => useProductStore.getState().openBoard('product')}
      />
      {showPlanningMarker ? (
        <group position={[0, 0, depth / 2 - 0.15]}>
          <PlanningMarker y={2.25} />
        </group>
      ) : null}
      <TrackLight position={[0, 2.7, -1]} withSpot />
    </group>
  )
}
