import { describe, it, expect, beforeEach } from 'vitest'
import { useCyberStoryStore } from './cyberStoryStore'
import { applyCyberConsequenceEffects, buildCyberConsequenceScript, evaluateCyberStoryConsequences, isCyberConsequencePending } from './cyberStoryConsequences'
import { useEconomyStore } from '../economyStore'
import { useRiskStore } from '../riskStore'
import { useTeamStore } from '../teamStore'
import { calculateBalance, initialTransactions } from '../economyRules'
import { getActualRiskScore } from '../riskRules'
import { CYBER_STORY_BALANCE } from '../balance/cyberStoryBalance'
import { ADDITIONAL_CYBER_STORY_BALANCE } from '../balance/additionalCyberStoryBalance'

const cyber = () => useCyberStoryStore.getState()
const AB = ADDITIONAL_CYBER_STORY_BALANCE
const M = { sprintNumber: 1, day: 5 }
const balance = () => calculateBalance(useEconomyStore.getState().transactions)
const risk = (domain: Parameters<typeof getActualRiskScore>[1]) => getActualRiskScore(useRiskStore.getState().signals, domain)

beforeEach(() => {
  window.localStorage.clear()
  cyber().resetCyberStory()
  useEconomyStore.setState({ transactions: initialTransactions() })
  useRiskStore.setState({ signals: [] })
  useTeamStore.setState({ hires: [] })
})

describe('buildCyberConsequenceScript', () => {
  it('every consequence has at least one line, and its variant changes with Ilya hired', () => {
    for (const id of ['phishing-targeted-followup', 'supply-chain-unknown-connection', 'shadow-it-external-download', 'external-credential-usage', 'hijacked-session-activity', 'unrestricted-ai-recurrence'] as const) {
      const withoutIlya = buildCyberConsequenceScript(id)
      useTeamStore.setState({ hires: [{ employeeId: 'ilya-vlasov', hiredAtSprint: 1, hiredAtDay: 1 }] })
      const withIlya = buildCyberConsequenceScript(id)
      useTeamStore.setState({ hires: [] })
      expect(withoutIlya.lines.length).toBeGreaterThan(0)
      expect(withIlya.lines.some((l) => l.speaker === 'Илья Власов')).toBe(true)
      expect(withoutIlya.lines.some((l) => l.speaker === 'Илья Власов')).toBe(false)
    }
  })

  it('credential-found-in-ci-cache and shadow-ai-personal-use have at least one line each (no Ilya variant by design)', () => {
    expect(buildCyberConsequenceScript('credential-found-in-ci-cache').lines.length).toBeGreaterThan(0)
    expect(buildCyberConsequenceScript('shadow-ai-personal-use').lines.length).toBeGreaterThan(0)
  })

  it('unrestricted-ai-recurrence never asserts the model was definitely trained on team data', () => {
    const script = buildCyberConsequenceScript('unrestricted-ai-recurrence')
    const text = script.lines.map((l) => l.text).join(' ')
    expect(text).toMatch(/не можем точно сказать|не знаем точно/)
  })
})

describe('evaluateCyberStoryConsequences (due-day scheduling)', () => {
  it('does not queue a consequence before its due day', () => {
    cyber().scheduleConsequenceOnce('phishing-targeted-followup', 10)
    evaluateCyberStoryConsequences(9)
    expect(cyber().pendingConsequenceIds).toEqual([])
  })

  it('queues a consequence exactly on its due day, and stays queued once queued', () => {
    cyber().scheduleConsequenceOnce('phishing-targeted-followup', 10)
    evaluateCyberStoryConsequences(10)
    expect(cyber().pendingConsequenceIds).toEqual(['phishing-targeted-followup'])
    evaluateCyberStoryConsequences(11) // repeated call is a no-op, not a duplicate
    expect(cyber().pendingConsequenceIds).toEqual(['phishing-targeted-followup'])
  })

  it('queues a consequence any day after its due day too (a save that skipped ahead)', () => {
    cyber().scheduleConsequenceOnce('supply-chain-unknown-connection', 5)
    evaluateCyberStoryConsequences(20)
    expect(cyber().pendingConsequenceIds).toEqual(['supply-chain-unknown-connection'])
  })
})

describe('isCyberConsequencePending', () => {
  it('true while pending or running, false once completed', () => {
    expect(isCyberConsequencePending()).toBe(false)
    cyber().queueConsequenceOnce('shadow-it-external-download')
    expect(isCyberConsequencePending()).toBe(true)
    cyber().startConsequence('shadow-it-external-download')
    expect(isCyberConsequencePending()).toBe(true)
    cyber().completeConsequence('shadow-it-external-download')
    expect(isCyberConsequencePending()).toBe(false)
  })
})

describe('applyCyberConsequenceEffects (idempotent per effect id)', () => {
  it('phishing-targeted-followup raises identity-access exactly once', () => {
    applyCyberConsequenceEffects('phishing-targeted-followup', M)
    applyCyberConsequenceEffects('phishing-targeted-followup', M) // repeat: no double effect
    expect(risk('identity-access')).toBe(CYBER_STORY_BALANCE.executivePhishing.followUpIdentityImpact)
  })

  it('supply-chain-unknown-connection raises service-continuity exactly once', () => {
    applyCyberConsequenceEffects('supply-chain-unknown-connection', M)
    applyCyberConsequenceEffects('supply-chain-unknown-connection', M)
    expect(risk('service-continuity')).toBe(CYBER_STORY_BALANCE.supplyChainUpdate.unknownConnectionServiceContinuityImpact)
  })

  it('shadow-it-external-download charges the containment cost and raises sensitive-data/governance, each exactly once', () => {
    applyCyberConsequenceEffects('shadow-it-external-download', M)
    applyCyberConsequenceEffects('shadow-it-external-download', M)
    expect(balance()).toBe(initialTransactions().reduce((s, t) => s + t.amount, 0) - CYBER_STORY_BALANCE.shadowItLogs.futureContainmentCostRub)
    expect(risk('sensitive-data')).toBe(CYBER_STORY_BALANCE.shadowItLogs.externalDownloadSensitiveImpact)
    expect(risk('governance')).toBe(CYBER_STORY_BALANCE.shadowItLogs.externalDownloadGovernanceImpact)
  })

  it('external-credential-usage charges the revocation cost and raises identity-access, each exactly once', () => {
    applyCyberConsequenceEffects('external-credential-usage', M)
    applyCyberConsequenceEffects('external-credential-usage', M)
    expect(balance()).toBe(initialTransactions().reduce((s, t) => s + t.amount, 0) - AB.repositorySecret.exposedCredentialIncidentCostRub)
    expect(risk('identity-access')).toBe(AB.repositorySecret.exposedCredentialIdentityAccessImpact)
  })

  it('credential-found-in-ci-cache charges the late-rotation cost exactly once, no risk signal', () => {
    applyCyberConsequenceEffects('credential-found-in-ci-cache', M)
    applyCyberConsequenceEffects('credential-found-in-ci-cache', M)
    expect(balance()).toBe(initialTransactions().reduce((s, t) => s + t.amount, 0) - AB.repositorySecret.exposedCredentialIncidentCostRubAfterRewrite)
  })

  it('hijacked-session-activity charges the containment cost and raises service-continuity, each exactly once', () => {
    applyCyberConsequenceEffects('hijacked-session-activity', M)
    applyCyberConsequenceEffects('hijacked-session-activity', M)
    expect(balance()).toBe(initialTransactions().reduce((s, t) => s + t.amount, 0) - AB.mfaFatigue.hijackedSessionIncidentCostRub)
    expect(risk('service-continuity')).toBe(AB.mfaFatigue.hijackedSessionServiceContinuityImpact)
  })

  it('unrestricted-ai-recurrence charges the audit cost and raises governance, each exactly once', () => {
    applyCyberConsequenceEffects('unrestricted-ai-recurrence', M)
    applyCyberConsequenceEffects('unrestricted-ai-recurrence', M)
    expect(balance()).toBe(initialTransactions().reduce((s, t) => s + t.amount, 0) - AB.externalAi.shadowAiAuditCostRub)
    expect(risk('governance')).toBe(AB.externalAi.shadowAiGovernanceImpact)
  })

  it('shadow-ai-personal-use is a deliberate no-op - no cost, no risk signal (not a second punishment on the safer ban choice)', () => {
    const txCountBefore = useEconomyStore.getState().transactions.length
    const signalCountBefore = useRiskStore.getState().signals.length
    applyCyberConsequenceEffects('shadow-ai-personal-use', M)
    expect(useEconomyStore.getState().transactions.length).toBe(txCountBefore)
    expect(useRiskStore.getState().signals.length).toBe(signalCountBefore)
  })
})
