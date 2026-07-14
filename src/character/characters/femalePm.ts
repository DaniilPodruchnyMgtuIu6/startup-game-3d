import type { CharacterDefinition } from './definition'

// Autonomous NPC: the project manager.
// Future: persona loaded from character-source/female_pm/persona.yaml and fed
// to her DeepSeek-agent brain via npc.planActivity.
export const femalePm: CharacterDefinition = {
  id: 'npc-female-pm',
  displayName: 'Product Manager',
  persona: {
    name: 'Анна Соколова',
    age: 29,
    role: 'Product Manager',
    traits: ['организованная', 'прямолинейная', 'болеет за продукт'],
  },
  model: {
    clips: {
      idle: '/character/female_pm/idle.glb',
      walk: '/character/female_pm/walk.glb',
      type: '/character/female_pm/type.glb',
      drink: '/character/female_pm/drink.glb',
      sitIdle: '/character/female_pm/sitIdle.glb',
      sofaSit: '/character/female_pm/sofaSit.glb',
    },
  },
  npc: {
    spawn: [-2, 0, 6.3],
    spawnRotationY: Math.PI,
  },
}
