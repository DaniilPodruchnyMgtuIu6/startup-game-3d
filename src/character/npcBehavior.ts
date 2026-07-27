import type { TriggerTarget } from '../interaction/triggerPayload'
import type { Point } from './navigation'

// Pure activity planning for NPC office life. All randomness comes in via the
// injected rng, so the logic stays deterministic and unit-testable.

// 'security-round' is a role-specific visual patrol (Feature 07). Like 'wander'
// it carries no context target - its destination is chosen by the security
// specialist's own planner from a fixed set of patrol points.
//
// 'ping-pong' and 'pull-up-bar' are 18H Wave 3 ambient activities (§13/§14).
// They exist here as data (kind, stay range, target pool) so the planner
// stays a single source of truth, but neither is in AMBIENT_WEIGHTS yet - see
// that constant's comment for why activation is deliberately held back.
export type ActivityKind = 'work' | 'coffee' | 'sofa' | 'meeting' | 'wander' | 'security-round' | 'ping-pong' | 'pull-up-bar'

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
  // 18H Wave 3: optional so the existing Npcs.tsx call site needs no change
  // while ping-pong/pull-up-bar stay unactivated (see AMBIENT_WEIGHTS).
  // Missing/empty is safe - planNextActivity treats "no free target of this
  // kind" as a fallback to 'wander', same as any other activity today.
  pingPongTables?: TriggerTarget[]
  pullUpBars?: TriggerTarget[]
  previousKind?: ActivityKind
  previousTargetKey?: string
}

// Decision maker signature for NPC brains. The default implementation is
// planNextActivity below; AI-driven brains (DeepSeek agents prompted with a
// character's persona) implement the same contract and may be asynchronous.
export type ActivityPlanner = (rng: () => number, ctx: ActivityContext) => ActivityPlan | Promise<ActivityPlan>

export type ActivityWeights = Array<[ActivityKind, number]>

// Work dominates - it is an office - with breaks sprinkled in. 'pull-up-bar'
// joined 18H Wave 3 once its clip existed and its hand grip was verified
// against the real bar (tools/art/liftClipToHandHeight.mjs,
// ambientClipFurnitureAlignment.test.ts) - a small weight, it is a break, not
// the default.
const WEIGHTS: ActivityWeights = [
  ['work', 0.47],
  ['coffee', 0.15],
  ['meeting', 0.12],
  ['sofa', 0.11],
  ['pull-up-bar', 0.05],
  ['wander', 0.1],
]

// A developer with an unfinished sprint task strongly favours work (0.70), the
// rest of the activities sharing 0.30. Feature 04 wires this in for hired devs.
export const WORK_BIASED_WEIGHTS: ActivityWeights = [
  ['work', 0.7],
  ['coffee', 0.09],
  ['meeting', 0.07],
  ['sofa', 0.06],
  ['pull-up-bar', 0.03],
  ['wander', 0.05],
]

// 18H §16 shortActivityDurationSeconds [8,20] for pull-ups (a short burst);
// ping-pong runs a little longer to fit AMBIENT_OFFICE_BALANCE.pingPongMaxRallies.
const STAY_RANGES_MS: Record<ActivityKind, [number, number]> = {
  work: [20000, 45000],
  coffee: [8000, 15000],
  meeting: [10000, 22000],
  sofa: [12000, 28000],
  wander: [3000, 8000],
  'security-round': [8000, 16000],
  'ping-pong': [15000, 30000],
  'pull-up-bar': [8000, 18000],
}

// 18H Wave 3: the weights ping-pong would ALSO use once it has real motion.
// pull-up-bar already graduated into WEIGHTS/WORK_BIASED_WEIGHTS above (real
// clip, hand grip verified against the bar). ping-pong still silently plays
// 'idle' (CharacterModel.tsx's CLIP_FALLBACKS - honest-but-invisible, not
// "broken") because no catalog action fit a paddle swing convincingly (see
// docs/art/higgsfield-ambient-motion-prompts.md) - it needs the procedural
// arm-swing + paddle-prop pass before it can join the live picker the same way.
export const AMBIENT_WEIGHTS: ActivityWeights = [
  ['work', 0.44],
  ['coffee', 0.13],
  ['meeting', 0.11],
  ['sofa', 0.1],
  ['ping-pong', 0.08],
  ['pull-up-bar', 0.05],
  ['wander', 0.09],
]

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
  const candidates: Record<Exclude<ActivityKind, 'wander' | 'security-round'>, TriggerTarget[]> = {
    work: ctx.workstations,
    coffee: ctx.coffeeMachines,
    sofa: ctx.sofas,
    meeting: ctx.seats,
    'ping-pong': ctx.pingPongTables ?? [],
    'pull-up-bar': ctx.pullUpBars ?? [],
  }
  // wander and security-round have no context target; security-round's patrol
  // destination is supplied by the specialist's own planner wrapper.
  if (kind === 'wander' || kind === 'security-round') return { kind, stayMs: stayFor(rng, kind) }
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
