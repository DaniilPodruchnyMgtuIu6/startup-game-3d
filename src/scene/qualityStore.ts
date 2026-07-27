// Feature 18E §7: render quality tiers. One persisted knob that scales the
// heaviest render features; gameplay is never blurred (§7) - DOF/grain are
// reserved for cinematic and none of the tiers blur the interactive view.
import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export type QualityTier = 'low' | 'medium' | 'high' | 'cinematic'

export interface QualityPreset {
  dprMax: number // devicePixelRatio cap
  ao: boolean // N8AO pass
  bloom: boolean
  vignette: boolean
  shadows: boolean
  // 18G §4: the per-frame NPC performance layer (breathing/gaze/nods/emotion
  // bone poses) - the one per-character CPU cost worth shedding on low.
  npcPerformance: boolean
}

export const QUALITY_PRESETS: Record<QualityTier, QualityPreset> = {
  low: { dprMax: 1, ao: false, bloom: false, vignette: false, shadows: false, npcPerformance: false },
  medium: { dprMax: 1.25, ao: false, bloom: true, vignette: true, shadows: true, npcPerformance: true },
  high: { dprMax: 1.5, ao: true, bloom: true, vignette: true, shadows: true, npcPerformance: true },
  cinematic: { dprMax: 2, ao: true, bloom: true, vignette: true, shadows: true, npcPerformance: true },
}

interface QualityState {
  tier: QualityTier
  setTier: (tier: QualityTier) => void
}

export const useQualityStore = create<QualityState>()(
  persist(
    (set) => ({
      tier: 'high',
      setTier: (tier) => set({ tier }),
    }),
    {
      name: 'startup-office-quality',
      // v1: a short-lived FPS auto-downgrade (removed after live feedback -
      // it PERSISTED lowered tiers and the game "went ugly" permanently).
      // Migrating resets every pre-v1 save back to the beautiful default;
      // from here the tier only changes through the visible in-game switch.
      version: 1,
      migrate: () => ({ tier: 'high' as QualityTier }),
    },
  ),
)

export function currentQuality(tier: QualityTier): QualityPreset {
  return QUALITY_PRESETS[tier]
}
