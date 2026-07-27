// 18H §7: structured, typed performance metadata a dialogue line can carry -
// enum-to-enum only, never a raw bone/morph name (explicitly forbidden by
// §7: "Не добавлять raw morph names в dialogue scripts"). The performance
// layer (useCharacterPerformance.ts) is the only place these enums resolve
// into actual bone rotations.
import type { CharacterEmotion } from './characterEmotion'

export type ListenerReaction =
  | 'neutral-listening'
  | 'focused-listening'
  | 'concerned-listening'
  | 'nod'
  | 'small-head-shake'
  | 'thinking'
  | 'surprised-reaction'
  | 'controlled-frustration'
  | 'relieved-reaction'
  | 'look-at-whiteboard'
  | 'look-at-speaker'

export type DialogueFocusTarget = 'speaker' | 'whiteboard' | 'player' | 'object'

export interface DialoguePerformanceCue {
  speakerEmotion?: CharacterEmotion
  listenerReaction?: ListenerReaction
  focusTarget?: DialogueFocusTarget
}

// Reactions that read as an existing CharacterEmotion bone-pose worn briefly
// by a listener - reuses characterEmotion.ts's already-tuned presets instead
// of authoring a second, parallel pose table for the same facial/body idea.
// Reactions absent here (nod, small-head-shake, thinking, look-at-*) are
// motion or gaze, handled directly in useCharacterPerformance.ts.
export const REACTION_EMOTION: Partial<Record<ListenerReaction, CharacterEmotion>> = {
  'neutral-listening': 'neutral',
  'focused-listening': 'focused',
  'concerned-listening': 'concerned',
  'surprised-reaction': 'surprised',
  'controlled-frustration': 'angry-controlled',
  'relieved-reaction': 'relieved',
}
