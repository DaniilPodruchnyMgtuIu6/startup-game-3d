import { describe, it, expect } from 'vitest'
import { ambientGate } from './Npcs'
import { createAmbientHistory, recordActivityStart } from './ambientActivityHistory'
import { AMBIENT_OFFICE_BALANCE } from '../game/balance'
import type { ActivityPlan } from './npcBehavior'

const PULL_UP: ActivityPlan = { kind: 'pull-up-bar', stayMs: 9000 }
const WORK: ActivityPlan = { kind: 'work', stayMs: 30000 }

describe('ambientGate (18H §15/§16)', () => {
  it('passes core activities through untouched, even with an exhausted history', () => {
    let history = createAmbientHistory('npc-a')
    for (let i = 0; i < 5; i++) history = recordActivityStart(history, 'work', i, 1, 'workday-1')
    expect(ambientGate(WORK, history, 10)).toBe(WORK)
  })

  it('passes an ambient pick through when nothing blocks it', () => {
    const history = createAmbientHistory('npc-a')
    expect(ambientGate(PULL_UP, history, 0)).toBe(PULL_UP)
  })

  it('falls back to wander while the picked kind is on cooldown', () => {
    let history = createAmbientHistory('npc-a')
    history = recordActivityStart(history, 'pull-up-bar', 0, 5, 'workday-1')
    const gated = ambientGate(PULL_UP, history, 3)
    expect(gated.kind).toBe('wander')
    expect(gated.stayMs).toBe(PULL_UP.stayMs)
  })

  it('falls back to wander for an immediate repeat, even past its own cooldown', () => {
    let history = createAmbientHistory('npc-a')
    history = recordActivityStart(history, 'pull-up-bar', 0, 1, 'workday-1')
    expect(ambientGate(PULL_UP, history, 5).kind).toBe('wander')
  })

  it('falls back to wander once the daily ambient-activity cap is reached', () => {
    let history = createAmbientHistory('npc-a')
    for (let i = 0; i < AMBIENT_OFFICE_BALANCE.maxActivitiesPerNpcPerWorkday; i++) {
      history = recordActivityStart(history, `activity-${i}`, i * 10, 1, 'workday-1')
    }
    const gated = ambientGate(PULL_UP, history, 999)
    expect(gated.kind).toBe('wander')
  })
})
