import { useStoryDecisionStore } from './storyDecisionStore'
import type { CyberStoryFlags } from './cyberStoryTypes'

// Feature 19B §"Связи с Feature 19A": explicit, individually-named,
// individually-tested links between the six cyber incidents - NOT a generic
// combining engine. Each function reads exactly one prior fact and returns
// one bounded number/boolean; callers (handlers/dialogues/effect selectors)
// decide what to do with it. No new store, no new risk/economy mechanism.
//
// The flag-reading functions take `flags: CyberStoryFlags` as a parameter
// (rather than importing useCyberStoryStore themselves) so this module never
// depends on the store - cyberStoryStore.ts imports cyberStoryHandlers.ts,
// which imports this module, so a reverse dependency would cycle.

// executive-phishing-request:escalate-phishing-to-security is the strongest
// identity defence available - mfa-fatigue-attack plays as a weaker attempt
// (reduced risk, different dialogue flavour) when it already happened.
export function hasStrongPhishingDefense(flags: CyberStoryFlags): boolean {
  return flags.phishingEscalatedToSecurity === true
}

// security-first-priority:prioritize-central-logging (Feature 17A) already
// shortens every risk SIGNAL's detection delay (storyEffectSelectors.ts);
// this mirrors that same fact for a cyber-story CONSEQUENCE's due-day, so an
// old credential's external use is noticed sooner when central logging exists.
export function applyCentralLoggingDetectionSpeedup(baseDelayWorkdays: number): number {
  const record = useStoryDecisionStore.getState().decisions['security-first-priority']
  const hasCentralLogging = record.status === 'resolved' && record.selectedChoiceId === 'prioritize-central-logging'
  return hasCentralLogging ? Math.max(1, baseDelayWorkdays - 1) : baseDelayWorkdays
}

// shadow-it-log-upload:configure-secure-log-sharing already masks
// email/session-id/token-like values before they reach any external
// destination - sending a component to an external AI assistant afterward
// carries less real sensitive-data risk than doing so cold.
export function hasSecureLogMasking(flags: CyberStoryFlags): boolean {
  return flags.secureLogSharingConfigured === true
}

// security-first-priority:prioritize-security-training (Feature 17A) already
// teaches the team to flag risky urgent asks - external-ai-data-disclosure's
// dialogue acknowledges that the team already knows the policy question. No
// separate accessor here: CyberStorySceneContext.securityTrainingCompleted
// (cyberStoryInteraction.ts's buildSceneContext) already reads this exact
// same fact for the phishing scene, so externalAiScene reuses that field
// directly instead of a second, duplicate selector for the same source.
