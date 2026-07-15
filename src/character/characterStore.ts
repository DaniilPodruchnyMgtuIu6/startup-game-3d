import { create } from 'zustand'
import { nextState, type CharacterState, type CharacterEvent, type Target } from './characterMachine'
import { nearestWalkable } from './grid'
import { claimTarget, releaseClaims, isTargetFree } from '../interaction/interactionRegistry'
import type { Point } from './navigation'
import type { ServerRole } from '../game/serverIncidentsStore'

export const PLAYER_ID = 'player'

const SPAWN_POSITION: Point = [2, 0, 6]
const SPAWN_ROTATION_Y = Math.PI

export interface CharacterEntity {
  state: CharacterState
  position: Point
  rotationY: number
}

interface CharactersStore {
  // Every walking body in the office - the player and all NPCs - lives here
  // under its own id and shares the same state machine and pathfinding.
  characters: Record<string, CharacterEntity>
  // Blocks player-originated clicks while a cutscene is directing the scene.
  inputLocked: boolean
  setInputLocked: (locked: boolean) => void
  // NPC ids a running cutscene has taken direct control of - their own
  // autonomous brain must not schedule new activities while owned.
  sceneOwned: Set<string>
  setSceneOwned: (ids: Set<string>) => void
  // Desks whose monitor must read as "on" regardless of whether anyone is
  // actually seated there right now - a scripted scene's way of saying "left
  // unlocked," which is a fact about the screen, not a fact derivable from
  // who's currently sitting at it.
  unlockedScreens: Point[]
  markScreenUnlocked: (point: Point) => void
  clearUnlockedScreens: () => void
  spawnCharacter: (id: string, position: Point, rotationY?: number) => void
  removeCharacter: (id: string) => void
  dispatchTo: (id: string, event: CharacterEvent) => void
  setTransform: (id: string, position: Point, rotationY: number) => void
  // Convenience actions for the player character, wired to scene clicks.
  clickFloor: (point: Point) => void
  clickWorkstation: (target: Target) => void
  clickCoffeeMachine: (target: Target) => void
  clickSeat: (target: Target) => void
  clickSofa: (target: Target) => void
  clickServer: (target: Target, role: ServerRole) => void
}

export const useCharacterStore = create<CharactersStore>()((set, get) => {
  const playerClick = (type: 'CLICK_WORKSTATION' | 'CLICK_COFFEE_MACHINE' | 'CLICK_SEAT' | 'CLICK_SOFA') => {
    return (target: Target) => {
      if (get().inputLocked) return
      // one seat, one character - clicks on a spot someone else already took
      // are ignored instead of stacking two characters on it
      if (!isTargetFree(target, PLAYER_ID)) return
      claimTarget(PLAYER_ID, target)
      get().dispatchTo(PLAYER_ID, { type, target })
    }
  }

  return {
    characters: {
      [PLAYER_ID]: { state: { kind: 'idle' }, position: SPAWN_POSITION, rotationY: SPAWN_ROTATION_Y },
    },
    inputLocked: false,
    setInputLocked: (locked) => set({ inputLocked: locked }),
    sceneOwned: new Set(),
    setSceneOwned: (ids) => set({ sceneOwned: ids }),
    unlockedScreens: [],
    markScreenUnlocked: (point) => set((s) => ({ unlockedScreens: [...s.unlockedScreens, point] })),
    clearUnlockedScreens: () => set({ unlockedScreens: [] }),
    spawnCharacter: (id, position, rotationY = 0) =>
      set((s) => ({
        characters: { ...s.characters, [id]: { state: { kind: 'idle' }, position, rotationY } },
      })),
    removeCharacter: (id) =>
      set((s) => {
        const characters = { ...s.characters }
        delete characters[id]
        return { characters }
      }),
    dispatchTo: (id, event) =>
      set((s) => {
        const entity = s.characters[id]
        if (!entity) return s
        const state = nextState(entity.state, event, entity.position, entity.rotationY)
        const rotationY = 'target' in state ? state.target.facing : entity.rotationY
        return { characters: { ...s.characters, [id]: { ...entity, state, rotationY } } }
      }),
    setTransform: (id, position, rotationY) =>
      set((s) => {
        const entity = s.characters[id]
        if (!entity) return s
        return { characters: { ...s.characters, [id]: { ...entity, position, rotationY } } }
      }),
    // Floor clicks may land on walls or furniture (the click ray projects onto
    // the floor beneath them) - clamp to the nearest walkable spot so the
    // character walks up beside the obstacle instead of into it. Walking away
    // also frees whatever spot the player had claimed.
    clickFloor: (point) => {
      if (get().inputLocked) return
      releaseClaims(PLAYER_ID)
      get().dispatchTo(PLAYER_ID, { type: 'CLICK_FLOOR', point: nearestWalkable(point) })
    },
    clickWorkstation: playerClick('CLICK_WORKSTATION'),
    clickCoffeeMachine: playerClick('CLICK_COFFEE_MACHINE'),
    clickSeat: playerClick('CLICK_SEAT'),
    clickSofa: playerClick('CLICK_SOFA'),
    // Like playerClick but carries the rack's role through to the machine so
    // arrival can open the correct mini-game.
    clickServer: (target, role) => {
      if (get().inputLocked) return
      if (!isTargetFree(target, PLAYER_ID)) return
      claimTarget(PLAYER_ID, target)
      get().dispatchTo(PLAYER_ID, { type: 'CLICK_SERVER', target: { point: target.point, facing: target.facing }, role })
    },
  }
})
