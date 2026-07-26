import { useSprintStore } from '../sprintStore'
import { useTeamStore } from '../teamStore'
import { useSecurityStoryStore } from '../securityStoryStore'
import { hasInitialDevelopmentTeam } from '../teamRules'
import { useStoryDecisionStore } from './storyDecisionStore'
import { canUnlockSecurityBaseline } from './storyDecisionRules'

// Feature 17A §9: startup migration of the story-decision records against a
// pre-17 save. Idempotent - a continuing 17A save is a no-op. Rules:
//   - a legacy staffing decision marks the baseline node resolved via migration
//     metadata (no scene replay, no effects, the player is never asked again);
//   - a save standing exactly at the baseline point (both developers hired,
//     sprint 1 still in planning) unlocks the scene;
//   - a save already past that point keeps the legacy post-breach conversation
//     as the only fork - nothing is replayed retroactively;
//   - the other seven nodes stay locked until their scenes ship in 17B/17C.
export function reconcileStoryDecisionsAtStartup(): void {
  const story = useStoryDecisionStore.getState()
  const legacy = useSecurityStoryStore.getState().postAuditConversation
  const sprint = useSprintStore.getState()
  const moment = { sprintNumber: sprint.sprintNumber, day: sprint.day }

  if (legacy.staffingDecision) {
    story.recordLegacyBaselineResolution(legacy.staffingDecision, legacy.completedAt ?? moment)
    return
  }

  if (
    story.decisions['security-baseline-path'].status === 'locked' &&
    canUnlockSecurityBaseline({
      bothDevelopersHired: hasInitialDevelopmentTeam(useTeamStore.getState().hires),
      sprintNumber: sprint.sprintNumber,
      sprintPhase: sprint.phase,
      legacyStaffingDecided: false,
    })
  ) {
    story.unlockDecision('security-baseline-path', moment)
  }
}
