// Feature 18C §5: centralized emotion presets. The project models have ZERO
// morph targets (18B audit), so emotions are expressed as additive BONE poses:
// small pitch offsets on head/spine/chest that read as body language at the
// game's camera distances. UI and scenes never touch raw bone names - they set
// a CharacterEmotion and the performance layer does the rest.

export type CharacterEmotion =
  | 'neutral'
  | 'focused'
  | 'concerned'
  | 'confident'
  | 'surprised'
  | 'angry-controlled'
  | 'relieved'
  | 'sad'

// Additive rotations in radians. Positive pitch = forward/down.
export interface EmotionPose {
  headPitch: number
  spinePitch: number
  chestPitch: number
}

// Hard caps for any single additive channel - presets (and any future tuning)
// must stay inside these so a pose can never fold a character in half.
export const EMOTION_LIMITS = { headPitch: 0.22, spinePitch: 0.12, chestPitch: 0.1 } as const

export const EMOTION_POSES: Record<CharacterEmotion, EmotionPose> = {
  neutral: { headPitch: 0, spinePitch: 0, chestPitch: 0 },
  focused: { headPitch: 0.07, spinePitch: 0.03, chestPitch: 0.02 },
  concerned: { headPitch: 0.12, spinePitch: 0.05, chestPitch: 0.04 },
  confident: { headPitch: -0.06, spinePitch: -0.03, chestPitch: -0.05 },
  surprised: { headPitch: -0.1, spinePitch: -0.04, chestPitch: -0.03 },
  'angry-controlled': { headPitch: 0.05, spinePitch: 0.04, chestPitch: 0.05 },
  relieved: { headPitch: -0.03, spinePitch: -0.02, chestPitch: -0.03 },
  sad: { headPitch: 0.18, spinePitch: 0.09, chestPitch: 0.06 },
}
