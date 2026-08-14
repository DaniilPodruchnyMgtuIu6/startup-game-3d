// Editable balance for the three Feature 19 cyber-story incidents
// (executive-phishing-request, supply-chain-update, shadow-it-log-upload).
// Every ruble amount, effort day, delay and risk impact used by
// cyberStoryHandlers/cyberStoryRiskSignals/cyberStoryConsequences lives here -
// no magic numbers in the handlers or the dialogue catalog. Plain constants
// only: no React, no stores, no localized texts, no env vars, no runtime JSON.

export const CYBER_STORY_BALANCE = {
  // 1. executive-phishing-request
  executivePhishing: {
    // Variant A - send-requested-data: no immediate cost, but exposes the team.
    sendGovernanceImpact: 2,
    sendIdentityImpact: 2,
    // Variant B - verify-through-known-channel: Sonya spends the day verifying.
    verificationEffortDays: 1,
    verifyGovernanceMitigation: -2,
    verifyIdentityMitigation: -1,
    // Variant C - escalate-phishing-to-security: requires Ilya.
    securityEscalationCostRub: 40_000,
    securityEscalationEffortDays: 1,
    escalateGovernanceMitigation: -3,
    escalateIdentityMitigation: -3,
    // Delayed consequence (phishing-targeted-followup): fires 2-4 completed
    // workdays after variant A, unless mitigated by C.
    followUpDelayWorkdays: 3,
    followUpIdentityImpact: 2,
    // Extra cost applied to a future AUTH incident while the exposure is
    // unmitigated (read by cyberStoryEffectSelectors, Feature 11 integration).
    followUpAuthIncidentCostRub: 70_000,
  },
  // 2. supply-chain-update
  supplyChainUpdate: {
    // Variant A - install-update-immediately: fixes the UX bug now, hidden risk.
    installServiceContinuityImpact: 2,
    installSensitiveDataImpact: 1,
    // Variant B - keep-current-version: known bug stays, small demo penalty.
    keepVersionDemoPenalty: 1,
    // Variant C - review-and-pin-dependency: Kirill reviews the change.
    reviewCostRub: 60_000,
    reviewEffortDays: 2,
    reviewServiceContinuityMitigation: -2,
    reviewSensitiveDataMitigation: -1,
    // Delayed consequence (supply-chain-unknown-connection): fires 1-3
    // completed workdays after variant A.
    unknownConnectionDelayWorkdays: 2,
    unknownConnectionServiceContinuityImpact: 2,
    // Extra cost applied to a future service-continuity incident (GATEWAY/
    // DATABASE) while the compromise is unmitigated.
    compromisedUpdateFutureCostRub: 120_000,
  },
  // 3. shadow-it-log-upload
  shadowItLogs: {
    // Variant A - upload-raw-logs-to-personal-cloud: fast, unsanitised.
    uploadSensitiveDataImpact: 3,
    uploadGovernanceImpact: 2,
    // Variant B - sanitize-logs-manually: a developer spends the day cleaning.
    manualSanitizationEffortDays: 1,
    sanitizeSensitiveDataMitigation: -2,
    // Variant C - configure-secure-log-sharing: Kirill (+Ilya, if hired) build
    // a reusable channel.
    secureSharingCostRub: 80_000,
    secureSharingKirillEffortDays: 1,
    secureSharingIlyaEffortDays: 1,
    secureSharingSensitiveMitigation: -3,
    secureSharingGovernanceMitigation: -2,
    // Delayed consequence (shadow-it-external-download): fires 2-4 completed
    // workdays after variant A.
    externalDownloadDelayWorkdays: 3,
    externalDownloadSensitiveImpact: 2,
    externalDownloadGovernanceImpact: 1,
    // Containment cost charged once the external download consequence lands.
    futureContainmentCostRub: 150_000,
  },
} as const
