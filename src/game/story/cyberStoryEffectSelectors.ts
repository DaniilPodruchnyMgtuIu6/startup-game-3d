import { CYBER_STORY_BALANCE } from '../balance/cyberStoryBalance'
import { ADDITIONAL_CYBER_STORY_BALANCE } from '../balance/additionalCyberStoryBalance'
import { useCyberStoryStore } from './cyberStoryStore'

// Derived, read-only consequences of resolved cyber-story choices (Feature
// 19A+19B), consumed by Feature 11's server-incident cost calculation and by
// Feature 13's release score. Mirrors storyEffectSelectors.ts's
// getStoryIncidentCostModifierRub/getStoryReleaseScoreAdjustment - additive on
// top of them, never replacing them.

// An exposed (unmitigated) phishing send widens a future AUTH incident's
// blast radius; an installed-without-review supply-chain update widens a
// future GATEWAY/DATABASE incident's; an unrotated repository secret widens
// AUTH's the same way; a hijacked MFA session adds a bounded GATEWAY/DATABASE
// modifier (§"связь с Feature 19A": "захваченная session может добавить
// ограниченный modifier к CI/supply-chain incident"). Total is summed with
// the Feature 17 modifier by the caller and clamped there, same as today.
export function getCyberStoryIncidentCostModifierRub(incidentId: string): number {
  const flags = useCyberStoryStore.getState().flags
  const completed = useCyberStoryStore.getState().completedConsequenceIds
  let modifier = 0
  if (incidentId === 'auth-account-incident' && flags.phishingInformationExposed) {
    modifier += CYBER_STORY_BALANCE.executivePhishing.followUpAuthIncidentCostRub
  }
  if ((incidentId === 'gateway-outage' || incidentId === 'database-exposure-review') && flags.supplyChainUpdateInstalled && !flags.supplyChainReviewedAndPinned) {
    modifier += CYBER_STORY_BALANCE.supplyChainUpdate.compromisedUpdateFutureCostRub
  }
  if (incidentId === 'auth-account-incident' && flags.credentialExposureState !== 'none' && flags.credentialExposureState !== 'rotated') {
    modifier += ADDITIONAL_CYBER_STORY_BALANCE.repositorySecret.unrotatedCredentialAuthIncidentCostRub
  }
  if ((incidentId === 'gateway-outage' || incidentId === 'database-exposure-review') && completed.includes('hijacked-session-activity')) {
    modifier += ADDITIONAL_CYBER_STORY_BALANCE.mfaFatigue.hijackedSessionSupplyChainCostRub
  }
  return modifier
}

// Landed (completed) delayed consequences that carry a documented release-
// score penalty (mirrors storyEffectSelectors.ts's
// getStoryReleaseScoreAdjustment - a pure read, never a stored/re-applied
// value). Only the three Feature 19B consequences with an explicit penalty in
// the balance config count; the softer shadow-ai-personal-use beat and every
// Feature 19A consequence intentionally do not (Feature 19A's balance config
// never defined a release-score field for them).
export function getCyberStoryReleaseScoreAdjustment(): number {
  const completed = useCyberStoryStore.getState().completedConsequenceIds
  let penalty = 0
  if (completed.includes('external-credential-usage')) penalty += ADDITIONAL_CYBER_STORY_BALANCE.repositorySecret.exposedCredentialExternalUsagePenalty
  if (completed.includes('hijacked-session-activity')) penalty += ADDITIONAL_CYBER_STORY_BALANCE.mfaFatigue.hijackedSessionReleasePenalty
  if (completed.includes('unrestricted-ai-recurrence')) penalty += ADDITIONAL_CYBER_STORY_BALANCE.externalAi.shadowAiReleasePenalty
  return penalty
}
