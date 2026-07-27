// Feature 18C §5-§7: runtime performance state - who feels what and who looks
// at whom. Deliberately NOT persisted: emotions and gaze are scene/dialogue
// dressing; after a reload characters simply return to neutral, which is a
// valid pose (§3 "serializable настолько, насколько нужно").
import { create } from 'zustand'
import type { CharacterEmotion } from './characterEmotion'
import type { ListenerReaction } from './dialoguePerformanceCue'

interface PerformanceState {
  emotions: Record<string, CharacterEmotion>
  // characterId -> characterId it is looking at (head look-at, clamped).
  gazeTargets: Record<string, string>
  // 18H §7: characterId -> a fixed WORLD point it looks at instead of another
  // character (e.g. the whiteboard) - same clamped head look-at math, just
  // fed a raw position instead of resolving one from another character.
  gazePoints: Record<string, [number, number, number]>
  // 18H §7: a listener's current reaction to the line on screen, driven by
  // DialoguePerformanceCue - separate from `emotions` (a more sustained
  // scene-level mood some interactions still set directly, e.g. Sonya
  // staying 'concerned' through the whole post-audit talk).
  listenerReactions: Record<string, ListenerReaction>
  setEmotion: (characterId: string, emotion: CharacterEmotion) => void
  clearEmotion: (characterId: string) => void
  // A conversation pair looks at each other for its duration.
  setGazePair: (a: string, b: string) => void
  // One-directional gaze (group scenes: listener -> current speaker).
  setGaze: (from: string, to: string) => void
  setGazePoint: (characterId: string, point: [number, number, number]) => void
  clearGaze: (...characterIds: string[]) => void
  setListenerReaction: (characterId: string, reaction: ListenerReaction) => void
  clearListenerReaction: (characterId: string) => void
  // §7: scene recovery - nothing survives a finished/failed scene.
  clearAllPerformance: () => void
}

export const usePerformanceStore = create<PerformanceState>((set) => ({
  emotions: {},
  gazeTargets: {},
  gazePoints: {},
  listenerReactions: {},
  setEmotion: (characterId, emotion) =>
    set((s) => ({ emotions: { ...s.emotions, [characterId]: emotion } })),
  clearEmotion: (characterId) =>
    set((s) => {
      const { [characterId]: _, ...rest } = s.emotions
      return { emotions: rest }
    }),
  setGazePair: (a, b) =>
    set((s) => ({ gazeTargets: { ...s.gazeTargets, [a]: b, [b]: a } })),
  setGaze: (from, to) =>
    set((s) => (s.gazeTargets[from] === to ? s : { gazeTargets: { ...s.gazeTargets, [from]: to } })),
  setGazePoint: (characterId, point) =>
    set((s) => {
      // a character looks at either another character OR a fixed point, never
      // both at once - clear any stale character-target so gaze is unambiguous
      const { [characterId]: _, ...restTargets } = s.gazeTargets
      return { gazeTargets: restTargets, gazePoints: { ...s.gazePoints, [characterId]: point } }
    }),
  clearGaze: (...characterIds) =>
    set((s) => {
      const nextTargets = { ...s.gazeTargets }
      const nextPoints = { ...s.gazePoints }
      for (const id of characterIds) {
        delete nextTargets[id]
        delete nextPoints[id]
      }
      return { gazeTargets: nextTargets, gazePoints: nextPoints }
    }),
  setListenerReaction: (characterId, reaction) =>
    set((s) => ({ listenerReactions: { ...s.listenerReactions, [characterId]: reaction } })),
  clearListenerReaction: (characterId) =>
    set((s) => {
      const { [characterId]: _, ...rest } = s.listenerReactions
      return { listenerReactions: rest }
    }),
  clearAllPerformance: () => set({ emotions: {}, gazeTargets: {}, gazePoints: {}, listenerReactions: {} }),
}))
