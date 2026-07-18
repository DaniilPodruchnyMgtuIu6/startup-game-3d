import type { TriggerTarget } from '../interaction/triggerPayload'
import type { Point } from './navigation'

// Pure activity planning for NPC office life. All randomness comes in via the
// injected rng, so the logic stays deterministic and unit-testable.

export type ActivityKind = 'work' | 'coffee' | 'sofa' | 'meeting' | 'wander'

export interface ActivityPlan {
  kind: ActivityKind
  target?: TriggerTarget
  // how long to stay in the activity once settled, before picking the next one
  stayMs: number
}

export interface ActivityContext {
  workstations: TriggerTarget[]
  coffeeMachines: TriggerTarget[]
  sofas: TriggerTarget[]
  seats: TriggerTarget[]
  previousKind?: ActivityKind
  previousTargetKey?: string
}

// Decision maker signature for NPC brains. The default implementation is
// planNextActivity below; AI-driven brains (DeepSeek agents prompted with a
// character's persona) implement the same contract and may be asynchronous.
export type ActivityPlanner = (rng: () => number, ctx: ActivityContext) => ActivityPlan | Promise<ActivityPlan>

export type ActivityWeights = Array<[ActivityKind, number]>

// Work dominates - it is an office - with breaks sprinkled in.
const WEIGHTS: ActivityWeights = [
  ['work', 0.5],
  ['coffee', 0.15],
  ['meeting', 0.13],
  ['sofa', 0.12],
  ['wander', 0.1],
]

// A developer with an unfinished sprint task strongly favours work (0.70), the
// rest of the activities sharing 0.30. Feature 04 wires this in for hired devs.
export const WORK_BIASED_WEIGHTS: ActivityWeights = [
  ['work', 0.7],
  ['coffee', 0.1],
  ['meeting', 0.08],
  ['sofa', 0.07],
  ['wander', 0.05],
]

const STAY_RANGES_MS: Record<ActivityKind, [number, number]> = {
  work: [20000, 45000],
  coffee: [8000, 15000],
  meeting: [10000, 22000],
  sofa: [12000, 28000],
  wander: [3000, 8000],
}

function key(target: TriggerTarget): string {
  return `${target.point[0].toFixed(2)}|${target.point[2].toFixed(2)}`
}

function pickKind(rng: () => number, previousKind?: ActivityKind, weights: ActivityWeights = WEIGHTS): ActivityKind {
  const roll = () => {
    let r = rng()
    for (const [kind, weight] of weights) {
      r -= weight
      if (r < 0) return kind
    }
    return 'work'
  }
  const kind = roll()
  // breaks should not repeat back-to-back - re-roll once, then default to work
  if (kind !== 'work' && kind === previousKind) {
    const second = roll()
    return second === previousKind ? 'work' : second
  }
  return kind
}

function pickTarget(rng: () => number, candidates: TriggerTarget[], previousTargetKey?: string): TriggerTarget | undefined {
  const fresh = candidates.filter((c) => key(c) !== previousTargetKey)
  const pool = fresh.length > 0 ? fresh : candidates
  if (pool.length === 0) return undefined
  return pool[Math.min(pool.length - 1, Math.floor(rng() * pool.length))]
}

function stayFor(rng: () => number, kind: ActivityKind): number {
  const [min, max] = STAY_RANGES_MS[kind]
  return Math.round(min + rng() * (max - min))
}

export function planNextActivity(
  rng: () => number,
  ctx: ActivityContext,
  weights: ActivityWeights = WEIGHTS,
): ActivityPlan {
  const kind = pickKind(rng, ctx.previousKind, weights)
  const candidates: Record<Exclude<ActivityKind, 'wander'>, TriggerTarget[]> = {
    work: ctx.workstations,
    coffee: ctx.coffeeMachines,
    sofa: ctx.sofas,
    meeting: ctx.seats,
  }
  if (kind === 'wander') return { kind, stayMs: stayFor(rng, kind) }
  const target = pickTarget(rng, candidates[kind], ctx.previousTargetKey)
  // everything of that kind is taken - stretch legs instead of idling in place
  if (!target) return { kind: 'wander', stayMs: stayFor(rng, 'wander') }
  return { kind, target, stayMs: stayFor(rng, kind) }
}

// Random stroll destination inside the open space, biased away from the walls.
export function wanderPoint(rng: () => number): Point {
  return [-5 + rng() * 10, 0, -6.5 + rng() * 13]
}

// Small deterministic PRNG so NPC behavior can be seeded per character.
export function createRng(seed: number): () => number {
  let t = seed >>> 0
  return () => {
    t += 0x6d2b79f5
    let r = Math.imul(t ^ (t >>> 15), 1 | t)
    r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296
  }
}
