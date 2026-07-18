import { useEffect, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { Html } from '@react-three/drei'
import type { Group } from 'three'
import { useGameStore } from './gameStore'
import { useGameOutcomeStore } from './gameOutcomeStore'
import { useTeamStore } from './teamStore'
import { useSecurityStoryStore } from './securityStoryStore'
import { useCutsceneStore } from '../cutscenes/cutsceneStore'
import { useServerIncidentsStore } from './serverIncidentsStore'
import { useNpcConversationStore } from './npcConversationStore'
import { useCharacterStore, PLAYER_ID } from '../character/characterStore'
import { nearestWalkable } from '../character/grid'
import { releaseClaims } from '../interaction/interactionRegistry'
import { approachPoint, isWithinMeetDistance, facingBetween } from './meetingGeometry'
import { gatherFreeNpcEligibility } from './freeNpcConversation'
import { NPC_CHARACTER_ID, NPC_IDS, type NpcId } from './npcChatTypes'
import '../ui/ui.css'

// Feature 14: renders a clickable proxy + 💬 marker over each NPC when an
// OPTIONAL free chat is allowed (no pending required story, no blocking UI).
// The component itself stays MOUNTED for as long as the NPC exists and the game
// is in free play — only the visuals are gated by eligibility. This matters:
// opening the chat locks input (making the NPC "not eligible"), and an
// unmount-on-ineligibility would fire the cleanup mid-conversation, unlocking
// the player and sending the NPC back to its planner while the panel is open.
export function FreeNpcChatController() {
  const gamePhase = useGameStore((s) => s.phase)
  if (gamePhase !== 'free') return null
  return (
    <>
      {NPC_IDS.map((npcId) => (
        <NpcChatTarget key={npcId} npcId={npcId} />
      ))}
    </>
  )
}

function NpcChatTarget({ npcId }: { npcId: NpcId }) {
  // Subscribe to the slices that change eligibility so the marker appears/hides.
  useGameStore((s) => s.phase)
  useGameStore((s) => s.activeDialogue)
  useGameStore((s) => s.activeChoice)
  useCharacterStore((s) => s.inputLocked)
  useCutsceneStore((s) => s.activeSceneId)
  useServerIncidentsStore((s) => s.activeMinigame)
  useSecurityStoryStore((s) => s.postAuditConversation.status)
  useSecurityStoryStore((s) => s.hasIntroducedSecuritySpecialist)
  useTeamStore((s) => s.hires)
  useGameOutcomeStore((s) => s.status)

  const charId = NPC_CHARACTER_ID[npcId]
  const present = useCharacterStore((s) => s.characters[charId] !== undefined)
  const activeNpcChat = useNpcConversationStore((s) => s.activeNpcChat)
  const chatOpenForThis = activeNpcChat === npcId
  const eligible = present && gatherFreeNpcEligibility(npcId).eligible

  const opened = useRef(false)
  const approaching = useRef(false)
  const boxRef = useRef<Group>(null)

  // Ends the talk and/or an interrupted approach. The planner must resume in
  // BOTH cases — beginApproach pauses it before the player arrives.
  const cleanup = () => {
    if (opened.current) {
      endTalking(charId)
      useCharacterStore.getState().setInputLocked(false)
    }
    if (opened.current || approaching.current) resumePlanner(charId)
    opened.current = false
    approaching.current = false
  }

  // Panel closed → clean up the 3D talk. Also on real unmount (phase change,
  // reset, character despawn).
  useEffect(() => {
    if (opened.current && !chatOpenForThis) cleanup()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chatOpenForThis])
  useEffect(() => cleanup, []) // eslint-disable-line react-hooks/exhaustive-deps

  useFrame(() => {
    const npc = useCharacterStore.getState().characters[charId]
    if (boxRef.current && npc) boxRef.current.position.set(npc.position[0], 0, npc.position[2])
    if (opened.current || !approaching.current) return
    const player = useCharacterStore.getState().characters[PLAYER_ID]
    if (!player || !npc) return
    if (!isWithinMeetDistance(player.position, npc.position)) return
    approaching.current = false
    // The walk may have been overtaken by a mandatory event — re-check before
    // opening, and hand the NPC back to its planner if the chat can't start.
    if (!gatherFreeNpcEligibility(npcId).eligible) {
      resumePlanner(charId)
      return
    }
    opened.current = true
    openTalk(npcId, charId)
  })

  const beginApproach = () => {
    if (opened.current || approaching.current) return
    if (!gatherFreeNpcEligibility(npcId).eligible) return
    const store = useCharacterStore.getState()
    const npc = store.characters[charId]
    if (!npc || store.inputLocked) return
    pausePlanner(charId)
    releaseClaims(charId)
    store.dispatchTo(charId, { type: 'CLICK_FLOOR', point: nearestWalkable(npc.position) })
    store.clickFloor(approachPoint(npc.position, npc.rotationY))
    approaching.current = true
  }

  if (!present) return null
  const spawn = useCharacterStore.getState().characters[charId]?.position ?? [0, 0, 0]
  const showTarget = eligible && !chatOpenForThis
  return (
    <group ref={boxRef} position={[spawn[0], 0, spawn[2]]}>
      {showTarget ? (
        <Html position={[0, 2.2, 0]} center zIndexRange={[10, 0]}>
          <button className="npc-indicator" aria-label="Свободный разговор" onClick={beginApproach}>
            💬
          </button>
        </Html>
      ) : null}
      {showTarget ? (
        <mesh position={[0, 0.9, 0]} onClick={beginApproach}>
          <boxGeometry args={[0.8, 1.8, 0.8]} />
          <meshBasicMaterial transparent opacity={0} depthWrite={false} />
        </mesh>
      ) : null}
    </group>
  )
}

function openTalk(npcId: NpcId, charId: string) {
  const store = useCharacterStore.getState()
  store.setInputLocked(true)
  const player = store.characters[PLAYER_ID]
  const npc = store.characters[charId]
  store.dispatchTo(PLAYER_ID, { type: 'TALK_START' })
  store.dispatchTo(charId, { type: 'TALK_START' })
  if (player && npc) {
    store.setTransform(PLAYER_ID, player.position, facingBetween(player.position, npc.position))
    store.setTransform(charId, npc.position, facingBetween(npc.position, player.position))
  }
  useNpcConversationStore.getState().openChat(npcId)
}

function endTalking(charId: string) {
  const store = useCharacterStore.getState()
  store.dispatchTo(PLAYER_ID, { type: 'TALK_END' })
  store.dispatchTo(charId, { type: 'TALK_END' })
}

function pausePlanner(charId: string) {
  const store = useCharacterStore.getState()
  const next = new Set(store.sceneOwned)
  next.add(charId)
  store.setSceneOwned(next)
}

function resumePlanner(charId: string) {
  const store = useCharacterStore.getState()
  const next = new Set(store.sceneOwned)
  next.delete(charId)
  store.setSceneOwned(next)
}
