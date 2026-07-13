import { describe, it, expect } from 'vitest'
import { nextState, type CharacterState } from './characterMachine'
import { DOORWAYS } from './navigation'

const IDLE: CharacterState = { kind: 'idle' }

describe('characterMachine', () => {
  it('CLICK_FLOOR starts walking with a path to the point', () => {
    const state = nextState(IDLE, { type: 'CLICK_FLOOR', point: [1, 0, 1] }, [0, 0, 0])
    expect(state).toEqual({ kind: 'walking', path: [[1, 0, 1]], nextIndex: 0, onArrive: { kind: 'idle' } })
  })

  it('CLICK_WORKSTATION starts walking with a sit arrival goal', () => {
    const target = { point: [1, 0, 1] as [number, number, number], facing: 0 }
    const state = nextState(IDLE, { type: 'CLICK_WORKSTATION', target }, [0, 0, 0])
    expect(state.kind).toBe('walking')
    if (state.kind === 'walking') expect(state.onArrive).toEqual({ kind: 'sit', target })
  })

  it('WAYPOINT_REACHED advances to the next waypoint', () => {
    const walking: CharacterState = {
      kind: 'walking',
      path: [DOORWAYS.meetingRoom, [1, 0, 1]],
      nextIndex: 0,
      onArrive: { kind: 'idle' },
    }
    const state = nextState(walking, { type: 'WAYPOINT_REACHED' }, DOORWAYS.meetingRoom)
    expect(state).toEqual({ ...walking, nextIndex: 1 })
  })

  it('WAYPOINT_REACHED on the final waypoint resolves the arrival goal (idle)', () => {
    const walking: CharacterState = { kind: 'walking', path: [[1, 0, 1]], nextIndex: 0, onArrive: { kind: 'idle' } }
    const state = nextState(walking, { type: 'WAYPOINT_REACHED' }, [1, 0, 1])
    expect(state).toEqual({ kind: 'idle' })
  })

  it('WAYPOINT_REACHED on the final waypoint resolves a sit arrival goal', () => {
    const target = { point: [1, 0, 1] as [number, number, number], facing: Math.PI }
    const walking: CharacterState = { kind: 'walking', path: [[1, 0, 1]], nextIndex: 0, onArrive: { kind: 'sit', target } }
    const state = nextState(walking, { type: 'WAYPOINT_REACHED' }, [1, 0, 1])
    expect(state).toEqual({ kind: 'sittingDown', target })
  })

  it('SETTLE_ELAPSED moves sittingDown to working', () => {
    const target = { point: [1, 0, 1] as [number, number, number], facing: 0 }
    const state = nextState({ kind: 'sittingDown', target }, { type: 'SETTLE_ELAPSED' }, [1, 0, 1])
    expect(state).toEqual({ kind: 'working', target })
  })

  it('BREW_ELAPSED moves brewingCoffee to drinkingCoffee', () => {
    const target = { point: [1, 0, 1] as [number, number, number], facing: 0 }
    const state = nextState({ kind: 'brewingCoffee', target }, { type: 'BREW_ELAPSED' }, [1, 0, 1])
    expect(state).toEqual({ kind: 'drinkingCoffee', target })
  })

  it('a new click while working interrupts and starts walking to the new target', () => {
    const oldTarget = { point: [1, 0, 1] as [number, number, number], facing: 0 }
    const working: CharacterState = { kind: 'working', target: oldTarget }
    const state = nextState(working, { type: 'CLICK_FLOOR', point: [5, 0, 5] }, [1, 0, 1])
    expect(state.kind).toBe('walking')
  })
})
