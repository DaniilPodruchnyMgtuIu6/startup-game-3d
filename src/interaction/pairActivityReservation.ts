// 18H §17: atomic two-participant reservation for paired ambient activities
// (ping-pong today). Deliberately thin - it reuses the existing single-owner
// claim registry (one claim per target) rather than inventing a parallel
// "pair" concept: a paired activity is just two ordinary claims taken (or
// refused) together, one per side.
import { isTargetFree, claimTarget, releaseClaims } from './interactionRegistry'
import type { TriggerTarget } from './triggerPayload'

// Both sides are checked BEFORE either is claimed, so a failed reservation
// never leaves a lone half-claimed target behind. Synchronous end-to-end (no
// await between check and claim), so there is no interleaving window for a
// third caller to observe or exploit.
export function tryReservePairActivity(
  participantAId: string,
  participantBId: string,
  targetA: TriggerTarget,
  targetB: TriggerTarget,
): boolean {
  if (participantAId === participantBId) return false
  if (!isTargetFree(targetA, participantAId) || !isTargetFree(targetB, participantBId)) return false
  claimTarget(participantAId, targetA)
  claimTarget(participantBId, targetB)
  return true
}

export function releasePairActivity(participantAId: string, participantBId: string): void {
  releaseClaims(participantAId)
  releaseClaims(participantBId)
}
