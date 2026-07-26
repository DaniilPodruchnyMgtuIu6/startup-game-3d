import { useSprintStore } from '../sprintStore'
import { useTeamStore } from '../teamStore'
import { useSecurityStoryStore } from '../securityStoryStore'
import { hasInitialDevelopmentTeam } from '../teamRules'
import { toWorkdayIndex } from '../workdayIndex'
import { LEVEL1_TIMELINE_BALANCE } from '../balance/timelineBalance'
import { useStoryDecisionStore } from './storyDecisionStore'
import { useStoryConsequenceStore } from './storyConsequenceStore'
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

// Feature 17C §15: a save loaded PAST a fixed data-loss moment with its
// checkpoint still pending can only be a pre-17C campaign - the catastrophe is
// never applied retroactively, the checkpoints are marked skipped. A live 17C
// campaign evaluates every checkpoint at the end of its own day, so its records
// are already immutable before this point is ever passed.
export function reconcileStoryConsequencesAtStartup(): void {
  const conseq = useStoryConsequenceStore.getState()
  const sprint = useSprintStore.getState()
  const idx = toWorkdayIndex(sprint.sprintNumber, sprint.day)

  const warningIndex = toWorkdayIndex(LEVEL1_TIMELINE_BALANCE.dataLossFinalWarning.sprintNumber, LEVEL1_TIMELINE_BALANCE.dataLossFinalWarning.day)
  if (conseq.checkpoints['data-loss-final-warning'].status === 'pending' && idx > warningIndex) {
    conseq.markCheckpoint('data-loss-final-warning', 'skipped-migration', idx)
  }
  const resolutionIndex = toWorkdayIndex(LEVEL1_TIMELINE_BALANCE.dataLossResolution.sprintNumber, LEVEL1_TIMELINE_BALANCE.dataLossResolution.day)
  if (
    conseq.checkpoints['data-loss-resolution'].status === 'pending' &&
    idx > resolutionIndex &&
    conseq.finalWarningShownAtWorkdayIndex === undefined
  ) {
    conseq.markCheckpoint('data-loss-resolution', 'skipped-migration', idx)
  }
}
