import type { CharacterDefinition } from './definition'

// Cutscene-only actor - not part of the autonomous NPC roster (no
// npc/persona field). Spawned and despawned directly by whichever scene
// needs him; never listed in characters/index.ts's CHARACTERS array.
export const security1: CharacterDefinition = {
  id: 'security-1',
  displayName: 'Максим Орлов',
  portrait: '/dialogue_pictures/security/security_1_without_emotions.png',
  model: {
    clips: {
      idle: '/character/security_1/idle.glb',
      walk: '/character/security_1/walk.glb',
      talk: '/character/security_1/talk.glb',
      look: '/character/security_1/look.glb',
    },
  },
}
