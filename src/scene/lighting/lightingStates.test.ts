import { describe, it, expect } from 'vitest'
import { LIGHTING_PRESETS, resolveLightingState, type LightingStateName } from './lightingStates'

const BASE = { outcomeStatus: 'playing', anyRackDown: false, intrusionActive: false, auditBlocking: false, sprintDay: 4 }

describe('lighting states (18E §6)', () => {
  it('defines a preset for every state, all faces stay readable (no black rooms)', () => {
    const names: LightingStateName[] = [
      'normal-workday', 'morning', 'evening', 'security-alert', 'server-incident', 'audit', 'success', 'failure',
    ]
    expect(Object.keys(LIGHTING_PRESETS).sort()).toEqual([...names].sort())
    for (const name of names) {
      const p = LIGHTING_PRESETS[name]
      expect(p.ambientIntensity, name).toBeGreaterThanOrEqual(0.2)
      expect(p.keyIntensity, name).toBeGreaterThanOrEqual(0.9)
      expect(p.keyIntensity, name).toBeLessThanOrEqual(2) // нет пересвета
      expect(p.envIntensity, name).toBeGreaterThan(0.3)
    }
  })

  it('resolves the plain day: morning on day 1, evening on day 10, workday between', () => {
    expect(resolveLightingState({ ...BASE, sprintDay: 1 })).toBe('morning')
    expect(resolveLightingState({ ...BASE, sprintDay: 5 })).toBe('normal-workday')
    expect(resolveLightingState({ ...BASE, sprintDay: 10 })).toBe('evening')
  })

  it('threat states override the day tint by priority', () => {
    expect(resolveLightingState({ ...BASE, auditBlocking: true })).toBe('audit')
    expect(resolveLightingState({ ...BASE, auditBlocking: true, intrusionActive: true })).toBe('security-alert')
    expect(resolveLightingState({ ...BASE, intrusionActive: true, anyRackDown: true })).toBe('server-incident')
  })

  it('terminal outcomes own the room over everything else', () => {
    expect(resolveLightingState({ ...BASE, outcomeStatus: 'failed', anyRackDown: true })).toBe('failure')
    expect(resolveLightingState({ ...BASE, outcomeStatus: 'failure-pending' })).toBe('failure')
    expect(resolveLightingState({ ...BASE, outcomeStatus: 'succeeded', intrusionActive: true })).toBe('success')
  })
})
