import type { CharacterDefinition } from './definition'

// Frontend developer hired in Feature 03. Not part of the always-on roster -
// spawned only once the player hires her, from the team store (see Npcs.tsx).
// walkPace/walkLift measured from her walk clip.
export const alinaBelova: CharacterDefinition = {
  id: 'npc-alina-belova',
  displayName: 'Алина Белова',
  portrait: '/dialogue_pictures/alina_belova/alina_neutral.jpg',
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
    walkPace: 1.68,
    walkLift: 0.003,
    // measured hips: sit 0.455 / sitIdle 0.480 / sofa 0.471
    seatLift: { sit: 0.069, sitIdle: 0.044, sofa: 0.069 },
  },
  npc: {
    spawn: [-4, 0, 6.3],
    spawnRotationY: Math.PI,
  },
}
