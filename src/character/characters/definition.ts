import type { Point } from '../navigation'
import type { ActivityPlanner } from '../npcBehavior'

export const CLIP_NAMES = [
  'idle',
  'walk',
  'sit',
  'type',
  'drink',
  'sitIdle',
  'sofaSit',
  'talk',
  'look',
  // 18C/18D: Higgsfield/Meshy actions retargeted onto the project rigs
  // (tools/art/retargetMeshyClip.mjs) - dialogue and story gestures.
  'agree',
  'celebrate',
  'explain',
  'angryTalk',
  'facepalm',
] as const
export type ClipName = (typeof CLIP_NAMES)[number]

// Gesture clips a scene may play through the 'performing' state.
export type PerformClip = 'agree' | 'celebrate' | 'explain' | 'angryTalk' | 'facepalm'

export interface CharacterModelConfig {
  // URL per animation clip. 'idle' is required - it is also the base file
  // carrying the skinned mesh. Missing clips fall back at runtime to the
  // closest available pose (see resolveClip in CharacterModel).
  clips: Partial<Record<ClipName, string>> & { idle: string }
  // Natural pace of the walk clip in m/s, measured as the median horizontal
  // speed of the planted (stance) foot bone - for an in-place clip that speed
  // IS the pace the body must travel at. The walk action plays at
  // WALK_SPEED / walkPace so feet stay pinned instead of skating.
  walkPace: number
  // How far the walk clip's stance foot dips below the idle clip's ground
  // level (idle min foot Y - walk min foot Y, when positive). The model is
  // raised by this while walking so soles don't sink through the floor.
  walkLift?: number
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
  // Drawn portrait shown next to this character's dialogue lines.
  portrait?: string
  // Optional worried/concerned variant of the portrait for tense scenes
  // (incidents, audits, intrusions). Falls back to `portrait` when absent.
  portraitWorried?: string
  persona?: Persona
  // Present => the character lives autonomously in the office as an NPC.
  npc?: NpcSettings
}
