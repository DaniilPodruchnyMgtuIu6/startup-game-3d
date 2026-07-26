// Editable Level 1 timeline balance (Feature 17A). Values are moved verbatim
// from Features 01/12; sprintRules and gameOutcomeRules re-export them under
// their existing names.

export const TIMELINE_BALANCE = {
  sprintDays: 10,
  campaignDeadlineSprint: 6,
  leadershipGraceWorkdays: 5,
  maxServerDowntimeDays: 5,
} as const
