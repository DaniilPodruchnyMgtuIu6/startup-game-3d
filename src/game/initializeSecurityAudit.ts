import { useSprintStore } from './sprintStore'
import { useSecurityStoryStore } from './securityStoryStore'
import { useSecurityAuditStore } from './securityAuditStore'
import { useRiskStore } from './riskStore'
import { correctivePlanOfficeAccessSignals } from './riskSignals'
import { riskMomentAt } from './riskContext'
import { toWorkdayIndex } from './workdayIndex'

// Creates the corrective-action plan once the post-audit conversation (Feature
// 06) is completed - regardless of the staffing decision (Feature 08 §5/§6).
// Idempotent: safe to call at startup (migration) and right after the
// conversation completes in-session.
export function initializeSecurityAuditIfReady(): void {
  const story = useSecurityStoryStore.getState()
  if (story.postAuditConversation.status !== 'completed') return
  const audit = useSecurityAuditStore.getState()
  if (audit.initialized) return

  const sprint = useSprintStore.getState()
  const currentWorkdayIndex = toWorkdayIndex(sprint.sprintNumber, sprint.day)
  const staffingDecision = story.postAuditConversation.staffingDecision
  const completedAt = story.postAuditConversation.completedAt

  // Anchor the 10-day window on the conversation's completion. On a fresh
  // in-session completion this equals the current day, so the deadline is
  // current + 9. For an old save whose window already elapsed, fire after the
  // next completed day instead - never a retroactive fine.
  if (completedAt) {
    const anchorIndex = toWorkdayIndex(completedAt.sprintNumber, completedAt.day)
    if (anchorIndex + 9 < currentWorkdayIndex) {
      audit.initializeCorrectiveActionPlan({ currentWorkdayIndex, overdue: true, staffingDecision })
    } else {
      // store adds +9 to the passed index, so pass the anchor index
      audit.initializeCorrectiveActionPlan({ currentWorkdayIndex: anchorIndex, staffingDecision })
    }
  } else {
    audit.initializeCorrectiveActionPlan({ currentWorkdayIndex, staffingDecision })
  }

  // Feature 16 §9: the breach exposed a physical-access / workstation-discipline
  // problem — record the office-access risk (idempotent) so the СКУД proposal can
  // unlock and, if left unaddressed, escalate to an intrusion.
  useRiskStore.getState().addSignalsOnce(correctivePlanOfficeAccessSignals(riskMomentAt(sprint.sprintNumber, sprint.day)))
}
