// 18H: the shared rally rhythm. The ball and BOTH players' swings derive
// their phase from the same absolute clock, so a strike always lands exactly
// when the ball reaches that player - no per-component timers to drift apart.
// Pure math over the r3f clock's elapsed seconds; unit-testable.

export const RALLY_CROSSING_S = 1.05 // one table crossing - unhurried office rally
const CYCLE_S = RALLY_CROSSING_S * 2 // there and back

// Where the ball is: which participant it is flying FROM (0|1) and how far
// along that crossing it is (0..1).
export function rallyCrossing(tAbs: number): { from: 0 | 1; along: number } {
  const cycle = ((tAbs % CYCLE_S) + CYCLE_S) % CYCLE_S
  return cycle < RALLY_CROSSING_S
    ? { from: 0, along: cycle / RALLY_CROSSING_S }
    : { from: 1, along: (cycle - RALLY_CROSSING_S) / RALLY_CROSSING_S }
}

// Signed distance (in cycle fractions, -0.5..0.5) from participant `side`'s
// strike moment - side 0 strikes at cycle phase 0, side 1 at phase 0.5.
function strikeDelta(tAbs: number, side: 0 | 1): number {
  const cycle = (((tAbs % CYCLE_S) + CYCLE_S) % CYCLE_S) / CYCLE_S
  let delta = cycle - (side === 0 ? 0 : 0.5)
  if (delta > 0.5) delta -= 1
  if (delta < -0.5) delta += 1
  return delta
}

const gauss = (x: number, sigma: number) => Math.exp(-(x * x) / (2 * sigma * sigma))

// Two-lobe swing envelope: WINDUP peaks shortly before the strike moment
// (arm draws back, torso coils), STRIKE peaks just after (arm drives
// through). Both 0..1; at most one is large at any time.
export function swingEnvelope(tAbs: number, side: 0 | 1): { windup: number; strike: number } {
  const delta = strikeDelta(tAbs, side)
  return {
    windup: gauss(delta + 0.1, 0.05),
    strike: gauss(delta - 0.04, 0.05),
  }
}
