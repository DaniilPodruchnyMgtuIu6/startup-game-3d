import { useEffect, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import type { Group } from 'three'
import { useGameStore } from './gameStore'
import { useTeamStore } from './teamStore'
import { useServerIncidentsStore } from './serverIncidentsStore'
import { useSecurityStoryStore } from './securityStoryStore'
import { useCutsceneStore } from '../cutscenes/cutsceneStore'
import { useCharacterStore, PLAYER_ID } from '../character/characterStore'
import { ilyaVlasov } from '../character/characters/ilyaVlasov'
import { nearestWalkable } from '../character/grid'
import { releaseClaims } from '../interaction/interactionRegistry'
import { hasSecuritySpecialist } from './teamRules'
import { approachPoint, isWithinMeetDistance, facingBetween } from './meetingGeometry'
import {
  SECURITY_SPECIALIST_INTRO_LINES,
  SECURITY_SPECIALIST_REPEAT_LINES,
  SECURITY_SPECIALIST_RISK_ALERT_LINES,
  SECURITY_SPECIALIST_CLOSING_LABEL,
} from './securitySpecialistDialogue'
import { useRiskStore } from './riskStore'
import { buildRiskObservations } from './riskRules'
import '../ui/ui.css'

const ILYA = ilyaVlasov.id

// Optional static chat with the hired security specialist (Feature 07). Clicking
// Ilya walks the player to him and opens his short dialogue (a longer intro the
// first time, a brief line after). No marker, no objective, no DeepSeek - the
// talk never blocks the day. Mounted only once he is hired.
export function SecuritySpecialistController() {
  const gamePhase = useGameStore((s) => s.phase)
  const hired = useTeamStore((s) => hasSecuritySpecialist(s.hires))
  // Only the one-time static onboarding lives here; once introduced, Ilya's
  // clicks are handled by the optional DeepSeek free chat (Feature 14).
  const introduced = useSecurityStoryStore((s) => s.hasIntroducedSecuritySpecialist)
  if (gamePhase !== 'free' || !hired || introduced) return null
  return <IlyaTalkTarget />
}

function IlyaTalkTarget() {
  const eligible = useTalkEligible()
  const opened = useRef(false)
  const approaching = useRef(false)
  const boxRef = useRef<Group>(null)

  // If unmounted mid-talk (e.g. reset), release control cleanly.
  useEffect(() => {
    return () => {
      if (!opened.current) return
      endTalking()
      resumeIlya()
      useCharacterStore.getState().setInputLocked(false)
    }
  }, [])

  useFrame(() => {
    const ilya = useCharacterStore.getState().characters[ILYA]
    if (boxRef.current && ilya) boxRef.current.position.set(ilya.position[0], 0, ilya.position[2])
    if (opened.current || !approaching.current) return
    const player = useCharacterStore.getState().characters[PLAYER_ID]
    if (!player || !ilya) return
    if (!isWithinMeetDistance(player.position, ilya.position)) return
    opened.current = true
    runTalk()
  })

  const beginApproach = () => {
    if (opened.current || approaching.current || !eligible) return
    const store = useCharacterStore.getState()
    if (store.inputLocked) return
    const ilya = store.characters[ILYA]
    if (!ilya) return
    // pause his patrol, drop any claim, halt him, then route the player over
    pauseIlya()
    releaseClaims(ILYA)
    store.dispatchTo(ILYA, { type: 'CLICK_FLOOR', point: nearestWalkable(ilya.position) })
    store.clickFloor(approachPoint(ilya.position, ilya.rotationY))
    approaching.current = true
  }

  const spawn = useCharacterStore.getState().characters[ILYA]?.position ?? ilyaVlasov.npc!.spawn
  return (
    <group ref={boxRef} position={[spawn[0], 0, spawn[2]]}>
      <mesh position={[0, 0.9, 0]} onClick={beginApproach}>
        <boxGeometry args={[0.8, 1.8, 0.8]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>
    </group>
  )
}

function runTalk() {
  const store = useCharacterStore.getState()
  store.setInputLocked(true)
  const player = store.characters[PLAYER_ID]
  const ilya = store.characters[ILYA]
  store.dispatchTo(PLAYER_ID, { type: 'TALK_START' })
  store.dispatchTo(ILYA, { type: 'TALK_START' })
  if (player && ilya) {
    store.setTransform(PLAYER_ID, player.position, facingBetween(player.position, ilya.position))
    store.setTransform(ILYA, ilya.position, facingBetween(ilya.position, player.position))
  }

  const introduced = useSecurityStoryStore.getState().hasIntroducedSecuritySpecialist
  // While an unacknowledged high/critical risk is on the board, Ilya's repeat
  // line becomes a warning (Feature 09 §19). The intro still plays first-time.
  const hasUrgentRisk = buildRiskObservations(useRiskStore.getState().signals, { revealDetailedFactors: true }).some(
    (o) => (o.level === 'high' || o.level === 'critical') && o.unacknowledgedSignalIds.length > 0,
  )
  const lines = !introduced
    ? SECURITY_SPECIALIST_INTRO_LINES
    : hasUrgentRisk
      ? SECURITY_SPECIALIST_RISK_ALERT_LINES
      : SECURITY_SPECIALIST_REPEAT_LINES
  useGameStore.getState().startDialogue(lines, { closingLabel: SECURITY_SPECIALIST_CLOSING_LABEL })

  const unsubscribe = useGameStore.subscribe(() => {
    if (useGameStore.getState().activeDialogue !== null) return
    unsubscribe()
    useSecurityStoryStore.getState().markSecuritySpecialistIntroduced()
    endTalking()
    resumeIlya()
    useCharacterStore.getState().setInputLocked(false)
  })
}

function endTalking() {
  const store = useCharacterStore.getState()
  store.dispatchTo(PLAYER_ID, { type: 'TALK_END' })
  store.dispatchTo(ILYA, { type: 'TALK_END' })
}

function pauseIlya() {
  const store = useCharacterStore.getState()
  const next = new Set(store.sceneOwned)
  next.add(ILYA)
  store.setSceneOwned(next)
}

function resumeIlya() {
  const store = useCharacterStore.getState()
  const next = new Set(store.sceneOwned)
  next.delete(ILYA)
  store.setSceneOwned(next)
}

function useTalkEligible(): boolean {
  const activeDialogue = useGameStore((s) => s.activeDialogue !== null)
  const activeChoice = useGameStore((s) => s.activeChoice !== null)
  const minigame = useServerIncidentsStore((s) => s.activeMinigame !== null)
  const cutscene = useCutsceneStore((s) => s.activeSceneId !== null)
  return !activeDialogue && !activeChoice && !minigame && !cutscene
}
