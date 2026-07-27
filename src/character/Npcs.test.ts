import { describe, it, expect, beforeEach, vi } from 'vitest'
import { renderHook } from '@testing-library/react'
import { ambientGate, useNpcBrain, npcActivityPools } from './Npcs'
import { createAmbientHistory, recordActivityStart, wasJustDone } from './ambientActivityHistory'
import { createRng } from './npcBehavior'
import { AMBIENT_OFFICE_BALANCE } from '../game/balance'
import { useCharacterStore } from './characterStore'
import { useGameStore } from '../game/gameStore'
import { registerInteraction, targetKey } from '../interaction/interactionRegistry'
import type { ActivityPlan, ActivityPlanner } from './npcBehavior'

const PULL_UP: ActivityPlan = { kind: 'pull-up-bar', stayMs: 9000 }
const WORK: ActivityPlan = { kind: 'work', stayMs: 30000 }

describe('npcActivityPools: the CEO chair stays player-only (Feature 16 §7 / 18H §22.16)', () => {
  it('a registered exec-seat never appears in any pool an NPC brain samples from', () => {
    const execSeat = { point: [9.9, 0, 9.9] as [number, number, number], facing: 0 }
    const unregister = registerInteraction('exec-seat', execSeat)
    try {
      const pools = npcActivityPools('npc-female-pm')
      const sampled = Object.values(pools).flat()
      expect(sampled.some((target) => targetKey(target) === targetKey(execSeat))).toBe(false)
    } finally {
      unregister()
    }
  })
})

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

// A planner stub that ignores context and always returns the same plan -
// removes WEIGHTS randomness so the walk-then-perform-then-replan cycle is
// exercised deterministically (18H AO-03/AO-04 style integration coverage).
const alwaysPullUpAt = (point: [number, number, number]): ActivityPlanner => () => ({
  kind: 'pull-up-bar',
  target: { point, facing: 0 },
  stayMs: 5000,
})

describe('useNpcBrain: walk-then-perform ambient cycle (18H)', () => {
  const NPC = 'npc-integration-test'
  const SPOT: [number, number, number] = [1, 0, 1]

  beforeEach(() => {
    useCharacterStore.setState({ characters: {}, sceneOwned: new Set() })
    useGameStore.setState({ phase: 'free' })
  })

  it('walks to the target, holds while performing, then ends itself and re-plans', async () => {
    vi.useFakeTimers()
    try {
      useCharacterStore.getState().spawnCharacter(NPC, SPOT, 0)
      renderHook(() => useNpcBrain(NPC, alwaysPullUpAt(SPOT)))

      await vi.advanceTimersByTimeAsync(4100) // initial decision delay, max ~4000ms
      expect(useCharacterStore.getState().characters[NPC].state.kind).toBe('walking')

      useCharacterStore.getState().dispatchTo(NPC, { type: 'WAYPOINT_REACHED' })
      expect(useCharacterStore.getState().characters[NPC].state.kind).toBe('performing')

      await vi.advanceTimersByTimeAsync(5100) // the fixed stayMs hold
      expect(useCharacterStore.getState().characters[NPC].state.kind).toBe('idle')
    } finally {
      vi.useRealTimers()
    }
  })

  it('a scene claiming the NPC mid-hold cancels the pending PERFORM_END (18H AO-04)', async () => {
    vi.useFakeTimers()
    try {
      useCharacterStore.getState().spawnCharacter(NPC, SPOT, 0)
      renderHook(() => useNpcBrain(NPC, alwaysPullUpAt(SPOT)))
      await vi.advanceTimersByTimeAsync(4100)
      useCharacterStore.getState().dispatchTo(NPC, { type: 'WAYPOINT_REACHED' })
      expect(useCharacterStore.getState().characters[NPC].state.kind).toBe('performing')

      // a mandatory scene claims this NPC mid-activity
      useCharacterStore.getState().setSceneOwned(new Set([NPC]))
      await vi.advanceTimersByTimeAsync(10_000) // well past the 5000ms stayMs
      expect(useCharacterStore.getState().characters[NPC].state.kind).toBe('performing')
    } finally {
      vi.useRealTimers()
    }
  })

  it('cooldown gating prevents an immediate repeat of the same ambient pick', async () => {
    vi.useFakeTimers()
    try {
      useCharacterStore.getState().spawnCharacter(NPC, SPOT, 0)
      renderHook(() => useNpcBrain(NPC, alwaysPullUpAt(SPOT)))
      await vi.advanceTimersByTimeAsync(4100)
      useCharacterStore.getState().dispatchTo(NPC, { type: 'WAYPOINT_REACHED' })
      expect(useCharacterStore.getState().characters[NPC].state.kind).toBe('performing')
      await vi.advanceTimersByTimeAsync(5100)
      expect(useCharacterStore.getState().characters[NPC].state.kind).toBe('idle')

      // the planner would pick pull-up-bar again immediately - ambientGate
      // must reject the repeat and send the NPC wandering instead
      await vi.advanceTimersByTimeAsync(9000) // past wander's own stay range
      expect(useCharacterStore.getState().characters[NPC].state.kind).not.toBe('performing')
    } finally {
      vi.useRealTimers()
    }
  })
})

// 18H AO-05 (soak): a deterministic scenario simulator over the PURE logic
// layer (ambientGate + ambientActivityHistory), not a real render loop -
// mirrors this project's established balance-testing approach (Feature 15:
// "детерминированный сценарный симулятор"). Exercises hundreds of decision
// cycles across many simulated workdays and asserts the invariants a real
// multi-day soak must never violate: the daily cap is never exceeded, the
// same ambient activity never fires twice in a row, and recent-history
// bookkeeping stays bounded (no unbounded growth over a long session).
describe('ambient activity soak (18H AO-05, deterministic simulation)', () => {
  const AMBIENT_KINDS = ['pull-up-bar', 'window-look', 'whiteboard-glance', 'phone-check'] as const

  it('never exceeds the daily cap, never repeats back-to-back, history stays bounded over 40 workdays', () => {
    const rng = createRng(20260727)
    let history = createAmbientHistory('npc-soak')
    const BEATS_PER_WORKDAY = 8
    const WORKDAYS = 40

    for (let day = 0; day < WORKDAYS; day++) {
      const workdayId = `sprint-1-day-${day}`
      let completedThisDay = 0
      for (let beatInDay = 0; beatInDay < BEATS_PER_WORKDAY; beatInDay++) {
        const beat = day * BEATS_PER_WORKDAY + beatInDay
        const proposedKind = AMBIENT_KINDS[Math.floor(rng() * AMBIENT_KINDS.length)]
        const proposed: ActivityPlan = { kind: proposedKind, stayMs: 8000 }
        const plan = ambientGate(proposed, history, beat)

        if (plan === proposed) {
          expect(wasJustDone(history, proposedKind), `day ${day} beat ${beatInDay}: immediate repeat`).toBe(false)
          history = recordActivityStart(history, proposedKind, beat, AMBIENT_OFFICE_BALANCE.activityCooldownBeats, workdayId)
          completedThisDay += 1
          expect(
            completedThisDay,
            `day ${day}: exceeded maxActivitiesPerNpcPerWorkday`,
          ).toBeLessThanOrEqual(AMBIENT_OFFICE_BALANCE.maxActivitiesPerNpcPerWorkday)
        }
        // recent-history bookkeeping never grows past its own fixed cap,
        // however many thousands of beats have elapsed
        expect(history.recentActivityIds.length).toBeLessThanOrEqual(5)
        expect(Object.keys(history.cooldowns).length).toBeLessThanOrEqual(AMBIENT_KINDS.length)
      }
      expect(history.completedToday).toBeLessThanOrEqual(AMBIENT_OFFICE_BALANCE.maxActivitiesPerNpcPerWorkday)
    }
  })
})
