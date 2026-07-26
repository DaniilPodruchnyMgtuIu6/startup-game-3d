import { useCharacterStore } from '../character/characterStore'
import { usePerformanceStore } from '../character/performance/performanceStore'
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

function waitForSeated(characterId: string): Promise<void> {
  return new Promise((resolve) => {
    const isDone = () => {
      const kind = useCharacterStore.getState().characters[characterId]?.state.kind
      return kind === undefined || kind === 'working' || kind === 'sittingIdle'
    }
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

function facingTowards(from: Point, to: Point): number {
  return Math.atan2(to[0] - from[0], to[2] - from[2])
}

// Feature 16 §8: if a cutscene actor never stops walking (bad path, obstacle
// churn), don't hang the whole scene — after maxMs snap it to its destination
// mark so the scene proceeds. The mark is where it was already headed, so this
// is not a jarring teleport in front of the camera, and it never duplicates the
// actor.
const WALK_TIMEOUT_MS = 9000

export function createDirector(): CutsceneDirector {
  return {
    walk(characterId, point, maxMs = WALK_TIMEOUT_MS) {
      const entity = useCharacterStore.getState().characters[characterId]
      if (!entity) return Promise.resolve()
      const dest = nearestWalkable(point)
      useCharacterStore.getState().dispatchTo(characterId, { type: 'CLICK_FLOOR', point: dest })
      return Promise.race([
        waitForIdle(characterId),
        new Promise<void>((resolve) =>
          setTimeout(() => {
            const stuck = useCharacterStore.getState().characters[characterId]
            if (stuck && stuck.state.kind === 'walking') {
              // land it on the mark; stepTowards then reports the target reached
              // next frame and the state machine settles it to idle
              useCharacterStore.getState().setTransform(characterId, dest, stuck.rotationY)
            }
            resolve()
          }, maxMs),
        ),
      ])
    },
    setSpeed(characterId, multiplier) {
      useCharacterStore.getState().setSpeedMultiplier(characterId, multiplier)
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
    spawnModeledActor(id, at, definition, rotationY = 0) {
      useCharacterStore.getState().spawnCharacter(id, at, rotationY)
      useCutsceneStore.getState().upsertModeledActor(id, definition)
    },
    look(characterId, on) {
      useCharacterStore.getState().dispatchTo(characterId, { type: on ? 'LOOK_START' : 'LOOK_END' })
    },
    emotion(characterId, emotion) {
      const performance = usePerformanceStore.getState()
      if (emotion) performance.setEmotion(characterId, emotion)
      else performance.clearEmotion(characterId)
    },
    perform(characterId, clip) {
      useCharacterStore
        .getState()
        .dispatchTo(characterId, clip ? { type: 'PERFORM_START', clip } : { type: 'PERFORM_END' })
    },
    sit(characterId, target, kind) {
      const eventType = kind === 'workstation' ? ('CLICK_WORKSTATION' as const) : ('CLICK_SEAT' as const)
      useCharacterStore.getState().dispatchTo(characterId, { type: eventType, target })
      return waitForSeated(characterId)
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
