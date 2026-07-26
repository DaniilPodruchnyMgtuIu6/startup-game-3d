import { describe, it, expect, beforeEach } from 'vitest'
import { recoverSceneCharacters } from './sceneRecovery'
import { useCutsceneStore } from './cutsceneStore'
import { useCharacterStore, PLAYER_ID } from '../character/characterStore'
import { usePerformanceStore } from '../character/performance/performanceStore'

// Regression (Feature 15 deep pass): a cutscene that THROWS mid-run used to
// leave (a) invisible ghost character entries for its ephemeral actors and
// (b) owned NPCs stuck in 'talking' forever (the brain only schedules from
// settled states). recoverSceneCharacters runs in the runner's finally.

const SONYA = 'npc-female-pm'

beforeEach(() => {
  window.localStorage.clear()
  const store = useCharacterStore.getState()
  // reset character map to just the player
  for (const id of Object.keys(store.characters)) if (id !== PLAYER_ID) store.removeCharacter(id)
  useCharacterStore.getState().setSceneOwned(new Set())
  useCutsceneStore.setState({ activeSceneId: null, actors: {} })
})

describe('recoverSceneCharacters', () => {
  it('removes ghost character entries of ephemeral actors a failed scene left behind', () => {
    // the scene spawned an intruder (character entry + visual actor) and threw
    // before its own despawnActor call
    useCharacterStore.getState().spawnCharacter('intruder', [0, 0, 0], 0)
    useCutsceneStore.getState().upsertActor('intruder', '#888888')
    expect(useCharacterStore.getState().characters['intruder']).toBeDefined()

    recoverSceneCharacters([])

    expect(useCharacterStore.getState().characters['intruder']).toBeUndefined()
  })

  it('closes a TALK_START a failed scene left open so the planner can resume the NPC', () => {
    useCharacterStore.getState().spawnCharacter(SONYA, [1, 0, 1], 0)
    useCharacterStore.getState().dispatchTo(SONYA, { type: 'TALK_START' })
    expect(useCharacterStore.getState().characters[SONYA].state.kind).toBe('talking')

    recoverSceneCharacters([SONYA])

    expect(useCharacterStore.getState().characters[SONYA].state.kind).toBe('idle')
  })

  it('leaves settled characters untouched and is idempotent', () => {
    useCharacterStore.getState().spawnCharacter(SONYA, [1, 0, 1], 0)
    recoverSceneCharacters([SONYA])
    recoverSceneCharacters([SONYA])
    expect(useCharacterStore.getState().characters[SONYA].state.kind).toBe('idle')
    expect(useCharacterStore.getState().characters[PLAYER_ID]).toBeDefined()
  })

  it('wipes every emotion override and gaze pair a failed scene left behind (18C §7)', () => {
    usePerformanceStore.getState().setEmotion(SONYA, 'concerned')
    usePerformanceStore.getState().setGazePair(PLAYER_ID, SONYA)

    recoverSceneCharacters([SONYA])

    expect(usePerformanceStore.getState().emotions).toEqual({})
    expect(usePerformanceStore.getState().gazeTargets).toEqual({})
  })
})
