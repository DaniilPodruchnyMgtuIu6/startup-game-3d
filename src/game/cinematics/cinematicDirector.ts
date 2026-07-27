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
import { usePerformanceStore } from '../../character/performance/performanceStore'
import { enterCutsceneCamera, exitCutsceneCamera, flyTo, useCutsceneCameraStore } from '../../scene/camera/cameraController'
import { computeShot, eyePoint, type CinematicShotType, type ShotFrame, type SubjectPose } from './cinematicShots'
import { makeShotSafe } from './cinematicSafety'
import { WHITEBOARD_POSITION } from '../../scene/whiteboardSpot'
import { pickDialoguePanelSide, projectHeadsForShot, type DialoguePanelSide } from './dialogueSafeArea'

// HUD/letterbox flag (§8): SprintHud hides and CinematicBars show while true.
// panelSide (§8): which side the dialogue panel renders on for the CURRENT
// shot - shifted away from 'center' only when a cast member's head would
// otherwise sit under it. DialoguePanel.tsx reads this directly.
export const useCinematicStore = create<{ active: boolean; panelSide: DialoguePanelSide }>()(() => ({
  active: false,
  panelSide: 'center',
}))

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
  // resolves once the OPENING shot has fully settled (§5: no line before the
  // camera arrives) - callers await this before the first startDialogue
  ready: Promise<void>
  // §2: re-aim the CURRENT shot at the participants' latest poses and resolve
  // once that move settles (bounded like `ready`). The kickoff awaits this
  // AFTER gatherParticipants: `ready` covers only the opening transition,
  // which is aimed while the cast is still walking in - by gather-end the
  // camera may be mid-blend from a tracking re-aim, and the first line must
  // wait for a settle on the GATHERED group, not the pre-gather composition.
  resettle: () => Promise<void>
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
  // 18H: a GROUP scene - all participants standing together. Enables the
  // safe-wide-group opening/fallback shot and per-line group gaze (every
  // listener looks at the current speaker).
  groupIds?: string[]
}

// The camera re-aims the CURRENT shot a few times a second with a short
// blend - subjects that finish a walk mid-line stay framed (tracking, §2)
// instead of leaving a one-shot camera looking at empty floor.
const TRACK_INTERVAL_MS = 450

// 18H §4/§5: `ready`'s underlying camera-controls tween resolves once the rig
// reports itself converged, which needs several real animation frames - under
// a throttled/low-framerate tab that can take far longer than the shot's own
// durationMs (observed ~8s for a nominal 1100ms two-shot under headless
// software rendering) even though nothing has actually failed. Bounding the
// wait is the same "reasonable timeout only as a failure guard" principle
// already used for gatherParticipants/pairActivityReservation - the scene
// proceeds once the camera is CLOSE ENOUGH rather than blocking the first
// line indefinitely on a frame-rate-dependent convergence check.
const READY_TIMEOUT_MS = 3500

// §8: aspect ratio drives how head projections map to screen fractions, so
// the safe area actually accounts for the real browser viewport rather than
// an assumed ratio. Falls back to 16:9 outside a browser (tests).
function currentAspect(): number {
  if (typeof window === 'undefined' || !window.innerHeight) return 16 / 9
  return window.innerWidth / window.innerHeight
}

// Exported for its own focused unit test (cinematicDirector.test.ts) - the
// real call sites below are hard to force into a "never resolves" state
// without a live camera-controls rig, which jsdom doesn't have.
export function withReadyTimeout(promise: Promise<void>): Promise<void> {
  return new Promise((resolve) => {
    let settled = false
    const settle = () => {
      if (settled) return
      settled = true
      resolve()
    }
    const timer = setTimeout(settle, READY_TIMEOUT_MS)
    promise.then(() => {
      clearTimeout(timer)
      settle()
    })
  })
}

let activeCinematic: ConversationCinematicHandle | null = null

export function beginConversationCinematic(options: ConversationCinematicOptions = {}): ConversationCinematicHandle {
  // §9: only one active cinematic - a second begin() is a safe no-op handle.
  if (activeCinematic || useCutsceneCameraStore.getState().active) {
    return { end: async () => {}, ready: Promise.resolve(), resettle: async () => {} }
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
  // the currently held shot, re-aimed by the tracking loop with fresh poses;
  // promise-returning so resettle() can await one full settle of the same aim
  let currentAim: (() => Promise<void>) | null = null

  const presentGroup = () => (options.groupIds ?? []).filter((id) => subjectOf(id))

  // §8: recompute which side the dialogue panel renders on for the shot
  // about to play, from the SAME frame the shot itself will use - so the
  // decision reflects where heads will actually end up once the cut lands,
  // not the mid-transition camera.
  const applySafeArea = (
    type: CinematicShotType,
    subjectId: string,
    opts: { partnerId?: string; side?: 1 | -1; durationMs?: number },
    headIds: string[],
  ) => {
    const subject = subjectOf(subjectId)
    if (!subject) return
    const partner = opts.partnerId ? subjectOf(opts.partnerId) : undefined
    const frame = makeShotSafe(computeShot(type, subject, { partner, side: opts.side, durationMs: opts.durationMs }))
    const heads = headIds
      .map((id) => subjectOf(id))
      .filter((s): s is SubjectPose => !!s)
      .map(eyePoint)
    const projected = projectHeadsForShot(frame.position, frame.target, currentAspect(), heads)
    useCinematicStore.setState({ panelSide: pickDialoguePanelSide(projected) })
  }

  // §6: the mandatory safe-wide-group shot - a two-shot spanning the first and
  // last PRESENT participants of the gathered semicircle covers everyone.
  const aimSafeWideGroup = (): Promise<void> => {
    const group = presentGroup()
    if (group.length >= 2) {
      applySafeArea('two-shot', group[0], { partnerId: group[group.length - 1], side: 1, durationMs: 1100 }, group)
      return playShot('two-shot', group[0], { partnerId: group[group.length - 1], side: 1, durationMs: 1100 })
    }
    if (group.length === 1) {
      applySafeArea('medium', group[0], { side: 1, durationMs: 1000 }, group)
      return playShot('medium', group[0], { side: 1, durationMs: 1000 })
    }
    return Promise.resolve()
  }

  // 18H §7: while a line is up, every listener in the group looks at the
  // speaker; the speaker looks at the closest listener (never the camera).
  const applyGroupGaze = (speakerId: string) => {
    const group = presentGroup()
    if (!group.length) return
    const performance = usePerformanceStore.getState()
    for (const id of group) {
      if (id !== speakerId) performance.setGaze(id, speakerId)
    }
    const listener = group.find((id) => id !== speakerId)
    if (listener) performance.setGaze(speakerId, listener)
  }

  // 18H §7: apply the line's DialoguePerformanceCue, if any - the speaker's
  // emotion, every listener's reaction, and (when focusTarget overrides the
  // default "look at the speaker") where listeners actually look. Metadata
  // on the line drives this, never a random pick.
  //
  // speakerEmotion only ever SETS, never auto-clears: emotion is a sustained
  // scene-level mood some callers set before the cinematic even starts
  // (postAuditInteraction.ts keeps Sonya 'concerned' for the whole talk) -
  // a line with no cue must not silently erase that. listenerReaction is the
  // opposite: a momentary per-line reaction with no prior persistent-state
  // convention to protect, so it resets to neutral cleanly on every line
  // that doesn't specify one (no stuck reaction from two lines ago).
  const applyCue = (line: DialogueLine, speakerId: string, listeners: string[]) => {
    const performance = usePerformanceStore.getState()
    if (line.cue?.speakerEmotion) performance.setEmotion(speakerId, line.cue.speakerEmotion)
    for (const id of listeners) {
      if (line.cue?.listenerReaction) performance.setListenerReaction(id, line.cue.listenerReaction)
      else performance.clearListenerReaction(id)
    }
    if (line.cue?.focusTarget === 'whiteboard') {
      for (const id of listeners) performance.setGazePoint(id, WHITEBOARD_POSITION)
    } else if (line.cue?.focusTarget === 'player') {
      for (const id of listeners) if (id !== PLAYER_ID) performance.setGaze(id, PLAYER_ID)
    }
    // 'speaker' is already the default via applyGroupGaze/pair gaze above;
    // 'object' has no generic world-position source on the cue and is not
    // implemented (documented limitation, see 18h-known-issues.md).
  }

  const aimAtLine = (line: DialogueLine, index: number) => {
    // off-cast speakers (guards, «Руководство») frame the player listening -
    // the camera never stares at an empty room (§5)
    const speakerId = characterIdForSpeaker(line) ?? options.pairA ?? PLAYER_ID
    if (options.groupIds) {
      if (!subjectOf(speakerId)) {
        // §6: invalid target -> hold the safe group composition, never a void
        currentAim = aimSafeWideGroup
        void currentAim()
        return
      }
      applyGroupGaze(speakerId)
      applyCue(
        line,
        speakerId,
        presentGroup().filter((id) => id !== speakerId),
      )
      side = side === 1 ? -1 : 1
      const shotSide = side
      // group grammar: open wide, single the speaker, re-establish every 4th
      const wide = index === 0 || index % 4 === 3
      if (wide) {
        currentAim = aimSafeWideGroup
      } else {
        applySafeArea('medium-close', speakerId, { side: shotSide, durationMs: 850 }, presentGroup())
        currentAim = () => playShot('medium-close', speakerId, { side: shotSide, durationMs: 850 })
      }
      void currentAim()
      return
    }
    if (!subjectOf(speakerId)) return
    side = side === 1 ? -1 : 1 // alternate coverage sides every cut
    const shotSide = side
    const partnerId =
      options.pairA && options.pairB ? (speakerId === options.pairA ? options.pairB : options.pairA) : undefined
    if (partnerId) applyCue(line, speakerId, [partnerId])
    let type: CinematicShotType
    if (partnerId) {
      // pair coverage: open on a two-shot, then OTS with medium-close emphasis
      type = index === 0 ? 'two-shot' : index % 3 === 2 ? 'medium-close' : 'over-the-shoulder'
    } else {
      type = index === 0 ? 'medium' : 'medium-close'
    }
    const shotOpts = { partnerId, side: shotSide, durationMs: type === 'two-shot' ? 1100 : 850 }
    applySafeArea(type, speakerId, shotOpts, partnerId ? [speakerId, partnerId] : [speakerId])
    currentAim = () => playShot(type, speakerId, shotOpts)
    void currentAim()
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
  const tracker = setInterval(() => void currentAim?.(), TRACK_INTERVAL_MS)

  const end = async () => {
    if (ended) return
    ended = true
    clearInterval(tracker)
    unsubscribe()
    activeCinematic = null
    if (options.groupIds?.length) usePerformanceStore.getState().clearGaze(...options.groupIds)
    // 18H §7: applyCue's emotion/listener-reaction state is this director's
    // own responsibility to clean up - unlike gaze (which pair-mode callers
    // like postAuditInteraction.ts already clear themselves), nothing else
    // touches these fields for a cue-driven scene.
    const cueParticipants = options.groupIds ?? [options.pairA, options.pairB].filter((id): id is string => !!id)
    for (const id of cueParticipants) {
      usePerformanceStore.getState().clearEmotion(id)
      usePerformanceStore.getState().clearListenerReaction(id)
    }
    if (ownedByUs.length) {
      const next = new Set(useCharacterStore.getState().sceneOwned)
      for (const id of ownedByUs) next.delete(id)
      useCharacterStore.getState().setSceneOwned(next)
    }
    exitCutsceneCamera()
    useCinematicStore.setState({ active: false, panelSide: 'center' })
  }

  // §5: the opening shot is AWAITED - `ready` resolves once the camera has
  // settled on the establishing composition (or READY_TIMEOUT_MS elapses,
  // whichever comes first - see withReadyTimeout above); callers hold the
  // first line until then.
  let ready: Promise<void>
  activeCinematic = null // set below with the full handle
  if (options.groupIds) {
    ready = withReadyTimeout(aimSafeWideGroup())
    currentAim = aimSafeWideGroup
  } else if (options.pairA && options.pairB) {
    applySafeArea('two-shot', options.pairA, { partnerId: options.pairB, side, durationMs: 1100 }, [options.pairA, options.pairB])
    ready = withReadyTimeout(playShot('two-shot', options.pairA, { partnerId: options.pairB, side, durationMs: 1100 }))
    currentAim = () => playShot('two-shot', options.pairA!, { partnerId: options.pairB, side, durationMs: 1100 })
  } else {
    ready = Promise.resolve()
  }
  // §2: one fresh, settle-awaited pass of the current shot at the cast's
  // LATEST poses - the kickoff calls this after gatherParticipants so the
  // first line opens on a camera settled over the gathered group, not one
  // still blending away from its pre-gather framing. Bounded exactly like
  // `ready`; a no-op after end() or when nothing is aimed yet.
  const resettle = (): Promise<void> => {
    if (ended || !currentAim) return Promise.resolve()
    return withReadyTimeout(currentAim())
  }
  const handle: ConversationCinematicHandle = { end, ready, resettle }
  activeCinematic = handle
  // if a dialogue is already open, frame its current line immediately
  applyCurrent()
  return handle
}
