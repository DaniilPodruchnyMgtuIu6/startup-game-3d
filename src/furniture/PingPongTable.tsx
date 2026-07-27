import { useRef } from 'react'
import type { Group } from 'three'
import { useMaterials } from '../materials/MaterialsContext'
import { useObstacle } from '../character/useObstacle'
import { InteractionTrigger } from '../interaction/InteractionTrigger'
import { PING_PONG_TABLE_ANCHORS } from '../interaction/interactionAnchors'
import type { TriggerTarget } from '../interaction/triggerPayload'
import { RallyBall } from './RallyBall'

export interface PingPongTableProps {
  position?: [number, number, number]
  rotation?: [number, number, number]
  // Player click on a table side: walk up and start a rally (the matchmaker
  // then recruits an NPC opponent to the far side). NPC-NPC matches ignore
  // this and go through the matchmaker's own pairing as before.
  onSelectSide?: (target: TriggerTarget) => void
}

const LENGTH = 2.74
const WIDTH = 1.525
const HEIGHT = 0.76
const TOP_THICKNESS = 0.03
const NET_HEIGHT = 0.15

export function PingPongTable({ position = [0, 0, 0], rotation = [0, 0, 0], onSelectSide }: PingPongTableProps) {
  const materials = useMaterials()
  // Only the physical TABLE registers as a nav obstacle. The whole group's
  // bounds would include the two invisible side TRIGGER boxes at the ends -
  // Box3.setFromObject sees their geometry too - and with grid inflation that
  // walled off the exact stand points the triggers designate (every arriving
  // player silently diverted off the mark).
  const table = useRef<Group>(null)
  useObstacle(table)
  const legHeight = HEIGHT - TOP_THICKNESS
  const legX = LENGTH / 2 - 0.1
  const legZ = WIDTH / 2 - 0.1

  return (
    <group position={position} rotation={rotation}>
      <group ref={table}>
      <mesh position={[0, HEIGHT - TOP_THICKNESS / 2, 0]} castShadow receiveShadow>
        <boxGeometry args={[LENGTH, TOP_THICKNESS, WIDTH]} />
        <meshStandardMaterial color="#1d5f8a" roughness={0.5} metalness={0} />
      </mesh>
      <mesh position={[0, HEIGHT + 0.001, 0]}>
        <boxGeometry args={[0.02, 0.001, WIDTH]} />
        <meshStandardMaterial color="#ffffff" roughness={0.6} metalness={0} />
      </mesh>
      <mesh position={[0, HEIGHT + NET_HEIGHT / 2, 0]}>
        <boxGeometry args={[0.01, NET_HEIGHT, WIDTH + 0.1]} />
        <meshStandardMaterial color="#1a1a1a" roughness={0.9} metalness={0} transparent opacity={0.75} />
      </mesh>
      {[-1, 1].map((side) => (
        <mesh key={side} position={[0, HEIGHT + NET_HEIGHT / 2, (side * (WIDTH + 0.1)) / 2]}>
          <cylinderGeometry args={[0.012, 0.012, NET_HEIGHT, 8]} />
          <meshStandardMaterial {...materials.metalChrome} />
        </mesh>
      ))}
      {[
        [-legX, -legZ],
        [legX, -legZ],
        [-legX, legZ],
        [legX, legZ],
      ].map(([x, z], i) => (
        <mesh key={i} position={[x, legHeight / 2, z]} castShadow>
          <boxGeometry args={[0.06, legHeight, 0.06]} />
          <meshStandardMaterial {...materials.metalFrame} />
        </mesh>
      ))}
      </group>
      {/* 18H Wave 3: two 'ping-pong' targets (one per short end), matching
          PING_PONG_TABLE_ANCHORS. Each trigger is ROTATED so its forward (the
          facing a character adopts on arrival) points across the table at the
          opponent - unrotated triggers inherited the table group's forward and
          made both players stand facing the same sideline (the "оба смотрят в
          одну сторону" bug). onTrigger lets the PLAYER click a side to play. */}
      <InteractionTrigger
        position={[PING_PONG_TABLE_ANCHORS.sideA.root.position[0], 0.9, 0]}
        rotation={[0, Math.PI / 2, 0]}
        size={[0.8, 1.8, WIDTH]}
        kind="ping-pong"
        onTrigger={onSelectSide}
      />
      <InteractionTrigger
        position={[PING_PONG_TABLE_ANCHORS.sideB.root.position[0], 0.9, 0]}
        rotation={[0, -Math.PI / 2, 0]}
        size={[0.8, 1.8, WIDTH]}
        kind="ping-pong"
        onTrigger={onSelectSide}
      />
      {/* §20: the rally ball - one shared mesh, visible only while a rally is
          live, animated between the sides in sync with the swing tempo. */}
      <RallyBall tableHeight={HEIGHT} halfLength={LENGTH / 2} />
    </group>
  )
}
