import { useGameStore, type ChoiceOption, type DialogueLine } from '../gameStore'
import { useSprintStore } from '../sprintStore'
import { useTeamStore } from '../teamStore'
import { useCharacterStore, PLAYER_ID } from '../../character/characterStore'
import { usePerformanceStore } from '../../character/performance/performanceStore'
import { beginConversationCinematic, playInsert } from '../cinematics/cinematicDirector'
import { playVideoCutscene } from '../../cutscenes/videoCutscene'
import { nearestWalkable } from '../../character/grid'
import { releaseClaims } from '../../interaction/interactionRegistry'
import { approachPoint, facingBetween } from '../meetingGeometry'
import { hasSecuritySpecialist } from '../teamRules'
import { NPC_CHARACTER_ID, type NpcId } from '../npcChatTypes'
import type { StoryMoment } from '../securityStoryRules'
import { useStoryDecisionStore } from './storyDecisionStore'
import { useCyberStoryStore } from './cyberStoryStore'
import { buildCyberStorySceneScript, type CyberStorySceneContext } from './cyberStoryDialogues'
import { buildCyberConsequenceScript, applyCyberConsequenceEffects } from './cyberStoryConsequences'
import { evaluateCyberStoryUnlocks } from './evaluateCyberStoryUnlocks'
import { hasStrongPhishingDefense, hasSecureLogMasking } from './cyberStoryLinkedEffects'
import type { CyberConsequenceId, CyberStoryIncidentId } from './cyberStoryTypes'

// The non-React half of a Feature 19 cyber-incident scene: the player walks to
// the scene's lead colleague, the scripted talk plays (with a short screen
// insert before the choice), the choice is recorded through the cyber-story
// store (which applies the handler effects), the reaction line closes the
// scene and the NPC returns to their planner. Mirrors storyDecisionInteraction.

export function currentMoment(): StoryMoment {
  const s = useSprintStore.getState()
  return { sprintNumber: s.sprintNumber, day: s.day }
}

// The colleague who carries the marker and leads the scene.
export function getSceneLeadNpcId(incidentId: CyberStoryIncidentId): NpcId {
  switch (incidentId) {
    case 'executive-phishing-request':
      return 'sonya-sokolova'
    case 'supply-chain-update':
    case 'shadow-it-log-upload':
    case 'secret-committed-to-repository':
    case 'mfa-fatigue-attack':
      return 'kirill-morozov'
    case 'external-ai-data-disclosure':
      return 'alina-belova'
  }
}

export function getSceneLeadCharacterId(incidentId: CyberStoryIncidentId): string {
  return NPC_CHARACTER_ID[getSceneLeadNpcId(incidentId)]
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
export function beginApproachToCyberScene(incidentId: CyberStoryIncidentId): boolean {
  const store = useCharacterStore.getState()
  if (store.inputLocked) return false
  const characterId = getSceneLeadCharacterId(incidentId)
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

// The workstation screen every incident's cinematic insert frames (the same
// prop Feature 17B's admin-access/test-data decisions use) - a generated
// Higgsfield clip plays here when one is registered under public/cutscenes/;
// its absence falls back to this in-engine insert shot (§ "безопасный fallback
// без Higgsfield" is mandatory, the clip itself is optional presentation only).
const SCREEN_INSERT_POINT: [number, number, number] = [-1.9, 0.75, 4.75]

const INSERT_CLIP: Record<CyberStoryIncidentId, string> = {
  'executive-phishing-request': '/cutscenes/executive-phishing-request-insert.mp4',
  'supply-chain-update': '/cutscenes/supply-chain-update-insert.mp4',
  'shadow-it-log-upload': '/cutscenes/shadow-it-log-upload-insert.mp4',
  'secret-committed-to-repository': '/cutscenes/secret-committed-to-repository-insert.mp4',
  'mfa-fatigue-attack': '/cutscenes/mfa-fatigue-attack-insert.mp4',
  'external-ai-data-disclosure': '/cutscenes/external-ai-data-disclosure-insert.mp4',
}

function buildSceneContext(): CyberStorySceneContext {
  const decisions = useStoryDecisionStore.getState().decisions
  const firstPriority = decisions['security-first-priority']
  const trainingCompleted = firstPriority.status === 'resolved' && firstPriority.selectedChoiceId === 'prioritize-security-training'
  const centralLoggingChosen = firstPriority.status === 'resolved' && firstPriority.selectedChoiceId === 'prioritize-central-logging'
  const flags = useCyberStoryStore.getState().flags
  return {
    ilyaHired: hasSecuritySpecialist(useTeamStore.getState().hires),
    securityTrainingCompleted: trainingCompleted,
    centralLoggingChosen,
    hasStrongPhishingDefense: hasStrongPhishingDefense(flags),
    hasSecureLogMasking: hasSecureLogMasking(flags),
  }
}

// The full scripted incident talk. A choice already saved before an
// interrupted run is reused - the player is never asked twice and effects
// never re-apply (the store guarantees both).
export async function runCyberStoryConversation(incidentId: CyberStoryIncidentId): Promise<void> {
  const characterId = getSceneLeadCharacterId(incidentId)
  const chars = useCharacterStore.getState()
  chars.setInputLocked(true)
  startTalking(characterId)
  const story = useCyberStoryStore.getState()
  story.startIncident(incidentId, currentMoment())

  const cinematic = beginConversationCinematic({ pairA: PLAYER_ID, pairB: characterId })
  try {
    await cinematic.ready // no line before the camera settles

    // Short pre-choice insert (§ Higgsfield-вставка): a generated clip if one
    // exists, else the screen prop shot - never blocks, never shows a choice.
    const clipPlayed = await playVideoCutscene(INSERT_CLIP[incidentId])
    if (!clipPlayed) await playInsert(SCREEN_INSERT_POINT, { side: 1, durationMs: 1300 })

    const script = buildCyberStorySceneScript(incidentId, buildSceneContext())
    await say(script.lines)

    let choiceId: string | undefined = useCyberStoryStore.getState().incidents[incidentId].selectedChoiceId
    if (!choiceId) {
      choiceId = await choose(script.choices)
    }
    const resolution = useCyberStoryStore.getState().resolveIncident(incidentId, choiceId, currentMoment())

    // The reaction is shown BEFORE the scene closes.
    await say(script.reaction(resolution.choiceId))
  } finally {
    await cinematic.end()
    endTalking(characterId)
    resumePlanner(characterId)
    useCharacterStore.getState().setInputLocked(false)
  }

  // A resolved incident may immediately make the next one eligible.
  evaluateCyberStoryUnlocks()
}

// Dev-only (see cyberStoryDevLauncher.ts): plays the exact same cinematic,
// insert and dialogue as runCyberStoryConversation, but NEVER calls
// resolveIncident - no money, no risk signal, no work assignment, no
// scheduled consequence. For visual QA of camera/dialogue/insert only.
export async function runCyberStoryConversationVisualOnly(incidentId: CyberStoryIncidentId): Promise<void> {
  const characterId = getSceneLeadCharacterId(incidentId)
  const chars = useCharacterStore.getState()
  chars.setInputLocked(true)
  startTalking(characterId)

  const cinematic = beginConversationCinematic({ pairA: PLAYER_ID, pairB: characterId })
  try {
    await cinematic.ready
    const clipPlayed = await playVideoCutscene(INSERT_CLIP[incidentId])
    if (!clipPlayed) await playInsert(SCREEN_INSERT_POINT, { side: 1, durationMs: 1300 })

    const script = buildCyberStorySceneScript(incidentId, buildSceneContext())
    await say(script.lines)
    const choiceId = await choose(script.choices)
    await say(script.reaction(choiceId))
  } finally {
    await cinematic.end()
    endTalking(characterId)
    resumePlanner(characterId)
    useCharacterStore.getState().setInputLocked(false)
  }
}

// --- Delayed consequence playback ---------------------------------------------

// Optional per-consequence insert (mirrors INSERT_CLIP above, one level down):
// most consequences play dialogue-only (the same as every Feature 17C
// checkpoint without an insert), a few have a generated pre-choice-style clip.
// Missing entries simply skip straight to dialogue - no fallback prop-shot
// here, since a dialogue-only consequence was already the shipped Feature 19A
// behaviour and is not being changed for the ids that never had a clip.
const CONSEQUENCE_INSERT_CLIP: Partial<Record<CyberConsequenceId, string>> = {
  'supply-chain-unknown-connection': '/cutscenes/supply-chain-update-consequence-insert.mp4',
  'shadow-it-external-download': '/cutscenes/shadow-it-log-upload-consequence-insert.mp4',
}

function isUiFreeForCyberConsequence(): boolean {
  // A lighter check than StoryConsequenceController's isUiFree - the caller
  // (CyberStoryController) already gates on the broader coordinator state
  // before invoking this; this only guards the dialogue/input primitives the
  // runner itself touches.
  return useGameStore.getState().activeDialogue === null && useGameStore.getState().activeChoice === null && !useCharacterStore.getState().inputLocked
}

export async function runCyberConsequenceScene(id: CyberConsequenceId): Promise<void> {
  if (!isUiFreeForCyberConsequence()) return
  const store = useCyberStoryStore.getState()
  store.startConsequence(id)
  const moment = currentMoment()
  const script = buildCyberConsequenceScript(id)

  const cinematic = beginConversationCinematic({})
  try {
    const clipPath = CONSEQUENCE_INSERT_CLIP[id]
    if (clipPath) await playVideoCutscene(clipPath)
    await say(script.lines)
    applyCyberConsequenceEffects(id, moment)
  } finally {
    await cinematic.end()
  }
  useCyberStoryStore.getState().completeConsequence(id)
}
