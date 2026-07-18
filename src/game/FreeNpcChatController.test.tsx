import { describe, it, expect, beforeEach } from 'vitest'
import ReactThreeTestRenderer from '@react-three/test-renderer'
import { FreeNpcChatController } from './FreeNpcChatController'
import { useCharacterStore, PLAYER_ID } from '../character/characterStore'
import { useGameStore } from './gameStore'
import { useTeamStore } from './teamStore'
import { useSecurityStoryStore } from './securityStoryStore'
import { useNpcConversationStore } from './npcConversationStore'
import { useGameOutcomeStore } from './gameOutcomeStore'
import { INITIAL_SECURITY_BREACH } from './securityStoryRules'
import { NPC_CHARACTER_ID } from './npcChatTypes'

// Regression for the free-chat lifecycle (Feature 15 deep pass): opening the
// chat locks input, which makes the NPC "not eligible" — the click target must
// NOT unmount and fire its cleanup mid-conversation (that used to unlock the
// player, end the talk animation and hand the NPC back to its planner while
// the panel was still open). An interrupted approach must also release the
// planner instead of leaving the NPC scene-owned forever.

const KIRILL_CHAR = NPC_CHARACTER_ID['kirill-morozov']

function setupStores() {
  window.localStorage.clear()
  useGameStore.setState({ phase: 'free', playerName: 'Т', activeDialogue: null, activeChoice: null, tasks: [], reprimands: 0 })
  useTeamStore.setState({
    hires: [
      { employeeId: 'kirill-morozov', hiredAtSprint: 1, hiredAtDay: 1 },
      { employeeId: 'alina-belova', hiredAtSprint: 1, hiredAtDay: 1 },
    ],
    panelOpen: false,
  })
  useSecurityStoryStore.setState({
    securityBreach: { ...INITIAL_SECURITY_BREACH, status: 'completed', decision: 'take-responsibility', effectsApplied: true },
    postAuditConversation: { status: 'completed', staffingDecision: 'decline-security-hire', completedAt: { sprintNumber: 2, day: 1 }, effectsApplied: true },
    hasIntroducedSecuritySpecialist: false,
  })
  useGameOutcomeStore.getState().resetGameOutcome()
  useNpcConversationStore.getState().resetNpcConversations()

  const chars = useCharacterStore.getState()
  chars.setInputLocked(false)
  chars.setSceneOwned(new Set())
  chars.spawnCharacter(KIRILL_CHAR, [1, 0, 1], 0)
  // player already within MEET_DISTANCE of Kirill so the approach opens quickly
  chars.setTransform(PLAYER_ID, [1.6, 0, 1.6], 0)
}

const charStore = () => useCharacterStore.getState()

async function openChatWithKirill(renderer: Awaited<ReturnType<typeof ReactThreeTestRenderer.create>>) {
  // exactly one invisible click box is rendered (only Kirill is spawned)
  const boxes = renderer.scene.findAllByType('Mesh')
  expect(boxes).toHaveLength(1)
  await renderer.fireEvent(boxes[0], 'click')
  // a couple of frames: approach detects proximity and opens the talk
  await ReactThreeTestRenderer.act(async () => {
    await renderer.advanceFrames(3, 0.016)
  })
}

describe('free NPC chat lifecycle', () => {
  beforeEach(setupStores)

  it('keeps the conversation locked while the panel is open (no unmount-cleanup mid-chat)', async () => {
    const renderer = await ReactThreeTestRenderer.create(<FreeNpcChatController />)
    await openChatWithKirill(renderer)

    expect(useNpcConversationStore.getState().activeNpcChat).toBe('kirill-morozov')
    expect(charStore().inputLocked).toBe(true)
    expect(charStore().sceneOwned.has(KIRILL_CHAR)).toBe(true)
    expect(charStore().characters[KIRILL_CHAR].state.kind).toBe('talking')

    // several more frames/re-renders: the regression made cleanup fire here
    await ReactThreeTestRenderer.act(async () => {
      await renderer.advanceFrames(5, 0.016)
    })
    expect(charStore().inputLocked).toBe(true) // player still locked in the talk
    expect(charStore().sceneOwned.has(KIRILL_CHAR)).toBe(true) // planner still paused
    expect(charStore().characters[KIRILL_CHAR].state.kind).toBe('talking')

    await renderer.unmount()
  })

  it('closing the panel releases input, the talk state and the planner', async () => {
    const renderer = await ReactThreeTestRenderer.create(<FreeNpcChatController />)
    await openChatWithKirill(renderer)

    await ReactThreeTestRenderer.act(async () => {
      useNpcConversationStore.getState().closeChat()
      await renderer.advanceFrames(2, 0.016)
    })

    expect(charStore().inputLocked).toBe(false)
    expect(charStore().sceneOwned.has(KIRILL_CHAR)).toBe(false)
    expect(charStore().characters[KIRILL_CHAR].state.kind).toBe('idle')
    await renderer.unmount()
  })

  it('an approach interrupted by a mandatory dialogue hands the NPC back to the planner', async () => {
    // player far from Kirill so the approach has to walk
    charStore().setTransform(PLAYER_ID, [5, 0, 5], 0)
    const renderer = await ReactThreeTestRenderer.create(<FreeNpcChatController />)
    const boxes = renderer.scene.findAllByType('Mesh')
    await renderer.fireEvent(boxes[0], 'click')
    expect(charStore().sceneOwned.has(KIRILL_CHAR)).toBe(true) // paused for the approach

    // a mandatory dialogue opens mid-walk; the player "arrives" during it
    useGameStore.getState().startDialogue([{ speaker: 'X', text: 'y' }])
    charStore().setTransform(PLAYER_ID, [1.6, 0, 1.6], 0)
    await ReactThreeTestRenderer.act(async () => {
      await renderer.advanceFrames(3, 0.016)
    })

    // the chat must NOT open, and the NPC must not stay scene-owned forever
    expect(useNpcConversationStore.getState().activeNpcChat).toBeNull()
    expect(charStore().sceneOwned.has(KIRILL_CHAR)).toBe(false)
    await renderer.unmount()
  })
})
