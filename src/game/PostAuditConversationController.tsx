import { useEffect, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { Html } from '@react-three/drei'
import type { Group } from 'three'
import { useGameStore } from './gameStore'
import { useSprintStore } from './sprintStore'
import { useTeamStore } from './teamStore'
import { useProductStore } from './productStore'
import { useEconomyStore } from './economyStore'
import { useServerIncidentsStore } from './serverIncidentsStore'
import { useSecurityStoryStore } from './securityStoryStore'
import { useCutsceneStore } from '../cutscenes/cutsceneStore'
import { useCharacterStore, PLAYER_ID } from '../character/characterStore'
import { femalePm } from '../character/characters/femalePm'
import { isWithinMeetDistance } from './meetingGeometry'
import { canStartPostAuditConversation, type PostAuditConversationContext } from './securityStoryRules'
import {
  SONYA,
  beginApproachToSonya,
  runPostAuditConversation,
  resumePlanner,
} from './postAuditInteraction'
import '../ui/ui.css'

// Story glue for Feature 06: once the security-breach audit is over, Sonya wears
// a 💬 marker and the player must walk to her to discuss staffing. Mirrors the
// PM-introduction interaction (approach, then talk) instead of a scripted
// cutscene, so the player keeps control until they reach her. The state work
// lives in postAuditInteraction/securityStoryStore; this only renders the marker
// and detects arrival.
export function PostAuditConversationController() {
  const gamePhase = useGameStore((s) => s.phase)
  const status = useSecurityStoryStore((s) => s.postAuditConversation.status)
  if (gamePhase !== 'free') return null
  // Mounted while the conversation is available (pending) or in progress
  // (running, which we set ourselves once the player reaches Sonya).
  if (status !== 'pending' && status !== 'running') return null
  return <SonyaAuditMarker />
}

function SonyaAuditMarker() {
  const status = useSecurityStoryStore((s) => s.postAuditConversation.status)
  const eligible = usePostAuditEligibility()
  const opened = useRef(false)
  const approaching = useRef(false)
  const markerRef = useRef<Group>(null)

  // If this controller unmounts while a conversation is still running (e.g. the
  // player is sent back to the intro), roll the story back to pending and hand
  // control back so nothing stays locked or stuck in the talking pose.
  useEffect(() => {
    return () => {
      if (!opened.current) return
      if (useSecurityStoryStore.getState().postAuditConversation.status !== 'running') return
      resumePlanner()
      useCharacterStore.getState().setInputLocked(false)
      useSecurityStoryStore.getState().markPostAuditConversationFailed()
    }
  }, [])

  useFrame(() => {
    const sonya = useCharacterStore.getState().characters[SONYA]
    // keep the marker glued above Sonya's live position as she moves
    if (markerRef.current && sonya) markerRef.current.position.set(sonya.position[0], 0, sonya.position[2])
    if (opened.current || !approaching.current) return
    const player = useCharacterStore.getState().characters[PLAYER_ID]
    if (!player || !sonya) return
    if (!isWithinMeetDistance(player.position, sonya.position)) return
    opened.current = true
    void runPostAuditConversation()
  })

  const beginApproach = () => {
    if (opened.current || approaching.current || !eligible) return
    if (beginApproachToSonya()) approaching.current = true
  }

  // The marker is only shown while the conversation is pending; it disappears
  // the instant the talk starts (running) and never returns after completed.
  if (status !== 'pending') return null

  const spawn = useCharacterStore.getState().characters[SONYA]?.position ?? femalePm.npc!.spawn
  return (
    <group ref={markerRef} position={[spawn[0], 0, spawn[2]]}>
      <Html position={[0, 2.2, 0]} center zIndexRange={[10, 0]}>
        <button className="npc-indicator" aria-label="Обсудить результаты аудита с Соней" onClick={beginApproach}>
          💬
        </button>
      </Html>
      <mesh position={[0, 0.9, 0]} onClick={beginApproach}>
        <boxGeometry args={[0.8, 1.8, 0.8]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>
    </group>
  )
}

function usePostAuditEligibility(): boolean {
  const gamePhase = useGameStore((s) => s.phase)
  const sprintPhase = useSprintStore((s) => s.phase)
  const conversationStatus = useSecurityStoryStore((s) => s.postAuditConversation.status)
  const securityBreachStatus = useSecurityStoryStore((s) => s.securityBreach.status)
  const isCutsceneRunning = useCutsceneStore((s) => s.activeSceneId !== null)
  const isServerMinigameOpen = useServerIncidentsStore((s) => s.activeMinigame !== null)
  const financeOpen = useEconomyStore((s) => s.panelOpen)
  const teamOpen = useTeamStore((s) => s.panelOpen)
  const boardOpen = useProductStore((s) => s.boardOpen)
  const dailyReportOpen = useProductStore((s) => s.activeReport !== null)
  const prototypeOpen = useProductStore((s) => s.prototypeOpen)
  const activeDialogue = useGameStore((s) => s.activeDialogue !== null)
  const activeChoice = useGameStore((s) => s.activeChoice !== null)

  const context: PostAuditConversationContext = {
    gamePhase,
    sprintPhase,
    conversationStatus,
    securityBreachStatus,
    isCutsceneRunning,
    isServerMinigameOpen,
    isBlockingOverlayOpen: financeOpen || teamOpen || boardOpen || dailyReportOpen || prototypeOpen,
    isBlockingDialogueOpen: activeDialogue || activeChoice,
  }
  return canStartPostAuditConversation(context)
}
