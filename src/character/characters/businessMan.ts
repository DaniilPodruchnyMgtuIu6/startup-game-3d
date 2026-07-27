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
    // 2*max foot separation / cycle time = 1.17 m/s). The old 1.33 was the
    // previous Mixamo clip's pace - keeping it after the v2 model swap made
    // the feet skate ~14% (the "сломана анимация ходьбы" live report).
    walkPace: 1.17,
    walkLift: 0.011,
    // measured hips (sit 0.474 / sitIdle 0.474 / sofa 0.540) - the reference
    // look every other rig is normalized to (see SeatLift in definition.ts)
    seatLift: { sit: 0.05, sitIdle: 0.05, sofa: 0 },
  },
}
