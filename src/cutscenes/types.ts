import type { DialogueLine, ChoiceOption } from '../game/gameStore'
import type { BoardTask } from '../game/tasks'

export type Point = [number, number, number]

export interface CutsceneDirector {
  walk(characterId: string, point: Point): Promise<void>
  face(characterId: string, towardId: string): void
  camera(target: Point, opts?: { position?: Point; durationMs?: number }): Promise<void>
  say(lines: DialogueLine[]): Promise<void>
  choice(options: ChoiceOption[]): Promise<string>
  wait(ms: number): Promise<void>
  talk(characterId: string, on: boolean): void
  spawnActor(id: string, at: Point, rotationY?: number, color?: string): void
  despawnActor(id: string): void
  addTask(task: BoardTask): void
}

export type CutsceneScript = (director: CutsceneDirector) => Promise<void>

export interface CutsceneEntry {
  script: CutsceneScript
  // Existing persistent NPCs this scene must pause the autonomous brain of
  // for its duration (ephemeral scene-only actors never have one to pause).
  ownsNpcIds?: string[]
}
