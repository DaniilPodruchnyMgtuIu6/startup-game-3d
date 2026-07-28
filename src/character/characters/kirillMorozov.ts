import type { CharacterDefinition } from './definition'

// Backend developer hired in Feature 03. Not part of the always-on roster
// (CHARACTERS/NPC_CHARACTERS) - he is spawned only once the player hires him,
// from the team store (see Npcs.tsx). walkPace/walkLift measured from his walk
// clip so planted feet stay pinned to the floor.
export const kirillMorozov: CharacterDefinition = {
  id: 'npc-kirill-morozov',
  displayName: 'Кирилл Морозов',
  portrait: '/dialogue_pictures/kirill_morozov/kirill_neutral.jpg',
  portraitWorried: '/dialogue_pictures/kirill_morozov/kirill_worried.jpg',
  persona: {
    name: 'Кирилл Морозов',
    role: 'Backend-разработчик',
    traits: ['уверенный', 'технически сильный', 'прямолинейный'],
    backstory: 'Любит быстрые решения и спорит с процессами, которые считает избыточными.',
  },
  model: {
    clips: {
      idle: '/character/kirill_morozov/idle.glb',
      walk: '/character/kirill_morozov/walk.glb',
      sit: '/character/kirill_morozov/sit.glb',
      look: '/character/kirill_morozov/look.glb',
      type: '/character/kirill_morozov/type.glb',
      drink: '/character/kirill_morozov/drink.glb',
      sitIdle: '/character/kirill_morozov/sitIdle.glb',
      sofaSit: '/character/kirill_morozov/sofaSit.glb',
      talk: '/character/kirill_morozov/talk.glb',
      agree: '/character/kirill_morozov/agree.glb',
      celebrate: '/character/kirill_morozov/celebrate.glb',
      explain: '/character/kirill_morozov/explain.glb',
      pullUp: '/character/kirill_morozov/pullUp.glb',
    },
    // measured stride pace of his v2 walk clip (1.77 was the old Mixamo one)
    walkPace: 1.38,
    walkLift: 0.015,
    // visual calibration: the reference look («нормально сидит только backend»)
    // asked for a touch higher than the old global 0.05
    // sofa: native 0.547 already rides the cushion
    seatLift: { sit: 0.065, sitIdle: 0.065, sofa: 0 },
  },
  npc: {
    spawn: [4, 0, 6.3],
    spawnRotationY: Math.PI,
  },
}
