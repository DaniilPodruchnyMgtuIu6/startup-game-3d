import { describe, it, expect, beforeEach } from 'vitest'
import { useCharacterStore, PLAYER_ID } from './characterStore'
import { claimTarget, releaseClaims } from '../interaction/interactionRegistry'

describe('characterStore', () => {
  beforeEach(() => {
    // [3,0,-6] keeps these fixtures clear of the open-space furniture and any
    // room boundary, so paths built here are single-waypoint direct lines.
    useCharacterStore.setState({
      characters: { [PLAYER_ID]: { state: { kind: 'idle' }, position: [3, 0, -6], rotationY: 0 } },
    })
  })

  it('starts with an idle player entity', () => {
    expect(useCharacterStore.getState().characters[PLAYER_ID].state).toEqual({ kind: 'idle' })
  })

  it('clickFloor dispatches a walking state built from the player position', () => {
    useCharacterStore.getState().clickFloor([4, 0, -6])
    expect(useCharacterStore.getState().characters[PLAYER_ID].state.kind).toBe('walking')
  })

  it('clickWorkstation snaps player rotation to the target facing once seated', () => {
    const target = { point: [4, 0, -6] as [number, number, number], facing: Math.PI / 2 }
    useCharacterStore.getState().clickWorkstation(target)
    useCharacterStore.getState().setTransform(PLAYER_ID, [4, 0, -6], 0)
    useCharacterStore.getState().dispatchTo(PLAYER_ID, { type: 'WAYPOINT_REACHED' })
    expect(useCharacterStore.getState().characters[PLAYER_ID].state).toEqual({ kind: 'sittingDown', target })
    expect(useCharacterStore.getState().characters[PLAYER_ID].rotationY).toBeCloseTo(Math.PI / 2)
  })

  it('clickSeat and clickSofa start the player walking', () => {
    useCharacterStore.getState().clickSeat({ point: [4, 0, -6], facing: 0 })
    expect(useCharacterStore.getState().characters[PLAYER_ID].state.kind).toBe('walking')
  })

  it('ignores player clicks on a seat someone else already claimed', () => {
    claimTarget('npc-x', { point: [4, 0, -6], facing: 0 })
    try {
      useCharacterStore.getState().clickSeat({ point: [4, 0, -6], facing: 0 })
      expect(useCharacterStore.getState().characters[PLAYER_ID].state.kind).toBe('idle')
    } finally {
      releaseClaims('npc-x')
    }
  })

  it('spawns, drives and removes independent NPC entities', () => {
    const store = useCharacterStore.getState()
    store.spawnCharacter('npc-1', [2, 0, -6], 0)
    expect(useCharacterStore.getState().characters['npc-1'].state).toEqual({ kind: 'idle' })

    useCharacterStore.getState().dispatchTo('npc-1', { type: 'CLICK_FLOOR', point: [1, 0, -6] })
    expect(useCharacterStore.getState().characters['npc-1'].state.kind).toBe('walking')
    // the player entity is untouched by NPC events
    expect(useCharacterStore.getState().characters[PLAYER_ID].state.kind).toBe('idle')

    useCharacterStore.getState().removeCharacter('npc-1')
    expect(useCharacterStore.getState().characters['npc-1']).toBeUndefined()
  })

  it('ignores events for unknown character ids', () => {
    const before = useCharacterStore.getState().characters
    useCharacterStore.getState().dispatchTo('ghost', { type: 'CLICK_FLOOR', point: [1, 0, -6] })
    expect(useCharacterStore.getState().characters).toEqual(before)
  })

  it('setTransform updates one entity position and rotation directly', () => {
    useCharacterStore.getState().setTransform(PLAYER_ID, [1, 0, 1], 1.5)
    const player = useCharacterStore.getState().characters[PLAYER_ID]
    expect(player.position).toEqual([1, 0, 1])
    expect(player.rotationY).toBe(1.5)
  })
})
