// Editable balance for the three Feature 19B cyber-story incidents
// (secret-committed-to-repository, mfa-fatigue-attack, external-ai-data-disclosure).
// Sibling to cyberStoryBalance.ts (Feature 19A) - same src/game/balance/
// directory, same convention of one file per feature wave. No magic numbers
// in handlers/dialogues/cinematic files - everything here.

export const ADDITIONAL_CYBER_STORY_BALANCE = {
  // 4. secret-committed-to-repository
  repositorySecret: {
    // Variant A - remove-secret-in-new-commit: no cost, history keeps the key.
    removeIdentityAccessImpact: 2,
    removeGovernanceImpact: 2,
    // Variant B - rewrite-repository-history.
    rewriteKirillEffortDays: 1,
    rewriteAlinaEffortDays: 1,
    rewriteGovernanceMitigation: -1,
    rewriteIdentityAccessImpact: 1, // reduced, not zero - key is still "potentially exposed"
    // Variant C - rotate-and-secure-secret.
    rotationAndVaultCostRub: 90_000,
    rotationKirillEffortDays: 1,
    rotationIlyaEffortDays: 1,
    rotationWithoutIlyaExtraDays: 1,
    rotationIdentityAccessMitigation: -3,
    rotationGovernanceMitigation: -2,
    // Delayed consequence (external-credential-usage): fires 2-4 days after A,
    // 4-6 days (later, smaller) after B, never after C.
    exposedUseDelayWorkdaysAfterRemove: 3,
    exposedUseDelayWorkdaysAfterRewrite: 5,
    exposedCredentialIncidentCostRub: 140_000,
    exposedCredentialIncidentCostRubAfterRewrite: 60_000, // smaller - CI-cache finding, not a live external client
    exposedCredentialExternalUsagePenalty: 8, // qualitative release-score penalty units (see mvpReleaseRules)
    exposedCredentialIdentityAccessImpact: 2,
    // Extra cost applied to a future AUTH incident while the credential is
    // not fully rotated (mirrors executivePhishing's followUpAuthIncidentCostRub).
    unrotatedCredentialAuthIncidentCostRub: 60_000,
  },
  // 5. mfa-fatigue-attack
  mfaFatigue: {
    // Variant A - change-password-only: unknown session stays active.
    passwordChangeKirillEffortDays: 1,
    passwordOnlyIdentityAccessImpact: 3,
    // Variant B - revoke-sessions-and-investigate.
    investigationCostRub: 50_000,
    investigationKirillEffortDays: 1,
    investigationIlyaEffortDays: 1,
    investigationWithoutIlyaSonyaEffortDays: 1,
    investigationGovernanceMitigation: -2,
    investigationIdentityAccessMitigation: -2,
    // Variant C - enable-phishing-resistant-auth.
    phishingResistantAuthCostRub: 140_000,
    phishingResistantAuthEffortDays: 2,
    phishingResistantAuthWithoutIlyaExtraDays: 1, // "не блокировать безопасный вариант только отсутствием роли" - slower, not unavailable
    phishingResistantAuthIdentityAccessMitigation: -4,
    // Delayed consequence (hijacked-session-activity): fires 2-4 days after A.
    hijackedSessionDelayWorkdays: 3,
    hijackedSessionIncidentCostRub: 180_000,
    hijackedSessionReleasePenalty: 10,
    hijackedSessionServiceContinuityImpact: 2,
    // §"связь с Feature 19A": a bounded modifier this consequence adds to a
    // future GATEWAY/DATABASE incident (mirrors supplyChainUpdate's own).
    hijackedSessionSupplyChainCostRub: 50_000,
  },
  // 6. external-ai-data-disclosure
  externalAi: {
    // Variant A - allow-unrestricted-ai-tools: bounded, ONE-TIME acceleration
    // (unrestrictedAccelerationDays * unrestrictedAccelerationUses days of
    // instant Alina progress, applied once via the existing
    // applyStoryEffortReduction use-case - never an open-ended buff).
    unrestrictedAccelerationDays: 1,
    unrestrictedAccelerationUses: 2,
    unrestrictedSensitiveDataImpact: 3,
    unrestrictedGovernanceImpact: 2,
    // Variant B - ban-external-ai-tools: bounded, one-time friction cost.
    banExtraEffortDays: 1,
    banAffectedTaskCount: 2, // documented, not separately modelled - see handler comment
    banSensitiveDataMitigation: -1,
    // Variant C - configure-controlled-ai-gateway.
    controlledGatewayCostRub: 120_000,
    controlledGatewayKirillEffortDays: 1,
    controlledGatewayIlyaEffortDays: 1,
    controlledGatewayWithoutIlyaExtraDays: 1,
    controlledGatewaySensitiveDataMitigation: -3,
    controlledGatewayGovernanceMitigation: -2,
    // Delayed consequence (shadow-ai-recurrence): fires 2-4 days after A;
    // a much smaller "shadow use" beat fires ~5 days after B (no cost, dialogue only).
    unrestrictedRecurrenceDelayWorkdays: 3,
    shadowUseDelayWorkdaysAfterBan: 5,
    shadowAiAuditCostRub: 160_000,
    shadowAiReleasePenalty: 8,
    shadowAiGovernanceImpact: 2,
  },
} as const
