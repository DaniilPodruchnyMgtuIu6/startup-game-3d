import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { Workstation } from '../furniture/Workstation'
import { Plant } from '../furniture/Plant'
import { Sofa } from '../furniture/Sofa'
import { CoffeeTable } from '../furniture/CoffeeTable'
import { TrackLight } from '../furniture/TrackLight'
import { AcousticCeilingPanel } from '../furniture/AcousticCeilingPanel'
import { Whiteboard } from '../furniture/Whiteboard'
import { WallPoster } from '../furniture/WallPoster'
import { PlanningMarker } from '../furniture/PlanningMarker'
import { useCharacterStore, PLAYER_ID } from '../character/characterStore'
import { useGameStore } from '../game/gameStore'
import { useSprintStore } from '../game/sprintStore'
import { useProductStore } from '../game/productStore'
import { isWithinMeetDistance } from '../game/meetingGeometry'
import { WHITEBOARD_POSITION, WHITEBOARD_ROTATION_Y, WHITEBOARD_APPROACH_POINT } from '../scene/whiteboardSpot'
import { ROOMS, roomCenter } from '../scene/layout'

const CLUSTER_CENTERS: [number, number][] = [
  [-3, -4],
  [3, -4],
  [-3, 4],
  [3, 4],
]
const CLUSTER_DESK_OFFSETS: [number, number][] = [
  [-1.1, -0.9],
  [1.1, -0.9],
  [-1.1, 0.9],
  [1.1, 0.9],
]
const CHAIR_COLORS = ['#c0392b', '#2166c9', '#2f9e59', '#e0a72b']

function WorkstationCluster({ center }: { center: [number, number] }) {
  return (
    <group position={[center[0], 0, center[1]]}>
      {CLUSTER_DESK_OFFSETS.map(([dx, dz], i) => (
        <Workstation
          key={i}
          position={[dx, 0, dz]}
          chairColor={CHAIR_COLORS[i % CHAIR_COLORS.length]}
          onSelect={(target) => useCharacterStore.getState().clickWorkstation(target)}
        />
      ))}
    </group>
  )
}

// The task whiteboard on the open-space face of the server-room wall (see
// scene/whiteboardSpot.ts). A far click routes the player to the board and the
// panel opens on arrival — never a teleport-open from across the office.
function OpenSpaceWhiteboard() {
  const pendingOpen = useRef(false)
  // Both store hooks MUST be called unconditionally. A `a && useSprintStore()`
  // short-circuit skips the second hook while phase !== 'free', which changes
  // the hook order across the meetPm→free transition and corrupts the useFrame
  // subscription below (React "change in order of Hooks" → R3F crash / white
  // screen). Read both, then combine.
  const gamePhase = useGameStore((s) => s.phase)
  const sprintPhase = useSprintStore((s) => s.phase)
  const showPlanningMarker = gamePhase === 'free' && sprintPhase === 'planning'

  useFrame(() => {
    if (!pendingOpen.current) return
    const player = useCharacterStore.getState().characters[PLAYER_ID]
    if (!player) {
      pendingOpen.current = false
      return
    }
    if (player.state.kind !== 'idle') return
    // Arrived (or the walk was interrupted/redirected): open only when close.
    pendingOpen.current = false
    if (isWithinMeetDistance(player.position, WHITEBOARD_POSITION)) {
      useProductStore.getState().openBoard('product')
    }
  })

  const onSelect = () => {
    const store = useCharacterStore.getState()
    if (store.inputLocked) return
    const player = store.characters[PLAYER_ID]
    if (player && isWithinMeetDistance(player.position, WHITEBOARD_POSITION)) {
      useProductStore.getState().openBoard('product')
      return
    }
    store.clickFloor([...WHITEBOARD_APPROACH_POINT])
    pendingOpen.current = true
  }

  return (
    <>
      <Whiteboard position={WHITEBOARD_POSITION} rotation={[0, WHITEBOARD_ROTATION_Y, 0]} onSelect={onSelect} />
      {showPlanningMarker ? (
        <group position={[WHITEBOARD_POSITION[0], 0, WHITEBOARD_POSITION[2]]}>
          <PlanningMarker y={2.25} />
        </group>
      ) : null}
    </>
  )
}

const PLANT_POSITIONS: [number, number][] = [
  [-5.4, -7.2],
  [5.4, -7.2],
  [-5.4, 7.2],
  [5.4, 7.2],
]

export function OpenSpace() {
  const center = roomCenter(ROOMS.openSpace)
  return (
    <group position={center}>
      {CLUSTER_CENTERS.map((c, i) => (
        <WorkstationCluster key={i} center={c} />
      ))}
      <Sofa
        position={[-1, 0, 0]}
        rotation={[0, Math.PI / 2, 0]}
        onSelect={(target) => useCharacterStore.getState().clickSofa(target)}
      />
      <CoffeeTable position={[0.1, 0, 0]} rotation={[0, Math.PI / 2, 0]} />
      <OpenSpaceWhiteboard />
      {/* Printed posters on the open-space face of the server-room wall, north
          of its door - same wall and 0.15 offset convention as the whiteboard
          (see scene/whiteboardSpot.ts), so they face the isometric camera. */}
      <WallPoster position={[-5.85, 1.55, 6.35]} rotation={[0, Math.PI / 2, 0]} variant="officeFlow" />
      <WallPoster position={[-5.85, 1.55, 7.25]} rotation={[0, Math.PI / 2, 0]} variant="lockScreen" />
      {PLANT_POSITIONS.map(([x, z], i) => (
        <Plant key={i} position={[x, 0, z]} />
      ))}
      <TrackLight position={[-3, 2.7, -4]} withSpot />
      <TrackLight position={[3, 2.7, -4]} />
      <TrackLight position={[-3, 2.7, 4]} />
      <TrackLight position={[3, 2.7, 4]} />
      <AcousticCeilingPanel position={[-1.5, 2.65, -1.5]} />
      <AcousticCeilingPanel position={[1.5, 2.65, 1.5]} />
      <AcousticCeilingPanel position={[-1.5, 2.65, 1.5]} rotation={[0, Math.PI / 2, 0]} />
    </group>
  )
}
