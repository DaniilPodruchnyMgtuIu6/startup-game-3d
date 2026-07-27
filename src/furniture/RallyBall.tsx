import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import type { Mesh } from 'three'
import { usePingPongRallyStore } from '../character/pingPongRallyStore'

// 18H §20: the rally ball. ONE mesh owned by the table (never duplicated,
// disappears with the rally - no cleanup to forget), animated table-end to
// table-end with a parabolic arc over the net. The crossing period matches
// the procedural swing tempo (PADDLE_SWING_HZ=2.4 in useCharacterPerformance:
// one crossing per swing beat) so hits and swings read as one motion.
// Purely visual - never touches gameplay state (§20).
const CROSSING_PERIOD_S = 1 / 2.4
const ARC_HEIGHT = 0.42
const BALL_RADIUS = 0.02

export function RallyBall({ tableHeight, halfLength }: { tableHeight: number; halfLength: number }) {
  const active = usePingPongRallyStore((s) => s.participants !== null)
  const mesh = useRef<Mesh>(null)
  const elapsed = useRef(0)

  useFrame((_, delta) => {
    if (!active || !mesh.current) return
    elapsed.current += delta
    const phase = (elapsed.current / CROSSING_PERIOD_S) % 2 // 0..2: there and back
    const along = phase < 1 ? phase : 2 - phase // triangle wave between ends
    // turnaround just past the table end, at the paddles (players stand 0.65m
    // behind the edge - see PING_PONG_TABLE_ANCHORS' SIDE_ROOT)
    const reach = halfLength + 0.3
    mesh.current.position.x = -reach + along * reach * 2
    mesh.current.position.y = tableHeight + 0.08 + Math.sin(along * Math.PI) * ARC_HEIGHT
  })

  if (!active) return null
  return (
    <mesh ref={mesh} position={[0, tableHeight + 0.1, 0]}>
      <sphereGeometry args={[BALL_RADIUS, 12, 12]} />
      <meshStandardMaterial color="#f8f4e8" roughness={0.35} metalness={0} />
    </mesh>
  )
}
