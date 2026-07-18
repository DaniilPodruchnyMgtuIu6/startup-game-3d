import { useSprintStore } from './sprintStore'
import { useProductStore } from './productStore'
import { useGameOutcomeStore } from './gameOutcomeStore'
import { hasCompletedCoreMvp } from './productRules'
import { isGameOutcomeBlocking, registerGameFailureIfNeeded } from './registerGameFailure'
import { CAMPAIGN_DEADLINE_SPRINT } from './gameOutcomeRules'

// The single use-case that closes a sprint review and opens the next planning.
// Carries incomplete product tasks back to the backlog (keeping their progress)
// before advancing the sprint clock. Never charges money or applies progress.
// The review component must not call the low-level sprintStore action directly.
export function completeSprintAndPrepareNextPlanning(): { completed: boolean } {
  if (useSprintStore.getState().phase !== 'review') return { completed: false }
  // A registered defeat freezes the review → planning transition.
  if (isGameOutcomeBlocking()) return { completed: false }
  useProductStore.getState().prepareNextPlanning()
  useSprintStore.getState().completeSprintReview()
  return { completed: true }
}

// Feature 12: the campaign deadline is checked exactly once, at the sprint-6
// review (never during day 10 or under any mandatory overlay). The review UI
// calls one of these two based on hasCompletedCoreMvp.

export function isCampaignDeadlineReview(): boolean {
  const sprint = useSprintStore.getState()
  return sprint.phase === 'review' && sprint.sprintNumber === CAMPAIGN_DEADLINE_SPRINT
}

// All 14 tasks done at the deadline review: record "met" and continue the
// campaign the existing way (Feature 13 will replace this with the MVP release).
export function completeCampaignDeadlineMet(): { completed: boolean } {
  const sprint = useSprintStore.getState()
  if (!isCampaignDeadlineReview()) return { completed: false }
  if (!hasCompletedCoreMvp(useProductStore.getState().taskStates)) return { completed: false }
  useGameOutcomeStore.getState().markCampaignDeadlineMet({ sprintNumber: sprint.sprintNumber, day: sprint.day })
  return completeSprintAndPrepareNextPlanning()
}

// Unfinished tasks at the deadline review: record "missed" and register the
// delivery-deadline defeat. Does NOT advance to sprint 7.
export function failCampaignDeadlineMissed(): { registered: boolean } {
  const sprint = useSprintStore.getState()
  if (!isCampaignDeadlineReview()) return { registered: false }
  if (hasCompletedCoreMvp(useProductStore.getState().taskStates)) return { registered: false }
  useGameOutcomeStore.getState().markCampaignDeadlineMissed()
  return registerGameFailureIfNeeded(`campaign-review:sprint-${sprint.sprintNumber}`, {
    sprintNumber: sprint.sprintNumber,
    day: sprint.day,
  })
}
