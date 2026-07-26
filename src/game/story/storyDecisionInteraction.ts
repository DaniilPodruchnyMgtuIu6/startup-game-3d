import { useGameStore, type ChoiceOption, type DialogueLine } from '../gameStore'
import { useSprintStore } from '../sprintStore'
import { useTeamStore } from '../teamStore'
import { useCharacterStore, PLAYER_ID } from '../../character/characterStore'
import { usePerformanceStore } from '../../character/performance/performanceStore'
import { nearestWalkable } from '../../character/grid'
import { releaseClaims } from '../../interaction/interactionRegistry'
import { approachPoint, facingBetween } from '../meetingGeometry'
import { hasSecuritySpecialist } from '../teamRules'
import { NPC_CHARACTER_ID, type NpcId } from '../npcChatTypes'
import type { StoryMoment } from '../securityStoryRules'
import { useStoryDecisionStore } from './storyDecisionStore'
import { buildStorySceneScript } from './storyDecisionDialogues'
import { evaluateStoryUnlocks } from './evaluateStoryUnlocks'
import type { Level1StoryDecisionId } from './level1Timeline'

// The non-React half of a Level 1 decision scene (Feature 17B): the player
// walks to the scene's lead colleague, the scripted talk plays, the choice is
// recorded through the story store (which applies the handler effects), the
// reaction line closes the scene and the NPC returns to their planner. One
// runner serves all eight decisions - the script data differs, the flow never.

export function currentMoment(): StoryMoment {
  const s = useSprintStore.getState()
  return { sprintNumber: s.sprintNumber, day: s.day }
}

// The colleague who carries the marker and leads the scene. Deterministic;
// the suspicious-activity scene is led by Kirill until Ilya is really hired.
export function getSceneLeadNpcId(decisionId: Level1StoryDecisionId, ilyaHired: boolean): NpcId {
  switch (decisionId) {
    case 'security-baseline-path':
    case 'release-risk-decision':
      return 'sonya-sokolova'
    case 'frontend-test-data':
      return 'alina-belova'
    case 'security-first-priority':
      return 'ilya-vlasov'
    case 'suspicious-activity-disclosure':
      return ilyaHired ? 'ilya-vlasov' : 'kirill-morozov'
    case 'developer-admin-access':
    case 'backup-and-restore-strategy':
    case 'architecture-boundary':
      return 'kirill-morozov'
  }
}

export function getSceneLeadCharacterId(decisionId: Level1StoryDecisionId): string {
  const ilyaHired = hasSecuritySpecialist(useTeamStore.getState().hires)
  return NPC_CHARACTER_ID[getSceneLeadNpcId(decisionId, ilyaHired)]
}

function pausePlanner(characterId: string): void {
  const store = useCharacterStore.getState()
  const next = new Set(store.sceneOwned)
  next.add(characterId)
  store.setSceneOwned(next)
}

export function resumePlanner(characterId: string): void {
  const store = useCharacterStore.getState()
  const next = new Set(store.sceneOwned)
  next.delete(characterId)
  store.setSceneOwned(next)
}

// Player click on the story marker: pause the lead NPC and walk the player to
// them. The dialogue waits until arrival (approach, never teleport).
export function beginApproachToStoryScene(decisionId: Level1StoryDecisionId): boolean {
  const store = useCharacterStore.getState()
  if (store.inputLocked) return false
  const characterId = getSceneLeadCharacterId(decisionId)
  const lead = store.characters[characterId]
  if (!lead) return false
  pausePlanner(characterId)
  releaseClaims(characterId)
  store.dispatchTo(characterId, { type: 'CLICK_FLOOR', point: nearestWalkable(lead.position) })
  store.clickFloor(approachPoint(lead.position, lead.rotationY))
  return true
}

function startTalking(characterId: string): void {
  const store = useCharacterStore.getState()
  const player = store.characters[PLAYER_ID]
  const lead = store.characters[characterId]
  store.dispatchTo(PLAYER_ID, { type: 'TALK_START' })
  store.dispatchTo(characterId, { type: 'TALK_START' })
  usePerformanceStore.getState().setGazePair(PLAYER_ID, characterId)
  if (player && lead) {
    store.setTransform(PLAYER_ID, player.position, facingBetween(player.position, lead.position))
    store.setTransform(characterId, lead.position, facingBetween(lead.position, player.position))
  }
}

function endTalking(characterId: string): void {
  const store = useCharacterStore.getState()
  store.dispatchTo(PLAYER_ID, { type: 'TALK_END' })
  store.dispatchTo(characterId, { type: 'TALK_END' })
  usePerformanceStore.getState().clearGaze(PLAYER_ID, characterId)
}

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

// The full scripted decision talk. A choice already saved before an
// interrupted run is reused - the player is never asked twice and effects
// never re-apply (the store guarantees both).
export async function runStoryDecisionConversation(decisionId: Level1StoryDecisionId): Promise<void> {
  const characterId = getSceneLeadCharacterId(decisionId)
  const chars = useCharacterStore.getState()
  chars.setInputLocked(true)
  startTalking(characterId)
  const story = useStoryDecisionStore.getState()
  story.startDecision(decisionId, currentMoment())

  const script = buildStorySceneScript(decisionId, { ilyaHired: hasSecuritySpecialist(useTeamStore.getState().hires) })
  await say(script.lines)

  let choiceId = useStoryDecisionStore.getState().decisions[decisionId].selectedChoiceId
  if (!choiceId) {
    choiceId = await choose(script.choices)
  }
  const resolution = useStoryDecisionStore.getState().resolveDecision(decisionId, choiceId, currentMoment())

  // The reaction is shown BEFORE the scene closes (17B §9).
  await say(script.reaction(resolution.choiceId))

  endTalking(characterId)
  resumePlanner(characterId)
  useCharacterStore.getState().setInputLocked(false)

  // A resolved decision may immediately make the next one eligible.
  evaluateStoryUnlocks()
}
