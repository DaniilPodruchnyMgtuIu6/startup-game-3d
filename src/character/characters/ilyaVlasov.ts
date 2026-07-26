import type { CharacterDefinition } from './definition'

// The fixed information-security specialist hired in Feature 07. Not part of the
// always-on roster (CHARACTERS/NPC_CHARACTERS) - spawned only once the player
// hires him, from the team store (see Npcs.tsx). Uses the dedicated
// "cybersecurity" office model (its own full clip set, converted from
// character-source/cybersecurity via scripts/convert-character.mjs), so he sits,
// types and drinks like the other office staff on top of his security rounds.
export const ilyaVlasov: CharacterDefinition = {
  id: 'npc-ilya-vlasov',
  displayName: 'Илья Власов',
  portrait: '/dialogue_pictures/ilya_vlasov/ilya_neutral.jpg',
  persona: {
    name: 'Илья Власов',
    role: 'Специалист по информационной безопасности',
    traits: ['спокойный', 'внимательный', 'прямолинейный'],
    backstory: 'Не обещает абсолютной безопасности и всегда объясняет цену риска. Не любит временные решения, которые становятся постоянными.',
  },
  model: {
    clips: {
      idle: '/character/cybersecurity/idle.glb',
      walk: '/character/cybersecurity/walk.glb',
      type: '/character/cybersecurity/type.glb',
      drink: '/character/cybersecurity/drink.glb',
      sitIdle: '/character/cybersecurity/sitIdle.glb',
      sofaSit: '/character/cybersecurity/sofaSit.glb',
      talk: '/character/cybersecurity/talk.glb',
    },
    walkPace: 1.6,
    walkLift: 0.01,
  },
  npc: {
    spawn: [5.5, 0, 6],
    spawnRotationY: Math.PI,
  },
}
