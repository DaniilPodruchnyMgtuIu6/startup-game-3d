import { describe, it, expect } from 'vitest'
import { getRiskLevel, RISK_DOMAINS } from './riskCatalog'
import {
  buildRiskObservations,
  effectiveDetectionDelay,
  getActualRiskLevel,
  getActualRiskScore,
  getDetectedRiskLevel,
  getDetectedRiskScore,
  getRiskLevelReachedAt,
  getRiskSignalFactorLabel,
  getSprintOverloadRiskImpact,
  getUnacknowledgedDetectedCount,
  hasActualRiskAtLeast,
  isSignalDue,
  normalizeRiskSignals,
  type RiskSignal,
} from './riskRules'

const sig = (over: Partial<RiskSignal> & { id: string; domain: RiskSignal['domain']; impact: number }): RiskSignal => ({
  source: 'security-audit',
  sourceRef: 'x',
  createdAt: { sprintNumber: 2, day: 2 },
  createdAtWorkdayIndex: 12,
  ...over,
})

describe('risk levels', () => {
  it('maps the fixed thresholds', () => {
    expect(getRiskLevel(0)).toBe('controlled')
    expect(getRiskLevel(-5)).toBe('controlled')
    expect(getRiskLevel(1)).toBe('low')
    expect(getRiskLevel(2)).toBe('low')
    expect(getRiskLevel(3)).toBe('elevated')
    expect(getRiskLevel(4)).toBe('elevated')
    expect(getRiskLevel(5)).toBe('high')
    expect(getRiskLevel(6)).toBe('high')
    expect(getRiskLevel(7)).toBe('critical')
    expect(getRiskLevel(99)).toBe('critical')
  })

  it('there are exactly six domains', () => {
    expect(RISK_DOMAINS).toHaveLength(6)
  })
})

describe('scores clamp at 0 and sum per domain', () => {
  it('actual score sums a domain and clamps negatives', () => {
    const signals = [sig({ id: 'a', domain: 'identity-access', impact: 2 }), sig({ id: 'b', domain: 'identity-access', impact: -5 })]
    expect(getActualRiskScore(signals, 'identity-access')).toBe(0)
    expect(getActualRiskLevel(signals, 'identity-access')).toBe('controlled')
  })

  it('domains are counted separately', () => {
    const signals = [sig({ id: 'a', domain: 'identity-access', impact: 3 }), sig({ id: 'b', domain: 'governance', impact: 2 })]
    expect(getActualRiskScore(signals, 'identity-access')).toBe(3)
    expect(getActualRiskScore(signals, 'governance')).toBe(2)
  })

  it('detected score only counts detected signals', () => {
    const signals = [
      sig({ id: 'a', domain: 'governance', impact: 2, detectedAtWorkdayIndex: 15 }),
      sig({ id: 'b', domain: 'governance', impact: 2 }), // not detected
    ]
    expect(getDetectedRiskScore(signals, 'governance')).toBe(2)
    expect(getActualRiskScore(signals, 'governance')).toBe(4)
    expect(getDetectedRiskLevel(signals, 'governance')).toBe('low')
  })
})

describe('detection delay', () => {
  const base = sig({ id: 'a', domain: 'governance', impact: 2, createdAtWorkdayIndex: 12 })

  it('is 3 without the specialist and 1 with', () => {
    expect(effectiveDetectionDelay(base, false)).toBe(3)
    expect(effectiveDetectionDelay(base, true)).toBe(1)
  })

  it('an override of 0 is immediate', () => {
    expect(effectiveDetectionDelay({ ...base, detectionDelayOverride: 0 }, false)).toBe(0)
    expect(isSignalDue({ ...base, detectionDelayOverride: 0 }, 12, false)).toBe(true)
  })

  it('is due only once the delay has elapsed', () => {
    expect(isSignalDue(base, 14, false)).toBe(false) // 12 + 3 = 15
    expect(isSignalDue(base, 15, false)).toBe(true)
    expect(isSignalDue(base, 13, true)).toBe(true) // 12 + 1
  })
})

describe('future selectors', () => {
  it('hasActualRiskAtLeast uses actual, not detected', () => {
    const signals = [sig({ id: 'a', domain: 'governance', impact: 5 })] // high, undetected
    expect(hasActualRiskAtLeast(signals, 'governance', 'high')).toBe(true)
    expect(getDetectedRiskLevel(signals, 'governance')).toBe('controlled')
  })

  it('getRiskLevelReachedAt returns the first historical threshold moment; mitigation does not change it', () => {
    const signals = [
      sig({ id: 'a', domain: 'governance', impact: 2, createdAtWorkdayIndex: 12 }), // low (2)
      sig({ id: 'b', domain: 'governance', impact: 2, createdAtWorkdayIndex: 15 }), // elevated (4)
      sig({ id: 'c', domain: 'governance', impact: -3, createdAtWorkdayIndex: 20 }), // back to low
    ]
    expect(getRiskLevelReachedAt(signals, 'governance', 'elevated')).toBe(15)
    expect(getRiskLevelReachedAt(signals, 'governance', 'high')).toBeNull()
  })

  it('tie-break by id is stable at the same workday index', () => {
    const signals = [
      sig({ id: 'z', domain: 'governance', impact: 1, createdAtWorkdayIndex: 12 }),
      sig({ id: 'a', domain: 'governance', impact: 2, createdAtWorkdayIndex: 12 }),
    ]
    // ordered a(+2 -> low) then z(+1 -> low); low reached at 12
    expect(getRiskLevelReachedAt(signals, 'governance', 'low')).toBe(12)
  })
})

describe('sprint overload impact', () => {
  it.each([
    [10, 0],
    [11, 1],
    [13, 1],
    [14, 2],
    [16, 2],
    [17, 3],
    [25, 3],
  ])('load %i -> impact %i', (load, impact) => {
    expect(getSprintOverloadRiskImpact(load)).toBe(impact)
  })
})

describe('factor labels', () => {
  it('describes each source in plain language', () => {
    expect(getRiskSignalFactorLabel(sig({ id: '1', domain: 'governance', impact: 2, sourceRef: 'decline-security-hire', source: 'staffing-decision' }))).toContain('не назначен')
    expect(getRiskSignalFactorLabel(sig({ id: '2', domain: 'identity-access', impact: -3, sourceRef: 'account-access-review', source: 'security-finding' }))).toContain('учётных записей')
    expect(getRiskSignalFactorLabel(sig({ id: '3', domain: 'governance', impact: 3, sourceRef: 'audit:2:failed' }))).toContain('второй раз')
    expect(getRiskSignalFactorLabel(sig({ id: '4', domain: 'identity-access', impact: 1, sourceRef: 'server:auth:failure:1', source: 'server-minigame' }))).toContain('AUTH')
    expect(getRiskSignalFactorLabel(sig({ id: '5', domain: 'identity-access', impact: -2, sourceRef: 'server:auth:stabilized', source: 'server-minigame' }))).toContain('исправлена')
    expect(getRiskSignalFactorLabel(sig({ id: '6', domain: 'delivery-pressure', impact: 2, sourceRef: 'sprint:3:kirill-morozov:load-15', source: 'sprint-plan' }))).toContain('Кирилла')
  })
})

describe('observations', () => {
  const signals = [
    sig({ id: 'a', domain: 'identity-access', impact: 2, sourceRef: 'server:auth:failure:1', source: 'server-minigame', detectedAtWorkdayIndex: 15 }),
    sig({ id: 'b', domain: 'identity-access', impact: 1, sourceRef: 'server:auth:failure:2', source: 'server-minigame', detectedAtWorkdayIndex: 15 }),
    sig({ id: 'c', domain: 'governance', impact: 2, sourceRef: 'audit:1:failed' }), // undetected -> hidden
  ]

  it('shows only domains with a detected signal, grouped, and hides factors without the specialist', () => {
    const withoutIlya = buildRiskObservations(signals, { revealDetailedFactors: false })
    expect(withoutIlya).toHaveLength(1)
    expect(withoutIlya[0].domain).toBe('identity-access')
    expect(withoutIlya[0].level).toBe('elevated') // 2 + 1 = 3
    expect(withoutIlya[0].factorLabels).toEqual([])
    expect(withoutIlya[0].detectedSignalIds).toEqual(['a', 'b'])
  })

  it('reveals factor labels with the specialist', () => {
    const withIlya = buildRiskObservations(signals, { revealDetailedFactors: true })
    expect(withIlya[0].factorLabels.length).toBeGreaterThan(0)
    expect(withIlya[0].factorLabels[0]).toContain('AUTH')
  })

  it('a domain mitigated back to controlled stays visible with the improved summary', () => {
    const mitigated = [
      sig({ id: 'a', domain: 'identity-access', impact: 3, detectedAtWorkdayIndex: 15 }),
      sig({ id: 'b', domain: 'identity-access', impact: -3, detectedAtWorkdayIndex: 18 }),
    ]
    const obs = buildRiskObservations(mitigated, { revealDetailedFactors: false })
    expect(obs).toHaveLength(1)
    expect(obs[0].level).toBe('controlled')
    expect(obs[0].summary).toContain('снизили')
  })

  it('unacknowledged detected count is correct', () => {
    const s = [
      sig({ id: 'a', domain: 'governance', impact: 2, detectedAtWorkdayIndex: 15 }),
      sig({ id: 'b', domain: 'governance', impact: 2, detectedAtWorkdayIndex: 15, acknowledgedAtWorkdayIndex: 16 }),
      sig({ id: 'c', domain: 'governance', impact: 2 }),
    ]
    expect(getUnacknowledgedDetectedCount(s)).toBe(1)
  })
})

describe('normalisation', () => {
  it('drops unknown domain/source, zero/fractional/NaN impact, and dedupes by id', () => {
    const result = normalizeRiskSignals([
      sig({ id: 'ok', domain: 'governance', impact: 2 }),
      sig({ id: 'ok', domain: 'governance', impact: 2 }), // duplicate id
      { id: 'bad-domain', domain: 'nope', impact: 1, source: 'security-audit', sourceRef: 'x', createdAt: { sprintNumber: 1, day: 1 }, createdAtWorkdayIndex: 1 },
      { id: 'zero', domain: 'governance', impact: 0, source: 'security-audit', sourceRef: 'x', createdAt: { sprintNumber: 1, day: 1 }, createdAtWorkdayIndex: 1 },
      { id: 'frac', domain: 'governance', impact: 1.5, source: 'security-audit', sourceRef: 'x', createdAt: { sprintNumber: 1, day: 1 }, createdAtWorkdayIndex: 1 },
      { id: 'nan', domain: 'governance', impact: NaN, source: 'security-audit', sourceRef: 'x', createdAt: { sprintNumber: 1, day: 1 }, createdAtWorkdayIndex: 1 },
      'garbage',
    ])
    expect(result.map((s) => s.id)).toEqual(['ok'])
  })

  it('detected before created is cleared; ack without detected is cleared', () => {
    const result = normalizeRiskSignals([
      sig({ id: 'a', domain: 'governance', impact: 2, createdAtWorkdayIndex: 12, detectedAtWorkdayIndex: 10 }), // detected < created
      sig({ id: 'b', domain: 'governance', impact: 2, createdAtWorkdayIndex: 12, acknowledgedAtWorkdayIndex: 20 }), // ack without detected
    ])
    expect(result.find((s) => s.id === 'a')!.detectedAtWorkdayIndex).toBeUndefined()
    expect(result.find((s) => s.id === 'b')!.acknowledgedAtWorkdayIndex).toBeUndefined()
  })
})
