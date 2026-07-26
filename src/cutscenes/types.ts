import type { DialogueLine, ChoiceOption } from '../game/gameStore'
import type { BoardTask } from '../game/tasks'
import type { CharacterDefinition } from '../character/characters/definition'
import type { CharacterEmotion } from '../character/performance/characterEmotion'
import type { PerformClip } from '../character/characters/definition'

export type Point = [number, number, number]

export interface CutsceneDirector {
  walk(characterId: string, point: Point, maxMs?: number): Promise<void>
  setSpeed(characterId: string, multiplier: number): void
  face(characterId: string, towardId: string): void
  camera(target: Point, opts?: { position?: Point; durationMs?: number }): Promise<void>
  say(lines: DialogueLine[]): Promise<void>
  choice(options: ChoiceOption[]): Promise<string>
  wait(ms: number): Promise<void>
  talk(characterId: string, on: boolean): void
  spawnActor(id: string, at: Point, rotationY?: number, color?: string): void
  spawnModeledActor(id: string, at: Point, definition: CharacterDefinition, rotationY?: number): void
  look(characterId: string, on: boolean): void
  // 18C §5: set (or clear with null) a character's emotion bone pose for the
  // scene. Scene recovery clears every emotion after the scene regardless.
  emotion(characterId: string, emotion: CharacterEmotion | null): void
  // 18C §2: play (or stop with null) a named gesture clip - the retargeted
  // Higgsfield actions (agree / celebrate / explain).
  perform(characterId: string, clip: PerformClip | null): void
  sit(characterId: string, target: { point: Point; facing: number }, kind: 'workstation' | 'seat'): Promise<void>
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
