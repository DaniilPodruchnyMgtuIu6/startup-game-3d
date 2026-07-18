import { useSprintStore } from './sprintStore'
import { useTeamStore } from './teamStore'
import { hasSecuritySpecialist } from './teamRules'
import { toWorkdayIndex } from './workdayIndex'
import type { RiskCreationMoment } from './riskSignals'

// Small live-state helpers shared by the risk integration points, so each
// use-case builds a consistent "now" moment and specialist flag without
// duplicating the sprint/team reads.

export function riskMomentNow(): RiskCreationMoment {
  const s = useSprintStore.getState()
  return { sprintNumber: s.sprintNumber, day: s.day, workdayIndex: toWorkdayIndex(s.sprintNumber, s.day) }
}

export function riskMomentAt(sprintNumber: number, day: number): RiskCreationMoment {
  return { sprintNumber, day, workdayIndex: toWorkdayIndex(sprintNumber, day) }
}

export function hasSecuritySpecialistNow(): boolean {
  return hasSecuritySpecialist(useTeamStore.getState().hires)
}
