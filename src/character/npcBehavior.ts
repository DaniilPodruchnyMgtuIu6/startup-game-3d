import type { TriggerTarget } from '../interaction/triggerPayload'
import type { Point } from './navigation'

// Pure activity planning for NPC office life. All randomness comes in via the
// injected rng, so the logic stays deterministic and unit-testable.

// 'security-round' is a role-specific visual patrol (Feature 07). Like 'wander'
// it carries no context target - its destination is chosen by the security
// specialist's own planner from a fixed set of patrol points.
//
// 'pull-up-bar' is an 18H Wave 3 solo ambient activity (§14), picked here
// like any other. Its paired sibling, ping-pong, does NOT live here - a
// two-person activity doesn't fit a per-character solo picker, so it is its
// own small coordinator (pingPongMatchmaker.ts) that dispatches the same
// CLICK_PERFORM_ACTIVITY event directly, bypassing planNextActivity.
//
// 'window-look'/'whiteboard-glance' walk to one fixed spot each
// (ambientLookSpots.ts, resolved in Npcs.tsx like security-round's patrol
// point - not a context-provided pool). 'phone-check' walks to a random
// wanderPoint. All three carry no context target here, same as 'wander'.
export type ActivityKind =
  | 'work'
  | 'coffee'
  | 'sofa'
  | 'meeting'
  | 'wander'
  | 'security-round'
  | 'pull-up-bar'
  | 'window-look'
  | 'whiteboard-glance'
  | 'phone-check'

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
  // 18H Wave 3: optional so callers that predate pull-up-bar need no change.
  // Missing/empty is safe - planNextActivity treats "no free target of this
  // kind" as a fallback to 'wander', same as any other activity today.
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
  ['work', 0.44],
  ['coffee', 0.14],
  ['meeting', 0.11],
  ['sofa', 0.1],
  ['pull-up-bar', 0.05],
  ['window-look', 0.04],
  ['whiteboard-glance', 0.04],
  ['phone-check', 0.04],
  ['wander', 0.04],
]

// A developer with an unfinished sprint task strongly favours work (0.70), the
// rest of the activities sharing 0.30. Feature 04 wires this in for hired devs.
export const WORK_BIASED_WEIGHTS: ActivityWeights = [
  ['work', 0.7],
  ['coffee', 0.08],
  ['meeting', 0.06],
  ['sofa', 0.05],
  ['pull-up-bar', 0.03],
  ['window-look', 0.02],
  ['whiteboard-glance', 0.02],
  ['phone-check', 0.02],
  ['wander', 0.02],
]

// 18H §16 shortActivityDurationSeconds [8,20] for a pull-up burst or a phone
// check. window-look/whiteboard-glance use the SAME real 'look' clip (fixed
// ~4.75s, tools/art/characterIdentity.test.ts) - their stayMs is the
// lingering pause AFTER the glance, before the next decision, not the
// animation length itself (mirrors security-round's own look-around). Ping-
// pong's hold duration lives in AMBIENT_OFFICE_BALANCE.socialActivityDurationSeconds
// instead (pingPongMatchmaker.ts) - it is not picked through this table.
const STAY_RANGES_MS: Record<ActivityKind, [number, number]> = {
  work: [20000, 45000],
  coffee: [8000, 15000],
  meeting: [10000, 22000],
  sofa: [12000, 28000],
  wander: [3000, 8000],
  'security-round': [8000, 16000],
  'pull-up-bar': [8000, 18000],
  'window-look': [3000, 7000],
  'whiteboard-glance': [2000, 5000],
  'phone-check': [6000, 12000],
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

type NoTargetKind = 'wander' | 'security-round' | 'window-look' | 'whiteboard-glance' | 'phone-check'
const NO_TARGET_KIND_SET: ReadonlySet<string> = new Set<NoTargetKind>([
  'wander',
  'security-round',
  'window-look',
  'whiteboard-glance',
  'phone-check',
])
function isNoTargetKind(kind: ActivityKind): kind is NoTargetKind {
  return NO_TARGET_KIND_SET.has(kind)
}

export function planNextActivity(
  rng: () => number,
  ctx: ActivityContext,
  weights: ActivityWeights = WEIGHTS,
): ActivityPlan {
  const kind = pickKind(rng, ctx.previousKind, weights)
  const candidates: Record<Exclude<ActivityKind, NoTargetKind>, TriggerTarget[]> = {
    work: ctx.workstations,
    coffee: ctx.coffeeMachines,
    sofa: ctx.sofas,
    meeting: ctx.seats,
    'pull-up-bar': ctx.pullUpBars ?? [],
  }
  // No-target kinds resolve their actual destination elsewhere: wander picks
  // a random point right here, security-round's patrol point comes from the
  // specialist's own planner wrapper, and window-look/whiteboard-glance/
  // phone-check are resolved in Npcs.tsx (a fixed spot or a random point).
  if (isNoTargetKind(kind)) return { kind, stayMs: stayFor(rng, kind) }
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
