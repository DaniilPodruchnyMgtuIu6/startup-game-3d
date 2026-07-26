// Editable balance for the Level 1 story decisions (Feature 17A). These values
// are NOT wired into gameplay yet - the decision scenes and their effects are
// implemented in 17B/17C, which must read every number from here (no magic
// numbers in handlers). Values are the 17A draft and may be tuned in 17B-17C.

export const STORY_BALANCE = {
  baselineAudit: {
    costRub: 140_000,
    resultDelayWorkdays: 2,
  },
  internalSecurityReview: {
    effortDays: 2,
    hireDeadlineWorkdays: 3,
  },
  backupRestore: {
    fullDrillCostRub: 60_000,
    fullDrillEffortDays: 2,
    configureOnlyCostRub: 30_000,
    configureOnlyEffortDays: 1,
  },
} as const
