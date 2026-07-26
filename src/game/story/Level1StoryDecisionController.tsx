import { useEffect, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { Html } from '@react-three/drei'
import type { Group } from 'three'
import { useGameStore } from '../gameStore'
import { useSprintStore } from '../sprintStore'
import { useTeamStore } from '../teamStore'
import { useProductStore } from '../productStore'
import { useRiskStore } from '../riskStore'
import { useSecurityStoryStore } from '../securityStoryStore'
import { useServerIncidentStore } from '../serverIncidentStore'
import { useGameOutcomeStore } from '../gameOutcomeStore'
import { useCutsceneStore } from '../../cutscenes/cutsceneStore'
import { useServerIncidentsStore } from '../serverIncidentsStore'
import { useCharacterStore, PLAYER_ID } from '../../character/characterStore'
import { isWithinMeetDistance } from '../meetingGeometry'
import { useStoryDecisionStore } from './storyDecisionStore'
import { getStoryDecision } from './storyDecisionCatalog'
import { evaluateStoryUnlocks } from './evaluateStoryUnlocks'
import {
  beginApproachToStoryScene,
  getSceneLeadCharacterId,
  runStoryDecisionConversation,
  resumePlanner,
} from './storyDecisionInteraction'
import type { Level1StoryDecisionId } from './level1Timeline'
import '../../ui/ui.css'

// Story glue for the Level 1 decisions (Features 17A/17B). Two jobs:
//   1. re-evaluate the deterministic scene triggers whenever relevant state
//      changes (hires, progress, risks, threats) - never on a timer;
//   2. while a decision is available, hang the amber "!" story marker over the
//      scene's lead colleague (distinct from the optional DeepSeek 💬), walk
//      the player over on click and run the scripted talk.
export function Level1StoryDecisionController() {
  const gamePhase = useGameStore((s) => s.phase)
  // Trigger inputs - each subscription re-runs the evaluation effect below.
  const sprintPhase = useSprintStore((s) => s.phase)
  const day = useSprintStore((s) => s.day)
  const hires = useTeamStore((s) => s.hires)
  const taskStates = useProductStore((s) => s.taskStates)
  const signals = useRiskStore((s) => s.signals)
  const incidents = useServerIncidentStore((s) => s.incidents)
  const ilyaIntroduced = useSecurityStoryStore((s) => s.hasIntroducedSecuritySpecialist)
  const legacyStaffing = useSecurityStoryStore((s) => s.postAuditConversation.staffingDecision)
  const outcomeStatus = useGameOutcomeStore((s) => s.status)
  const tasks = useGameStore((s) => s.tasks)
  const activeDecisionId = useStoryDecisionStore((s) => s.activeDecisionId)

  useEffect(() => {
    if (gamePhase !== 'free' || outcomeStatus !== 'playing') return
    evaluateStoryUnlocks()
  }, [gamePhase, outcomeStatus, sprintPhase, day, hires, taskStates, signals, incidents, ilyaIntroduced, legacyStaffing, tasks])

  if (gamePhase !== 'free') return null
  if (!activeDecisionId) return null
  return <StorySceneMarker decisionId={activeDecisionId} />
}

function StorySceneMarker({ decisionId }: { decisionId: Level1StoryDecisionId }) {
  const status = useStoryDecisionStore((s) => s.decisions[decisionId].status)
  const activeDialogue = useGameStore((s) => s.activeDialogue !== null)
  const activeChoice = useGameStore((s) => s.activeChoice !== null)
  const inputLocked = useCharacterStore((s) => s.inputLocked)
  const cutsceneRunning = useCutsceneStore((s) => s.activeSceneId !== null)
  const minigameOpen = useServerIncidentsStore((s) => s.activeMinigame !== null)
  useTeamStore((s) => s.hires) // the lead may change when Ilya is hired

  const opened = useRef(false)
  const approaching = useRef(false)
  const markerRef = useRef<Group>(null)
  const characterId = getSceneLeadCharacterId(decisionId)

  // If the controller unmounts mid-conversation (reset), roll the decision back
  // to available and hand control back - nothing stays locked.
  useEffect(() => {
    return () => {
      if (!opened.current) return
      resumePlanner(characterId)
      useCharacterStore.getState().setInputLocked(false)
      useStoryDecisionStore.getState().markDecisionInterrupted(decisionId)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [decisionId])

  useFrame(() => {
    const lead = useCharacterStore.getState().characters[characterId]
    if (markerRef.current && lead) markerRef.current.position.set(lead.position[0], 0, lead.position[2])
    if (opened.current || !approaching.current) return
    const player = useCharacterStore.getState().characters[PLAYER_ID]
    if (!player || !lead) return
    if (!isWithinMeetDistance(player.position, lead.position)) return
    opened.current = true
    void runStoryDecisionConversation(decisionId).then(() => {
      opened.current = false
      approaching.current = false
    })
  })

  const eligible = !activeDialogue && !activeChoice && !inputLocked && !cutsceneRunning && !minigameOpen

  const beginApproach = () => {
    if (opened.current || approaching.current || !eligible) return
    if (beginApproachToStoryScene(decisionId)) approaching.current = true
  }

  // The marker shows only while the decision awaits the player.
  if (status !== 'available') return null

  const def = getStoryDecision(decisionId)
  const spawn = useCharacterStore.getState().characters[characterId]?.position
  if (!spawn) return null // the lead NPC is not in the office (e.g. not hired yet)
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
