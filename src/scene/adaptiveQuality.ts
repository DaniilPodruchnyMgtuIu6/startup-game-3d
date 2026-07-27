import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { useQualityStore, type QualityTier } from './qualityStore'

// 18H §21 / live feedback «хочу плавную игру»: production hides the quality
// dev panel, so the ONE mechanism a player has is automatic - measure the
// real frame rate and walk the persisted tier down until the game is smooth
// (and cautiously back up when there is clear headroom). Pure decision logic
// kept separate from the sampling hook so it unit-tests without a renderer.

export const ADAPTIVE_QUALITY = {
  warmupS: 10, // ignore load/shader-compile spikes after (re)mount
  windowS: 4, // one FPS sample = one full window, not a single bad frame
  stepDownBelowFps: 45,
  stepUpAboveFps: 58,
  stepUpAfterWindows: 3, // hysteresis: many good windows before going up
  maxAutoTier: 'high' as QualityTier, // cinematic stays a manual choice
} as const

const ORDER: QualityTier[] = ['low', 'medium', 'high', 'cinematic']

// Returns the tier to switch to, or null for no change. `goodWindows` is how
// many consecutive windows already measured above the up-threshold BEFORE
// this one.
export function nextAdaptiveTier(current: QualityTier, avgFps: number, goodWindows: number): QualityTier | null {
  const index = ORDER.indexOf(current)
  if (avgFps < ADAPTIVE_QUALITY.stepDownBelowFps && index > 0) return ORDER[index - 1]
  if (
    avgFps > ADAPTIVE_QUALITY.stepUpAboveFps &&
    goodWindows + 1 >= ADAPTIVE_QUALITY.stepUpAfterWindows &&
    index < ORDER.indexOf(ADAPTIVE_QUALITY.maxAutoTier)
  ) {
    return ORDER[index + 1]
  }
  return null
}

// Mounted INSIDE the Canvas. The tier switch remounts the renderer
// (App.tsx keys the Canvas by tier), which resets the r3f clock - so the
// warmup naturally re-arms after every step and one adjustment settles
// before the next window can fire.
export function AdaptiveQuality() {
  const windowStart = useRef<number | null>(null)
  const frames = useRef(0)
  const goodWindows = useRef(0)

  useFrame(({ clock }) => {
    if (typeof document !== 'undefined' && document.hidden) {
      windowStart.current = null // a hidden tab throttles rAF - never sample it
      return
    }
    const t = clock.elapsedTime
    if (t < ADAPTIVE_QUALITY.warmupS) return
    if (windowStart.current === null) {
      windowStart.current = t
      frames.current = 0
      return
    }
    frames.current += 1
    const elapsed = t - windowStart.current
    if (elapsed < ADAPTIVE_QUALITY.windowS) return
    const fps = frames.current / elapsed
    windowStart.current = t
    frames.current = 0
    const tier = useQualityStore.getState().tier
    const next = nextAdaptiveTier(tier, fps, goodWindows.current)
    goodWindows.current = fps > ADAPTIVE_QUALITY.stepUpAboveFps ? goodWindows.current + 1 : 0
    if (next) {
      goodWindows.current = 0
      console.info(`[adaptive-quality] ${fps.toFixed(0)} fps on '${tier}' -> switching to '${next}'`)
      useQualityStore.getState().setTier(next)
    }
  })
  return null
}
