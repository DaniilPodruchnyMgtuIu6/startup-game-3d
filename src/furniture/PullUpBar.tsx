import { useRef } from 'react'
import type { Group } from 'three'
import { useMaterials } from '../materials/MaterialsContext'
import { useObstacle } from '../character/useObstacle'
import { InteractionTrigger } from '../interaction/InteractionTrigger'
import type { TriggerTarget } from '../interaction/triggerPayload'

export interface PullUpBarProps {
  position?: [number, number, number]
  rotation?: [number, number, number]
  onSelect?: (target: TriggerTarget) => void
}

const WIDTH = 1.2
const HEIGHT = 2.2
const BAR_Y = 2.0
const POST_RADIUS = 0.035

export function PullUpBar({ position = [0, 0, 0], rotation = [0, 0, 0], onSelect }: PullUpBarProps) {
  const materials = useMaterials()
  // Only the POST/CROSSBAR line registers as a nav obstacle. The full group's
  // bounds (foot plates depth 0.7m + braces) plus the grid's character-radius
  // inflation used to wall off ~1.7m in front of the bar - the approach point
  // itself became unwalkable and every mount diverted. The 4cm-tall floor
  // plates are fine to step over, and the braces sit behind the approach with
  // a real wall behind them - no path exists there to protect.
  const obstacleLine = useRef<Group>(null)
  useObstacle(obstacleLine)
  const postX = WIDTH / 2

  return (
    <group position={position} rotation={rotation}>
      <group ref={obstacleLine}>
        {[-1, 1].map((side) => (
          <mesh key={side} position={[side * postX, HEIGHT / 2, 0]} castShadow>
            <cylinderGeometry args={[POST_RADIUS, POST_RADIUS, HEIGHT, 12]} />
            <meshStandardMaterial {...materials.metalFrame} />
          </mesh>
        ))}
        <mesh position={[0, BAR_Y, 0]} rotation={[0, 0, Math.PI / 2]} castShadow>
          <cylinderGeometry args={[0.02, 0.02, WIDTH, 12]} />
          <meshStandardMaterial {...materials.metalChrome} />
        </mesh>
      </group>
      {[-1, 1].map((side) => (
        <mesh key={`foot-${side}`} position={[side * postX, 0.02, 0.3]} castShadow receiveShadow>
          <boxGeometry args={[0.12, 0.04, 0.7]} />
          <meshStandardMaterial {...materials.metalFrame} />
        </mesh>
      ))}
      {[-1, 1].map((side) => (
        <mesh
          key={`brace-${side}`}
          position={[side * postX * 0.6, HEIGHT * 0.35, 0.2]}
          rotation={[Math.PI / 5, 0, 0]}
          castShadow
        >
          <cylinderGeometry args={[0.018, 0.018, 0.9, 8]} />
          <meshStandardMaterial {...materials.metalFrame} />
        </mesh>
      ))}
      {/* 18H Wave 3: matches PULL_UP_BAR_ANCHORS.approach (interactionAnchors.ts) -
          0.9m in front of the posts: clear of the foot plates (z<=0.65) and,
          with the obstacle narrowed to the post line above, genuinely
          walkable (pinned by the mounted registry test). Rotated PI so its
          forward faces the BAR: the trigger's forward is the facing a
          character adopts on arrival, and unrotated it pointed AWAY from the
          crossbar - the mount jump leapt off into the room (with the old
          +PI/2 room placement, straight through the office wall). The clip's
          forward travel is normalized to this 0.9m stand-off by
          tools/art/normalizeClipForwardTravel.mjs, so the jump ends with the
          hands ON the crossbar. */}
      <InteractionTrigger
        position={[0, 0.9, 0.9]}
        rotation={[0, Math.PI, 0]}
        size={[1.0, 1.8, 0.6]}
        onTrigger={onSelect}
        kind={onSelect ? 'pull-up-bar' : undefined}
      />
    </group>
  )
}
