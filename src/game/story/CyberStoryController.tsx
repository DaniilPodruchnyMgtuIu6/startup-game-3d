import { useEffect, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { Html } from '@react-three/drei'
import type { Group } from 'three'
import { useGameStore } from '../gameStore'
import { useSprintStore } from '../sprintStore'
import { useTeamStore } from '../teamStore'
import { useProductStore } from '../productStore'
import { useEconomyStore } from '../economyStore'
import { useSecurityAuditStore, isFollowUpAuditBlocking } from '../securityAuditStore'
import { useAccessControlStore } from '../accessControlStore'
import { isOfficeIntrusionBlocking } from '../accessControlRules'
import { useServerIncidentStore } from '../serverIncidentStore'
import { anyServerIncidentBlocking } from '../serverIncidentRules'
import { useServerIncidentsStore } from '../serverIncidentsStore'
import { useCutsceneStore } from '../../cutscenes/cutsceneStore'
import { useCharacterStore, PLAYER_ID } from '../../character/characterStore'
import { isWithinMeetDistance } from '../meetingGeometry'
import { useStoryDecisionStore } from './storyDecisionStore'
import { isStoryDecisionBlockingNow } from './storyDecisionSelectors'
import { isStoryConsequencePending } from './storyConsequences'
import { useCyberStoryStore } from './cyberStoryStore'
import { getCyberStoryDefinition } from './cyberStoryCatalog'
import { evaluateCyberStoryUnlocks } from './evaluateCyberStoryUnlocks'
import { beginApproachToCyberScene, getSceneLeadCharacterId, resumePlanner, runCyberConsequenceScene, runCyberStoryConversation } from './cyberStoryInteraction'
import type { CyberStoryIncidentId } from './cyberStoryTypes'
import '../../ui/ui.css'

// Feature 19 glue: two jobs, mirroring Level1StoryDecisionController (17A) and
// StoryConsequenceController (17C) combined into one component:
//   1. re-evaluate the deterministic scene triggers whenever relevant state
//      changes (hires, product progress) - never on a timer; hang the amber
//      "!" marker over the lead colleague while an incident is available; walk
//      the player over on click and run the scripted talk;
//   2. once a delayed consequence's due day lands, play it the moment every
//      other blocking scene/panel is closed (never on top of one).

function isUiFree(): boolean {
  const game = useGameStore.getState()
  const product = useProductStore.getState()
  const audit = useSecurityAuditStore.getState()
  const access = useAccessControlStore.getState()
  return (
    game.activeDialogue === null &&
    game.activeChoice === null &&
    !useCharacterStore.getState().inputLocked &&
    useCutsceneStore.getState().activeSceneId === null &&
    useServerIncidentsStore.getState().activeMinigame === null &&
    product.activeReport === null &&
    !product.boardOpen &&
    !product.prototypeOpen &&
    !product.releaseCheckOpen &&
    !useEconomyStore.getState().panelOpen &&
    !useTeamStore.getState().panelOpen &&
    audit.auditResultToAcknowledge === null &&
    access.intrusionResultToAcknowledge === null &&
    useServerIncidentStore.getState().incidentResultToAcknowledge === null &&
    !isFollowUpAuditBlocking(audit.followUpAudit) &&
    !isOfficeIntrusionBlocking(access.intrusion) &&
    !anyServerIncidentBlocking(Object.values(useServerIncidentStore.getState().incidents)) &&
    // Feature 17 decisions/consequences take priority over Feature 19 scenes
    // (adapted event order - see docs/qa/19-cyber-story-test-matrix.md).
    !isStoryDecisionBlockingNow() &&
    !isStoryConsequencePending()
  )
}

export function CyberStoryController() {
  const gamePhase = useGameStore((s) => s.phase)
  // Trigger inputs - each subscription re-runs the evaluation effect below.
  const sprintPhase = useSprintStore((s) => s.phase)
  const day = useSprintStore((s) => s.day)
  const hires = useTeamStore((s) => s.hires)
  const taskStates = useProductStore((s) => s.taskStates)
  const frontendTestDataStatus = useStoryDecisionStore((s) => s.decisions['frontend-test-data'].status)
  const activeIncidentId = useCyberStoryStore((s) => s.activeIncidentId)

  useEffect(() => {
    if (gamePhase !== 'free') return
    evaluateCyberStoryUnlocks()
  }, [gamePhase, sprintPhase, day, hires, taskStates, frontendTestDataStatus])

  // Delayed-consequence playback (job 2).
  const pending = useCyberStoryStore((s) => s.pendingConsequenceIds)
  const running = useCyberStoryStore((s) => s.runningConsequenceId)
  useGameStore((s) => s.activeDialogue)
  useGameStore((s) => s.activeChoice)
  useProductStore((s) => s.activeReport)
  useProductStore((s) => s.boardOpen)
  useEconomyStore((s) => s.panelOpen)
  useTeamStore((s) => s.panelOpen)
  useSecurityAuditStore((s) => s.auditResultToAcknowledge)
  useSecurityAuditStore((s) => s.followUpAudit)
  useAccessControlStore((s) => s.intrusionResultToAcknowledge)
  useAccessControlStore((s) => s.intrusion)
  useServerIncidentStore((s) => s.incidentResultToAcknowledge)
  useServerIncidentStore((s) => s.incidents)
  useCutsceneStore((s) => s.activeSceneId)
  useServerIncidentsStore((s) => s.activeMinigame)
  useCharacterStore((s) => s.inputLocked)
  useStoryDecisionStore((s) => s.activeDecisionId)

  const opening = useRef(false)
  useEffect(() => {
    if (gamePhase !== 'free' || running || opening.current) return
    const next = pending[0]
    if (!next || !isUiFree()) return
    opening.current = true
    void runCyberConsequenceScene(next).finally(() => {
      opening.current = false
    })
  })

  if (gamePhase !== 'free') return null
  if (!activeIncidentId) return null
  return <CyberStorySceneMarker incidentId={activeIncidentId} />
}

function CyberStorySceneMarker({ incidentId }: { incidentId: CyberStoryIncidentId }) {
  const status = useCyberStoryStore((s) => s.incidents[incidentId].status)
  const activeDialogue = useGameStore((s) => s.activeDialogue !== null)
  const activeChoice = useGameStore((s) => s.activeChoice !== null)
  const inputLocked = useCharacterStore((s) => s.inputLocked)
  const cutsceneRunning = useCutsceneStore((s) => s.activeSceneId !== null)
  const minigameOpen = useServerIncidentsStore((s) => s.activeMinigame !== null)
  useTeamStore((s) => s.hires) // the lead may change hire state

  const opened = useRef(false)
  const approaching = useRef(false)
  const markerRef = useRef<Group>(null)
  const characterId = getSceneLeadCharacterId(incidentId)
  // Reactive, not a one-off .getState() read: at mount the lead NPC's model
  // may still be loading (Suspense, GLTF decode) and not yet in the store.
  // A plain .getState() snapshot here would freeze that "not spawned yet"
  // null forever, since nothing else in this component necessarily
  // re-renders once the character actually appears - the marker would never
  // come back even though the incident is genuinely available. Must be
  // called unconditionally (before the `status !== 'available'` early
  // return below) to keep hook order stable across renders.
  const spawn = useCharacterStore((s) => s.characters[characterId]?.position)

  // If the controller unmounts mid-conversation (reset), roll the incident
  // back to available and hand control back - nothing stays locked.
  useEffect(() => {
    return () => {
      if (!opened.current) return
      resumePlanner(characterId)
      useCharacterStore.getState().setInputLocked(false)
      useCyberStoryStore.getState().markIncidentInterrupted(incidentId)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [incidentId])

  useFrame(() => {
    const lead = useCharacterStore.getState().characters[characterId]
    if (markerRef.current && lead) markerRef.current.position.set(lead.position[0], 0, lead.position[2])
    if (opened.current || !approaching.current) return
    const player = useCharacterStore.getState().characters[PLAYER_ID]
    if (!player || !lead) return
    if (!isWithinMeetDistance(player.position, lead.position)) return
    opened.current = true
    void runCyberStoryConversation(incidentId).then(() => {
      opened.current = false
      approaching.current = false
    })
  })

  const eligible = !activeDialogue && !activeChoice && !inputLocked && !cutsceneRunning && !minigameOpen

  const beginApproach = () => {
    if (opened.current || approaching.current || !eligible) return
    if (beginApproachToCyberScene(incidentId)) approaching.current = true
  }

  // The marker shows only while the incident awaits the player.
  if (status !== 'available') return null

  const def = getCyberStoryDefinition(incidentId)
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
