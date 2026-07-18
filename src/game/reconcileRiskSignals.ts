import { useSprintStore } from './sprintStore'
import { useTeamStore } from './teamStore'
import { useSecurityStoryStore } from './securityStoryStore'
import { useSecurityAuditStore } from './securityAuditStore'
import { useRiskStore } from './riskStore'
import { hasSecuritySpecialist } from './teamRules'
import { toWorkdayIndex } from './workdayIndex'
import { rebuildRiskSignalsFromGameState } from './riskSignals'

// Migration from an old Feature 08 save: rebuild the risk signals implied by
// facts already in the save (staffing decision, real Ilya hire, closed findings,
// audit records) and merge them idempotently. Server failures / overload are not
// reconstructed - server incidents are not persisted and overload has no history
// (spec §23). Safe to call once at startup: addSignalsOnce dedupes by id, so a
// continuing Feature 09 save is a no-op.
export function reconcileRiskSignals(): void {
  const story = useSecurityStoryStore.getState()
  // Nothing to reconstruct until the story has actually produced facts.
  if (story.postAuditConversation.status !== 'completed') return

  const sprint = useSprintStore.getState()
  const currentWorkdayIndex = toWorkdayIndex(sprint.sprintNumber, sprint.day)
  const audit = useSecurityAuditStore.getState()

  const closedFindings = audit.findings
    .filter((f) => f.status === 'closed')
    .map((f) => ({
      findingId: f.findingId,
      closedAt: f.closedAt ? { ...f.closedAt, workdayIndex: toWorkdayIndex(f.closedAt.sprintNumber, f.closedAt.day) } : undefined,
    }))

  const auditRecords = audit.followUpAudit.records.map((r) => ({
    auditNumber: r.auditNumber,
    passed: r.result === 'passed',
    evaluatedAt: { ...r.evaluatedAt, workdayIndex: toWorkdayIndex(r.evaluatedAt.sprintNumber, r.evaluatedAt.day) },
  }))

  const signals = rebuildRiskSignalsFromGameState({
    currentWorkdayIndex,
    currentMoment: { sprintNumber: sprint.sprintNumber, day: sprint.day },
    staffingDecision: story.postAuditConversation.staffingDecision,
    ilyaHired: hasSecuritySpecialist(useTeamStore.getState().hires),
    closedFindings,
    auditRecords,
    serverFailures: [],
    serverStabilized: [],
  })
  if (signals.length > 0) useRiskStore.getState().addSignalsOnce(signals)
}
