import { useGameStore, type ChoiceOption, type DialogueLine } from '../gameStore'
import { useSprintStore } from '../sprintStore'
import { useCharacterStore, PLAYER_ID } from '../../character/characterStore'
import { femalePm } from '../../character/characters/femalePm'
import { nearestWalkable } from '../../character/grid'
import { releaseClaims } from '../../interaction/interactionRegistry'
import { approachPoint, facingBetween } from '../meetingGeometry'
import type { StoryMoment } from '../securityStoryRules'
import { useStoryDecisionStore } from './storyDecisionStore'
import { baselineIntroLines, baselineReactionLines, BASELINE_CHOICES } from './baselineSceneDialogue'

// The non-React half of the baseline decision scene (Feature 17A): pausing
// Sonya's planner, walking the player to her and running the scripted talk
// against the stores. Mirrors postAuditInteraction so auto/manual paths and
// tests share one flow. The scene records the choice; it applies no gameplay
// effects in 17A.

export const SONYA = femalePm.id
const DECISION_ID = 'security-baseline-path' as const

export function currentMoment(): StoryMoment {
  const s = useSprintStore.getState()
  return { sprintNumber: s.sprintNumber, day: s.day }
}

function pausePlanner(): void {
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

// Player click on Sonya's story marker: pause her planner and route the player
// to her. The dialogue itself waits until arrival (approach, never teleport).
export function beginApproachToSonyaForBaseline(): boolean {
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

// The full scripted baseline talk. A choice already saved before an interrupted
// run is reused - the player is never asked twice and effects never re-apply.
export async function runBaselineDecisionConversation(): Promise<void> {
  const chars = useCharacterStore.getState()
  chars.setInputLocked(true)
  startTalking()
  const story = useStoryDecisionStore.getState()
  story.startDecision(DECISION_ID, currentMoment())

  await say(baselineIntroLines())

  let choiceId = useStoryDecisionStore.getState().decisions[DECISION_ID].selectedChoiceId
  if (!choiceId) {
    choiceId = await choose(BASELINE_CHOICES)
  }
  const resolution = useStoryDecisionStore.getState().resolveDecision(DECISION_ID, choiceId, currentMoment())

  await say(baselineReactionLines(resolution.choiceId))

  endTalking()
  resumePlanner()
  useCharacterStore.getState().setInputLocked(false)
}
