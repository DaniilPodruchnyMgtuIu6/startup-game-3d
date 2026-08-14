import type { RiskDomain } from '../riskCatalog'
import type { RiskCreationMoment } from '../riskSignals'
import type { RiskSignal } from '../riskRules'
import { CYBER_STORY_BALANCE } from '../balance/cyberStoryBalance'
import { ADDITIONAL_CYBER_STORY_BALANCE } from '../balance/additionalCyberStoryBalance'
import type { CyberConsequenceId, CyberStoryIncidentId } from './cyberStoryTypes'

// Pure builders for every risk signal a Feature 19 (A+B) cyber-story choice
// or consequence creates. Signal ids embed the operation id, so riskStore's
// addSignalsOnce makes each application idempotent. Impacts live ONLY in
// cyberStoryBalance/additionalCyberStoryBalance - nothing here invents a
// number. Mirrors storyRiskSignals.ts.

function make(operationId: string, domain: RiskDomain, impact: number, moment: RiskCreationMoment, detectionDelayOverride?: number): RiskSignal {
  return {
    id: `${operationId}:${domain}`,
    domain,
    impact,
    source: 'story-decision',
    sourceRef: operationId,
    createdAt: { sprintNumber: moment.sprintNumber, day: moment.day },
    createdAtWorkdayIndex: moment.workdayIndex,
    ...(detectionDelayOverride !== undefined ? { detectionDelayOverride } : {}),
  }
}

const B = CYBER_STORY_BALANCE
const AB = ADDITIONAL_CYBER_STORY_BALANCE

// The player made this choice themselves - its consequences are known
// immediately, never "hidden until detected".
const IMMEDIATE = 0

export interface CyberChoiceSignalOptions {
  // executive-phishing-request: security-first-priority's training choice
  // already caught the attempt in time - see § "не должна создавать риск при
  // правильном автоматическом распознавании".
  trainingSuppressed?: boolean
  // Feature 19B explicit links (cyberStoryLinkedEffects.ts): when the caller
  // has already computed a REDUCED number for one domain (a weaker attempt,
  // or masking already in place), it overrides the base balance constant for
  // that one domain instead of a generic "scale everything" mechanism.
  impactOverrides?: Partial<Record<RiskDomain, number>>
}

function impactFor(overrides: CyberChoiceSignalOptions['impactOverrides'], domain: RiskDomain, base: number): number {
  return overrides?.[domain] ?? base
}

export function cyberStoryChoiceSignals(incidentId: CyberStoryIncidentId, choiceId: string, moment: RiskCreationMoment, opts: CyberChoiceSignalOptions = {}): RiskSignal[] {
  const op = `cyber-story:${incidentId}:${choiceId}`
  const ov = opts.impactOverrides
  switch (`${incidentId}:${choiceId}`) {
    // 1. executive-phishing-request
    case 'executive-phishing-request:send-requested-data':
      if (opts.trainingSuppressed) return []
      return [
        make(op, 'governance', B.executivePhishing.sendGovernanceImpact, moment, IMMEDIATE),
        make(op, 'identity-access', B.executivePhishing.sendIdentityImpact, moment, IMMEDIATE),
      ]
    case 'executive-phishing-request:verify-through-known-channel':
      return [
        make(op, 'governance', B.executivePhishing.verifyGovernanceMitigation, moment, IMMEDIATE),
        make(op, 'identity-access', B.executivePhishing.verifyIdentityMitigation, moment, IMMEDIATE),
      ]
    case 'executive-phishing-request:escalate-phishing-to-security':
      return [
        make(op, 'governance', B.executivePhishing.escalateGovernanceMitigation, moment, IMMEDIATE),
        make(op, 'identity-access', B.executivePhishing.escalateIdentityMitigation, moment, IMMEDIATE),
      ]

    // 2. supply-chain-update
    case 'supply-chain-update:install-update-immediately':
      return [
        make(op, 'service-continuity', B.supplyChainUpdate.installServiceContinuityImpact, moment, IMMEDIATE),
        make(op, 'sensitive-data', B.supplyChainUpdate.installSensitiveDataImpact, moment, IMMEDIATE),
      ]
    case 'supply-chain-update:keep-current-version':
      return [make(op, 'delivery-pressure', B.supplyChainUpdate.keepVersionDemoPenalty, moment, IMMEDIATE)]
    case 'supply-chain-update:review-and-pin-dependency':
      return [
        make(op, 'service-continuity', B.supplyChainUpdate.reviewServiceContinuityMitigation, moment, IMMEDIATE),
        make(op, 'sensitive-data', B.supplyChainUpdate.reviewSensitiveDataMitigation, moment, IMMEDIATE),
      ]

    // 3. shadow-it-log-upload
    case 'shadow-it-log-upload:upload-raw-logs-to-personal-cloud':
      return [
        make(op, 'sensitive-data', B.shadowItLogs.uploadSensitiveDataImpact, moment, IMMEDIATE),
        make(op, 'governance', B.shadowItLogs.uploadGovernanceImpact, moment, IMMEDIATE),
      ]
    case 'shadow-it-log-upload:sanitize-logs-manually':
      return [make(op, 'sensitive-data', B.shadowItLogs.sanitizeSensitiveDataMitigation, moment, IMMEDIATE)]
    case 'shadow-it-log-upload:configure-secure-log-sharing':
      return [
        make(op, 'sensitive-data', B.shadowItLogs.secureSharingSensitiveMitigation, moment, IMMEDIATE),
        make(op, 'governance', B.shadowItLogs.secureSharingGovernanceMitigation, moment, IMMEDIATE),
      ]

    // 4. secret-committed-to-repository
    case 'secret-committed-to-repository:remove-secret-in-new-commit':
      return [
        make(op, 'identity-access', AB.repositorySecret.removeIdentityAccessImpact, moment, IMMEDIATE),
        make(op, 'governance', AB.repositorySecret.removeGovernanceImpact, moment, IMMEDIATE),
      ]
    case 'secret-committed-to-repository:rewrite-repository-history':
      return [
        make(op, 'identity-access', AB.repositorySecret.rewriteIdentityAccessImpact, moment, IMMEDIATE),
        make(op, 'governance', AB.repositorySecret.rewriteGovernanceMitigation, moment, IMMEDIATE),
      ]
    case 'secret-committed-to-repository:rotate-and-secure-secret':
      return [
        make(op, 'identity-access', AB.repositorySecret.rotationIdentityAccessMitigation, moment, IMMEDIATE),
        make(op, 'governance', AB.repositorySecret.rotationGovernanceMitigation, moment, IMMEDIATE),
      ]

    // 5. mfa-fatigue-attack
    case 'mfa-fatigue-attack:change-password-only':
      return [make(op, 'identity-access', impactFor(ov, 'identity-access', AB.mfaFatigue.passwordOnlyIdentityAccessImpact), moment, IMMEDIATE)]
    case 'mfa-fatigue-attack:revoke-sessions-and-investigate':
      return [
        make(op, 'identity-access', AB.mfaFatigue.investigationIdentityAccessMitigation, moment, IMMEDIATE),
        make(op, 'governance', AB.mfaFatigue.investigationGovernanceMitigation, moment, IMMEDIATE),
      ]
    case 'mfa-fatigue-attack:enable-phishing-resistant-auth':
      return [make(op, 'identity-access', AB.mfaFatigue.phishingResistantAuthIdentityAccessMitigation, moment, IMMEDIATE)]

    // 6. external-ai-data-disclosure
    case 'external-ai-data-disclosure:allow-unrestricted-ai-tools':
      return [
        make(op, 'sensitive-data', impactFor(ov, 'sensitive-data', AB.externalAi.unrestrictedSensitiveDataImpact), moment, IMMEDIATE),
        make(op, 'governance', AB.externalAi.unrestrictedGovernanceImpact, moment, IMMEDIATE),
      ]
    case 'external-ai-data-disclosure:ban-external-ai-tools':
      return [make(op, 'sensitive-data', AB.externalAi.banSensitiveDataMitigation, moment, IMMEDIATE)]
    case 'external-ai-data-disclosure:configure-controlled-ai-gateway':
      return [
        make(op, 'sensitive-data', AB.externalAi.controlledGatewaySensitiveDataMitigation, moment, IMMEDIATE),
        make(op, 'governance', AB.externalAi.controlledGatewayGovernanceMitigation, moment, IMMEDIATE),
      ]
    default:
      return []
  }
}

// One-off consequence-time risk signal (the domain the scene's due-day
// consequence lands in).
export function cyberConsequenceSignal(id: CyberConsequenceId, domain: RiskDomain, impact: number, moment: RiskCreationMoment): RiskSignal[] {
  return [make(`cyber-consequence:${id}`, domain, impact, moment, IMMEDIATE)]
}
