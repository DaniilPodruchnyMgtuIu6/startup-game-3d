import { useCharacterStore, PLAYER_ID } from '../character/characterStore'
import { usePerformanceStore } from '../character/performance/performanceStore'
import { useCutsceneStore } from './cutsceneStore'

// After a scene ends — successfully or by throwing — hand every character the
// scene may have touched back to normal life (Feature 15 deep pass):
// - ephemeral actors (intruder, guards, auditors) get their characterStore
//   entries removed even when the scene failed before its own despawnActor
//   calls (endScene only clears the VISUAL actor map, which used to leave
//   invisible ghost entries behind);
// - any TALK_START left without its TALK_END is closed, because the NPC brain
//   only schedules from settled states — a 'talking' leftover froze the NPC
//   forever after a scene error;
// - (18C §7) every emotion override and gaze pair is wiped, so a failed scene
//   can never leave a character permanently worried or staring at a corner.
export function recoverSceneCharacters(ownedNpcIds: string[]): void {
  const store = useCharacterStore.getState()
  for (const actorId of Object.keys(useCutsceneStore.getState().actors)) {
    store.removeCharacter(actorId)
  }
  for (const id of [PLAYER_ID, ...ownedNpcIds]) {
    const kind = useCharacterStore.getState().characters[id]?.state.kind
    if (kind === 'talking') store.dispatchTo(id, { type: 'TALK_END' })
    if (kind === 'performing') store.dispatchTo(id, { type: 'PERFORM_END' })
  }
  usePerformanceStore.getState().clearAllPerformance()
}
