import { useSprintStore } from './sprintStore'
import { useEconomyStore } from './economyStore'
import { useProductStore } from './productStore'
import { useGameOutcomeStore } from './gameOutcomeStore'
import { calculateBalance } from './economyRules'
import { hasCompletedCoreMvp } from './productRules'
import { toWorkdayIndex } from './workdayIndex'
import { CAMPAIGN_DEADLINE_SPRINT } from './gameOutcomeRules'
import { registerGameFailureIfNeeded, startLeadershipGraceIfNeeded } from './registerGameFailure'
import { ensureMvpReleaseTask } from './releaseOfficeFlowMvp'

// Feature 12 migration from an old Feature 11 save (no outcome state). Runs once
// at App module load. Never applies a defeat retroactively except an already
// irreversible negative budget; every other cause is given a safe continuation
// point (a fresh grace period or the next completed day / review).
export function reconcileGameOutcomeAtStartup(): void {
  const outcome = useGameOutcomeStore.getState()
  // A persisted pending/failed outcome is left to the coordinator / overlay.
  if (outcome.status !== 'playing') return

  const sprint = useSprintStore.getState()
  const currentWorkdayIndex = toWorkdayIndex(sprint.sprintNumber, sprint.day)

  // Old third-audit shutdown recommendation → a full five-day grace from now.
  startLeadershipGraceIfNeeded(currentWorkdayIndex)

  // Old save already past the campaign deadline: record met/missed, but never
  // fail immediately — a missed deadline registers on the next completed day.
  if (sprint.sprintNumber > CAMPAIGN_DEADLINE_SPRINT && outcome.campaignDeadline.status === 'active') {
    if (hasCompletedCoreMvp(useProductStore.getState().taskStates)) {
      outcome.markCampaignDeadlineMet({ sprintNumber: sprint.sprintNumber, day: sprint.day })
    } else {
      outcome.markCampaignDeadlineMissed()
    }
  }

  // An already-negative budget is irreversible and plainly shown — register it
  // straight away (budget is the highest-priority reason, so it stays primary).
  if (calculateBalance(useEconomyStore.getState().transactions) <= 0) {
    registerGameFailureIfNeeded('migration:hydration', { sprintNumber: sprint.sprintNumber, day: sprint.day })
  }

  // Feature 13: a still-playing save that already finished all 14 tasks gets the
  // release task (never auto-wins). Self-guarded on status playing + all done.
  ensureMvpReleaseTask()
}
