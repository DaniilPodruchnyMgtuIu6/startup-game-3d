import { describe, it, expect, beforeEach } from 'vitest'
import { useStoryDecisionStore } from './storyDecisionStore'
import { useStoryWorkStore } from './storyWorkStore'
import { useEconomyStore } from '../economyStore'
import { useRiskStore } from '../riskStore'
import { useGameStore } from '../gameStore'
import { useTeamStore } from '../teamStore'
import { useProductStore } from '../productStore'
import { useSprintStore } from '../sprintStore'
import { useSecurityAuditStore, INITIAL_SECURITY_AUDIT } from '../securityAuditStore'
import { useServerIncidentStore, INITIAL_SERVER_INCIDENT_DATA } from '../serverIncidentStore'
import { getStoryIncidentCostModifierRub, getStoryReleaseScoreAdjustment, getRestoreReadiness, getStoryDetectionDelayReductionDays, getBaselinePath } from './storyEffectSelectors'
import { getServerIncidentImmediateCost } from '../serverIncidentRules'
import { calculateBalance, initialTransactions, INITIAL_BUDGET } from '../economyRules'
import { calculateCampaignSuccessScore } from '../mvpReleaseRules'
import { STORY_BALANCE } from '../balance/storyBalance'
import { initialTaskStates } from '../productRules'
import { INITIAL_SPRINT_STATE } from '../sprintRules'
import { BOARD_TASKS } from '../tasks'
import type { Level1StoryDecisionId } from './level1Timeline'
import type { RiskDomain, RiskLevel } from '../riskCatalog'

// 17B §10: the two mandatory end-to-end decision paths, driven through the
// real store + handlers. Money comes from the ledger, never re-derived.

const M = { sprintNumber: 2, day: 2 }
const story = () => useStoryDecisionStore.getState()
const balance = () => calculateBalance(useEconomyStore.getState().transactions)

const BOTH_DEVS = [
  { employeeId: 'kirill-morozov', hiredAtSprint: 1, hiredAtDay: 1 },
  { employeeId: 'alina-belova', hiredAtSprint: 1, hiredAtDay: 1 },
]
const WITH_ILYA = [...BOTH_DEVS, { employeeId: 'ilya-vlasov', hiredAtSprint: 2, hiredAtDay: 1 }]

function decide(id: Level1StoryDecisionId, choiceId: string) {
  story().unlockDecision(id, M)
  const res = story().resolveDecision(id, choiceId, M)
  expect(res.choiceId).toBe(choiceId)
}

function riskLevels(levels: Partial<Record<RiskDomain, RiskLevel>>): Record<RiskDomain, RiskLevel> {
  return {
    'office-access': 'controlled',
    'identity-access': 'controlled',
    'sensitive-data': 'controlled',
    'service-continuity': 'controlled',
    governance: 'controlled',
    'delivery-pressure': 'controlled',
    ...levels,
  }
}

beforeEach(() => {
  window.localStorage.clear()
  useSprintStore.setState({ ...INITIAL_SPRINT_STATE, sprintNumber: M.sprintNumber, day: M.day, phase: 'active', confirmingEndDay: false })
  useEconomyStore.setState({ transactions: initialTransactions(), panelOpen: false })
  useRiskStore.setState({ signals: [] })
  useGameStore.setState({ phase: 'free', activeDialogue: null, activeChoice: null, tasks: BOARD_TASKS.map((t) => ({ ...t })) })
  useProductStore.setState({ taskStates: initialTaskStates(), activeReport: null, boardOpen: false, prototypeOpen: false, releaseCheckOpen: false })
  useSecurityAuditStore.setState({ ...INITIAL_SECURITY_AUDIT, findings: [], auditResultToAcknowledge: null })
  useServerIncidentStore.setState({ ...INITIAL_SERVER_INCIDENT_DATA, incidentResultToAcknowledge: null })
  story().resetLevel1Story()
  useStoryWorkStore.getState().resetStoryWork()
})

it('path A: audit → JIT access → synthetic data → full restore → separated architecture → report immediately → release with known risk', () => {
  useTeamStore.setState({ hires: BOTH_DEVS, panelOpen: false })
  decide('security-baseline-path', 'commission-security-audit')
  decide('developer-admin-access', 'use-just-in-time-access')
  decide('frontend-test-data', 'create-synthetic-data')
  decide('backup-and-restore-strategy', 'run-full-restore-drill')
  decide('architecture-boundary', 'separate-security-boundaries')
  decide('suspicious-activity-disclosure', 'report-activity-immediately')
  decide('release-risk-decision', 'release-with-known-risk')

  // the ledger carries exactly the four paid decisions of this path
  const spent =
    STORY_BALANCE.baselineAudit.costRub +
    STORY_BALANCE.testData.syntheticCostRub +
    STORY_BALANCE.backupRestore.fullDrillCostRub +
    STORY_BALANCE.disclosure.reportCostRub
  expect(balance()).toBe(INITIAL_BUDGET - spent)

  expect(getBaselinePath()).toBe('external-audit')
  expect(getRestoreReadiness()).toBe('verified')
  // separated boundaries + honest report make a future AUTH incident cheaper
  expect(getStoryIncidentCostModifierRub('auth-account-incident')).toBe(
    -STORY_BALANCE.architecture.separateIncidentCostReductionRub - STORY_BALANCE.disclosure.reportIncidentCostReductionRub,
  )
  // the known-risk release costs exactly its score penalty
  expect(getStoryReleaseScoreAdjustment()).toBe(STORY_BALANCE.release.knownRiskScorePenalty)
  const clean = calculateCampaignSuccessScore({
    failedAuditNumbers: [],
    officeIntrusionOutcome: 'not-triggered',
    occurredServerIncidentCount: 0,
    leadershipComplaint: false,
    shutdownRecommendation: false,
    accessControlActive: true,
    actualRiskLevels: riskLevels({}),
    balance: 1_000_000,
  }).score
  const withPenalty = calculateCampaignSuccessScore({
    failedAuditNumbers: [],
    officeIntrusionOutcome: 'not-triggered',
    occurredServerIncidentCount: 0,
    leadershipComplaint: false,
    shutdownRecommendation: false,
    accessControlActive: true,
    actualRiskLevels: riskLevels({}),
    balance: 1_000_000,
    storyScorePenalty: getStoryReleaseScoreAdjustment(),
  }).score
  expect(clean - withPenalty).toBe(STORY_BALANCE.release.knownRiskScorePenalty)
})

it('path B: hire Ilya → controlled access → masked data → logging priority → postpone backup → shared architecture → dismiss warning → hardening', () => {
  useTeamStore.setState({ hires: WITH_ILYA, panelOpen: false })
  decide('security-baseline-path', 'hire-security-specialist-first')
  decide('developer-admin-access', 'configure-controlled-access')
  decide('frontend-test-data', 'mask-data-with-security')
  decide('security-first-priority', 'prioritize-central-logging')
  decide('backup-and-restore-strategy', 'postpone-backup-work')
  decide('architecture-boundary', 'keep-shared-architecture')
  // raise a detected high risk so the hardening choice has a domain to mitigate
  useRiskStore.setState({
    signals: [
      {
        id: 'test:continuity-high',
        domain: 'service-continuity',
        impact: 8,
        source: 'story-decision',
        sourceRef: 'test',
        createdAt: { sprintNumber: 2, day: 1 },
        createdAtWorkdayIndex: 11,
        detectionDelayOverride: 0,
        detectedAtWorkdayIndex: 11,
      },
      ...useRiskStore.getState().signals,
    ],
  })
  decide('suspicious-activity-disclosure', 'dismiss-as-false-positive')
  decide('release-risk-decision', 'delay-for-hardening')

  const spent =
    STORY_BALANCE.adminAccess.controlledCostRub + STORY_BALANCE.testData.maskedCostRub + STORY_BALANCE.firstPriority.loggingCostRub
  expect(balance()).toBe(INITIAL_BUDGET - spent)

  expect(getBaselinePath()).toBe('internal-review')
  expect(getRestoreReadiness()).toBe('absent')
  // central logging shortens future detection delays
  expect(getStoryDetectionDelayReductionDays()).toBe(STORY_BALANCE.firstPriority.loggingDetectionDelayReductionWorkdays)
  // permanent-admin was NOT chosen - AUTH costs stay unmodified on this path
  expect(getStoryIncidentCostModifierRub('auth-account-incident')).toBe(0)
  expect(getServerIncidentImmediateCost('auth-account-incident', true, getStoryIncidentCostModifierRub('auth-account-incident'))).toBe(100_000)
  // hardening left its mitigation on the detected high domain
  expect(
    useRiskStore
      .getState()
      .signals.some(
        (s) =>
          s.id === 'story-decision:release-risk-decision:delay-for-hardening:service-continuity' &&
          s.impact === STORY_BALANCE.release.hardeningMitigationImpact,
      ),
  ).toBe(true)
  // Ilya carries the review + controlled access + masked data + logging queue
  expect(useStoryWorkStore.getState().isEmployeeBusy('ilya-vlasov')).toBe(true)
})
