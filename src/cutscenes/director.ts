import { useCharacterStore } from '../character/characterStore'
import { nearestWalkable } from '../character/grid'
import { useGameStore } from '../game/gameStore'
import { flyTo } from '../scene/camera/cameraController'
import { useCutsceneStore } from './cutsceneStore'
import type { CutsceneDirector, Point } from './types'

function waitForIdle(characterId: string): Promise<void> {
  return new Promise((resolve) => {
    const isDone = () => useCharacterStore.getState().characters[characterId]?.state.kind !== 'walking'
    if (isDone()) {
      resolve()
      return
    }
    const unsubscribe = useCharacterStore.subscribe(() => {
      if (!isDone()) return
      unsubscribe()
      resolve()
    })
  })
}

function waitForDialogueClosed(): Promise<void> {
  return new Promise((resolve) => {
    const isDone = () => useGameStore.getState().activeDialogue === null
    if (isDone()) {
      resolve()
      return
    }
    const unsubscribe = useGameStore.subscribe(() => {
      if (!isDone()) return
      unsubscribe()
      resolve()
    })
  })
}

function facingTowards(from: Point, to: Point): number {
  return Math.atan2(to[0] - from[0], to[2] - from[2])
}

export function createDirector(): CutsceneDirector {
  return {
    walk(characterId, point) {
      const entity = useCharacterStore.getState().characters[characterId]
      if (!entity) return Promise.resolve()
      useCharacterStore.getState().dispatchTo(characterId, { type: 'CLICK_FLOOR', point: nearestWalkable(point) })
      return waitForIdle(characterId)
    },
    face(characterId, towardId) {
      const store = useCharacterStore.getState()
      const self = store.characters[characterId]
      const other = store.characters[towardId]
      if (!self || !other) return
      store.setTransform(characterId, self.position, facingTowards(self.position, other.position))
    },
    camera(target, opts) {
      return flyTo(target, opts?.position, opts?.durationMs)
    },
    say(lines) {
      useGameStore.getState().startDialogue(lines)
      return waitForDialogueClosed()
    },
    choice(options) {
      return new Promise((resolve) => {
        useGameStore.getState().presentChoice(options, resolve)
      })
    },
    wait(ms) {
      return new Promise((resolve) => setTimeout(resolve, ms))
    },
    talk(characterId, on) {
      useCharacterStore.getState().dispatchTo(characterId, { type: on ? 'TALK_START' : 'TALK_END' })
    },
    spawnActor(id, at, rotationY = 0, color = '#3a4a5c') {
      useCharacterStore.getState().spawnCharacter(id, at, rotationY)
      useCutsceneStore.getState().upsertActor(id, color)
    },
    despawnActor(id) {
      useCharacterStore.getState().removeCharacter(id)
      useCutsceneStore.getState().removeActor(id)
    },
    addTask(task) {
      useGameStore.getState().addTask(task)
    },
  }
}
