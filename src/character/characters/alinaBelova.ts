import type { CharacterDefinition } from './definition'

// Frontend developer hired in Feature 03. Not part of the always-on roster -
// spawned only once the player hires her, from the team store (see Npcs.tsx).
// walkPace/walkLift measured from her walk clip.
export const alinaBelova: CharacterDefinition = {
  id: 'npc-alina-belova',
  displayName: 'Алина Белова',
  portrait: '/dialogue_pictures/alina_belova/alina_neutral.jpg',
  portraitWorried: '/dialogue_pictures/alina_belova/alina_worried.jpg',
  persona: {
    name: 'Алина Белова',
    role: 'Frontend-разработчик',
    traits: ['общительная', 'ответственная'],
    backstory: 'Не любит постоянную смену требований и бессмысленные переделки.',
  },
  model: {
    clips: {
      idle: '/character/alina_belova/idle.glb',
      walk: '/character/alina_belova/walk.glb',
      sit: '/character/alina_belova/sit.glb',
      look: '/character/alina_belova/look.glb',
      type: '/character/alina_belova/type.glb',
      drink: '/character/alina_belova/drink.glb',
      sitIdle: '/character/alina_belova/sitIdle.glb',
      sofaSit: '/character/alina_belova/sofaSit.glb',
      talk: '/character/alina_belova/talk.glb',
      agree: '/character/alina_belova/agree.glb',
      celebrate: '/character/alina_belova/celebrate.glb',
      explain: '/character/alina_belova/explain.glb',
      pullUp: '/character/alina_belova/pullUp.glb',
    },
    // measured stride pace of her v2 walk clip (1.68 was the old Mixamo one)
    walkPace: 1.15,
    walkLift: 0.003,
    // visual calibration: moderate raise over her native depth
    // sofa: native 0.471 sat at cushion level - thighs sank; +0.065 -> ~0.535
    seatLift: { sit: 0.075, sitIdle: 0.075, sofa: 0.065 },
  },
  npc: {
    spawn: [-4, 0, 6.3],
    spawnRotationY: Math.PI,
  },
}
