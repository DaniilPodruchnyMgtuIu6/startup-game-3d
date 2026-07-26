import { useSprintStore } from './sprintStore'
import { useTeamStore, type HireEmployeeResult } from './teamStore'
import { useGameStore } from './gameStore'
import { useSecurityStoryStore } from './securityStoryStore'
import { hasInitialDevelopmentTeam } from './teamRules'
import { isGameOutcomeBlocking } from './registerGameFailure'
import { useStoryDecisionStore } from './story/storyDecisionStore'
import { canUnlockSecurityBaseline } from './story/storyDecisionRules'

// The single game operation for hiring a developer. Reads the current sprint as
// the hire context, blocks hiring during a sprint review, records the hire, and
// completes the "form the team" board task once both developers are on board.
// Kept out of React so the flow is testable with controlled store states.

export const BUILD_TEAM_TASK_ID = 'build-team'

export function canHireNow(): boolean {
  return useSprintStore.getState().phase !== 'review'
}

export function hireDeveloper(employeeId: string): HireEmployeeResult {
  const sprint = useSprintStore.getState()
  // Team changes are not allowed while reviewing a finished sprint.
  if (sprint.phase === 'review') return { hired: false, reason: 'invalid-game-state' }
  // A registered defeat freezes every game action.
  if (isGameOutcomeBlocking()) return { hired: false, reason: 'invalid-game-state' }

  const result = useTeamStore.getState().hireEmployee(employeeId, {
    sprintNumber: sprint.sprintNumber,
    day: sprint.day,
  })

  if (result.hired && hasInitialDevelopmentTeam(useTeamStore.getState().hires)) {
    useGameStore.getState().completeTask(BUILD_TEAM_TASK_ID)
    // Feature 17A: once the team is formed and the first sprint has not started,
    // the mandatory baseline check with Sonya becomes available (idempotent).
    if (
      canUnlockSecurityBaseline({
        bothDevelopersHired: true,
        sprintNumber: sprint.sprintNumber,
        sprintPhase: useSprintStore.getState().phase,
        legacyStaffingDecided: useSecurityStoryStore.getState().postAuditConversation.staffingDecision !== undefined,
      })
    ) {
      useStoryDecisionStore.getState().unlockDecision('security-baseline-path', { sprintNumber: sprint.sprintNumber, day: sprint.day })
    }
  }
  return result
}
