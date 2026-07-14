import type { Point } from '../navigation'
import type { ActivityPlanner } from '../npcBehavior'

export const CLIP_NAMES = ['idle', 'walk', 'sit', 'type', 'drink', 'sitIdle', 'sofaSit'] as const
export type ClipName = (typeof CLIP_NAMES)[number]

export interface CharacterModelConfig {
  // URL per animation clip. 'idle' is required - it is also the base file
  // carrying the skinned mesh. Missing clips fall back at runtime to the
  // closest available pose (see resolveClip in CharacterModel).
  clips: Partial<Record<ClipName, string>> & { idle: string }
}

// Personality sheet. Today it is optional and unused by gameplay; it is the
// typed shape that each character's future YAML file (persona.yaml alongside
// its animations) will be parsed into, and what the DeepSeek-agent brain will
// receive as its character prompt.
export interface Persona {
  name: string
  age?: number
  role?: string
  traits?: string[]
  backstory?: string
}

export interface NpcSettings {
  spawn: Point
  spawnRotationY?: number
  // Decision maker for this NPC's office life. Defaults to the seeded
  // random planner; an AI brain (DeepSeek agent driven by `persona`) plugs
  // in here per character without touching any other code. May be async.
  planActivity?: ActivityPlanner
}

// One character = one definition module in this folder. Everything about a
// character - its id, animations, personality and (for NPCs) behavior - is
// edited in that single place.
export interface CharacterDefinition {
  id: string
  displayName: string
  model: CharacterModelConfig
  persona?: Persona
  // Present => the character lives autonomously in the office as an NPC.
  npc?: NpcSettings
}
