import type { CharacterDefinition } from './definition'

// The player-controlled founder.
// Future: persona loaded from character-source/business_man/persona.yaml.
export const businessMan: CharacterDefinition = {
  id: 'player',
  displayName: 'Founder',
  portrait: '/dialogue_pictures/businessman/businesman.jpeg',
  model: {
    clips: {
      idle: '/character/business_man/idle.glb',
      walk: '/character/business_man/walk.glb',
      sit: '/character/business_man/sit.glb',
      look: '/character/business_man/look.glb',
      type: '/character/business_man/type.glb',
      drink: '/character/business_man/drink.glb',
      sitIdle: '/character/business_man/sitIdle.glb',
      sofaSit: '/character/business_man/sofaSit.glb',
      talk: '/character/business_man/talk.glb',
      agree: '/character/business_man/agree.glb',
      celebrate: '/character/business_man/celebrate.glb',
      explain: '/character/business_man/explain.glb',
      facepalm: '/character/business_man/facepalm.glb',
      pullUp: '/character/business_man/pullUp.glb',
    },
    // Measured from THIS model's retargeted walk.glb (geometric stride pace:
    // 2*max foot separation / cycle time; re-measured after the spine-map
    // retarget fix). The old 1.33 was the previous Mixamo clip's pace -
    // keeping it after the v2 model swap made the feet skate visibly.
    walkPace: 1.07,
    walkLift: 0.011,
    // visual calibration (live feedback iterations): native clip depth plus a
    // small constant raise; sofa cushions swallowed everyone at native depth
    seatLift: { sit: 0.05, sitIdle: 0.05, sofa: 0.06 },
  },
}
