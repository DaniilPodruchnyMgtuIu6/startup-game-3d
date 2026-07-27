import type { CharacterDefinition } from './definition'

// Autonomous NPC: the project manager.
// Future: persona loaded from character-source/female_pm/persona.yaml and fed
// to her DeepSeek-agent brain via npc.planActivity.
export const femalePm: CharacterDefinition = {
  id: 'npc-female-pm',
  displayName: 'Product Manager',
  portrait: '/dialogue_pictures/prodact_manager/pm.jpeg',
  portraitWorried: '/dialogue_pictures/prodact_manager/pm_worried.jpg',
  persona: {
    name: 'Соня Соколова',
    age: 29,
    role: 'Product Manager',
    traits: ['организованная', 'прямолинейная', 'болеет за продукт'],
  },
  model: {
    clips: {
      idle: '/character/female_pm/idle.glb',
      walk: '/character/female_pm/walk.glb',
      sit: '/character/female_pm/sit.glb',
      look: '/character/female_pm/look.glb',
      type: '/character/female_pm/type.glb',
      drink: '/character/female_pm/drink.glb',
      sitIdle: '/character/female_pm/sitIdle.glb',
      sofaSit: '/character/female_pm/sofaSit.glb',
      talk: '/character/female_pm/talk.glb',
      agree: '/character/female_pm/agree.glb',
      celebrate: '/character/female_pm/celebrate.glb',
      explain: '/character/female_pm/explain.glb',
      facepalm: '/character/female_pm/facepalm.glb',
      pullUp: '/character/female_pm/pullUp.glb',
    },
    // measured stride pace of HER v2 walk clip (the pre-swap 0.99 was the old
    // Mixamo clip's). Travel speed follows the clip (walkSpeedFor) so her
    // short stride reads calm, not fast-forwarded.
    walkPace: 0.69,
    // visual calibration: bone-height normalization (0.115) overshot and she
    // floated; moderate raise over her native depth instead («девочки ниже»)
    seatLift: { sit: 0.08, sitIdle: 0.08, sofa: 0.06 },
  },
  npc: {
    spawn: [-2, 0, 6.3],
    spawnRotationY: Math.PI,
  },
}
