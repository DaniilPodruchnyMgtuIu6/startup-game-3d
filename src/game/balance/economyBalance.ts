// Editable economy balance (Feature 17A). Source of truth for the money values
// the campaign uses; the rule modules import from here and re-export their
// existing names, so behavior and tests stay unchanged. Plain constants only:
// no React, no stores, no env vars, no runtime JSON.

export const ECONOMY_BALANCE = {
  initialBudgetRub: 2_500_000,
  baseDailyExpenses: {
    officeRentRub: 8_000,
    infrastructureRub: 4_000,
    projectManagerRub: 6_000,
    administrationRub: 2_000,
  },
} as const
