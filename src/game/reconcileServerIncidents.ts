import { useSprintStore } from './sprintStore'
import { useServerIncidentStore } from './serverIncidentStore'
import { toWorkdayIndex } from './workdayIndex'

// Migration from an old Feature 10 save (spec §36): arm each dormant server
// incident whose domain risk is high and whose rack is unstable, giving a full
// fresh 4-day delay - never firing retroactively. Idempotent; a continuing
// Feature 11 save is a no-op or a normal reconcile.
export function reconcileServerIncidentThreatsAtStartup(): void {
  const sprint = useSprintStore.getState()
  useServerIncidentStore.getState().reconcileServerIncidentThreats(toWorkdayIndex(sprint.sprintNumber, sprint.day))
}
