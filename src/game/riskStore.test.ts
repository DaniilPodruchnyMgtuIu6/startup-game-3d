import { describe, it, expect, beforeEach } from 'vitest'
import { useRiskStore, loadRisk, saveRisk } from './riskStore'
import { getActualRiskScore, getDetectedRiskScore, getUnacknowledgedDetectedCount, type RiskSignal } from './riskRules'

const sig = (over: Partial<RiskSignal> & { id: string; impact: number }): RiskSignal => ({
  domain: 'governance',
  source: 'security-audit',
  sourceRef: 'x',
  createdAt: { sprintNumber: 2, day: 2 },
  createdAtWorkdayIndex: 12,
  ...over,
})

const risk = () => useRiskStore.getState()
const KEY = 'startup-office-risk'

function fakeStorage(init: Record<string, string> = {}) {
  const data = new Map(Object.entries(init))
  return {
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => void data.set(k, v),
    removeItem: (k: string) => void data.delete(k),
  }
}

beforeEach(() => {
  useRiskStore.setState({ signals: [] })
  window.localStorage.clear()
})

describe('addSignalsOnce', () => {
  it('adds new signals and never re-adds an existing id', () => {
    expect(risk().addSignalsOnce([sig({ id: 'a', impact: 2 })]).added).toHaveLength(1)
    const second = risk().addSignalsOnce([sig({ id: 'a', impact: 99 })]) // same id
    expect(second.added).toEqual([])
    expect(risk().signals).toHaveLength(1)
    expect(risk().signals[0].impact).toBe(2) // not overwritten
  })

  it('dedupes ids within the incoming batch', () => {
    risk().addSignalsOnce([sig({ id: 'a', impact: 2 }), sig({ id: 'a', impact: 2 })])
    expect(risk().signals).toHaveLength(1)
  })

  it('mitigation reduces the score; history is never removed', () => {
    risk().addSignalsOnce([sig({ id: 'a', domain: 'identity-access', impact: 3 })])
    risk().addSignalsOnce([sig({ id: 'b', domain: 'identity-access', impact: -3 })])
    expect(getActualRiskScore(risk().signals, 'identity-access')).toBe(0)
    expect(risk().signals).toHaveLength(2) // both kept
  })
})

describe('detectDueSignals', () => {
  it('detects a signal only once its delay elapses, writes detectedAt once', () => {
    risk().addSignalsOnce([sig({ id: 'a', impact: 2, createdAtWorkdayIndex: 12 })])
    expect(risk().detectDueSignals(14, false).detected).toEqual([]) // 12 + 3 = 15
    expect(getDetectedRiskScore(risk().signals, 'governance')).toBe(0)

    const detected = risk().detectDueSignals(15, false).detected
    expect(detected).toHaveLength(1)
    expect(risk().signals[0].detectedAtWorkdayIndex).toBe(15)
    expect(getDetectedRiskScore(risk().signals, 'governance')).toBe(2)

    // a second detection call does not move detectedAt
    risk().detectDueSignals(20, false)
    expect(risk().signals[0].detectedAtWorkdayIndex).toBe(15)
  })

  it('a late Ilya hire speeds up detection of an existing signal', () => {
    risk().addSignalsOnce([sig({ id: 'a', impact: 2, createdAtWorkdayIndex: 12 })])
    // day 13: without Ilya not due (needs 15); with Ilya due (12 + 1)
    expect(risk().detectDueSignals(13, false).detected).toEqual([])
    expect(risk().detectDueSignals(13, true).detected).toHaveLength(1)
  })

  it('an immediate (override 0) signal detects on the same day', () => {
    risk().addSignalsOnce([sig({ id: 'a', impact: 4, createdAtWorkdayIndex: 21, detectionDelayOverride: 0 })])
    expect(risk().detectDueSignals(21, false).detected).toHaveLength(1)
  })
})

describe('acknowledgement', () => {
  it('acknowledges detected signals without changing the score, and the badge count', () => {
    risk().addSignalsOnce([sig({ id: 'a', impact: 2, createdAtWorkdayIndex: 12 }), sig({ id: 'b', impact: 2, createdAtWorkdayIndex: 12 })])
    risk().detectDueSignals(15, false)
    expect(getUnacknowledgedDetectedCount(risk().signals)).toBe(2)
    risk().acknowledgeDetectedSignals(16)
    expect(getUnacknowledgedDetectedCount(risk().signals)).toBe(0)
    expect(getDetectedRiskScore(risk().signals, 'governance')).toBe(4) // unchanged
  })
})

describe('persistence & reset', () => {
  it('round-trips through storage', () => {
    const signals = [sig({ id: 'a', impact: 2, detectedAtWorkdayIndex: 15 })]
    saveRisk(window.localStorage, signals)
    expect(loadRisk(window.localStorage, '')).toEqual(signals)
  })

  it('?intro wipes signals', () => {
    const storage = fakeStorage({ [KEY]: JSON.stringify({ signals: [sig({ id: 'a', impact: 2 })] }) })
    expect(loadRisk(storage, '?intro')).toEqual([])
  })

  it('reset clears the store', () => {
    risk().addSignalsOnce([sig({ id: 'a', impact: 2 })])
    risk().resetRisks()
    expect(risk().signals).toEqual([])
  })
})
