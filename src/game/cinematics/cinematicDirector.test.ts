import { describe, it, expect, beforeEach, vi } from 'vitest'
import { useGameStore } from '../gameStore'
import { useCharacterStore, PLAYER_ID } from '../../character/characterStore'
import { useCutsceneCameraStore } from '../../scene/camera/cameraController'
import { usePerformanceStore } from '../../character/performance/performanceStore'
import { WHITEBOARD_POSITION } from '../../scene/whiteboardSpot'
import { beginConversationCinematic, characterIdForSpeaker, useCinematicStore, withReadyTimeout } from './cinematicDirector'

const SONYA = 'npc-female-pm'
const KIRILL = 'npc-kirill-morozov'
const ALINA = 'npc-alina-belova'

beforeEach(() => {
  window.localStorage.clear()
  useGameStore.setState({ activeDialogue: null })
  useCutsceneCameraStore.setState({ active: false })
  useCinematicStore.setState({ active: false })
  usePerformanceStore.getState().clearAllPerformance()
  const chars = useCharacterStore.getState()
  if (!chars.characters[SONYA]) chars.spawnCharacter(SONYA, [1, 0, 1], 0)
  if (!chars.characters[KIRILL]) chars.spawnCharacter(KIRILL, [2, 0, 1], 0)
  if (!chars.characters[ALINA]) chars.spawnCharacter(ALINA, [3, 0, 1], 0)
})

describe('cinematic director runtime (18D §6/§9)', () => {
  it('resolves dialogue speakers to character ids from the real cast', () => {
    expect(characterIdForSpeaker({ speaker: 'Соня Соколова', text: 'x' })).toBe(SONYA)
    expect(characterIdForSpeaker({ speaker: 'Кирилл Морозов', text: 'x' })).toBe('npc-kirill-morozov')
    expect(characterIdForSpeaker({ speaker: 'Кто-то Неизвестный', text: 'x' })).toBeUndefined()
  })

  it('activates the cutscene camera + HUD flag and restores both on end (§6)', async () => {
    const handle = beginConversationCinematic({ pairA: PLAYER_ID, pairB: SONYA })
    expect(useCinematicStore.getState().active).toBe(true)
    expect(useCutsceneCameraStore.getState().active).toBe(true)
    await handle.end()
    expect(useCinematicStore.getState().active).toBe(false)
    expect(useCutsceneCameraStore.getState().active).toBe(false)
  })

  it('only one cinematic can run: a second begin() is a safe no-op (§9)', async () => {
    const first = beginConversationCinematic({ pairA: PLAYER_ID, pairB: SONYA })
    const second = beginConversationCinematic({})
    await second.end() // no-op: must NOT tear down the first cinematic
    expect(useCinematicStore.getState().active).toBe(true)
    await first.end()
    expect(useCinematicStore.getState().active).toBe(false)
  })

  it('refuses to start over a scripted cutscene camera (§9)', async () => {
    useCutsceneCameraStore.setState({ active: true })
    const handle = beginConversationCinematic({})
    expect(useCinematicStore.getState().active).toBe(false)
    await handle.end()
    useCutsceneCameraStore.setState({ active: false })
  })

  it('auto-ends when the dialogue closes (kickoff mode)', async () => {
    useGameStore.setState({ activeDialogue: { lines: [{ speaker: 'Соня Соколова', text: 'Планёрка.' }], index: 0 } })
    beginConversationCinematic({ autoEndOnDialogueClose: true })
    expect(useCinematicStore.getState().active).toBe(true)
    useGameStore.setState({ activeDialogue: null })
    // the subscription fires synchronously on setState; end() is async-safe
    await Promise.resolve()
    expect(useCinematicStore.getState().active).toBe(false)
  })

  it('does NOT auto-end before the dialogue has ever opened (kickoff begins pre-dialogue, §2)', async () => {
    // The kickoff begins the cinematic FIRST (gather + settle), startDialogue
    // comes seconds later - begin() itself runs applyCurrent() with no
    // dialogue open, which used to hit the auto-end branch and kill the scene
    // at birth (every kickoff played on the gameplay camera).
    const handle = beginConversationCinematic({ groupIds: [SONYA, KIRILL, ALINA], autoEndOnDialogueClose: true })
    expect(useCinematicStore.getState().active).toBe(true) // survived begin()
    // unrelated gameStore churn during the gather must not end it either
    useGameStore.setState({ activeChoice: null })
    expect(useCinematicStore.getState().active).toBe(true)
    // ...but a real open -> close still auto-ends
    useGameStore.setState({ activeDialogue: { lines: [{ speaker: 'Соня Соколова', text: 'Планёрка.' }], index: 0 } })
    useGameStore.setState({ activeDialogue: null })
    await Promise.resolve()
    expect(useCinematicStore.getState().active).toBe(false)
    await handle.end()
  })

  it('ending twice is idempotent', async () => {
    const handle = beginConversationCinematic({ pairA: PLAYER_ID, pairB: SONYA })
    await handle.end()
    await handle.end()
    expect(useCinematicStore.getState().active).toBe(false)
    // and a NEW cinematic can start again afterwards
    const next = beginConversationCinematic({})
    expect(useCinematicStore.getState().active).toBe(true)
    await next.end()
  })
})

describe('withReadyTimeout (18H §4/§5 - bounded camera-settle wait)', () => {
  it('resolves as soon as the underlying promise resolves, well under the cap', async () => {
    vi.useFakeTimers()
    try {
      let resolveInner: () => void
      const inner = new Promise<void>((resolve) => {
        resolveInner = resolve
      })
      let settled = false
      withReadyTimeout(inner).then(() => {
        settled = true
      })
      await vi.advanceTimersByTimeAsync(100)
      expect(settled).toBe(false)
      resolveInner!()
      await vi.advanceTimersByTimeAsync(0)
      expect(settled).toBe(true)
    } finally {
      vi.useRealTimers()
    }
  })

  it('resolves on its own after READY_TIMEOUT_MS even if the camera tween never settles', async () => {
    vi.useFakeTimers()
    try {
      const neverResolves = new Promise<void>(() => {})
      let settled = false
      withReadyTimeout(neverResolves).then(() => {
        settled = true
      })
      await vi.advanceTimersByTimeAsync(3000)
      expect(settled).toBe(false)
      await vi.advanceTimersByTimeAsync(1000) // past READY_TIMEOUT_MS=3500
      expect(settled).toBe(true)
    } finally {
      vi.useRealTimers()
    }
  })

  it('a late resolution after the timeout cap does not throw or double-settle', async () => {
    vi.useFakeTimers()
    try {
      let resolveInner: () => void
      const inner = new Promise<void>((resolve) => {
        resolveInner = resolve
      })
      const p = withReadyTimeout(inner)
      await vi.advanceTimersByTimeAsync(4000) // past the cap - already settled
      resolveInner!() // arrives late; must be a harmless no-op
      await expect(p).resolves.toBeUndefined()
    } finally {
      vi.useRealTimers()
    }
  })
})

describe('DialoguePerformanceCue application (18H §7)', () => {
  // beginConversationCinematic refuses a second begin() while activeCinematic
  // is still set (§9) - every test here MUST end() its own handle, or it
  // silently no-ops every later test in this block (module-level guard).
  it('group mode: sets the speaker emotion and every listener reaction from the cue', async () => {
    const handle = beginConversationCinematic({ groupIds: [SONYA, KIRILL, ALINA] })
    useGameStore.setState({
      activeDialogue: {
        lines: [
          {
            speaker: 'Соня Соколова',
            text: 'x',
            cue: { speakerEmotion: 'confident', listenerReaction: 'focused-listening' },
          },
        ],
        index: 0,
      },
    })
    const perf = usePerformanceStore.getState()
    expect(perf.emotions[SONYA]).toBe('confident')
    expect(perf.listenerReactions[KIRILL]).toBe('focused-listening')
    expect(perf.listenerReactions[ALINA]).toBe('focused-listening')
    // the speaker never reacts to their own line
    expect(perf.listenerReactions[SONYA]).toBeUndefined()
    await handle.end()
  })

  it('group mode: a listener reaction clears on the next line when no cue repeats it', async () => {
    const handle = beginConversationCinematic({ groupIds: [SONYA, KIRILL, ALINA] })
    useGameStore.setState({
      activeDialogue: {
        lines: [
          { speaker: 'Соня Соколова', text: 'x', cue: { listenerReaction: 'concerned-listening' } },
          { speaker: 'Кирилл Морозов', text: 'y' }, // no cue on this line
        ],
        index: 0,
      },
    })
    expect(usePerformanceStore.getState().listenerReactions[ALINA]).toBe('concerned-listening')
    useGameStore.setState((s) => ({ activeDialogue: s.activeDialogue && { ...s.activeDialogue, index: 1 } }))
    expect(usePerformanceStore.getState().listenerReactions[ALINA]).toBeUndefined()
    await handle.end()
  })

  it('group mode: focusTarget "whiteboard" points listener gaze at the board instead of the speaker', async () => {
    const handle = beginConversationCinematic({ groupIds: [SONYA, KIRILL, ALINA] })
    useGameStore.setState({
      activeDialogue: {
        lines: [{ speaker: 'Соня Соколова', text: 'x', cue: { focusTarget: 'whiteboard' } }],
        index: 0,
      },
    })
    const perf = usePerformanceStore.getState()
    expect(perf.gazePoints[KIRILL]).toEqual(WHITEBOARD_POSITION)
    expect(perf.gazeTargets[KIRILL]).toBeUndefined() // setGazePoint clears the character target
    await handle.end()
  })

  it('a pre-existing speaker emotion survives a line with no cue at all (regression: must not auto-clear)', async () => {
    // mirrors postAuditInteraction.ts: emotion set BEFORE the cinematic starts,
    // meant to persist through a scene whose script does not use cues yet
    usePerformanceStore.getState().setEmotion(SONYA, 'concerned')
    const handle = beginConversationCinematic({ pairA: PLAYER_ID, pairB: SONYA })
    useGameStore.setState({
      activeDialogue: { lines: [{ speaker: 'Соня Соколова', text: 'обычная реплика без cue' }], index: 0 },
    })
    expect(usePerformanceStore.getState().emotions[SONYA]).toBe('concerned')
    await handle.end()
  })

  it('pair mode: an explicit cue still sets the speaker emotion and the partner reaction', async () => {
    const handle = beginConversationCinematic({ pairA: PLAYER_ID, pairB: SONYA })
    useGameStore.setState({
      activeDialogue: {
        lines: [{ speaker: 'Соня Соколова', text: 'x', cue: { speakerEmotion: 'sad', listenerReaction: 'surprised-reaction' } }],
        index: 0,
      },
    })
    const perf = usePerformanceStore.getState()
    expect(perf.emotions[SONYA]).toBe('sad')
    expect(perf.listenerReactions[PLAYER_ID]).toBe('surprised-reaction')
    await handle.end()
  })

  it('end() clears listener reactions and cue-set emotion for every scene participant', async () => {
    const handle = beginConversationCinematic({ groupIds: [SONYA, KIRILL, ALINA] })
    useGameStore.setState({
      activeDialogue: {
        lines: [{ speaker: 'Соня Соколова', text: 'x', cue: { speakerEmotion: 'concerned', listenerReaction: 'nod' } }],
        index: 0,
      },
    })
    expect(usePerformanceStore.getState().emotions[SONYA]).toBe('concerned')
    await handle.end()
    const perf = usePerformanceStore.getState()
    expect(perf.emotions[SONYA]).toBeUndefined()
    expect(perf.listenerReactions[KIRILL]).toBeUndefined()
    expect(perf.listenerReactions[ALINA]).toBeUndefined()
  })

  it('empty options (consequence scenes): the speaker emotion still applies and end() clears it', async () => {
    // StoryConsequenceController runs beginConversationCinematic({}) - the
    // speaker resolves per line; the emotion must play AND must not leak
    // past the scene (nobody is listed in options to be cleaned up by name).
    const handle = beginConversationCinematic({})
    useGameStore.setState({
      activeDialogue: {
        lines: [{ speaker: 'Соня Соколова', text: 'x', cue: { speakerEmotion: 'sad' } }],
        index: 0,
      },
    })
    expect(usePerformanceStore.getState().emotions[SONYA]).toBe('sad')
    await handle.end()
    expect(usePerformanceStore.getState().emotions[SONYA]).toBeUndefined()
  })
})

describe('resettle (18H §2 - settle on the GATHERED group before the first line)', () => {
  it('resolves for a group cinematic with an aimed opening shot', async () => {
    const handle = beginConversationCinematic({ groupIds: [SONYA, KIRILL, ALINA] })
    await expect(handle.resettle()).resolves.toBeUndefined()
    await handle.end()
  })

  it('is a safe no-op after end()', async () => {
    const handle = beginConversationCinematic({ groupIds: [SONYA, KIRILL, ALINA] })
    await handle.end()
    await expect(handle.resettle()).resolves.toBeUndefined()
  })

  it('the §9 no-op guard handle also carries a resolving resettle', async () => {
    const first = beginConversationCinematic({ pairA: PLAYER_ID, pairB: SONYA })
    const second = beginConversationCinematic({})
    await expect(second.resettle()).resolves.toBeUndefined()
    await first.end()
  })
})

describe('dialogue panel safe area (18H §8)', () => {
  it('group mode: panelSide starts as a valid value once the opening shot is aimed', () => {
    const handle = beginConversationCinematic({ groupIds: [SONYA, KIRILL, ALINA] })
    expect(['center', 'left', 'right']).toContain(useCinematicStore.getState().panelSide)
    void handle.end()
  })

  it('pair mode: panelSide starts as a valid value once the opening two-shot is aimed', () => {
    const handle = beginConversationCinematic({ pairA: PLAYER_ID, pairB: SONYA })
    expect(['center', 'left', 'right']).toContain(useCinematicStore.getState().panelSide)
    void handle.end()
  })

  it('recomputes per line as the speaker changes in a group scene', () => {
    const handle = beginConversationCinematic({ groupIds: [SONYA, KIRILL, ALINA] })
    useGameStore.setState({
      activeDialogue: {
        lines: [
          { speaker: 'Соня Соколова', text: 'x' },
          { speaker: 'Кирилл Морозов', text: 'y' },
        ],
        index: 0,
      },
    })
    const firstSide = useCinematicStore.getState().panelSide
    expect(['center', 'left', 'right']).toContain(firstSide)
    useGameStore.setState((s) => ({ activeDialogue: s.activeDialogue && { ...s.activeDialogue, index: 1 } }))
    expect(['center', 'left', 'right']).toContain(useCinematicStore.getState().panelSide)
    void handle.end()
  })

  it('end() resets panelSide back to center for the next scene', async () => {
    const handle = beginConversationCinematic({ groupIds: [SONYA, KIRILL, ALINA] })
    await handle.end()
    expect(useCinematicStore.getState().panelSide).toBe('center')
  })

  it('does not throw when the speaker has no live subject (off-cast speaker fallback)', () => {
    const handle = beginConversationCinematic({ groupIds: [SONYA, KIRILL, ALINA] })
    expect(() =>
      useGameStore.setState({
        activeDialogue: { lines: [{ speaker: 'Кто-то Неизвестный', text: 'x' }], index: 0 },
      }),
    ).not.toThrow()
    void handle.end()
  })
})
