import { SPRINT_DAYS } from './sprintRules'

// Relative working-day scale (Feature 08). A single monotonically increasing
// index over sprint/day, used for audit deadlines. No calendar dates, no `Date`,
// no browser timer - purely derived from the deterministic sprint clock.
//
//   workdayIndex = (sprintNumber - 1) * SPRINT_DAYS + day
//   Sprint 1 day 1  -> 1
//   Sprint 1 day 10 -> 10
//   Sprint 2 day 1  -> 11
//   Sprint 3 day 4  -> 24

export { SPRINT_DAYS }

export function toWorkdayIndex(sprintNumber: number, day: number): number {
  return (sprintNumber - 1) * SPRINT_DAYS + day
}

export function fromWorkdayIndex(workdayIndex: number): { sprintNumber: number; day: number } {
  const clamped = Math.max(1, Math.floor(workdayIndex))
  const sprintNumber = Math.floor((clamped - 1) / SPRINT_DAYS) + 1
  const day = clamped - (sprintNumber - 1) * SPRINT_DAYS
  return { sprintNumber, day }
}

// Working days remaining until the next audit (0 if the deadline day has arrived
// or passed). Never negative.
export function getDaysUntilAudit(currentWorkdayIndex: number, nextAuditWorkdayIndex: number): number {
  return Math.max(0, nextAuditWorkdayIndex - currentWorkdayIndex)
}
