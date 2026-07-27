import { describe, it, expect } from 'vitest'
import { planNextActivity, wanderPoint, createRng, type ActivityContext } from './npcBehavior'
import type { TriggerTarget } from '../interaction/triggerPayload'

const desk = (x: number): TriggerTarget => ({ point: [x, 0, 0], facing: 0 })

const baseCtx: ActivityContext = {
  workstations: [desk(1), desk(2), desk(3)],
  coffeeMachines: [desk(10)],
  sofas: [desk(20)],
  seats: [desk(30)],
  pullUpBars: [desk(40)],
}

// rng stub yielding a fixed sequence (repeats the last value when exhausted)
function seq(...values: number[]): () => number {
  let i = 0
  return () => values[Math.min(i++, values.length - 1)]
}

describe('planNextActivity', () => {
  it('is a working office: low rolls choose work at a desk', () => {
    const plan = planNextActivity(seq(0.1, 0.5, 0.5), baseCtx)
    expect(plan.kind).toBe('work')
    expect(plan.target).toBeDefined()
    expect(plan.stayMs).toBeGreaterThanOrEqual(20000)
    expect(plan.stayMs).toBeLessThanOrEqual(45000)
  })

  it('takes breaks: rolls in the coffee band choose the coffee machine', () => {
    const plan = planNextActivity(seq(0.55, 0.5, 0.5), baseCtx)
    expect(plan.kind).toBe('coffee')
    expect(plan.target?.point[0]).toBe(10)
  })

  it('does not repeat the same break twice in a row', () => {
    const plan = planNextActivity(seq(0.55, 0.55, 0.5, 0.5), { ...baseCtx, previousKind: 'coffee' })
    expect(plan.kind).toBe('work')
  })

  it('avoids picking the same desk twice in a row when others are free', () => {
    for (let r = 0; r < 1; r += 0.24) {
      const plan = planNextActivity(seq(0.1, r, 0.5), { ...baseCtx, previousTargetKey: '2.00|0.00' })
      expect(plan.target?.point[0]).not.toBe(2)
    }
  })

  it('picks the pull-up bar and its target in the live WEIGHTS band (18H Wave 3)', () => {
    // WEIGHTS bands: work[0,.47) coffee[.47,.62) meeting[.62,.74) sofa[.74,.85)
    // pull-up-bar[.85,.90) wander[.90,1) - .87 lands squarely on pull-up-bar.
    const plan = planNextActivity(seq(0.87, 0.5, 0.5), baseCtx)
    expect(plan.kind).toBe('pull-up-bar')
    expect(plan.target?.point[0]).toBe(40)
  })

  it('falls back to wandering when everything of the chosen kind is occupied', () => {
    const plan = planNextActivity(seq(0.1, 0.5, 0.5), { ...baseCtx, workstations: [] })
    expect(plan.kind).toBe('wander')
    expect(plan.target).toBeUndefined()
  })

  it('wander points stay inside the open space', () => {
    const rng = createRng(42)
    for (let i = 0; i < 50; i++) {
      const [x, , z] = wanderPoint(rng)
      expect(x).toBeGreaterThanOrEqual(-5)
      expect(x).toBeLessThanOrEqual(5)
      expect(z).toBeGreaterThanOrEqual(-6.5)
      expect(z).toBeLessThanOrEqual(6.5)
    }
  })

  it('createRng is deterministic per seed and covers [0,1)', () => {
    const a = createRng(7)
    const b = createRng(7)
    for (let i = 0; i < 20; i++) {
      const v = a()
      expect(v).toBe(b())
      expect(v).toBeGreaterThanOrEqual(0)
      expect(v).toBeLessThan(1)
    }
  })
})
