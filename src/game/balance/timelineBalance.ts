// Editable Level 1 timeline balance (Feature 17A). Values are moved verbatim
// from Features 01/12; sprintRules and gameOutcomeRules re-export them under
// their existing names.

export const TIMELINE_BALANCE = {
  sprintDays: 10,
  campaignDeadlineSprint: 6,
  leadershipGraceWorkdays: 5,
  maxServerDowntimeDays: 5,
} as const

// Feature 17C: the fixed Level 1 checkpoint timeline. Moments are compared via
// the workday index; checkpoints are evaluated once and recorded immutably.
export const LEVEL1_TIMELINE_BALANCE = {
  baselineReviewDeadlineWorkdays: 5,
  backupWarningAfterChoiceWorkdays: 2,
  dataLossFinalWarning: {
    sprintNumber: 4,
    day: 3,
  },
  dataLossResolution: {
    sprintNumber: 4,
    day: 6,
  },
  releaseDecisionLatestSprint: 6,
} as const
