import type { CharacterDefinition } from './definition'

export const security2: CharacterDefinition = {
  id: 'security-2',
  displayName: 'Дмитрий Воронин',
  portrait: '/dialogue_pictures/security/security_2_without_emotions.png',
  model: {
    clips: {
      idle: '/character/security_2/idle.glb',
      walk: '/character/security_2/walk.glb',
      talk: '/character/security_2/talk.glb',
      look: '/character/security_2/look.glb',
    },
  },
}
