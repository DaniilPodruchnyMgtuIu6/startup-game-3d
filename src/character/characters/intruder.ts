import type { CharacterDefinition } from './definition'

// Temporary office-intrusion visitor (Feature 10). Not part of any roster - it
// is spawned and despawned only by the office-intrusion cutscene, so it needs
// just the two clips the scene drives (idle + walk). Its own dedicated model
// keeps the intruder visually distinct from the player/team.
//
// 18H+ (identity match with the generated office-intrusion video clips): the
// old Mixamo model (126 bones, 7 textures, visibly different build/face from
// the video) is replaced by a Higgsfield identity-locked model on the SAME
// 24-bone pipeline as the five main characters - see
// docs/art/characters/intruder-visitor/generation-prompts.md. walkPace is the
// measured geometric stride pace of the retargeted walk clip (measureWalkPace.mjs,
// same convention as every other character); walkLift matches kirill_morozov's
// (closest rig - heightRatio 0.968 against the old skeleton, same retarget engine).
export const intruder: CharacterDefinition = {
  id: 'intruder-visitor',
  displayName: 'Посетитель',
  model: {
    clips: {
      idle: '/character/intruder/idle.glb',
      walk: '/character/intruder/walk.glb',
    },
    walkPace: 1.48,
    walkLift: 0.015,
  },
}
