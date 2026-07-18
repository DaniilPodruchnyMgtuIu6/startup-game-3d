import { useGameStore, type ChoiceOption, type DialogueLine } from './gameStore'
import { useSprintStore } from './sprintStore'
import { useSecurityStoryStore } from './securityStoryStore'
import { useCharacterStore, PLAYER_ID } from '../character/characterStore'
import { femalePm } from '../character/characters/femalePm'
import { nearestWalkable } from '../character/grid'
import { releaseClaims } from '../interaction/interactionRegistry'
import { approachPoint, facingBetween } from './meetingGeometry'
import {
  getPostAuditDialogueBranch,
  mapPostAuditChoiceToStaffingDecision,
  type SecurityStaffingDecision,
  type StoryMoment,
} from './securityStoryRules'
import { postAuditIntroLines, postAuditFinalLines, POST_AUDIT_CHOICES } from './postAuditDialogue'

// The non-React half of the post-audit conversation (Feature 06): pausing
// Sonya's autonomous brain, sending the player to her, and running the scripted
// talk against the stores. Kept separate from the controller component so it is
// testable in jsdom without mounting a WebGL scene.

export const SONYA = femalePm.id

export function currentMoment(): StoryMoment {
  const s = useSprintStore.getState()
  return { sprintNumber: s.sprintNumber, day: s.day }
}

// While owned by the conversation, Sonya's office-life planner will not schedule
// new activities (Npcs.tsx gates on sceneOwned). Add/remove without clobbering
// any ids a cutscene may own.
export function pausePlanner(): void {
  const store = useCharacterStore.getState()
  const next = new Set(store.sceneOwned)
  next.add(SONYA)
  store.setSceneOwned(next)
}

export function resumePlanner(): void {
  const store = useCharacterStore.getState()
  const next = new Set(store.sceneOwned)
  next.delete(SONYA)
  store.setSceneOwned(next)
}

export function isPlannerPaused(): boolean {
  return useCharacterStore.getState().sceneOwned.has(SONYA)
}

// Player click on Sonya's marker: pause her, drop any claim, halt her where she
// stands, and route the player to a spot beside her. Returns false if she is not
// present. Does NOT open the dialogue - that waits until arrival (approach, not
// teleport).
export function beginApproachToSonya(): boolean {
  const store = useCharacterStore.getState()
  if (store.inputLocked) return false
  const sonya = store.characters[SONYA]
  if (!sonya) return false
  pausePlanner()
  releaseClaims(SONYA)
  store.dispatchTo(SONYA, { type: 'CLICK_FLOOR', point: nearestWalkable(sonya.position) })
  store.clickFloor(approachPoint(sonya.position, sonya.rotationY))
  return true
}

function startTalking(): void {
  const store = useCharacterStore.getState()
  const player = store.characters[PLAYER_ID]
  const sonya = store.characters[SONYA]
  store.dispatchTo(PLAYER_ID, { type: 'TALK_START' })
  store.dispatchTo(SONYA, { type: 'TALK_START' })
  if (player && sonya) {
    store.setTransform(PLAYER_ID, player.position, facingBetween(player.position, sonya.position))
    store.setTransform(SONYA, sonya.position, facingBetween(sonya.position, player.position))
  }
}

function endTalking(): void {
  const store = useCharacterStore.getState()
  store.dispatchTo(PLAYER_ID, { type: 'TALK_END' })
  store.dispatchTo(SONYA, { type: 'TALK_END' })
}

// Shows a linear dialogue and resolves when the player closes its last line -
// the same "wait for the panel to close" contract the cutscene director uses.
function say(lines: DialogueLine[]): Promise<void> {
  useGameStore.getState().startDialogue(lines)
  return new Promise((resolve) => {
    if (useGameStore.getState().activeDialogue === null) {
      resolve()
      return
    }
    const unsubscribe = useGameStore.subscribe(() => {
      if (useGameStore.getState().activeDialogue !== null) return
      unsubscribe()
      resolve()
    })
  })
}

function choose(options: ChoiceOption[]): Promise<string> {
  return new Promise((resolve) => {
    useGameStore.getState().presentChoice(options, resolve)
  })
}

// The full scripted talk: lock movement, tone the intro by the past breach
// choice, take (or reuse) the staffing decision, close, then hand control back
// and let Sonya resume her autonomous life.
export async function runPostAuditConversation(): Promise<void> {
  const chars = useCharacterStore.getState()
  chars.setInputLocked(true)
  startTalking()
  useSecurityStoryStore.getState().markPostAuditConversationRunning(currentMoment())

  const branch = getPostAuditDialogueBranch(useSecurityStoryStore.getState().securityBreach.decision)
  await say(postAuditIntroLines(branch))

  // A decision saved before a mid-conversation reload is reused (spec §14): the
  // choice is skipped and effects are never re-applied.
  let decision: SecurityStaffingDecision | undefined =
    useSecurityStoryStore.getState().postAuditConversation.staffingDecision
  if (!decision) {
    const pick = await choose(POST_AUDIT_CHOICES)
    decision = mapPostAuditChoiceToStaffingDecision(pick) ?? 'decline-security-hire'
    useSecurityStoryStore.getState().resolveSecurityStaffingDecision(decision)
  }

  await say(postAuditFinalLines(decision))
  useSecurityStoryStore.getState().markPostAuditConversationCompleted(currentMoment())

  endTalking()
  resumePlanner()
  useCharacterStore.getState().setInputLocked(false)
}
