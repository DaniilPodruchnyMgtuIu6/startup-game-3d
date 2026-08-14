import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { Workstation } from '../furniture/Workstation'
import { Plant } from '../furniture/Plant'
import { Sofa } from '../furniture/Sofa'
import { CoffeeTable } from '../furniture/CoffeeTable'
import { Whiteboard } from '../furniture/Whiteboard'
import { WallPoster } from '../furniture/WallPoster'
import { AuditPapers } from '../furniture/AuditPapers'
import { PlanningMarker } from '../furniture/PlanningMarker'
import { useSecurityAuditStore } from '../game/securityAuditStore'
import { usePosterViewerStore } from '../game/posterViewerStore'
import { useCharacterStore, PLAYER_ID } from '../character/characterStore'
import { useGameStore } from '../game/gameStore'
import { useSprintStore } from '../game/sprintStore'
import { useProductStore } from '../game/productStore'
import { isWithinMeetDistance } from '../game/meetingGeometry'
import { WHITEBOARD_POSITION, WHITEBOARD_ROTATION_Y, WHITEBOARD_APPROACH_POINT } from '../scene/whiteboardSpot'
import { ROOMS, roomCenter } from '../scene/layout'
import { StaticMerge } from '../scene/StaticMerge'

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
  // 18E §5: environmental storytelling, deterministic from persisted stores.
  // Audit paperwork piles onto Sonya's desk while a corrective plan is open.
  const auditPlanOpen = useSecurityAuditStore((s) =>
    ['scheduled', 'pending', 'running', 'critical-escalation'].includes(s.followUpAudit.status),
  )
  return (
    <group position={center}>
      {/* 18H §21: the open space alone was ~500 meshes (22 workstations x
          13-mesh chairs + desks + monitors + decor) - the dominant share of
          the 2690 draw calls. Everything static bakes into a handful of
          merged meshes; triggers and live monitor screens are exempted via
          userData.noMerge, dynamic/conditional pieces stay outside. */}
      <StaticMerge>
        {CLUSTER_CENTERS.map((c, i) => (
          <WorkstationCluster key={i} center={c} />
        ))}
        <CoffeeTable position={[0.1, 0, 0]} rotation={[0, Math.PI / 2, 0]} />
        {PLANT_POSITIONS.map(([x, z], i) => (
          <Plant key={i} position={[x, 0, z]} />
        ))}
      </StaticMerge>
      <Sofa
        position={[-1, 0, 0]}
        rotation={[0, Math.PI / 2, 0]}
        onSelect={(target) => useCharacterStore.getState().clickSofa(target)}
      />
      <OpenSpaceWhiteboard />
      {/* Interactive - kept outside StaticMerge (hover outline + click need a
          real per-object mesh, not a batched draw call). Click opens the full
          scan fullscreen so the small print is actually readable. Hangs where
          the officeFlow/lockScreen posters used to be - those moved to the
          game room (see GameRoom.tsx). */}
      <WallPoster
        position={[-5.85, 1.55, 6.8]}
        rotation={[0, Math.PI / 2, 0]}
        variant="cisoMap"
        label="Карта знаний CISO"
        onSelect={() => usePosterViewerStore.getState().openPosterViewer('/documents/ciso_competency_map_full.jpg')}
      />
      {auditPlanOpen ? <AuditPapers position={[-1.55, 0.7, 4.55]} rotation={[0, 0.35, 0]} /> : null}
    </group>
  )
}
