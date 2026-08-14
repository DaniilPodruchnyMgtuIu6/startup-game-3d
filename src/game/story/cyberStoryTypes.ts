import type { StoryMoment } from '../securityStoryRules'

// Feature 19 (A+B): six cyber-story incidents. A sibling engine to Feature
// 17A/17C's Level 1 decisions/consequences - same status-machine + due-workday
// pattern, but its own union and its own store/localStorage key, since
// level1Timeline.ts and level1Checkpoints.ts are explicitly fixed at "exactly
// eight decisions" / "exactly nine checkpoints" (no dynamic registration).
// Unlike those, this union was never declared closed, so Feature 19B extends
// it directly (3 more ids) instead of building a second parallel engine -
// the store/launcher/controller are already generic over these types and
// need no structural change, only new catalog/dialogue/handler entries.
// Feature 19 reuses every OTHER existing system directly: DialogueLine/
// ChoiceOption + DialoguePanel, the economy ledger, the risk domains, the
// cinematic director, storyWorkStore's busy-employee assignments.

export type CyberStoryIncidentId =
  // Feature 19A
  | 'executive-phishing-request'
  | 'supply-chain-update'
  | 'shadow-it-log-upload'
  // Feature 19B
  | 'secret-committed-to-repository'
  | 'mfa-fatigue-attack'
  | 'external-ai-data-disclosure'

export const CYBER_STORY_INCIDENT_PRIORITY: readonly CyberStoryIncidentId[] = [
  'executive-phishing-request',
  'supply-chain-update',
  'shadow-it-log-upload',
  'secret-committed-to-repository',
  'mfa-fatigue-attack',
  'external-ai-data-disclosure',
]

export function cyberIncidentPriorityRank(id: CyberStoryIncidentId): number {
  return CYBER_STORY_INCIDENT_PRIORITY.indexOf(id)
}

export type CyberStoryChoiceId =
  // Feature 19A
  | 'send-requested-data'
  | 'verify-through-known-channel'
  | 'escalate-phishing-to-security'
  | 'install-update-immediately'
  | 'keep-current-version'
  | 'review-and-pin-dependency'
  | 'upload-raw-logs-to-personal-cloud'
  | 'sanitize-logs-manually'
  | 'configure-secure-log-sharing'
  // Feature 19B
  | 'remove-secret-in-new-commit'
  | 'rewrite-repository-history'
  | 'rotate-and-secure-secret'
  | 'change-password-only'
  | 'revoke-sessions-and-investigate'
  | 'enable-phishing-resistant-auth'
  | 'allow-unrestricted-ai-tools'
  | 'ban-external-ai-tools'
  | 'configure-controlled-ai-gateway'

export type CyberStoryStatus = 'locked' | 'available' | 'running' | 'resolved'

export interface CyberStoryRecord {
  incidentId: CyberStoryIncidentId
  status: CyberStoryStatus
  availableAt?: StoryMoment
  startedAt?: StoryMoment
  resolvedAt?: StoryMoment
  selectedChoiceId?: CyberStoryChoiceId
  effectsApplied: boolean
}

export type CyberStoryRecords = Record<CyberStoryIncidentId, CyberStoryRecord>

export function initialCyberStoryRecords(): CyberStoryRecords {
  const records = {} as CyberStoryRecords
  for (const id of CYBER_STORY_INCIDENT_PRIORITY) {
    records[id] = { incidentId: id, status: 'locked', effectsApplied: false }
  }
  return records
}

// Delayed consequences. Feature 19A's three incidents each schedule exactly
// one (only their risky variant A - the safer variants B/C leave it
// unscheduled, mirroring §"Отложенные последствия": "Не каждая risky choice
// должна гарантировать game over"). Feature 19B's secret/external-AI
// incidents can schedule ONE OF TWO different consequences depending on
// WHICH choice was made (remove vs rewrite; allow-unrestricted vs ban) - the
// exact id+delay is decided inside the handler (cyberStoryHandlers.ts), not
// by a static 1:1 map, so this is an incident -> POSSIBLE ids map (used only
// by resetIncident to know what to clear).
export type CyberConsequenceId =
  // Feature 19A
  | 'phishing-targeted-followup'
  | 'supply-chain-unknown-connection'
  | 'shadow-it-external-download'
  // Feature 19B
  | 'external-credential-usage'
  | 'credential-found-in-ci-cache'
  | 'hijacked-session-activity'
  | 'unrestricted-ai-recurrence'
  | 'shadow-ai-personal-use'

export const CYBER_CONSEQUENCES_FOR_INCIDENT: Record<CyberStoryIncidentId, readonly CyberConsequenceId[]> = {
  'executive-phishing-request': ['phishing-targeted-followup'],
  'supply-chain-update': ['supply-chain-unknown-connection'],
  'shadow-it-log-upload': ['shadow-it-external-download'],
  'secret-committed-to-repository': ['external-credential-usage', 'credential-found-in-ci-cache'],
  'mfa-fatigue-attack': ['hijacked-session-activity'],
  'external-ai-data-disclosure': ['unrestricted-ai-recurrence', 'shadow-ai-personal-use'],
}

export const CYBER_CONSEQUENCE_PRIORITY: readonly CyberConsequenceId[] = [
  'phishing-targeted-followup',
  'supply-chain-unknown-connection',
  'shadow-it-external-download',
  'external-credential-usage',
  'credential-found-in-ci-cache',
  'hijacked-session-activity',
  'unrestricted-ai-recurrence',
  'shadow-ai-personal-use',
]

export function cyberConsequencePriorityRank(id: CyberConsequenceId): number {
  return CYBER_CONSEQUENCE_PRIORITY.indexOf(id)
}

// Deterministic idempotency key of a choice application, same convention as
// storyDecisionOperationId.
export function cyberStoryOperationId(incidentId: CyberStoryIncidentId, choiceId: string): string {
  return `cyber-story:${incidentId}:${choiceId}`
}

// --- Narrative flags ---------------------------------------------------------
// Defined here (a leaf module) rather than in cyberStoryHandlers.ts so both
// cyberStoryHandlers.ts and cyberStoryLinkedEffects.ts can depend on the type
// without importing each other (cyberStoryLinkedEffects reads flags passed in
// by the store; cyberStoryStore.ts imports cyberStoryHandlers.ts, so a
// handlers -> linkedEffects -> store -> handlers cycle must not exist).
export type CredentialExposureState = 'none' | 'history-retained' | 'reduced' | 'rotated'
export type UnknownSessionState = 'none' | 'active' | 'revoked'
export type ShadowAiPolicy = 'unset' | 'unrestricted' | 'banned' | 'controlled-gateway'

export interface CyberStoryFlags {
  phishingInformationExposed: boolean
  phishingVerifiedAndRejected: boolean
  phishingEscalatedToSecurity: boolean
  supplyChainUpdateInstalled: boolean
  supplyChainReviewedAndPinned: boolean
  rawLogsExternallyShared: boolean
  logsManuallySanitized: boolean
  secureLogSharingConfigured: boolean
  credentialExposureState: CredentialExposureState
  unknownSessionState: UnknownSessionState
  shadowAiPolicy: ShadowAiPolicy
}

export function initialCyberStoryFlags(): CyberStoryFlags {
  return {
    phishingInformationExposed: false,
    phishingVerifiedAndRejected: false,
    phishingEscalatedToSecurity: false,
    supplyChainUpdateInstalled: false,
    supplyChainReviewedAndPinned: false,
    rawLogsExternallyShared: false,
    logsManuallySanitized: false,
    secureLogSharingConfigured: false,
    credentialExposureState: 'none',
    unknownSessionState: 'none',
    shadowAiPolicy: 'unset',
  }
}
