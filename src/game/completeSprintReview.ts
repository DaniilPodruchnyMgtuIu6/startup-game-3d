import { useSprintStore } from './sprintStore'
import { useProductStore } from './productStore'

// The single use-case that closes a sprint review and opens the next planning.
// Carries incomplete product tasks back to the backlog (keeping their progress)
// before advancing the sprint clock. Never charges money or applies progress.
// The review component must not call the low-level sprintStore action directly.
export function completeSprintAndPrepareNextPlanning(): { completed: boolean } {
  if (useSprintStore.getState().phase !== 'review') return { completed: false }
  useProductStore.getState().prepareNextPlanning()
  useSprintStore.getState().completeSprintReview()
  return { completed: true }
}
