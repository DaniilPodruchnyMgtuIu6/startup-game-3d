import { describe, it, expect } from 'vitest'
import { REACTION_EMOTION, type ListenerReaction } from './dialoguePerformanceCue'
import { EMOTION_POSES } from './characterEmotion'

const ALL_REACTIONS: ListenerReaction[] = [
  'neutral-listening',
  'focused-listening',
  'concerned-listening',
  'nod',
  'small-head-shake',
  'thinking',
  'surprised-reaction',
  'controlled-frustration',
  'relieved-reaction',
  'look-at-whiteboard',
  'look-at-speaker',
]

describe('REACTION_EMOTION (18H §7)', () => {
  it('every mapped reaction points at a real, defined CharacterEmotion preset', () => {
    for (const [reaction, emotion] of Object.entries(REACTION_EMOTION)) {
      expect(EMOTION_POSES[emotion], `${reaction} -> ${emotion}`).toBeDefined()
    }
  })

  it('motion/gaze-only reactions are deliberately absent (handled procedurally, not via emotion pose)', () => {
    const motionOrGazeOnly: ListenerReaction[] = ['nod', 'small-head-shake', 'thinking', 'look-at-whiteboard', 'look-at-speaker']
    for (const reaction of motionOrGazeOnly) {
      expect(REACTION_EMOTION[reaction], reaction).toBeUndefined()
    }
  })

  it('every ListenerReaction is either emotion-mapped or explicitly motion/gaze-only - none silently fall through', () => {
    const motionOrGazeOnly = new Set(['nod', 'small-head-shake', 'thinking', 'look-at-whiteboard', 'look-at-speaker'])
    for (const reaction of ALL_REACTIONS) {
      const handled = reaction in REACTION_EMOTION || motionOrGazeOnly.has(reaction)
      expect(handled, reaction).toBe(true)
    }
  })
})
