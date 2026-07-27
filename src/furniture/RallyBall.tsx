import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { Vector3, type Mesh } from 'three'
import { usePingPongRallyStore } from '../character/pingPongRallyStore'
import { useCharacterStore } from '../character/characterStore'
import { rallyCrossing, RALLY_CROSSING_S } from '../character/pingPongRhythm'

// 18H §20: the rally ball. ONE mesh owned by the table (never duplicated,
// disappears with the rally). It flies in WORLD space between the two actual
// participants - whatever side of the however-rotated table each one stands
// on - and shares its phase clock with the players' swings (pingPongRhythm),
// so every crossing starts exactly on a strike. Real table-tennis shape: a
// falling arc into a BOUNCE on the receiver's half, then a short hop up to
// the receiving paddle. Purely visual - never touches gameplay state.
const PADDLE_HEIGHT = 0.95 // strike/receive height over the floor
const BOUNCE_AT = 0.62 // fraction of the crossing where the ball hits the table
const DROP_ARC = 0.16 // extra rise of the outgoing arc
const HOP_ARC = 0.1 // rise of the post-bounce hop
const BALL_RADIUS = 0.02

const world = new Vector3()

export function RallyBall({ tableHeight }: { tableHeight: number; halfLength: number }) {
  const participants = usePingPongRallyStore((s) => s.participants)
  const mesh = useRef<Mesh>(null)

  useFrame(({ clock }) => {
    if (!participants || !mesh.current) return
    const chars = useCharacterStore.getState().characters
    const a = chars[participants[0]]
    const b = chars[participants[1]]
    if (!a || !b) return
    const { from, along } = rallyCrossing(clock.elapsedTime)
    const start = from === 0 ? a.position : b.position
    const end = from === 0 ? b.position : a.position
    // pull the endpoints slightly toward the table so the ball meets the
    // paddle in front of the body, not inside the chest
    const inset = 0.35
    const dx = end[0] - start[0]
    const dz = end[2] - start[2]
    const len = Math.hypot(dx, dz) || 1
    const sx = start[0] + (dx / len) * inset
    const sz = start[2] + (dz / len) * inset
    const ex = end[0] - (dx / len) * inset
    const ez = end[2] - (dz / len) * inset
    world.x = sx + (ex - sx) * along
    world.z = sz + (ez - sz) * along
    const bounceY = tableHeight + BALL_RADIUS
    if (along < BOUNCE_AT) {
      // outgoing arc: paddle height down onto the table, with a slight rise
      const u = along / BOUNCE_AT
      world.y = PADDLE_HEIGHT + (bounceY - PADDLE_HEIGHT) * u + Math.sin(Math.PI * u) * DROP_ARC
    } else {
      // post-bounce hop back up to the receiving paddle
      const v = (along - BOUNCE_AT) / (1 - BOUNCE_AT)
      world.y = bounceY + (PADDLE_HEIGHT - bounceY) * v + Math.sin(Math.PI * v) * HOP_ARC
    }
    mesh.current.parent?.worldToLocal(mesh.current.position.copy(world))
  })

  if (!participants) return null
  return (
    <mesh ref={mesh} position={[0, tableHeight + 0.1, 0]}>
      <sphereGeometry args={[BALL_RADIUS, 12, 12]} />
      <meshStandardMaterial color="#f8f4e8" roughness={0.35} metalness={0} />
    </mesh>
  )
}

// keep the crossing period visible to tests/docs importing from the ball
export { RALLY_CROSSING_S }
