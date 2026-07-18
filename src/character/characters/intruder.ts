import type { CharacterDefinition } from './definition'

// Temporary office-intrusion visitor (Feature 10). Not part of any roster - it
// is spawned and despawned only by the office-intrusion cutscene, so it needs
// just the two clips the scene drives (idle + walk). Its own dedicated model
// keeps the intruder visually distinct from the player/team. Converted from
// character-source/intruder via scripts/convert-character.mjs. walkPace is an
// estimate and can be re-measured from the walk clip if the feet skate.
export const intruder: CharacterDefinition = {
  id: 'intruder-visitor',
  displayName: 'Посетитель',
  model: {
    clips: {
      idle: '/character/intruder/idle.glb',
      walk: '/character/intruder/walk.glb',
    },
    walkPace: 1.4,
    walkLift: 0.011,
  },
}
