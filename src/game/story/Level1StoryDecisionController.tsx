import { useEffect, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { Html } from '@react-three/drei'
import type { Group } from 'three'
import { useGameStore } from '../gameStore'
import { useSprintStore } from '../sprintStore'
import { useCutsceneStore } from '../../cutscenes/cutsceneStore'
import { useServerIncidentsStore } from '../serverIncidentsStore'
import { useCharacterStore, PLAYER_ID } from '../../character/characterStore'
import { femalePm } from '../../character/characters/femalePm'
import { isWithinMeetDistance } from '../meetingGeometry'
import { useStoryDecisionStore } from './storyDecisionStore'
import { getStoryDecision } from './storyDecisionCatalog'
import {
  SONYA,
  beginApproachToSonyaForBaseline,
  runBaselineDecisionConversation,
  resumePlanner,
} from './baselineInteraction'
import '../../ui/ui.css'

// Story glue for the Level 1 baseline decision (Feature 17A): while the
// decision is available Sonya wears the amber "!" story marker (distinct from
// the optional DeepSeek 💬 per Feature 16), the player walks to her and the
// scripted talk records the choice. Mirrors PostAuditConversationController.
export function Level1StoryDecisionController() {
  const gamePhase = useGameStore((s) => s.phase)
  const activeDecisionId = useStoryDecisionStore((s) => s.activeDecisionId)
  if (gamePhase !== 'free') return null
  // 17A ships exactly one live scene - the baseline path. Later decisions get
  // their scenes in 17B; until then they never become available in production.
  if (activeDecisionId !== 'security-baseline-path') return null
  return <SonyaBaselineMarker />
}

function SonyaBaselineMarker() {
  const status = useStoryDecisionStore((s) => s.decisions['security-baseline-path'].status)
  const activeDialogue = useGameStore((s) => s.activeDialogue !== null)
  const activeChoice = useGameStore((s) => s.activeChoice !== null)
  const inputLocked = useCharacterStore((s) => s.inputLocked)
  const cutsceneRunning = useCutsceneStore((s) => s.activeSceneId !== null)
  const minigameOpen = useServerIncidentsStore((s) => s.activeMinigame !== null)
  useSprintStore((s) => s.phase)

  const opened = useRef(false)
  const approaching = useRef(false)
  const markerRef = useRef<Group>(null)

  // If the controller unmounts mid-conversation (reset), roll the decision back
  // to available and hand control back - nothing stays locked.
  useEffect(() => {
    return () => {
      if (!opened.current) return
      resumePlanner()
      useCharacterStore.getState().setInputLocked(false)
      useStoryDecisionStore.getState().markDecisionInterrupted('security-baseline-path')
    }
  }, [])

  useFrame(() => {
    const sonya = useCharacterStore.getState().characters[SONYA]
    if (markerRef.current && sonya) markerRef.current.position.set(sonya.position[0], 0, sonya.position[2])
    if (opened.current || !approaching.current) return
    const player = useCharacterStore.getState().characters[PLAYER_ID]
    if (!player || !sonya) return
    if (!isWithinMeetDistance(player.position, sonya.position)) return
    opened.current = true
    void runBaselineDecisionConversation().then(() => {
      opened.current = false
      approaching.current = false
    })
  })

  const eligible = !activeDialogue && !activeChoice && !inputLocked && !cutsceneRunning && !minigameOpen

  const beginApproach = () => {
    if (opened.current || approaching.current || !eligible) return
    if (beginApproachToSonyaForBaseline()) approaching.current = true
  }

  // The marker shows only while the decision awaits the player.
  if (status !== 'available') return null

  const def = getStoryDecision('security-baseline-path')
  const spawn = useCharacterStore.getState().characters[SONYA]?.position ?? femalePm.npc!.spawn
  return (
    <group ref={markerRef} position={[spawn[0], 0, spawn[2]]}>
      <Html position={[0, 2.2, 0]} center zIndexRange={[10, 0]}>
        <button className="npc-marker npc-marker--story" title={def?.objectiveDescription} aria-label={def?.objectiveTitle} onClick={beginApproach}>
          <span className="npc-marker-icon">!</span>
          <span className="npc-marker-label">Сюжет</span>
        </button>
      </Html>
      <mesh position={[0, 0.9, 0]} onClick={beginApproach}>
        <boxGeometry args={[0.8, 1.8, 0.8]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>
    </group>
  )
}
