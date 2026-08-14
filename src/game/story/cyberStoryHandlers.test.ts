import { describe, it, expect, beforeEach } from 'vitest'
import { useCyberStoryStore } from './cyberStoryStore'
import { useStoryDecisionStore } from './storyDecisionStore'
import { initialStoryDecisionRecords } from './storyDecisionRules'
import { useEconomyStore } from '../economyStore'
import { useRiskStore } from '../riskStore'
import { useStoryWorkStore } from './storyWorkStore'
import { useTeamStore } from '../teamStore'
import { calculateBalance, initialTransactions } from '../economyRules'
import { getActualRiskScore } from '../riskRules'
import { CYBER_STORY_BALANCE } from '../balance/cyberStoryBalance'
import { ADDITIONAL_CYBER_STORY_BALANCE } from '../balance/additionalCyberStoryBalance'
import { useProductStore } from '../productStore'
import { initialTaskStates, remainingEffort } from '../productRules'

const cyber = () => useCyberStoryStore.getState()
const M = { sprintNumber: 1, day: 1 }
const balance = () => calculateBalance(useEconomyStore.getState().transactions)
const risk = (domain: Parameters<typeof getActualRiskScore>[1]) => getActualRiskScore(useRiskStore.getState().signals, domain)
// getActualRiskScore clamps at 0 (risk cannot go negative) - a pure mitigation
// signal with no offsetting positive impact needs the raw signal, not the score.
const rawImpact = (domain: string) => useRiskStore.getState().signals.filter((s) => s.domain === domain).reduce((sum, s) => sum + s.impact, 0)

beforeEach(() => {
  window.localStorage.clear()
  cyber().resetCyberStory()
  useEconomyStore.setState({ transactions: initialTransactions() })
  useRiskStore.setState({ signals: [] })
  useStoryWorkStore.getState().resetStoryWork()
  useStoryDecisionStore.setState({ decisions: initialStoryDecisionRecords(), activeDecisionId: undefined, completedCheckpointIds: [] })
  useTeamStore.setState({ hires: [] })
  useProductStore.setState({ taskStates: initialTaskStates(), activeReport: null, boardOpen: false, prototypeOpen: false, releaseCheckOpen: false })
})

function hireIlya() {
  useTeamStore.setState({ hires: [{ employeeId: 'ilya-vlasov', hiredAtSprint: 1, hiredAtDay: 1 }] })
}

describe('executive-phishing-request handlers', () => {
  it('send-requested-data: no cost, exposes governance/identity risk, schedules the follow-up consequence', () => {
    cyber().unlockIncident('executive-phishing-request', M)
    cyber().resolveIncident('executive-phishing-request', 'send-requested-data', M)
    expect(balance()).toBe(initialTransactions().reduce((s, t) => s + t.amount, 0))
    expect(risk('governance')).toBe(CYBER_STORY_BALANCE.executivePhishing.sendGovernanceImpact)
    expect(risk('identity-access')).toBe(CYBER_STORY_BALANCE.executivePhishing.sendIdentityImpact)
    expect(cyber().flags.phishingInformationExposed).toBe(true)
    expect(cyber().scheduledConsequences['phishing-targeted-followup']).toEqual({ dueWorkdayIndex: 1 + CYBER_STORY_BALANCE.executivePhishing.followUpDelayWorkdays })
  })

  it('send-requested-data is risk-free and unscheduled once security training is completed', () => {
    useStoryDecisionStore.setState({
      decisions: { ...initialStoryDecisionRecords(), 'security-first-priority': { decisionId: 'security-first-priority', status: 'resolved', selectedChoiceId: 'prioritize-security-training', effectsApplied: true } },
    })
    cyber().unlockIncident('executive-phishing-request', M)
    cyber().resolveIncident('executive-phishing-request', 'send-requested-data', M)
    expect(risk('governance')).toBe(0)
    expect(risk('identity-access')).toBe(0)
    expect(cyber().flags.phishingInformationExposed).toBe(false)
    expect(cyber().scheduledConsequences['phishing-targeted-followup']).toBeUndefined()
  })

  it('verify-through-known-channel: occupies Sonya, mitigates risk, no consequence scheduled', () => {
    cyber().unlockIncident('executive-phishing-request', M)
    cyber().resolveIncident('executive-phishing-request', 'verify-through-known-channel', M)
    expect(useStoryWorkStore.getState().assignments).toContainEqual(
      expect.objectContaining({ employeeId: 'sonya-sokolova', remainingDays: CYBER_STORY_BALANCE.executivePhishing.verificationEffortDays }),
    )
    expect(rawImpact('governance')).toBe(CYBER_STORY_BALANCE.executivePhishing.verifyGovernanceMitigation)
    expect(cyber().flags.phishingVerifiedAndRejected).toBe(true)
    expect(cyber().scheduledConsequences['phishing-targeted-followup']).toBeUndefined()
  })

  it('escalate-phishing-to-security: charges the escalation cost and occupies Ilya', () => {
    hireIlya()
    cyber().unlockIncident('executive-phishing-request', M)
    cyber().resolveIncident('executive-phishing-request', 'escalate-phishing-to-security', M)
    expect(balance()).toBe(initialTransactions().reduce((s, t) => s + t.amount, 0) - CYBER_STORY_BALANCE.executivePhishing.securityEscalationCostRub)
    expect(useStoryWorkStore.getState().assignments).toContainEqual(expect.objectContaining({ employeeId: 'ilya-vlasov' }))
    expect(cyber().flags.phishingEscalatedToSecurity).toBe(true)
    expect(cyber().scheduledConsequences['phishing-targeted-followup']).toBeUndefined()
  })
})

describe('supply-chain-update handlers', () => {
  it('install-update-immediately: no cost, raises service-continuity/sensitive-data risk, schedules the consequence', () => {
    cyber().unlockIncident('supply-chain-update', M)
    cyber().resolveIncident('supply-chain-update', 'install-update-immediately', M)
    expect(risk('service-continuity')).toBe(CYBER_STORY_BALANCE.supplyChainUpdate.installServiceContinuityImpact)
    expect(risk('sensitive-data')).toBe(CYBER_STORY_BALANCE.supplyChainUpdate.installSensitiveDataImpact)
    expect(cyber().flags.supplyChainUpdateInstalled).toBe(true)
    expect(cyber().scheduledConsequences['supply-chain-unknown-connection']).toEqual({ dueWorkdayIndex: 1 + CYBER_STORY_BALANCE.supplyChainUpdate.unknownConnectionDelayWorkdays })
  })

  it('keep-current-version: no cost, a small delivery-pressure penalty, no consequence', () => {
    cyber().unlockIncident('supply-chain-update', M)
    cyber().resolveIncident('supply-chain-update', 'keep-current-version', M)
    expect(balance()).toBe(initialTransactions().reduce((s, t) => s + t.amount, 0))
    expect(risk('delivery-pressure')).toBe(CYBER_STORY_BALANCE.supplyChainUpdate.keepVersionDemoPenalty)
    expect(cyber().scheduledConsequences['supply-chain-unknown-connection']).toBeUndefined()
  })

  it('review-and-pin-dependency: charges the review cost, occupies Kirill, mitigates risk', () => {
    cyber().unlockIncident('supply-chain-update', M)
    cyber().resolveIncident('supply-chain-update', 'review-and-pin-dependency', M)
    expect(balance()).toBe(initialTransactions().reduce((s, t) => s + t.amount, 0) - CYBER_STORY_BALANCE.supplyChainUpdate.reviewCostRub)
    expect(useStoryWorkStore.getState().assignments).toContainEqual(
      expect.objectContaining({ employeeId: 'kirill-morozov', remainingDays: CYBER_STORY_BALANCE.supplyChainUpdate.reviewEffortDays }),
    )
    expect(cyber().flags.supplyChainReviewedAndPinned).toBe(true)
  })
})

describe('shadow-it-log-upload handlers', () => {
  it('upload-raw-logs-to-personal-cloud: no cost, raises sensitive-data/governance risk, schedules the consequence', () => {
    cyber().unlockIncident('shadow-it-log-upload', M)
    cyber().resolveIncident('shadow-it-log-upload', 'upload-raw-logs-to-personal-cloud', M)
    expect(risk('sensitive-data')).toBe(CYBER_STORY_BALANCE.shadowItLogs.uploadSensitiveDataImpact)
    expect(risk('governance')).toBe(CYBER_STORY_BALANCE.shadowItLogs.uploadGovernanceImpact)
    expect(cyber().flags.rawLogsExternallyShared).toBe(true)
    expect(cyber().scheduledConsequences['shadow-it-external-download']).toEqual({ dueWorkdayIndex: 1 + CYBER_STORY_BALANCE.shadowItLogs.externalDownloadDelayWorkdays })
  })

  it('sanitize-logs-manually: occupies Kirill for a day, mitigates sensitive-data risk', () => {
    cyber().unlockIncident('shadow-it-log-upload', M)
    cyber().resolveIncident('shadow-it-log-upload', 'sanitize-logs-manually', M)
    expect(useStoryWorkStore.getState().assignments).toContainEqual(
      expect.objectContaining({ employeeId: 'kirill-morozov', remainingDays: CYBER_STORY_BALANCE.shadowItLogs.manualSanitizationEffortDays }),
    )
    expect(rawImpact('sensitive-data')).toBe(CYBER_STORY_BALANCE.shadowItLogs.sanitizeSensitiveDataMitigation)
    expect(cyber().flags.logsManuallySanitized).toBe(true)
  })

  it('configure-secure-log-sharing without Ilya: charges the cost, occupies only Kirill', () => {
    cyber().unlockIncident('shadow-it-log-upload', M)
    cyber().resolveIncident('shadow-it-log-upload', 'configure-secure-log-sharing', M)
    expect(balance()).toBe(initialTransactions().reduce((s, t) => s + t.amount, 0) - CYBER_STORY_BALANCE.shadowItLogs.secureSharingCostRub)
    const assignments = useStoryWorkStore.getState().assignments
    expect(assignments).toContainEqual(expect.objectContaining({ employeeId: 'kirill-morozov' }))
    expect(assignments.some((a) => a.employeeId === 'ilya-vlasov')).toBe(false)
    expect(cyber().flags.secureLogSharingConfigured).toBe(true)
  })

  it('configure-secure-log-sharing with Ilya: also occupies Ilya for the masking work', () => {
    hireIlya()
    cyber().unlockIncident('shadow-it-log-upload', M)
    cyber().resolveIncident('shadow-it-log-upload', 'configure-secure-log-sharing', M)
    expect(useStoryWorkStore.getState().assignments).toContainEqual(
      expect.objectContaining({ employeeId: 'ilya-vlasov', remainingDays: CYBER_STORY_BALANCE.shadowItLogs.secureSharingIlyaEffortDays }),
    )
  })
})

const AB = ADDITIONAL_CYBER_STORY_BALANCE

describe('secret-committed-to-repository handlers', () => {
  it('remove-secret-in-new-commit: no cost, raises identity-access/governance risk, credential stays exposed via history, schedules external-credential-usage', () => {
    cyber().unlockIncident('secret-committed-to-repository', M)
    cyber().resolveIncident('secret-committed-to-repository', 'remove-secret-in-new-commit', M)
    expect(balance()).toBe(initialTransactions().reduce((s, t) => s + t.amount, 0))
    expect(risk('identity-access')).toBe(AB.repositorySecret.removeIdentityAccessImpact)
    expect(risk('governance')).toBe(AB.repositorySecret.removeGovernanceImpact)
    expect(cyber().flags.credentialExposureState).toBe('history-retained')
    expect(cyber().scheduledConsequences['external-credential-usage']).toEqual({ dueWorkdayIndex: 1 + AB.repositorySecret.exposedUseDelayWorkdaysAfterRemove })
  })

  it('rewrite-repository-history: occupies Kirill and Alina, reduces (not clears) exposure, schedules credential-found-in-ci-cache', () => {
    cyber().unlockIncident('secret-committed-to-repository', M)
    cyber().resolveIncident('secret-committed-to-repository', 'rewrite-repository-history', M)
    expect(useStoryWorkStore.getState().assignments).toContainEqual(
      expect.objectContaining({ employeeId: 'kirill-morozov', remainingDays: AB.repositorySecret.rewriteKirillEffortDays }),
    )
    expect(useStoryWorkStore.getState().assignments).toContainEqual(
      expect.objectContaining({ employeeId: 'alina-belova', remainingDays: AB.repositorySecret.rewriteAlinaEffortDays }),
    )
    expect(cyber().flags.credentialExposureState).toBe('reduced')
    expect(cyber().scheduledConsequences['credential-found-in-ci-cache']).toEqual({ dueWorkdayIndex: 1 + AB.repositorySecret.exposedUseDelayWorkdaysAfterRewrite })
    // rewrite is explicitly NOT rotation - remove-secret's consequence id must never appear here
    expect(cyber().scheduledConsequences['external-credential-usage']).toBeUndefined()
  })

  it('rotate-and-secure-secret without Ilya: charges the cost, Kirill alone absorbs the full without-Ilya effort, actually rotates (no consequence)', () => {
    cyber().unlockIncident('secret-committed-to-repository', M)
    cyber().resolveIncident('secret-committed-to-repository', 'rotate-and-secure-secret', M)
    expect(balance()).toBe(initialTransactions().reduce((s, t) => s + t.amount, 0) - AB.repositorySecret.rotationAndVaultCostRub)
    const assignments = useStoryWorkStore.getState().assignments
    expect(assignments).toContainEqual(
      expect.objectContaining({ employeeId: 'kirill-morozov', remainingDays: AB.repositorySecret.rotationKirillEffortDays + AB.repositorySecret.rotationWithoutIlyaExtraDays }),
    )
    expect(assignments.filter((a) => a.employeeId === 'kirill-morozov')).toHaveLength(1)
    expect(assignments.some((a) => a.employeeId === 'ilya-vlasov')).toBe(false)
    expect(cyber().flags.credentialExposureState).toBe('rotated')
    expect(cyber().scheduledConsequences['external-credential-usage']).toBeUndefined()
    expect(cyber().scheduledConsequences['credential-found-in-ci-cache']).toBeUndefined()
  })

  it('rotate-and-secure-secret with Ilya: Kirill gets only the base reconnect days, Ilya sets up secret scanning', () => {
    hireIlya()
    cyber().unlockIncident('secret-committed-to-repository', M)
    cyber().resolveIncident('secret-committed-to-repository', 'rotate-and-secure-secret', M)
    expect(useStoryWorkStore.getState().assignments).toContainEqual(
      expect.objectContaining({ employeeId: 'kirill-morozov', remainingDays: AB.repositorySecret.rotationKirillEffortDays }),
    )
    expect(useStoryWorkStore.getState().assignments).toContainEqual(
      expect.objectContaining({ employeeId: 'ilya-vlasov', remainingDays: AB.repositorySecret.rotationIlyaEffortDays }),
    )
    expect(cyber().flags.credentialExposureState).toBe('rotated')
  })

  it('central logging (Feature 17A) shortens the scheduled consequence due-day by one workday', () => {
    useStoryDecisionStore.setState({
      decisions: { ...initialStoryDecisionRecords(), 'security-first-priority': { decisionId: 'security-first-priority', status: 'resolved', selectedChoiceId: 'prioritize-central-logging', effectsApplied: true } },
    })
    cyber().unlockIncident('secret-committed-to-repository', M)
    cyber().resolveIncident('secret-committed-to-repository', 'remove-secret-in-new-commit', M)
    expect(cyber().scheduledConsequences['external-credential-usage']).toEqual({ dueWorkdayIndex: 1 + AB.repositorySecret.exposedUseDelayWorkdaysAfterRemove - 1 })
  })
})

describe('mfa-fatigue-attack handlers', () => {
  it('change-password-only: occupies Kirill, leaves the unknown session active, schedules hijacked-session-activity', () => {
    cyber().unlockIncident('mfa-fatigue-attack', M)
    cyber().resolveIncident('mfa-fatigue-attack', 'change-password-only', M)
    expect(useStoryWorkStore.getState().assignments).toContainEqual(
      expect.objectContaining({ employeeId: 'kirill-morozov', remainingDays: AB.mfaFatigue.passwordChangeKirillEffortDays }),
    )
    expect(risk('identity-access')).toBe(AB.mfaFatigue.passwordOnlyIdentityAccessImpact)
    expect(cyber().flags.unknownSessionState).toBe('active')
    expect(cyber().scheduledConsequences['hijacked-session-activity']).toEqual({ dueWorkdayIndex: 1 + AB.mfaFatigue.hijackedSessionDelayWorkdays })
  })

  it('change-password-only carries half the identity-access impact once escalate-phishing-to-security already happened', () => {
    cyber().unlockIncident('executive-phishing-request', M)
    cyber().resolveIncident('executive-phishing-request', 'escalate-phishing-to-security', M)
    cyber().unlockIncident('mfa-fatigue-attack', { sprintNumber: 1, day: 2 })
    cyber().resolveIncident('mfa-fatigue-attack', 'change-password-only', { sprintNumber: 1, day: 2 })
    const halved = Math.round(AB.mfaFatigue.passwordOnlyIdentityAccessImpact / 2)
    const signal = useRiskStore.getState().signals.find((s) => s.id.endsWith('mfa-fatigue-attack:change-password-only:identity-access'))
    expect(signal?.impact).toBe(halved)
  })

  it('revoke-sessions-and-investigate without Ilya: charges the cost, Kirill and Sonya split the work, session revoked', () => {
    cyber().unlockIncident('mfa-fatigue-attack', M)
    cyber().resolveIncident('mfa-fatigue-attack', 'revoke-sessions-and-investigate', M)
    expect(balance()).toBe(initialTransactions().reduce((s, t) => s + t.amount, 0) - AB.mfaFatigue.investigationCostRub)
    expect(useStoryWorkStore.getState().assignments).toContainEqual(
      expect.objectContaining({ employeeId: 'kirill-morozov', remainingDays: AB.mfaFatigue.investigationKirillEffortDays }),
    )
    expect(useStoryWorkStore.getState().assignments).toContainEqual(
      expect.objectContaining({ employeeId: 'sonya-sokolova', remainingDays: AB.mfaFatigue.investigationWithoutIlyaSonyaEffortDays }),
    )
    expect(cyber().flags.unknownSessionState).toBe('revoked')
    expect(cyber().scheduledConsequences['hijacked-session-activity']).toBeUndefined()
  })

  it('revoke-sessions-and-investigate with Ilya: Ilya investigates instead of Sonya', () => {
    hireIlya()
    cyber().unlockIncident('mfa-fatigue-attack', M)
    cyber().resolveIncident('mfa-fatigue-attack', 'revoke-sessions-and-investigate', M)
    const assignments = useStoryWorkStore.getState().assignments
    expect(assignments).toContainEqual(expect.objectContaining({ employeeId: 'ilya-vlasov', remainingDays: AB.mfaFatigue.investigationIlyaEffortDays }))
    expect(assignments.some((a) => a.employeeId === 'sonya-sokolova')).toBe(false)
  })

  it('enable-phishing-resistant-auth without Ilya: charges the cost, Kirill alone absorbs the full without-Ilya effort, revokes the session', () => {
    cyber().unlockIncident('mfa-fatigue-attack', M)
    cyber().resolveIncident('mfa-fatigue-attack', 'enable-phishing-resistant-auth', M)
    expect(balance()).toBe(initialTransactions().reduce((s, t) => s + t.amount, 0) - AB.mfaFatigue.phishingResistantAuthCostRub)
    const assignments = useStoryWorkStore.getState().assignments
    expect(assignments).toContainEqual(
      expect.objectContaining({
        employeeId: 'kirill-morozov',
        remainingDays: AB.mfaFatigue.phishingResistantAuthEffortDays + AB.mfaFatigue.phishingResistantAuthWithoutIlyaExtraDays,
      }),
    )
    expect(assignments.filter((a) => a.employeeId === 'kirill-morozov')).toHaveLength(1)
    expect(cyber().flags.unknownSessionState).toBe('revoked')
  })

  it('enable-phishing-resistant-auth with Ilya: Kirill only needs the base effort', () => {
    hireIlya()
    cyber().unlockIncident('mfa-fatigue-attack', M)
    cyber().resolveIncident('mfa-fatigue-attack', 'enable-phishing-resistant-auth', M)
    expect(useStoryWorkStore.getState().assignments).toContainEqual(
      expect.objectContaining({ employeeId: 'kirill-morozov', remainingDays: AB.mfaFatigue.phishingResistantAuthEffortDays }),
    )
  })
})

describe('external-ai-data-disclosure handlers', () => {
  it("allow-unrestricted-ai-tools: accelerates Alina's product progress, raises sensitive-data/governance risk, schedules unrestricted-ai-recurrence", () => {
    const totalRemainingBefore = useProductStore.getState().taskStates.reduce((sum, s) => sum + remainingEffort(s), 0)
    cyber().unlockIncident('external-ai-data-disclosure', M)
    cyber().resolveIncident('external-ai-data-disclosure', 'allow-unrestricted-ai-tools', M)
    const totalRemainingAfter = useProductStore.getState().taskStates.reduce((sum, s) => sum + remainingEffort(s), 0)
    expect(totalRemainingBefore - totalRemainingAfter).toBe(AB.externalAi.unrestrictedAccelerationDays * AB.externalAi.unrestrictedAccelerationUses)
    expect(risk('sensitive-data')).toBe(AB.externalAi.unrestrictedSensitiveDataImpact)
    expect(risk('governance')).toBe(AB.externalAi.unrestrictedGovernanceImpact)
    expect(cyber().flags.shadowAiPolicy).toBe('unrestricted')
    expect(cyber().scheduledConsequences['unrestricted-ai-recurrence']).toEqual({ dueWorkdayIndex: 1 + AB.externalAi.unrestrictedRecurrenceDelayWorkdays })
  })

  it('allow-unrestricted-ai-tools carries a lower sensitive-data impact once secure log sharing is already configured', () => {
    cyber().unlockIncident('shadow-it-log-upload', M)
    cyber().resolveIncident('shadow-it-log-upload', 'configure-secure-log-sharing', M)
    cyber().unlockIncident('external-ai-data-disclosure', { sprintNumber: 1, day: 2 })
    cyber().resolveIncident('external-ai-data-disclosure', 'allow-unrestricted-ai-tools', { sprintNumber: 1, day: 2 })
    const expected = Math.max(1, AB.externalAi.unrestrictedSensitiveDataImpact - 2)
    const signal = useRiskStore.getState().signals.find((s) => s.id.endsWith('external-ai-data-disclosure:allow-unrestricted-ai-tools:sensitive-data'))
    expect(signal?.impact).toBe(expected)
  })

  it('ban-external-ai-tools: occupies Alina for the adaptation friction, mitigates sensitive-data risk, schedules shadow-ai-personal-use', () => {
    cyber().unlockIncident('external-ai-data-disclosure', M)
    cyber().resolveIncident('external-ai-data-disclosure', 'ban-external-ai-tools', M)
    expect(useStoryWorkStore.getState().assignments).toContainEqual(
      expect.objectContaining({ employeeId: 'alina-belova', remainingDays: AB.externalAi.banExtraEffortDays }),
    )
    expect(rawImpact('sensitive-data')).toBe(AB.externalAi.banSensitiveDataMitigation)
    expect(cyber().flags.shadowAiPolicy).toBe('banned')
    expect(cyber().scheduledConsequences['shadow-ai-personal-use']).toEqual({ dueWorkdayIndex: 1 + AB.externalAi.shadowUseDelayWorkdaysAfterBan })
  })

  it('configure-controlled-ai-gateway without Ilya: charges the cost, Kirill alone absorbs the full without-Ilya effort', () => {
    cyber().unlockIncident('external-ai-data-disclosure', M)
    cyber().resolveIncident('external-ai-data-disclosure', 'configure-controlled-ai-gateway', M)
    expect(balance()).toBe(initialTransactions().reduce((s, t) => s + t.amount, 0) - AB.externalAi.controlledGatewayCostRub)
    const assignments = useStoryWorkStore.getState().assignments
    expect(assignments).toContainEqual(
      expect.objectContaining({
        employeeId: 'kirill-morozov',
        remainingDays: AB.externalAi.controlledGatewayKirillEffortDays + AB.externalAi.controlledGatewayWithoutIlyaExtraDays,
      }),
    )
    expect(assignments.filter((a) => a.employeeId === 'kirill-morozov')).toHaveLength(1)
    expect(assignments.some((a) => a.employeeId === 'ilya-vlasov')).toBe(false)
    expect(cyber().flags.shadowAiPolicy).toBe('controlled-gateway')
  })

  it('configure-controlled-ai-gateway with Ilya: Kirill only needs the base integration effort, Ilya sets the masking rules', () => {
    hireIlya()
    cyber().unlockIncident('external-ai-data-disclosure', M)
    cyber().resolveIncident('external-ai-data-disclosure', 'configure-controlled-ai-gateway', M)
    expect(useStoryWorkStore.getState().assignments).toContainEqual(
      expect.objectContaining({ employeeId: 'kirill-morozov', remainingDays: AB.externalAi.controlledGatewayKirillEffortDays }),
    )
    expect(useStoryWorkStore.getState().assignments).toContainEqual(
      expect.objectContaining({ employeeId: 'ilya-vlasov', remainingDays: AB.externalAi.controlledGatewayIlyaEffortDays }),
    )
  })
})
