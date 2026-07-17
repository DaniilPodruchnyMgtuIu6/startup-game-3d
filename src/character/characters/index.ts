import { businessMan } from './businessMan'
import { femalePm } from './femalePm'
import { kirillMorozov } from './kirillMorozov'
import { alinaBelova } from './alinaBelova'
import type { CharacterDefinition } from './definition'

export type { CharacterDefinition, CharacterModelConfig, ClipName, Persona, NpcSettings } from './definition'

// The always-on roster. To add a permanent character: convert its animation set
// (scripts/convert-character.mjs), create its definition module next to the
// existing ones, and list it here.
export const CHARACTERS: CharacterDefinition[] = [businessMan, femalePm]

export const PLAYER_CHARACTER = businessMan

// NPCs that live in the office from the start of free play (currently just the PM).
export const NPC_CHARACTERS = CHARACTERS.filter((c) => c.npc !== undefined)

// Hireable developers (Feature 03). Deliberately NOT in CHARACTERS/NPC_CHARACTERS
// so they never auto-spawn - Npcs.tsx spawns each one only once the player has
// hired the matching employee (keyed by character id from the team catalog).
export const DEVELOPER_CHARACTERS: CharacterDefinition[] = [kirillMorozov, alinaBelova]

const BY_ID: Record<string, CharacterDefinition> = Object.fromEntries(
  [...CHARACTERS, ...DEVELOPER_CHARACTERS].map((c) => [c.id, c]),
)

export function getCharacterById(id: string): CharacterDefinition | undefined {
  return BY_ID[id]
}
