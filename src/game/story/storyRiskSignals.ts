import type { RiskDomain } from '../riskCatalog'
import type { RiskCreationMoment } from '../riskSignals'
import type { RiskSignal } from '../riskRules'
import { STORY_BALANCE } from '../balance/storyBalance'
import type { Level1StoryDecisionId } from './level1Timeline'

// Pure builders for every risk signal a Level 1 story choice creates
// (Feature 17B). Signal ids embed the story operation id, so riskStore's
// addSignalsOnce makes each application idempotent. Impacts live ONLY in
// storyBalance - nothing here invents a number.

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

const B = STORY_BALANCE

// The player made this choice themselves - its consequences are known
// immediately, never "hidden until detected".
const IMMEDIATE = 0

export function storyChoiceSignals(decisionId: Level1StoryDecisionId, choiceId: string, moment: RiskCreationMoment): RiskSignal[] {
  const op = `story-decision:${decisionId}:${choiceId}`
  switch (`${decisionId}:${choiceId}`) {
    // 1. security-baseline-path
    case 'security-baseline-path:commission-security-audit':
      return [make(op, 'governance', B.baselineAudit.governanceMitigation, moment, IMMEDIATE)]
    case 'security-baseline-path:hire-security-specialist-first':
      return [] // the deadline follow-up creates its own signal if the hire is late

    // 2. developer-admin-access
    case 'developer-admin-access:grant-permanent-admin':
      return [make(op, 'identity-access', B.adminAccess.permanentIdentityImpact, moment, IMMEDIATE)]
    case 'developer-admin-access:use-just-in-time-access':
      return [make(op, 'identity-access', B.adminAccess.jitIdentityMitigation, moment, IMMEDIATE)]
    case 'developer-admin-access:configure-controlled-access':
      return [make(op, 'identity-access', B.adminAccess.controlledIdentityMitigation, moment, IMMEDIATE)]

    // 3. frontend-test-data
    case 'frontend-test-data:copy-production-data':
      return [make(op, 'sensitive-data', B.testData.productionSensitiveImpact, moment, IMMEDIATE)]
    case 'frontend-test-data:create-synthetic-data':
      return [make(op, 'sensitive-data', B.testData.syntheticSensitiveMitigation, moment, IMMEDIATE)]
    case 'frontend-test-data:mask-data-with-security':
      return [make(op, 'sensitive-data', B.testData.maskedSensitiveMitigation, moment, IMMEDIATE)]

    // 4. security-first-priority
    case 'security-first-priority:prioritize-endpoint-protection':
      return [
        make(op, 'service-continuity', B.firstPriority.endpointContinuityMitigation, moment, IMMEDIATE),
        make(op, 'identity-access', B.firstPriority.endpointIdentityMitigation, moment, IMMEDIATE),
      ]
    case 'security-first-priority:prioritize-central-logging':
      return [
        make(op, 'sensitive-data', B.firstPriority.loggingSensitiveMitigation, moment, IMMEDIATE),
        make(op, 'governance', B.firstPriority.loggingGovernanceMitigation, moment, IMMEDIATE),
      ]
    case 'security-first-priority:prioritize-security-training':
      return [
        make(op, 'office-access', B.firstPriority.trainingOfficeAccessMitigation, moment, IMMEDIATE),
        make(op, 'governance', B.firstPriority.trainingGovernanceMitigation, moment, IMMEDIATE),
      ]

    // 5. backup-and-restore-strategy
    case 'backup-and-restore-strategy:run-full-restore-drill':
      return [make(op, 'service-continuity', B.backupRestore.fullDrillContinuityMitigation, moment, IMMEDIATE)]
    case 'backup-and-restore-strategy:configure-backups-only':
      return [make(op, 'service-continuity', B.backupRestore.configureOnlyContinuityMitigation, moment, IMMEDIATE)]
    case 'backup-and-restore-strategy:postpone-backup-work':
      return [make(op, 'service-continuity', B.backupRestore.postponeContinuityImpact, moment, IMMEDIATE)]

    // 6. architecture-boundary
    case 'architecture-boundary:keep-shared-architecture':
      return [
        make(op, 'identity-access', B.architecture.sharedIdentityImpact, moment, IMMEDIATE),
        make(op, 'sensitive-data', B.architecture.sharedSensitiveImpact, moment, IMMEDIATE),
        make(op, 'service-continuity', B.architecture.sharedContinuityImpact, moment, IMMEDIATE),
      ]
    case 'architecture-boundary:separate-security-boundaries':
      return [
        make(op, 'identity-access', B.architecture.separateIdentityMitigation, moment, IMMEDIATE),
        make(op, 'sensitive-data', B.architecture.separateSensitiveMitigation, moment, IMMEDIATE),
      ]
    case 'architecture-boundary:request-architecture-review':
      return [
        make(op, 'identity-access', B.architecture.reviewIdentityMitigation, moment, IMMEDIATE),
        make(op, 'sensitive-data', B.architecture.reviewSensitiveMitigation, moment, IMMEDIATE),
        make(op, 'service-continuity', B.architecture.reviewContinuityMitigation, moment, IMMEDIATE),
      ]

    // 7. suspicious-activity-disclosure
    case 'suspicious-activity-disclosure:report-activity-immediately':
      return [make(op, 'governance', B.disclosure.reportGovernanceMitigation, moment, IMMEDIATE)]
    case 'suspicious-activity-disclosure:investigate-quietly':
      return [make(op, 'governance', B.disclosure.investigateGovernanceImpact, moment, IMMEDIATE)]
    case 'suspicious-activity-disclosure:dismiss-as-false-positive':
      return [make(op, 'governance', B.disclosure.dismissGovernanceImpact, moment, IMMEDIATE)]

    // 8. release-risk-decision
    case 'release-risk-decision:hide-open-risk':
      return [make(op, 'governance', B.release.hideRiskGovernanceImpact, moment, IMMEDIATE)]
    case 'release-risk-decision:release-with-known-risk':
    case 'release-risk-decision:delay-for-hardening':
      return [] // hardening mitigations are computed per detected domain by the handler
    default:
      return []
  }
}

// Dismissing a real warning also raises the domain the warning belonged to.
export function dismissedWarningDomainSignal(domain: RiskDomain, moment: RiskCreationMoment): RiskSignal[] {
  const op = 'story-decision:suspicious-activity-disclosure:dismiss-as-false-positive'
  return [make(`${op}:domain`, domain, STORY_BALANCE.disclosure.dismissDomainImpact, moment, IMMEDIATE)]
}

// Hardening before release: one mitigation signal per detected high/critical
// domain at the moment of the choice.
export function hardeningMitigationSignals(domains: RiskDomain[], moment: RiskCreationMoment): RiskSignal[] {
  const op = 'story-decision:release-risk-decision:delay-for-hardening'
  // make() appends `:${domain}`, so ids stay unique per mitigated domain.
  return domains.map((domain) => make(op, domain, STORY_BALANCE.release.hardeningMitigationImpact, moment, IMMEDIATE))
}

// Missed 3-workday hire deadline on the internal-review path.
export function missedHireDeadlineSignals(moment: RiskCreationMoment): RiskSignal[] {
  return [
    make('story-decision:security-baseline-path:hire-deadline-missed', 'governance', STORY_BALANCE.internalSecurityReview.missedDeadlineGovernanceImpact, moment, IMMEDIATE),
  ]
}

// Feature 17C: a one-off consequence-scene signal. The effect id doubles as the
// idempotency key (make appends the domain, keeping multi-domain effects unique).
export function storyConsequenceSignal(effectId: string, domain: RiskDomain, impact: number, moment: RiskCreationMoment): RiskSignal[] {
  return [make(effectId, domain, impact, moment, IMMEDIATE)]
}
