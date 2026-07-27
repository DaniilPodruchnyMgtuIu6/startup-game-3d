import { describe, it, expect } from 'vitest'
import { nextAdaptiveTier, ADAPTIVE_QUALITY } from './adaptiveQuality'

describe('adaptive quality stepping (18H §21)', () => {
  it('steps down one tier when the window average is below the threshold', () => {
    expect(nextAdaptiveTier('high', 30, 0)).toBe('medium')
    expect(nextAdaptiveTier('medium', 44, 0)).toBe('low')
    expect(nextAdaptiveTier('cinematic', 20, 0)).toBe('high')
  })

  it('never steps below low', () => {
    expect(nextAdaptiveTier('low', 10, 0)).toBeNull()
  })

  it('holds steady in the comfortable band', () => {
    expect(nextAdaptiveTier('medium', 50, 5)).toBeNull()
    expect(nextAdaptiveTier('high', 55, 5)).toBeNull()
  })

  it('steps up only after enough consecutive good windows (hysteresis)', () => {
    expect(nextAdaptiveTier('low', 60, 0)).toBeNull()
    expect(nextAdaptiveTier('low', 60, 1)).toBeNull()
    expect(nextAdaptiveTier('low', 60, ADAPTIVE_QUALITY.stepUpAfterWindows - 1)).toBe('medium')
  })

  it('never auto-raises above the max auto tier (cinematic stays manual)', () => {
    expect(nextAdaptiveTier('high', 120, 10)).toBeNull()
    expect(nextAdaptiveTier('cinematic', 120, 10)).toBeNull()
  })
})
