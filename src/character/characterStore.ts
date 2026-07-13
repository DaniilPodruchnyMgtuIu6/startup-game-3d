import { create } from 'zustand'
import { nextState, type CharacterState, type CharacterEvent, type Target } from './characterMachine'
import type { Point } from './navigation'

const SPAWN_POSITION: Point = [2, 0, 6]
const SPAWN_ROTATION_Y = Math.PI

interface CharacterStore {
  state: CharacterState
  position: Point
  rotationY: number
  dispatch: (event: CharacterEvent) => void
  setTransform: (position: Point, rotationY: number) => void
  clickFloor: (point: Point) => void
  clickWorkstation: (target: Target) => void
  clickCoffeeMachine: (target: Target) => void
}

export const useCharacterStore = create<CharacterStore>()((set, get) => ({
  state: { kind: 'idle' },
  position: SPAWN_POSITION,
  rotationY: SPAWN_ROTATION_Y,
  dispatch: (event) =>
    set((s) => {
      const state = nextState(s.state, event, s.position)
      const rotationY = 'target' in state ? state.target.facing : s.rotationY
      return { state, rotationY }
    }),
  setTransform: (position, rotationY) => set({ position, rotationY }),
  clickFloor: (point) => get().dispatch({ type: 'CLICK_FLOOR', point }),
  clickWorkstation: (target) => get().dispatch({ type: 'CLICK_WORKSTATION', target }),
  clickCoffeeMachine: (target) => get().dispatch({ type: 'CLICK_COFFEE_MACHINE', target }),
}))
