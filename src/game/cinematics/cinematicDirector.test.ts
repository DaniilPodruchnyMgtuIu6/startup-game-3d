import { describe, it, expect, beforeEach } from 'vitest'
import { useGameStore } from '../gameStore'
import { useCharacterStore, PLAYER_ID } from '../../character/characterStore'
import { useCutsceneCameraStore } from '../../scene/camera/cameraController'
import { beginConversationCinematic, characterIdForSpeaker, useCinematicStore } from './cinematicDirector'

const SONYA = 'npc-female-pm'

beforeEach(() => {
  window.localStorage.clear()
  useGameStore.setState({ activeDialogue: null })
  useCutsceneCameraStore.setState({ active: false })
  useCinematicStore.setState({ active: false })
  const chars = useCharacterStore.getState()
  if (!chars.characters[SONYA]) chars.spawnCharacter(SONYA, [1, 0, 1], 0)
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
