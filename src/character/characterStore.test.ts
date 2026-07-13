import { describe, it, expect, beforeEach } from 'vitest'
import { useCharacterStore } from './characterStore'

describe('characterStore', () => {
  beforeEach(() => {
    useCharacterStore.setState({ state: { kind: 'idle' }, position: [0, 0, 0], rotationY: 0 })
  })

  it('starts idle at the spawn transform', () => {
    const s = useCharacterStore.getState()
    expect(s.state).toEqual({ kind: 'idle' })
  })

  it('clickFloor dispatches a walking state built from the current position', () => {
    useCharacterStore.getState().clickFloor([3, 0, 4])
    expect(useCharacterStore.getState().state.kind).toBe('walking')
  })

  it('clickWorkstation snaps rotationY to the target facing once seated', () => {
    const target = { point: [3, 0, 4] as [number, number, number], facing: Math.PI / 2 }
    useCharacterStore.getState().clickWorkstation(target)
    useCharacterStore.setState({ position: [3, 0, 4] })
    useCharacterStore.getState().dispatch({ type: 'WAYPOINT_REACHED' })
    expect(useCharacterStore.getState().state).toEqual({ kind: 'sittingDown', target })
    expect(useCharacterStore.getState().rotationY).toBeCloseTo(Math.PI / 2)
  })

  it('setTransform updates position and rotation directly', () => {
    useCharacterStore.getState().setTransform([1, 0, 1], 1.5)
    expect(useCharacterStore.getState().position).toEqual([1, 0, 1])
    expect(useCharacterStore.getState().rotationY).toBe(1.5)
  })
})
