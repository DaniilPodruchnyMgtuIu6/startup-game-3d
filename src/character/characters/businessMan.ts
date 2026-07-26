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
    },
    walkPace: 1.33,
    walkLift: 0.011,
  },
}
