import { describe, it, expect } from 'vitest'
import { rallyCrossing, swingEnvelope, RALLY_CROSSING_S } from './pingPongRhythm'

describe('shared rally rhythm (18H §20 - ball and swings on one clock)', () => {
  it('the ball leaves side 0 at phase 0 and side 1 half a cycle later', () => {
    expect(rallyCrossing(0.01)).toMatchObject({ from: 0 })
    expect(rallyCrossing(RALLY_CROSSING_S + 0.01)).toMatchObject({ from: 1 })
    expect(rallyCrossing(2 * RALLY_CROSSING_S + 0.01)).toMatchObject({ from: 0 })
  })

  it('each strike peaks exactly when the ball departs that side', () => {
    const cycle = 2 * RALLY_CROSSING_S
    // side 0 strikes around t=0 (mod cycle): strike lobe high, windup low
    const atHit0 = swingEnvelope(0.04 * cycle, 0)
    expect(atHit0.strike).toBeGreaterThan(0.9)
    // side 1 at the same moment is between exchanges: both lobes near zero
    const other = swingEnvelope(0.04 * cycle, 1)
    expect(other.strike).toBeLessThan(0.05)
    expect(other.windup).toBeLessThan(0.05)
    // shortly BEFORE side 1's hit, its windup rises while the strike is low
    const preHit1 = swingEnvelope(0.4 * cycle, 1)
    expect(preHit1.windup).toBeGreaterThan(0.6)
    expect(preHit1.windup).toBeGreaterThan(preHit1.strike)
  })

  it('the envelope is periodic - reps do not drift over long rallies', () => {
    const a = swingEnvelope(0.2, 0)
    const b = swingEnvelope(0.2 + 20 * RALLY_CROSSING_S, 0)
    expect(a.strike).toBeCloseTo(b.strike, 6)
    expect(a.windup).toBeCloseTo(b.windup, 6)
  })
})
