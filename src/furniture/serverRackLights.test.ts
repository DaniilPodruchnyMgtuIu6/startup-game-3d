import { describe, it, expect } from 'vitest'
import { ledStatusFor, ledMaterialKeyFor, ledIntensityAt } from './serverRackLights'

describe('ledStatusFor', () => {
  it('is deterministic for the same seed and unit', () => {
    for (let seed = 0; seed < 4; seed++) {
      for (let unit = 0; unit < 8; unit++) {
        expect(ledStatusFor(seed, unit)).toBe(ledStatusFor(seed, unit))
      }
    }
  })

  it('produces a mix dominated by healthy units, with warnings and at least one error across racks', () => {
    const statuses = []
    for (let seed = 0; seed < 4; seed++) {
      for (let unit = 0; unit < 8; unit++) statuses.push(ledStatusFor(seed, unit))
    }
    const ok = statuses.filter((s) => s === 'ok').length
    const warn = statuses.filter((s) => s === 'warn').length
    const error = statuses.filter((s) => s === 'error').length
    expect(ok).toBeGreaterThan(warn)
    expect(warn).toBeGreaterThan(0)
    expect(error).toBeGreaterThan(0)
  })
})

describe('ledMaterialKeyFor', () => {
  it('maps each status to its LED material', () => {
    expect(ledMaterialKeyFor('ok')).toBe('ledGreen')
    expect(ledMaterialKeyFor('warn')).toBe('ledAmber')
    expect(ledMaterialKeyFor('error')).toBe('ledRed')
  })
})

describe('ledIntensityAt', () => {
  it('actually blinks: intensity changes over time for every status', () => {
    for (const status of ['ok', 'warn', 'error'] as const) {
      const values = new Set()
      for (let t = 0; t < 4; t += 0.05) values.add(ledIntensityAt(status, 0, t))
      expect(values.size).toBeGreaterThan(1)
    }
  })

  it('error LEDs toggle more often than healthy ones', () => {
    const toggles = (status: 'ok' | 'error') => {
      let count = 0
      let prev = ledIntensityAt(status, 0, 0)
      for (let t = 0.05; t < 6; t += 0.05) {
        const v = ledIntensityAt(status, 0, t)
        if (v !== prev) count++
        prev = v
      }
      return count
    }
    expect(toggles('error')).toBeGreaterThan(toggles('ok'))
  })

  it('stays within the base intensity range', () => {
    for (let t = 0; t < 3; t += 0.1) {
      const v = ledIntensityAt('error', 3, t)
      expect(v).toBeGreaterThan(0)
      expect(v).toBeLessThanOrEqual(3)
    }
  })
})
