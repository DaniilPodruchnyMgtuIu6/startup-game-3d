import { useEffect, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { Html } from '@react-three/drei'
import { useGameStore } from './gameStore'
import { pmIntroDialogue } from './dialogues'
import { approachPoint, isWithinMeetDistance, facingBetween } from './meetingGeometry'
import { femalePm } from '../character/characters/femalePm'
import { useCharacterStore, PLAYER_ID } from '../character/characterStore'
import '../ui/ui.css'

// Story glue for phase 'meetPm': the PM waits at her spawn with a pulsing
// indicator; clicking her (or it) walks the player over, and coming within
// meeting distance opens her introduction dialogue. Once the dialogue ends
// the phase flips to 'free' and this controller unmounts.
export function MeetPmController() {
  const phase = useGameStore((s) => s.phase)
  if (phase !== 'meetPm') return null
  return <PmMeeting />
}

function PmMeeting() {
  const opened = useRef(false)
  const spawn = femalePm.npc!.spawn
  const rotationY = femalePm.npc!.spawnRotationY ?? 0

  const walkToPm = () => {
    useCharacterStore.getState().clickFloor(approachPoint(spawn, rotationY))
  }

  // when the conversation ends (phase leaves meetPm and this unmounts),
  // both participants drop the talking pose
  useEffect(() => {
    return () => {
      if (!opened.current) return
      const store = useCharacterStore.getState()
      store.dispatchTo(PLAYER_ID, { type: 'TALK_END' })
      store.dispatchTo(femalePm.id, { type: 'TALK_END' })
    }
  }, [])

  useFrame(() => {
    if (opened.current) return
    const characters = useCharacterStore.getState().characters
    const player = characters[PLAYER_ID]
    const pm = characters[femalePm.id]
    if (!player || !pm) return
    if (!isWithinMeetDistance(player.position, pm.position)) return
    opened.current = true
    // face each other and start the talking animations
    const store = useCharacterStore.getState()
    store.dispatchTo(PLAYER_ID, { type: 'TALK_START' })
    store.dispatchTo(femalePm.id, { type: 'TALK_START' })
    store.setTransform(PLAYER_ID, player.position, facingBetween(player.position, pm.position))
    store.setTransform(femalePm.id, pm.position, facingBetween(pm.position, player.position))
    const { playerName, startDialogue } = useGameStore.getState()
    startDialogue(pmIntroDialogue(playerName), { closingLabel: 'За работу' })
  })

  return (
    <group position={[spawn[0], 0, spawn[2]]}>
      <Html position={[0, 2.2, 0]} center zIndexRange={[10, 0]}>
        <button className="npc-indicator" aria-label="Поговорить" onClick={walkToPm}>
          💬
        </button>
      </Html>
      <mesh position={[0, 0.9, 0]} onClick={walkToPm}>
        <boxGeometry args={[0.8, 1.8, 0.8]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>
    </group>
  )
}
