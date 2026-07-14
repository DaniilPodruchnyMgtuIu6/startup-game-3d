import { businessMan } from './businessMan'
import { femalePm } from './femalePm'
import type { CharacterDefinition } from './definition'

export type { CharacterDefinition, CharacterModelConfig, ClipName, Persona, NpcSettings } from './definition'

// The full character roster. To add a character: convert its animation set
// (scripts/convert-character.mjs), create its definition module next to the
// existing ones, and list it here.
export const CHARACTERS: CharacterDefinition[] = [businessMan, femalePm]

export const PLAYER_CHARACTER = businessMan

export const NPC_CHARACTERS = CHARACTERS.filter((c) => c.npc !== undefined)
