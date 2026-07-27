import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { render, cleanup, waitFor } from '@testing-library/react'
import { WorkdayFlowController } from './WorkdayFlowController'
import { useSprintStore } from './sprintStore'
import { useEconomyStore } from './economyStore'
import { useTeamStore } from './teamStore'
import { useProductStore } from './productStore'
import { useSecurityStoryStore } from './securityStoryStore'
import { useSecurityAuditStore, INITIAL_SECURITY_AUDIT } from './securityAuditStore'
import { useAccessControlStore, INITIAL_ACCESS_CONTROL_DATA } from './accessControlStore'
import { useServerIncidentStore, INITIAL_SERVER_INCIDENT_DATA } from './serverIncidentStore'
import { useServerIncidentsStore } from './serverIncidentsStore'
import { useGameOutcomeStore } from './gameOutcomeStore'
import { useCharacterStore, PLAYER_ID } from '../character/characterStore'
import { useCutsceneStore } from '../cutscenes/cutsceneStore'
import { useGameStore } from './gameStore'
import { useCinematicStore } from './cinematics/cinematicDirector'
import { KICKOFF_SLOTS } from './cinematics/meetingSlots'
import { INITIAL_SPRINT_STATE } from './sprintRules'
import { INITIAL_SECURITY_BREACH } from './securityStoryRules'
import { initialTransactions } from './economyRules'
import { initialTaskStates, addToPlan } from './productRules'

// 18H §2/§5: the kickoff branch of the controller effect, end to end in jsdom.
// The cast is spawned ON its meeting slots so the gather resolves without a
// walk, and the camera settle promises resolve immediately (no rig in jsdom) -
// what remains is exactly the lifecycle under test: lock input -> cinematic ->
// gather -> first line only after settle -> unlock when the dialogue closes.
function seedKickoffDay() {
  window.localStorage.clear()
  useSprintStore.setState({ ...INITIAL_SPRINT_STATE, sprintNumber: 2, phase: 'active', day: 1, confirmingEndDay: false, kickoffShownForSprint: 1 })
  useEconomyStore.setState({ transactions: initialTransactions(), panelOpen: false })
  useTeamStore.setState({
    hires: [
      { employeeId: 'kirill-morozov', hiredAtSprint: 1, hiredAtDay: 1 },
      { employeeId: 'alina-belova', hiredAtSprint: 1, hiredAtDay: 1 },
    ],
    panelOpen: false,
  })
  useProductStore.setState({
    taskStates: addToPlan(initialTaskStates(), 'auth-api', 2),
    workdayHistory: [],
    activeReport: null,
    boardOpen: false,
    prototypeOpen: false,
    releaseCheckOpen: false,
  })
  useSecurityStoryStore.setState({
    securityBreach: { ...INITIAL_SECURITY_BREACH, status: 'completed', decision: 'take-responsibility', effectsApplied: true },
    postAuditConversation: { status: 'completed', staffingDecision: 'decline-security-hire', completedAt: { sprintNumber: 1, day: 1 }, effectsApplied: true },
    hasIntroducedSecuritySpecialist: false,
  })
  useSecurityAuditStore.setState({ ...INITIAL_SECURITY_AUDIT, auditResultToAcknowledge: null })
  useAccessControlStore.setState({ ...INITIAL_ACCESS_CONTROL_DATA, intrusionResultToAcknowledge: null })
  useServerIncidentStore.setState({ ...INITIAL_SERVER_INCIDENT_DATA, incidentResultToAcknowledge: null })
  useServerIncidentsStore.setState({ activeMinigame: null })
  useCutsceneStore.setState({ activeSceneId: null })
  useGameOutcomeStore.setState({ status: 'playing' })
  useGameStore.setState({ phase: 'free', activeDialogue: null, activeChoice: null })
  useCinematicStore.setState({ active: false, panelSide: 'center' })
  const chars = useCharacterStore.getState()
  for (const id of Object.keys(chars.characters)) if (id !== PLAYER_ID) chars.removeCharacter(id)
  useCharacterStore.setState({ inputLocked: false, sceneOwned: new Set() })
  // everyone already standing on their slot -> the readiness barrier is
  // instantly satisfied and the first line follows the settle chain
  for (const slot of KICKOFF_SLOTS) {
    if (slot.characterId === PLAYER_ID) {
      useCharacterStore.getState().setTransform(PLAYER_ID, slot.position, slot.facingY)
    } else if (slot.characterId !== 'npc-ilya-vlasov') {
      useCharacterStore.getState().spawnCharacter(slot.characterId, slot.position, slot.facingY)
    }
  }
}

afterEach(cleanup)

describe('WorkdayFlowController kickoff scene (18H §2/§5)', () => {
  beforeEach(seedKickoffDay)

  it('locks player input for the whole scene and unlocks when the dialogue closes', async () => {
    render(<WorkdayFlowController />)
    // the first line opens only after gather + camera settle (§2)
    await waitFor(() => expect(useGameStore.getState().activeDialogue).not.toBeNull())
    expect(useGameStore.getState().activeDialogue?.lines[0].text).toContain('Планёрка спринта 2')
    // §5: the player cannot walk out of the slot mid-scene
    expect(useCharacterStore.getState().inputLocked).toBe(true)
    // ...and the cinematic survived begin() (the insta-end regression)
    expect(useCinematicStore.getState().active).toBe(true)
    // §2 «shown» marker is set right before the dialogue
    expect(useSprintStore.getState().kickoffShownForSprint).toBe(2)

    // closing the dialogue ends the scene: input unlocks, cinematic auto-ends
    useGameStore.setState({ activeDialogue: null })
    await waitFor(() => expect(useCharacterStore.getState().inputLocked).toBe(false))
    await waitFor(() => expect(useCinematicStore.getState().active).toBe(false))
    // scene ownership released - the planner may resume (§2 lifecycle tail)
    expect(useCharacterStore.getState().sceneOwned.size).toBe(0)
  })

  it('does not replay the kickoff once the shown marker is set', async () => {
    useSprintStore.setState({ kickoffShownForSprint: 2 })
    render(<WorkdayFlowController />)
    // give the effect a tick; no dialogue and no input lock may appear
    await new Promise((resolve) => setTimeout(resolve, 50))
    expect(useGameStore.getState().activeDialogue).toBeNull()
    expect(useCharacterStore.getState().inputLocked).toBe(false)
  })
})
