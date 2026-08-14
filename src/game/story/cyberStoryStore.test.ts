import { describe, it, expect, beforeEach } from 'vitest'
import { useCyberStoryStore, loadCyberStory, saveCyberStory } from './cyberStoryStore'
import { initialCyberStoryRecords } from './cyberStoryRules'
import { initialCyberStoryFlags } from './cyberStoryTypes'
import { useEconomyStore } from '../economyStore'
import { useRiskStore } from '../riskStore'
import { useStoryWorkStore } from './storyWorkStore'
import { initialTransactions } from '../economyRules'

const store = () => useCyberStoryStore.getState()
const M = { sprintNumber: 1, day: 1 }

beforeEach(() => {
  window.localStorage.clear()
  store().resetCyberStory()
  useEconomyStore.setState({ transactions: initialTransactions() })
  useRiskStore.setState({ signals: [] })
  useStoryWorkStore.getState().resetStoryWork()
})

describe('store init & reset', () => {
  it('holds exactly six locked incidents after reset, idempotently', () => {
    store().resetCyberStory()
    store().resetCyberStory()
    expect(Object.keys(store().incidents)).toHaveLength(6)
    expect(Object.values(store().incidents).every((r) => r.status === 'locked')).toBe(true)
    expect(store().activeIncidentId).toBeUndefined()
    expect(store().pendingConsequenceIds).toEqual([])
    expect(store().scheduledConsequences).toEqual({})
    expect(store().flags).toEqual(initialCyberStoryFlags())
  })

  it('reset clears a resolved campaign back to locked', () => {
    store().unlockIncident('executive-phishing-request', M)
    store().resolveIncident('executive-phishing-request', 'send-requested-data', M)
    store().resetCyberStory()
    expect(store().incidents['executive-phishing-request']).toEqual(initialCyberStoryRecords()['executive-phishing-request'])
  })
})

describe('unlock/start/resolve lifecycle', () => {
  it('unlock -> available (with moment) and becomes the single active incident', () => {
    store().unlockIncident('executive-phishing-request', M)
    const r = store().incidents['executive-phishing-request']
    expect(r.status).toBe('available')
    expect(r.availableAt).toEqual(M)
    expect(store().activeIncidentId).toBe('executive-phishing-request')
  })

  it('unlock is idempotent and never rewinds a resolved incident', () => {
    store().unlockIncident('executive-phishing-request', M)
    store().resolveIncident('executive-phishing-request', 'verify-through-known-channel', M)
    store().unlockIncident('executive-phishing-request', { sprintNumber: 2, day: 2 })
    expect(store().incidents['executive-phishing-request'].status).toBe('resolved')
  })

  it('start requires available; interrupted running rolls back to available', () => {
    store().startIncident('supply-chain-update', M) // locked -> no-op
    expect(store().incidents['supply-chain-update'].status).toBe('locked')
    store().unlockIncident('supply-chain-update', M)
    store().startIncident('supply-chain-update', M)
    expect(store().incidents['supply-chain-update'].status).toBe('running')
    store().markIncidentInterrupted('supply-chain-update')
    expect(store().incidents['supply-chain-update'].status).toBe('available')
  })

  it('resolve records the choice, applies effects and clears the active id', () => {
    store().unlockIncident('supply-chain-update', M)
    const res = store().resolveIncident('supply-chain-update', 'keep-current-version', M)
    expect(res).toEqual({
      applied: true,
      incidentId: 'supply-chain-update',
      choiceId: 'keep-current-version',
      operationId: 'cyber-story:supply-chain-update:keep-current-version',
    })
    const r = store().incidents['supply-chain-update']
    expect(r.status).toBe('resolved')
    expect(r.effectsApplied).toBe(true)
    expect(store().activeIncidentId).toBeUndefined()
  })

  it('an unknown choice id is rejected without state change', () => {
    store().unlockIncident('supply-chain-update', M)
    const res = store().resolveIncident('supply-chain-update', 'hack-the-planet', M)
    expect(res.applied).toBe(false)
    expect(store().incidents['supply-chain-update'].status).toBe('available')
  })
})

describe('repeated & partial resolve (idempotency)', () => {
  it('a repeated resolve returns the EXISTING choice and applies nothing twice', () => {
    store().unlockIncident('shadow-it-log-upload', M)
    store().resolveIncident('shadow-it-log-upload', 'upload-raw-logs-to-personal-cloud', M)
    const balanceAfterFirst = useEconomyStore.getState().transactions.length
    const signalsAfterFirst = useRiskStore.getState().signals.length
    const again = store().resolveIncident('shadow-it-log-upload', 'sanitize-logs-manually', { sprintNumber: 2, day: 2 })
    expect(again.applied).toBe(false)
    expect(again.choiceId).toBe('upload-raw-logs-to-personal-cloud') // the original choice is the truth
    expect(useEconomyStore.getState().transactions.length).toBe(balanceAfterFirst)
    expect(useRiskStore.getState().signals.length).toBe(signalsAfterFirst)
  })

  it('a partially-applied resolve (choice saved, effects flag off) completes safely without duplicating', () => {
    store().unlockIncident('shadow-it-log-upload', M)
    store().resolveIncident('shadow-it-log-upload', 'configure-secure-log-sharing', M)
    const workAfterFirst = useStoryWorkStore.getState().assignments.length
    // simulate the crash between saving the choice and marking effects applied
    useCyberStoryStore.setState({
      incidents: { ...store().incidents, 'shadow-it-log-upload': { ...store().incidents['shadow-it-log-upload'], effectsApplied: false } },
    })
    const retry = store().resolveIncident('shadow-it-log-upload', 'configure-secure-log-sharing', M)
    expect(retry.applied).toBe(false)
    expect(store().incidents['shadow-it-log-upload'].effectsApplied).toBe(true)
    expect(useStoryWorkStore.getState().assignments.length).toBe(workAfterFirst) // no duplicate assignment
  })
})

describe('resetIncident (dev launcher support)', () => {
  it('resets exactly one incident, leaving the others untouched', () => {
    store().unlockIncident('executive-phishing-request', M)
    store().resolveIncident('executive-phishing-request', 'send-requested-data', M)
    store().unlockIncident('supply-chain-update', M)
    store().resolveIncident('supply-chain-update', 'keep-current-version', M)

    store().resetIncident('executive-phishing-request')

    expect(store().incidents['executive-phishing-request'].status).toBe('locked')
    expect(store().flags.phishingInformationExposed).toBe(false)
    expect(store().scheduledConsequences['phishing-targeted-followup']).toBeUndefined()
    // the other incident is untouched
    expect(store().incidents['supply-chain-update'].status).toBe('resolved')
  })

  it('resets a string-literal-flag incident back to its initial (non-boolean) value', () => {
    store().unlockIncident('mfa-fatigue-attack', M)
    store().resolveIncident('mfa-fatigue-attack', 'change-password-only', M)
    expect(store().flags.unknownSessionState).toBe('active')

    store().resetIncident('mfa-fatigue-attack')

    expect(store().incidents['mfa-fatigue-attack'].status).toBe('locked')
    expect(store().flags.unknownSessionState).toBe('none')
    expect(store().scheduledConsequences['hijacked-session-activity']).toBeUndefined()
  })

  it('clears BOTH possible consequences of a two-outcome incident, whichever was actually scheduled', () => {
    store().unlockIncident('secret-committed-to-repository', M)
    store().resolveIncident('secret-committed-to-repository', 'rewrite-repository-history', M)
    expect(store().scheduledConsequences['credential-found-in-ci-cache']).toBeDefined()

    store().resetIncident('secret-committed-to-repository')

    expect(store().incidents['secret-committed-to-repository'].status).toBe('locked')
    expect(store().flags.credentialExposureState).toBe('none')
    expect(store().scheduledConsequences['credential-found-in-ci-cache']).toBeUndefined()
    expect(store().scheduledConsequences['external-credential-usage']).toBeUndefined()
  })
})

describe('consequence scheduling & queue', () => {
  it('schedule -> queue (once due) -> start -> complete, each step idempotent', () => {
    expect(store().scheduleConsequenceOnce('phishing-targeted-followup', 10)).toBe(true)
    expect(store().scheduleConsequenceOnce('phishing-targeted-followup', 99)).toBe(false) // already scheduled

    expect(store().queueConsequenceOnce('phishing-targeted-followup')).toBe(true)
    expect(store().pendingConsequenceIds).toEqual(['phishing-targeted-followup'])
    expect(store().scheduledConsequences['phishing-targeted-followup']).toBeUndefined() // moved out of "scheduled"
    expect(store().queueConsequenceOnce('phishing-targeted-followup')).toBe(false) // already queued

    store().startConsequence('phishing-targeted-followup')
    expect(store().runningConsequenceId).toBe('phishing-targeted-followup')
    expect(store().pendingConsequenceIds).toEqual([])

    store().completeConsequence('phishing-targeted-followup')
    expect(store().runningConsequenceId).toBeUndefined()
    expect(store().completedConsequenceIds).toEqual(['phishing-targeted-followup'])
    // a completed consequence can never be re-scheduled or re-queued
    expect(store().scheduleConsequenceOnce('phishing-targeted-followup', 200)).toBe(false)
    expect(store().queueConsequenceOnce('phishing-targeted-followup')).toBe(false)
  })

  it('an interrupted running consequence returns to the head of the pending queue on reload', () => {
    store().queueConsequenceOnce('shadow-it-external-download')
    store().startConsequence('shadow-it-external-download')
    store().markConsequenceInterrupted('shadow-it-external-download')
    expect(store().runningConsequenceId).toBeUndefined()
    expect(store().pendingConsequenceIds).toEqual(['shadow-it-external-download'])
  })

  it('markEffectAppliedOnce guards a one-time effect', () => {
    expect(store().markEffectAppliedOnce('x')).toBe(true)
    expect(store().markEffectAppliedOnce('x')).toBe(false)
  })
})

describe('persistence', () => {
  it('save/load round-trips and ?intro returns the fresh state', () => {
    store().unlockIncident('executive-phishing-request', M)
    store().resolveIncident('executive-phishing-request', 'send-requested-data', M)
    saveCyberStory(window.localStorage, store())

    const loaded = loadCyberStory(window.localStorage, '')
    expect(loaded.incidents['executive-phishing-request'].status).toBe('resolved')
    expect(loaded.flags.phishingInformationExposed).toBe(true)
    expect(loaded.scheduledConsequences['phishing-targeted-followup']).toBeDefined()

    const reset = loadCyberStory(window.localStorage, '?intro')
    expect(Object.values(reset.incidents).every((r) => r.status === 'locked')).toBe(true)
    expect(window.localStorage.getItem('startup-office-cyber-story')).toBeNull()
  })

  it('a corrupt save hydrates fresh without throwing', () => {
    window.localStorage.setItem('startup-office-cyber-story', '{not json')
    const loaded = loadCyberStory(window.localStorage, '')
    expect(Object.values(loaded.incidents).every((r) => r.status === 'locked')).toBe(true)
  })

  it('save/load round-trips a string-literal state-machine flag (not just booleans)', () => {
    store().unlockIncident('external-ai-data-disclosure', M)
    store().resolveIncident('external-ai-data-disclosure', 'configure-controlled-ai-gateway', M)
    saveCyberStory(window.localStorage, store())

    const loaded = loadCyberStory(window.localStorage, '')
    expect(loaded.flags.shadowAiPolicy).toBe('controlled-gateway')
  })

  it('rejects a corrupt/unknown string-literal flag value and falls back to the initial one', () => {
    window.localStorage.setItem(
      'startup-office-cyber-story',
      JSON.stringify({ incidents: {}, flags: { shadowAiPolicy: 'not-a-real-policy', credentialExposureState: 'rotated' } }),
    )
    const loaded = loadCyberStory(window.localStorage, '')
    expect(loaded.flags.shadowAiPolicy).toBe('unset')
    expect(loaded.flags.credentialExposureState).toBe('rotated')
  })

  it('a running/pending consequence interrupted mid-save rolls to the head of pending on load', () => {
    window.localStorage.setItem(
      'startup-office-cyber-story',
      JSON.stringify({ incidents: {}, runningConsequenceId: 'phishing-targeted-followup', pendingConsequenceIds: [], completedConsequenceIds: [] }),
    )
    const loaded = loadCyberStory(window.localStorage, '')
    expect(loaded.runningConsequenceId).toBeUndefined()
    expect(loaded.pendingConsequenceIds).toEqual(['phishing-targeted-followup'])
  })
})
