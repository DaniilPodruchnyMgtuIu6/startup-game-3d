import { useRiskStore } from './riskStore'
import { serverFailureSignals, serverStabilizedSignals } from './riskSignals'
import { riskMomentNow } from './riskContext'
import type { ServerRole } from './serverIncidentsStore'

// Bridges the (in-memory) server mini-game results to the risk store without
// touching the incident history or the mini-games (Feature 09 §12). The failure
// number is derived from how many failure signals already exist for the rack, so
// it is robust across reloads and idempotent (addSignalsOnce dedupes by id).

function existingFailureCount(role: ServerRole): number {
  const prefix = `server:${role}:failure:`
  return useRiskStore.getState().signals.filter((s) => s.id.startsWith(prefix)).length
}

// Call after a failed mini-game attempt is saved. Only the first two failures of
// each rack add a risk point.
export function recordServerFailureRisk(role: ServerRole): void {
  const failureNumber = existingFailureCount(role) + 1
  const signals = serverFailureSignals(role, failureNumber, riskMomentNow())
  if (signals.length > 0) useRiskStore.getState().addSignalsOnce(signals)
}

// Call after a rack is first successfully stabilised. The mitigation signal is
// created once (idempotent by id).
export function recordServerStabilizedRisk(role: ServerRole): void {
  const signals = serverStabilizedSignals(role, riskMomentNow())
  if (signals.length > 0) useRiskStore.getState().addSignalsOnce(signals)
}
