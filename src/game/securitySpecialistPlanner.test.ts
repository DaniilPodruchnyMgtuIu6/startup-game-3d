import { describe, it, expect } from 'vitest'
import { securitySpecialistPlanActivity, SECURITY_PATROL_POINTS } from './securitySpecialistPlanner'
import { planNextActivity, createRng, type ActivityContext, type ActivityKind } from '../character/npcBehavior'

const target = (x: number, z: number) => ({ point: [x, 0, z] as [number, number, number], facing: 0 })

const ctx = (): ActivityContext => ({
  workstations: [target(1, 1), target(2, 2)],
  coffeeMachines: [target(3, 3)],
  sofas: [target(4, 4)],
  seats: [target(5, 5)],
})

const pointKey = (p: readonly number[]) => `${p[0]}|${p[1]}|${p[2]}`
const PATROL_KEYS = new Set(SECURITY_PATROL_POINTS.map(pointKey))

// Collect a batch of plans from one deterministic rng stream.
function collect(planner: ReturnType<typeof securitySpecialistPlanActivity>, n: number) {
  const rng = createRng(12345)
  const plans = []
  for (let i = 0; i < n; i++) plans.push(planner(rng, ctx()) as Awaited<ReturnType<typeof planner>>)
  return plans
}

describe('security specialist planner', () => {
  const planner = securitySpecialistPlanActivity('ilya-vlasov')
  const plans = collect(planner, 400)
  const kinds = new Set(plans.map((p) => p.kind))

  it('can choose ordinary work', () => {
    expect(kinds.has('work')).toBe(true)
  })

  it('produces a noticeable number of security rounds', () => {
    const rounds = plans.filter((p) => p.kind === 'security-round')
    expect(rounds.length).toBeGreaterThan(30) // ~30% weight over 400 rolls
  })

  it('every security round targets one of the fixed patrol points', () => {
    for (const p of plans) {
      if (p.kind !== 'security-round') continue
      expect(p.target).toBeDefined()
      expect(PATROL_KEYS.has(pointKey(p.target!.point))).toBe(true)
    }
  })

  it('returns a stable planner instance per employee id', () => {
    expect(securitySpecialistPlanActivity('ilya-vlasov')).toBe(planner)
  })
})

describe('ordinary NPC planner never patrols', () => {
  it('planNextActivity (default weights) never returns security-round', () => {
    const rng = createRng(999)
    const kinds = new Set<ActivityKind>()
    for (let i = 0; i < 400; i++) kinds.add(planNextActivity(rng, ctx()).kind)
    expect(kinds.has('security-round')).toBe(false)
  })
})
