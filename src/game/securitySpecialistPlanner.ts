import { planNextActivity, type ActivityPlanner, type ActivityWeights } from '../character/npcBehavior'
import type { Point } from '../character/navigation'

// Role-specific office life for the security specialist (Feature 07). He shares
// the ordinary office planner but with a noticeable `security-round` patrol.
// The round is purely visual: it walks him to one of a few fixed points (server
// room / open space / meeting room) and back. It never opens a mini-game,
// repairs a rack, changes incidents or touches numeric risk.

// Fixed patrol points. All are clamped to the navmesh by the NPC brain
// (nearestWalkable), so they only need to be roughly inside each area.
export const SECURITY_PATROL_POINTS: readonly Point[] = [
  [-8.5, 0, 6.3], // server room, in front of the racks
  [-7, 0, 4.6], // server room doorway / just inside
  [0, 0, 2], // open space, by the workstation rows
  [-8, 0, -3.5], // meeting room
]

// Work still dominates a little, but the security round is deliberately frequent
// so the patrol is easy to notice during manual play. Uses the shared weight
// normalisation in npcBehavior.
export const SECURITY_WEIGHTS: ActivityWeights = [
  ['work', 0.3],
  ['security-round', 0.3],
  ['coffee', 0.12],
  ['meeting', 0.1],
  ['sofa', 0.08],
  ['wander', 0.1],
]

// One stable planner per employee id (referential stability keeps the NPC brain
// effect from re-subscribing every render), mirroring developerPlanActivity.
const cache = new Map<string, ActivityPlanner>()

export function securitySpecialistPlanActivity(employeeId: string): ActivityPlanner {
  let planner = cache.get(employeeId)
  if (!planner) {
    planner = (rng, ctx) => {
      const plan = planNextActivity(rng, ctx, SECURITY_WEIGHTS)
      if (plan.kind !== 'security-round') return plan
      // choose a patrol destination; the round carries a floor target the brain
      // walks to (no seat/claim), then idles there for the plan's stay duration.
      const point = SECURITY_PATROL_POINTS[Math.floor(rng() * SECURITY_PATROL_POINTS.length) % SECURITY_PATROL_POINTS.length]
      return { ...plan, target: { point: [...point] as Point, facing: 0 } }
    }
    cache.set(employeeId, planner)
  }
  return planner
}
