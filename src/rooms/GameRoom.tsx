import { GlassPartitionWithDoor } from '../furniture/GlassPartitionWithDoor'
import { PingPongTable } from '../furniture/PingPongTable'
import { PullUpBar } from '../furniture/PullUpBar'
import { Sofa } from '../furniture/Sofa'
import { CoffeeTable } from '../furniture/CoffeeTable'
import { Bookshelf } from '../furniture/Bookshelf'
import { WallPoster } from '../furniture/WallPoster'
import { useCharacterStore } from '../character/characterStore'
import { useSecurityStoryStore } from '../game/securityStoryStore'
import { ROOMS, roomCenter, roomSize } from '../scene/layout'
import { StaticMerge } from '../scene/StaticMerge'

export function GameRoom() {
  const bounds = ROOMS.gameRoom
  const center = roomCenter(bounds)
  const { width, depth } = roomSize(bounds)
  // 18E §5: the lock-screen памятка still only appears after the security
  // training beat - moved here with the poster, condition unchanged.
  const trainingIntroduced = useSecurityStoryStore((s) => s.securityBreach.status === 'completed')

  return (
    <group position={center}>
      <StaticMerge>
        {/* the doorway partition is fully static (open opening, no moving leaf) */}
        <GlassPartitionWithDoor axis="z" length={depth} position={[-width / 2, 0, 0]} />
        {/* Turned lengthwise along Z at x=+0.6 (was lengthwise along X at
            z=-1): a walkability map of the mounted room showed NO horizontal
            placement leaves both end-stands on walkable cells - the bookshelf+
            partition corner and the door leaf wall off the west end, the outer
            wall the east. Along Z both stands land in the free north (z≈3.1)
            and south (z≈7.3) bands with the 1.2m west corridor connecting them
            (mounted registry test pins both stand points). The rally BALL
            mounts later (never merged); triggers self-exempt via noMerge. */}
        <PingPongTable
          position={[0.6, 0, -0.13]}
          rotation={[0, Math.PI / 2, 0]}
          onSelectSide={(target) => useCharacterStore.getState().clickPingPong(target)}
        />
        {/* rotation -PI/2 (was +PI/2): the bar stands 0.5m from the room's +x
            wall, and +PI/2 pointed its FRONT (approach trigger at local z=0.9,
            foot plates, braces) INTO that wall - the registered stand point
            landed 0.4m OUTSIDE the room, so a player click walked/hung the
            character behind the wall. -PI/2 turns the front toward the room. */}
        <PullUpBar
          position={[width / 2 - 0.5, 0, 1.6]}
          rotation={[0, -Math.PI / 2, 0]}
          onSelect={(target) => useCharacterStore.getState().clickPullUpBar(target)}
        />
        <Sofa
          position={[-1.8, 0, 2.15]}
          rotation={[0, 59.7, 0]}
          onSelect={(target) => useCharacterStore.getState().clickSofa(target)}
        />
        <CoffeeTable position={[-1.8, 0, 1.2]} />
        <Bookshelf position={[-width / 2 + 0.4, 0, -1.8]} rotation={[0, Math.PI / 2, 0]} />
        {/* Moved here from the open space (see OpenSpace.tsx) to make room for
            the CISO competency map poster. North wall (shared with the
            kitchen, built by Kitchen.tsx), centered on it (x=0 is the wall's
            midpoint). Sits above/behind the ping-pong table when viewed from
            the room - mounted well above table height, same real-world
            arrangement as a poster over furniture. Pure visual, no rotation
            needed: default plane normal faces +Z, i.e. south into the room. */}
        <WallPoster position={[-0.45, 1.55, -depth / 2 + 0.2]} variant="officeFlow" />
        {trainingIntroduced ? (
          <WallPoster position={[0.45, 1.55, -depth / 2 + 0.2]} variant="lockScreen" />
        ) : null}
      </StaticMerge>
    </group>
  )
}
