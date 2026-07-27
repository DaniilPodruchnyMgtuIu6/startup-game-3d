// Feature 18D §1/§6: the Cinematic Director - a thin runtime that turns the
// pure shot grammar into camera moves on the existing cutscene rig. Two entry
// points:
//   - subjectOf/playShot: building blocks for scripted cutscenes;
//   - beginConversationCinematic: per-line coverage for dialogue scenes
//     (kickoff, story talks) - the camera cuts to whoever speaks, alternating
//     sides like real conversation coverage, with OTS when the listener is
//     known. Exactly ONE cinematic can run at a time (§9).
import { create } from 'zustand'
import { useGameStore, type DialogueLine } from '../gameStore'
import { useCharacterStore, PLAYER_ID } from '../../character/characterStore'
import { CHARACTERS, DEVELOPER_CHARACTERS, SPECIALIST_CHARACTERS, PLAYER_CHARACTER } from '../../character/characters'
import { enterCutsceneCamera, exitCutsceneCamera, flyTo, useCutsceneCameraStore } from '../../scene/camera/cameraController'
import { computeShot, type CinematicShotType, type ShotFrame, type SubjectPose } from './cinematicShots'
import { makeShotSafe } from './cinematicSafety'

// HUD/letterbox flag (§8): SprintHud hides and CinematicBars show while true.
export const useCinematicStore = create<{ active: boolean }>()(() => ({ active: false }))

const SEATED_KINDS = new Set(['sittingDown', 'working', 'sittingIdle', 'sofaSitting'])

export function subjectOf(characterId: string): SubjectPose | undefined {
  const entity = useCharacterStore.getState().characters[characterId]
  if (!entity) return undefined
  return { position: entity.position, rotationY: entity.rotationY, seated: SEATED_KINDS.has(entity.state.kind) }
}

// Fly the cutscene camera to a shot, safety-clamped. Usable from cutscene
// scripts (the camera rig is already active there) and from the conversation
// cinematic below.
export async function playShot(type: CinematicShotType, characterId: string, opts: { partnerId?: string; side?: 1 | -1; durationMs?: number } = {}): Promise<void> {
  const subject = subjectOf(characterId)
  if (!subject) return
  const partner = opts.partnerId ? subjectOf(opts.partnerId) : undefined
  const frame = computeShot(type, subject, { partner, side: opts.side, durationMs: opts.durationMs })
  const safe = makeShotSafe(frame)
  await flyTo(safe.target, safe.position, safe.durationMs)
}

// An insert shot of a PROP (unlocked monitor, whiteboard, server rack): the
// point of interest is a raw world position, not a character.
export async function playInsert(propPoint: [number, number, number], opts: { side?: 1 | -1; durationMs?: number } = {}): Promise<void> {
  const frame = computeShot('insert', { position: propPoint, rotationY: 0 }, { side: opts.side, durationMs: opts.durationMs ?? 1000 })
  const safe = makeShotSafe(frame)
  await flyTo(safe.target, safe.position, safe.durationMs)
}

// Display name (as dialogue lines carry it) -> characterId, built from the
// real definitions so the mapping can never drift from the cast.
const NAME_TO_CHARACTER: Record<string, string> = {}
for (const definition of [...CHARACTERS, ...DEVELOPER_CHARACTERS, ...SPECIALIST_CHARACTERS]) {
  NAME_TO_CHARACTER[definition.displayName] = definition.id
  if (definition.persona?.name) NAME_TO_CHARACTER[definition.persona.name] = definition.id
}

export function characterIdForSpeaker(line: DialogueLine): string | undefined {
  return NAME_TO_CHARACTER[line.speaker]
}

// For scripted cutscenes (camera rig already active): call `aim` once per
// visible dialogue line while a dialogue is open. Returns the detach fn.
// This is how a cutscene gets per-line coverage without a second camera owner.
export function attachPerLineShots(aim: (line: DialogueLine, index: number) => void): () => void {
  let lastIndex = -1
  const apply = () => {
    const dialogue = useGameStore.getState().activeDialogue
    if (!dialogue || dialogue.index === lastIndex) return
    lastIndex = dialogue.index
    const line = dialogue.lines[dialogue.index]
    if (line) aim(line, dialogue.index)
  }
  const unsubscribe = useGameStore.subscribe(apply)
  apply()
  return unsubscribe
}

export interface ConversationCinematicHandle {
  end: () => Promise<void>
}

export interface ConversationCinematicOptions {
  // Fixed conversation pair: enables OTS coverage. When absent, coverage is
  // per-speaker singles (group scenes like the kickoff).
  pairA?: string
  pairB?: string
  // End automatically when the dialogue closes (single-dialogue scenes).
  autoEndOnDialogueClose?: boolean
  // Characters whose autonomous brains pause for the scene (§6 blocking):
  // added to sceneOwned on start, released on end (ids a cutscene already
  // owns are left untouched).
  ownIds?: string[]
}

// The camera re-aims the CURRENT shot a few times a second with a short
// blend - subjects that finish a walk mid-line stay framed (tracking, §2)
// instead of leaving a one-shot camera looking at empty floor.
const TRACK_INTERVAL_MS = 450

let activeCinematic: ConversationCinematicHandle | null = null

export function beginConversationCinematic(options: ConversationCinematicOptions = {}): ConversationCinematicHandle {
  // §9: only one active cinematic - a second begin() is a safe no-op handle.
  if (activeCinematic || useCutsceneCameraStore.getState().active) {
    return { end: async () => {} }
  }
  useCinematicStore.setState({ active: true })
  enterCutsceneCamera()

  // §6: pause the participants' office-life brains for the scene's duration
  const ownedByUs = (options.ownIds ?? []).filter((id) => !useCharacterStore.getState().sceneOwned.has(id))
  if (ownedByUs.length) {
    const next = new Set(useCharacterStore.getState().sceneOwned)
    for (const id of ownedByUs) next.add(id)
    useCharacterStore.getState().setSceneOwned(next)
  }

  let lastAppliedIndex = -1
  let side: 1 | -1 = 1
  let ended = false
  // the currently held shot, re-aimed by the tracking loop with fresh poses
  let currentAim: (() => void) | null = null

  const aimAtLine = (line: DialogueLine, index: number) => {
    // off-cast speakers (guards, «Руководство») frame the player listening -
    // the camera never stares at an empty room (§5)
    const speakerId = characterIdForSpeaker(line) ?? options.pairA ?? PLAYER_ID
    if (!subjectOf(speakerId)) return
    side = side === 1 ? -1 : 1 // alternate coverage sides every cut
    const shotSide = side
    const partnerId =
      options.pairA && options.pairB ? (speakerId === options.pairA ? options.pairB : options.pairA) : undefined
    let type: CinematicShotType
    if (partnerId) {
      // pair coverage: open on a two-shot, then OTS with medium-close emphasis
      type = index === 0 ? 'two-shot' : index % 3 === 2 ? 'medium-close' : 'over-the-shoulder'
    } else {
      type = index === 0 ? 'medium' : 'medium-close'
    }
    currentAim = () => void playShot(type, speakerId, { partnerId, side: shotSide, durationMs: type === 'two-shot' ? 1100 : 850 })
    currentAim()
  }

  const applyCurrent = () => {
    const dialogue = useGameStore.getState().activeDialogue
    if (!dialogue) {
      if (options.autoEndOnDialogueClose) void end()
      return
    }
    if (dialogue.index === lastAppliedIndex) return
    lastAppliedIndex = dialogue.index
    const line = dialogue.lines[dialogue.index]
    if (line) aimAtLine(line, dialogue.index)
  }

  const unsubscribe = useGameStore.subscribe(applyCurrent)
  const tracker = setInterval(() => currentAim?.(), TRACK_INTERVAL_MS)

  const end = async () => {
    if (ended) return
    ended = true
    clearInterval(tracker)
    unsubscribe()
    activeCinematic = null
    if (ownedByUs.length) {
      const next = new Set(useCharacterStore.getState().sceneOwned)
      for (const id of ownedByUs) next.delete(id)
      useCharacterStore.getState().setSceneOwned(next)
    }
    exitCutsceneCamera()
    useCinematicStore.setState({ active: false })
  }

  const handle: ConversationCinematicHandle = { end }
  activeCinematic = handle
  // frame the opening line (or the pair) immediately
  applyCurrent()
  if (lastAppliedIndex === -1 && options.pairA && options.pairB) {
    currentAim = () => void playShot('two-shot', options.pairA!, { partnerId: options.pairB, side, durationMs: 1100 })
    currentAim()
  }
  return handle
}
