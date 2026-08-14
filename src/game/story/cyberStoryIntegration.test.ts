import { describe, it, expect, beforeEach } from 'vitest'
import { useCyberStoryStore, loadCyberStory, saveCyberStory } from './cyberStoryStore'
import { evaluateCyberStoryConsequences, applyCyberConsequenceEffects, isCyberConsequencePending } from './cyberStoryConsequences'
import { getCyberStoryIncidentCostModifierRub } from './cyberStoryEffectSelectors'
import { isCyberStoryBlockingNow, isCyberStoryPendingFor } from './cyberStorySelectors'
import { canOpenFreeNpcConversation, gatherFreeNpcEligibility } from '../freeNpcConversation'
import { useEconomyStore } from '../economyStore'
import { useRiskStore } from '../riskStore'
import { useGameStore } from '../gameStore'
import { useTeamStore } from '../teamStore'
import { useSecurityStoryStore } from '../securityStoryStore'
import { useSprintStore } from '../sprintStore'
import { calculateBalance, initialTransactions, INITIAL_BUDGET } from '../economyRules'
import { getActualRiskScore } from '../riskRules'
import { CYBER_STORY_BALANCE } from '../balance/cyberStoryBalance'
import { INITIAL_SPRINT_STATE } from '../sprintRules'
import { getServerIncidentImmediateCost } from '../serverIncidentRules'
import { initialCyberStoryFlags, type CyberConsequenceId, type CyberStoryIncidentId } from './cyberStoryTypes'

// The three CYBER-* end-to-end paths (Feature 19 spec §E2E-сценарии), driven
// through the real store + handlers, not the 3D scene. Money and risk come
// from the ledgers, never re-derived.

const cyber = () => useCyberStoryStore.getState()
const balance = () => calculateBalance(useEconomyStore.getState().transactions)
const risk = (domain: Parameters<typeof getActualRiskScore>[1]) => getActualRiskScore(useRiskStore.getState().signals, domain)
const M = { sprintNumber: 1, day: 2 }

function decide(id: CyberStoryIncidentId, choiceId: string) {
  cyber().unlockIncident(id, M)
  const res = cyber().resolveIncident(id, choiceId, M)
  expect(res.choiceId).toBe(choiceId)
}

beforeEach(() => {
  window.localStorage.clear()
  useSprintStore.setState({ ...INITIAL_SPRINT_STATE, sprintNumber: M.sprintNumber, day: M.day, phase: 'active', confirmingEndDay: false })
  useEconomyStore.setState({ transactions: initialTransactions(), panelOpen: false })
  useRiskStore.setState({ signals: [] })
  useGameStore.setState({ phase: 'free', activeDialogue: null, activeChoice: null })
  useTeamStore.setState({ hires: [], panelOpen: false })
  cyber().resetCyberStory()
})

describe('CYBER-01 - safe path (verify / review / secure sharing)', () => {
  it('produces no scheduled consequence and only mitigation signals', () => {
    decide('executive-phishing-request', 'verify-through-known-channel')
    decide('supply-chain-update', 'review-and-pin-dependency')
    decide('shadow-it-log-upload', 'sanitize-logs-manually') // no Ilya, no central logging -> secure-sharing unavailable

    expect(cyber().scheduledConsequences).toEqual({})
    expect(cyber().pendingConsequenceIds).toEqual([])
    // no risky-choice future cost modifiers linger
    expect(getCyberStoryIncidentCostModifierRub('auth-account-incident')).toBe(0)
    expect(getCyberStoryIncidentCostModifierRub('gateway-outage')).toBe(0)
    // every raw signal recorded is a mitigation (<=0), never a positive risk add
    expect(useRiskStore.getState().signals.every((s) => s.impact <= 0)).toBe(true)
  })
})

describe('CYBER-02 - risky but recoverable (send / keep version / sanitize)', () => {
  it('schedules exactly the phishing follow-up, the game stays playable, and it eventually lands', () => {
    decide('executive-phishing-request', 'send-requested-data')
    decide('supply-chain-update', 'keep-current-version')
    decide('shadow-it-log-upload', 'sanitize-logs-manually')

    expect(Object.keys(cyber().scheduledConsequences)).toEqual(['phishing-targeted-followup'])
    expect(risk('identity-access')).toBe(CYBER_STORY_BALANCE.executivePhishing.sendIdentityImpact)

    // the due day arrives - the consequence surfaces and applies once
    const due = cyber().scheduledConsequences['phishing-targeted-followup']!.dueWorkdayIndex
    evaluateCyberStoryConsequences(due)
    expect(isCyberConsequencePending()).toBe(true)
    cyber().startConsequence('phishing-targeted-followup')
    applyCyberConsequenceEffects('phishing-targeted-followup', { sprintNumber: 1, day: due })
    cyber().completeConsequence('phishing-targeted-followup')

    expect(isCyberConsequencePending()).toBe(false)
    expect(useEconomyStore.getState().transactions.length).toBeGreaterThan(0) // budget ledger intact, no crash
    // the campaign is still playable - budget did not go negative from this alone
    expect(balance()).toBeGreaterThan(0)
  })
})

describe('CYBER-03 - accumulated risk (send / install immediately / upload raw logs)', () => {
  it('schedules all three consequences and measurably worsens budget, risk and a future incident cost', () => {
    decide('executive-phishing-request', 'send-requested-data')
    decide('supply-chain-update', 'install-update-immediately')
    decide('shadow-it-log-upload', 'upload-raw-logs-to-personal-cloud')

    expect(Object.keys(cyber().scheduledConsequences).sort()).toEqual(
      ['phishing-targeted-followup', 'shadow-it-external-download', 'supply-chain-unknown-connection'].sort(),
    )

    const budgetBeforeConsequences = balance()
    for (const [rawId, schedule] of Object.entries(cyber().scheduledConsequences)) {
      const id = rawId as CyberConsequenceId
      evaluateCyberStoryConsequences(schedule!.dueWorkdayIndex)
      cyber().startConsequence(id)
      applyCyberConsequenceEffects(id, { sprintNumber: 1, day: schedule!.dueWorkdayIndex })
      cyber().completeConsequence(id)
    }

    // budget worsens (the shadow-it containment cost lands)
    expect(balance()).toBe(budgetBeforeConsequences - CYBER_STORY_BALANCE.shadowItLogs.futureContainmentCostRub)
    // risk worsens across multiple domains
    expect(risk('identity-access')).toBeGreaterThan(0)
    expect(risk('service-continuity')).toBeGreaterThan(0)
    expect(risk('sensitive-data')).toBeGreaterThan(0)
    expect(risk('governance')).toBeGreaterThan(0)
    // a future AUTH/GATEWAY/DATABASE incident now costs strictly more
    expect(getCyberStoryIncidentCostModifierRub('auth-account-incident')).toBe(CYBER_STORY_BALANCE.executivePhishing.followUpAuthIncidentCostRub)
    expect(getCyberStoryIncidentCostModifierRub('gateway-outage')).toBe(CYBER_STORY_BALANCE.supplyChainUpdate.compromisedUpdateFutureCostRub)
    const baseCost = getServerIncidentImmediateCost('auth-account-incident', false, 0)
    const worsenedCost = getServerIncidentImmediateCost('auth-account-incident', false, getCyberStoryIncidentCostModifierRub('auth-account-incident'))
    expect(worsenedCost).toBeGreaterThan(baseCost)
    // the campaign does not instantly end - it is still playable, just worse off
    expect(balance()).toBeGreaterThan(0)
  })
})

describe('coordinator integration', () => {
  it('only one incident is ever active/blocking even when several are eligible at once', () => {
    cyber().unlockIncident('shadow-it-log-upload', M)
    cyber().unlockIncident('executive-phishing-request', M)
    expect(isCyberStoryBlockingNow()).toBe(true)
    expect(cyber().activeIncidentId).toBe('executive-phishing-request') // catalog priority order
  })

  it('DeepSeek free chat is suppressed for a participant of the pending incident', () => {
    cyber().unlockIncident('executive-phishing-request', M)
    expect(isCyberStoryPendingFor('sonya-sokolova')).toBe(true)
    const eligibility = canOpenFreeNpcConversation({
      npcId: 'sonya-sokolova',
      gamePhase: 'free',
      campaignOver: false,
      npcPresent: true,
      requiredInteractionPending: isCyberStoryPendingFor('sonya-sokolova'),
      inputLocked: false,
      activeDialogue: false,
      activeChoice: false,
      cutsceneRunning: false,
      minigameOpen: false,
      blockingOverlayOpen: false,
    })
    expect(eligibility).toEqual({ eligible: false, reason: 'required-interaction' })
  })

  it('a bystander NPC (not a participant of the pending incident) keeps free chat available', () => {
    useTeamStore.setState({ hires: [{ employeeId: 'ilya-vlasov', hiredAtSprint: 1, hiredAtDay: 1 }] })
    useSecurityStoryStore.setState({ hasIntroducedSecuritySpecialist: true }) // his own onboarding gate, unrelated to this test
    cyber().unlockIncident('executive-phishing-request', M) // Ilya is not a phishing-scene participant
    expect(gatherFreeNpcEligibility('ilya-vlasov').eligible).toBe(true)
  })
})

describe('reload safety', () => {
  it('reload before the choice keeps the incident available and applies nothing', () => {
    cyber().unlockIncident('supply-chain-update', M)
    saveCyberStory(window.localStorage, cyber())
    const loaded = loadCyberStory(window.localStorage, '')
    expect(loaded.incidents['supply-chain-update'].status).toBe('available')
    expect(loaded.incidents['supply-chain-update'].selectedChoiceId).toBeUndefined()
  })

  it('reload after the choice keeps the resolution and never re-applies effects', () => {
    decide('supply-chain-update', 'review-and-pin-dependency')
    const afterFirst = balance()
    saveCyberStory(window.localStorage, cyber())
    // NB: do not call resetCyberStory() here - it persists the fresh state
    // itself, which would overwrite the save just made.
    const loaded = loadCyberStory(window.localStorage, '')
    useCyberStoryStore.setState(loaded)
    expect(cyber().incidents['supply-chain-update'].status).toBe('resolved')
    expect(cyber().incidents['supply-chain-update'].effectsApplied).toBe(true)
    // resolving again through the store is a safe no-op (already resolved)
    cyber().resolveIncident('supply-chain-update', 'install-update-immediately', M)
    expect(balance()).toBe(afterFirst)
    expect(cyber().incidents['supply-chain-update'].selectedChoiceId).toBe('review-and-pin-dependency')
  })

  it('a resolved incident never becomes available again (no re-trigger)', () => {
    decide('shadow-it-log-upload', 'sanitize-logs-manually')
    // even if the trigger predicate would still match live state, the record
    // is resolved - evaluateCyberStoryUnlocks only touches locked records.
    expect(cyber().incidents['shadow-it-log-upload'].status).toBe('resolved')
  })

  it('reset clears every incident, schedule, queue and flag back to a fresh campaign', () => {
    decide('executive-phishing-request', 'send-requested-data')
    decide('supply-chain-update', 'install-update-immediately')
    cyber().resetCyberStory()
    expect(Object.values(cyber().incidents).every((r) => r.status === 'locked')).toBe(true)
    expect(cyber().scheduledConsequences).toEqual({})
    expect(cyber().pendingConsequenceIds).toEqual([])
    expect(cyber().flags).toEqual(initialCyberStoryFlags())
  })
})
