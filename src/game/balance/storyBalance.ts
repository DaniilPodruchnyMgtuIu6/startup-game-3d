// Editable balance for the Level 1 story decisions (Features 17A/17B). Every
// ruble amount, effort day, delay and risk impact of the eight decision scenes
// lives here - the handlers contain no magic numbers. Plain constants only:
// no React, no stores, no localized texts, no env vars, no runtime JSON.

export const STORY_BALANCE = {
  // 1. security-baseline-path
  baselineAudit: {
    costRub: 140_000,
    resultDelayWorkdays: 2,
    governanceMitigation: -1,
  },
  internalSecurityReview: {
    effortDays: 2,
    hireDeadlineWorkdays: 3,
    missedDeadlineGovernanceImpact: 2,
  },
  // 2. developer-admin-access
  adminAccess: {
    permanentIdentityImpact: 2,
    permanentAuthIncidentCostIncreaseRub: 50_000,
    jitProductDaysLost: 1,
    jitIdentityMitigation: -2,
    controlledCostRub: 40_000,
    controlledIlyaEffortDays: 1,
    controlledIdentityMitigation: -3,
  },
  // 3. frontend-test-data
  testData: {
    productionSensitiveImpact: 3,
    productionReleaseScorePenalty: 5,
    syntheticCostRub: 20_000,
    syntheticAlinaDaysLost: 1,
    syntheticSensitiveMitigation: -2,
    maskedCostRub: 30_000,
    maskedIlyaEffortDays: 1,
    maskedSensitiveMitigation: -3,
  },
  // 4. security-first-priority
  firstPriority: {
    endpointCostRub: 120_000,
    endpointIlyaEffortDays: 2,
    endpointContinuityMitigation: -1,
    endpointIdentityMitigation: -2,
    loggingCostRub: 100_000,
    loggingIlyaEffortDays: 2,
    loggingSensitiveMitigation: -2,
    loggingGovernanceMitigation: -1,
    loggingDetectionDelayReductionWorkdays: 1,
    trainingCostRub: 60_000,
    trainingIlyaEffortDays: 1,
    trainingSonyaEffortDays: 1,
    trainingOfficeAccessMitigation: -1,
    trainingGovernanceMitigation: -2,
  },
  // 5. backup-and-restore-strategy
  backupRestore: {
    fullDrillCostRub: 60_000,
    fullDrillEffortDays: 2,
    fullDrillContinuityMitigation: -3,
    configureOnlyCostRub: 30_000,
    configureOnlyEffortDays: 1,
    configureOnlyContinuityMitigation: -1,
    postponeContinuityImpact: 3,
    postponeWarningDelayWorkdays: 2,
  },
  // 6. architecture-boundary
  architecture: {
    sharedBackendEffortReductionDays: 2,
    sharedIdentityImpact: 2,
    sharedSensitiveImpact: 2,
    sharedContinuityImpact: 1,
    separateBackendExtraDays: 2,
    separateIdentityMitigation: -2,
    separateSensitiveMitigation: -1,
    separateIncidentCostReductionRub: 40_000,
    reviewCostRub: 90_000,
    reviewDelayWorkdays: 1,
    reviewIdentityMitigation: -2,
    reviewSensitiveMitigation: -2,
    reviewContinuityMitigation: -1,
  },
  // 7. suspicious-activity-disclosure
  disclosure: {
    reportCostRub: 100_000,
    reportLimitedWorkdays: 1,
    reportGovernanceMitigation: -2,
    reportIncidentCostReductionRub: 60_000,
    investigateEffortDays: 1,
    investigateGovernanceImpact: 1,
    dismissGovernanceImpact: 3,
    dismissDomainImpact: 2,
  },
  // 8. release-risk-decision
  release: {
    knownRiskScorePenalty: 10,
    hardeningDelayWorkdays: 2,
    hardeningMitigationImpact: -2,
    hideRiskGovernanceImpact: 4,
    hideRiskScorePenalty: 25,
  },
} as const
