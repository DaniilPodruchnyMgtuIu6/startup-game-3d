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
      sit: '/character/cybersecurity/sit.glb',
      look: '/character/cybersecurity/look.glb',
      type: '/character/cybersecurity/type.glb',
      drink: '/character/cybersecurity/drink.glb',
      sitIdle: '/character/cybersecurity/sitIdle.glb',
      sofaSit: '/character/cybersecurity/sofaSit.glb',
      talk: '/character/cybersecurity/talk.glb',
      agree: '/character/cybersecurity/agree.glb',
      celebrate: '/character/cybersecurity/celebrate.glb',
      explain: '/character/cybersecurity/explain.glb',
      pullUp: '/character/cybersecurity/pullUp.glb',
    },
    // measured stride pace of his v2 walk clip (1.6 was the old Mixamo one)
    walkPace: 1.4,
    walkLift: 0.01,
    // visual calibration: the old global 0.05 level read fine for him
    seatLift: { sit: 0.05, sitIdle: 0.05, sofa: 0.06 },
  },
  npc: {
    spawn: [5.5, 0, 6],
    spawnRotationY: Math.PI,
  },
}
