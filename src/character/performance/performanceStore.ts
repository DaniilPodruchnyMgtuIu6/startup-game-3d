// Feature 18C §5-§7: runtime performance state - who feels what and who looks
// at whom. Deliberately NOT persisted: emotions and gaze are scene/dialogue
// dressing; after a reload characters simply return to neutral, which is a
// valid pose (§3 "serializable настолько, насколько нужно").
import { create } from 'zustand'
import type { CharacterEmotion } from './characterEmotion'

interface PerformanceState {
  emotions: Record<string, CharacterEmotion>
  // characterId -> characterId it is looking at (head look-at, clamped).
  gazeTargets: Record<string, string>
  setEmotion: (characterId: string, emotion: CharacterEmotion) => void
  clearEmotion: (characterId: string) => void
  // A conversation pair looks at each other for its duration.
  setGazePair: (a: string, b: string) => void
  clearGaze: (...characterIds: string[]) => void
  // §7: scene recovery - nothing survives a finished/failed scene.
  clearAllPerformance: () => void
}

export const usePerformanceStore = create<PerformanceState>((set) => ({
  emotions: {},
  gazeTargets: {},
  setEmotion: (characterId, emotion) =>
    set((s) => ({ emotions: { ...s.emotions, [characterId]: emotion } })),
  clearEmotion: (characterId) =>
    set((s) => {
      const { [characterId]: _, ...rest } = s.emotions
      return { emotions: rest }
    }),
  setGazePair: (a, b) =>
    set((s) => ({ gazeTargets: { ...s.gazeTargets, [a]: b, [b]: a } })),
  clearGaze: (...characterIds) =>
    set((s) => {
      const next = { ...s.gazeTargets }
      for (const id of characterIds) delete next[id]
      return { gazeTargets: next }
    }),
  clearAllPerformance: () => set({ emotions: {}, gazeTargets: {} }),
}))
