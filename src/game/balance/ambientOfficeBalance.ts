// Editable ambient-office-life balance (18H §16). Ambient activities are
// flavour, not gameplay math - these numbers only shape how often/long an
// idle NPC steps away from work, never budget, progress, risk or deadlines.

export const AMBIENT_OFFICE_BALANCE = {
  maxActivitiesPerNpcPerWorkday: 2,
  maxConcurrentAmbientActivities: 2,
  maxConcurrentSocialActivities: 1,
  activityCooldownBeats: 3,
  repeatedActivityCooldownBeats: 6,
  shortActivityDurationSeconds: [8, 20],
  socialActivityDurationSeconds: [15, 35],
  pingPongMaxRallies: 6,
  pullUpRepetitions: [2, 5],
} as const
