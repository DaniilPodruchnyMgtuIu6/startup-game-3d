import { create } from 'zustand'
import type { CharacterDefinition } from '../character/characters/definition'

type SceneActor = { kind: 'placeholder'; color: string } | { kind: 'model'; definition: CharacterDefinition }

interface CutsceneStore {
  activeSceneId: string | null
  // ephemeral scene-only actors currently spawned, keyed by character id
  actors: Record<string, SceneActor>
  startScene: (id: string) => void
  endScene: () => void
  upsertActor: (id: string, color: string) => void
  upsertModeledActor: (id: string, definition: CharacterDefinition) => void
  removeActor: (id: string) => void
}

export const useCutsceneStore = create<CutsceneStore>()((set) => ({
  activeSceneId: null,
  actors: {},
  // ignored while a scene is already running - this project has no scene
  // queueing/interruption, only one scene plays at a time
  startScene: (id) =>
    set((s) => {
      if (s.activeSceneId) return s
      return { activeSceneId: id, actors: {} }
    }),
  endScene: () => set({ activeSceneId: null, actors: {} }),
  upsertActor: (id, color) => set((s) => ({ actors: { ...s.actors, [id]: { kind: 'placeholder', color } } })),
  upsertModeledActor: (id, definition) =>
    set((s) => ({ actors: { ...s.actors, [id]: { kind: 'model', definition } } })),
  removeActor: (id) =>
    set((s) => {
      const actors = { ...s.actors }
      delete actors[id]
      return { actors }
    }),
}))
