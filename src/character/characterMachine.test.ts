import { describe, it, expect } from 'vitest'
import { nextState, type CharacterState } from './characterMachine'

const IDLE: CharacterState = { kind: 'idle' }

describe('characterMachine', () => {
  it('CLICK_FLOOR starts walking with a path to the point', () => {
    // Clear of both the open-space sofa/coffee-table obstacle and any room
    // boundary, so this stays a plain state-transition test.
    const state = nextState(IDLE, { type: 'CLICK_FLOOR', point: [4, 0, -6] }, [3, 0, -6])
    expect(state).toEqual({ kind: 'walking', path: [[4, 0, -6]], nextIndex: 0, onArrive: { kind: 'idle' } })
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
      path: [
        [-6, 0, -5.333],
        [1, 0, 1],
      ],
      nextIndex: 0,
      onArrive: { kind: 'idle' },
    }
    const state = nextState(walking, { type: 'WAYPOINT_REACHED' }, [-6, 0, -5.333])
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

  it('WAYPOINT_REACHED on the final waypoint keeps the perform TARGET (settled facing)', () => {
    // Regression: arrive('perform') used to drop the target, so dispatchTo
    // had no facing to apply and the character kept its last WALK heading -
    // ping-pong players faced the sideline, the pull-up mount jumped sideways.
    const target = { point: [1, 0, 1] as [number, number, number], facing: Math.PI / 2 }
    const walking: CharacterState = {
      kind: 'walking',
      path: [[1, 0, 1]],
      nextIndex: 0,
      onArrive: { kind: 'perform', target, clip: 'pingPongRally' },
    }
    const state = nextState(walking, { type: 'WAYPOINT_REACHED' }, [1, 0, 1])
    expect(state).toEqual({ kind: 'performing', clip: 'pingPongRally', target })
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

  it('CLICK_SEAT walks then settles into sittingIdle on arrival', () => {
    const target = { point: [4, 0, -6] as [number, number, number], facing: Math.PI }
    const walking = nextState(IDLE, { type: 'CLICK_SEAT', target }, [3, 0, -6])
    expect(walking.kind).toBe('walking')
    if (walking.kind === 'walking') {
      expect(walking.onArrive).toEqual({ kind: 'sitIdle', target })
      const seated = nextState({ ...walking, nextIndex: walking.path.length - 1 }, { type: 'WAYPOINT_REACHED' }, target.point)
      expect(seated).toEqual({ kind: 'sittingIdle', target })
    }
  })

  it('CLICK_SOFA walks then settles into sofaSitting on arrival', () => {
    const target = { point: [4, 0, -6] as [number, number, number], facing: 0 }
    const walking = nextState(IDLE, { type: 'CLICK_SOFA', target }, [3, 0, -6])
    expect(walking.kind).toBe('walking')
    if (walking.kind === 'walking') {
      expect(walking.onArrive).toEqual({ kind: 'sofaSit', target })
      const seated = nextState({ ...walking, nextIndex: walking.path.length - 1 }, { type: 'WAYPOINT_REACHED' }, target.point)
      expect(seated).toEqual({ kind: 'sofaSitting', target })
    }
  })

  it('TALK_START enters talking from any state; TALK_END returns to idle', () => {
    const talking = nextState(IDLE, { type: 'TALK_START' }, [0, 0, 0])
    expect(talking).toEqual({ kind: 'talking' })
    expect(nextState(talking, { type: 'TALK_END' }, [0, 0, 0])).toEqual({ kind: 'idle' })
    // TALK_END does not disturb other states
    expect(nextState(IDLE, { type: 'TALK_END' }, [0, 0, 0])).toEqual(IDLE)
  })

  it('PERFORM_START plays a named gesture; PERFORM_END returns to idle (18C)', () => {
    const performing = nextState(IDLE, { type: 'PERFORM_START', clip: 'celebrate' }, [0, 0, 0])
    expect(performing).toEqual({ kind: 'performing', clip: 'celebrate' })
    expect(nextState(performing, { type: 'PERFORM_END' }, [0, 0, 0])).toEqual({ kind: 'idle' })
    // PERFORM_END does not disturb other states
    expect(nextState(IDLE, { type: 'PERFORM_END' }, [0, 0, 0])).toEqual(IDLE)
    // a listener switching to speaker: performing -> talking works directly
    expect(nextState(performing, { type: 'TALK_START' }, [0, 0, 0])).toEqual({ kind: 'talking' })
  })

  it('a new click while working interrupts and starts walking to the new target', () => {
    const oldTarget = { point: [1, 0, 1] as [number, number, number], facing: 0 }
    const working: CharacterState = { kind: 'working', target: oldTarget }
    const state = nextState(working, { type: 'CLICK_FLOOR', point: [5, 0, 5] }, [1, 0, 1])
    expect(state.kind).toBe('walking')
  })

  it('CLICK_PERFORM_ACTIVITY walks then plays the named clip on arrival (18H Wave 3)', () => {
    const target = { point: [4, 0, -6] as [number, number, number], facing: Math.PI }
    const walking = nextState(IDLE, { type: 'CLICK_PERFORM_ACTIVITY', target, clip: 'pullUp' }, [3, 0, -6])
    expect(walking.kind).toBe('walking')
    if (walking.kind === 'walking') {
      expect(walking.onArrive).toEqual({ kind: 'perform', target, clip: 'pullUp' })
      const arrived = nextState({ ...walking, nextIndex: walking.path.length - 1 }, { type: 'WAYPOINT_REACHED' }, target.point)
      expect(arrived).toEqual({ kind: 'performing', clip: 'pullUp', target })
    }
  })
})
