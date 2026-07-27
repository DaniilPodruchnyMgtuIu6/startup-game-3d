// 18H §15/§16: keeps ambient office life from reading as scripted or
// repetitive, without a needs/energy simulation - just recency + cooldowns.
// Pure, deterministic, and NOT wall-clock: "beat" is one NPC decision cycle
// (each time that character's planner picks a new activity), the same unit
// the rest of the ambient-life balance already reasons in (AMBIENT_OFFICE_BALANCE).

export interface AmbientActivityHistory {
  characterId: string
  recentActivityIds: string[]
  completedToday: number
  lastCompletedWorkdayId?: string
  cooldowns: Record<string, number> // activityId -> beat count it becomes free again
}

const RECENT_HISTORY_LENGTH = 5

export function createAmbientHistory(characterId: string): AmbientActivityHistory {
  return { characterId, recentActivityIds: [], completedToday: 0, cooldowns: {} }
}

export function isOnCooldown(history: AmbientActivityHistory, activityId: string, currentBeat: number): boolean {
  const readyAt = history.cooldowns[activityId]
  return readyAt !== undefined && currentBeat < readyAt
}

export function dailyLimitReached(history: AmbientActivityHistory, maxPerWorkday: number): boolean {
  return history.completedToday >= maxPerWorkday
}

// The single most recent activity never repeats back-to-back, regardless of
// its individual cooldown (a short cooldown could otherwise still expire
// between two immediately-consecutive picks).
export function wasJustDone(history: AmbientActivityHistory, activityId: string): boolean {
  return history.recentActivityIds[history.recentActivityIds.length - 1] === activityId
}

// Call once an ambient activity actually STARTS (not merely considered).
// `cooldownBeats` lets the caller pass AMBIENT_OFFICE_BALANCE's shorter
// general cooldown or its longer repeated-activity cooldown per activity.
export function recordActivityStart(
  history: AmbientActivityHistory,
  activityId: string,
  currentBeat: number,
  cooldownBeats: number,
  workdayId: string,
): AmbientActivityHistory {
  const recentActivityIds = [...history.recentActivityIds, activityId].slice(-RECENT_HISTORY_LENGTH)
  const sameWorkday = history.lastCompletedWorkdayId === workdayId
  return {
    ...history,
    recentActivityIds,
    completedToday: (sameWorkday ? history.completedToday : 0) + 1,
    lastCompletedWorkdayId: workdayId,
    cooldowns: { ...history.cooldowns, [activityId]: currentBeat + cooldownBeats },
  }
}

// A new workday resets the daily counter (cooldowns/recent-ids persist - an
// activity done at 17:55 should not repeat again at 09:00 the next day).
export function resetForNewWorkday(history: AmbientActivityHistory, workdayId: string): AmbientActivityHistory {
  if (history.lastCompletedWorkdayId === workdayId) return history
  return { ...history, completedToday: 0 }
}
