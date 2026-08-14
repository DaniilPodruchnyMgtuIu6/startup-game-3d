import { describe, it, expect } from 'vitest'
import { cyberCatalogMatchesPriority, CYBER_STORY_CATALOG } from './cyberStoryCatalog'
import {
  canUnlockExecutivePhishing,
  canUnlockExternalAiDataDisclosure,
  canUnlockMfaFatigueAttack,
  canUnlockSecretCommittedToRepository,
  canUnlockShadowItLogUpload,
  canUnlockSupplyChainUpdate,
  getActiveBlockingCyberIncidentId,
  initialCyberStoryRecords,
  isCyberConsequenceId,
  isValidCyberChoice,
  normalizeCyberStoryRecords,
} from './cyberStoryRules'
import { SPRINT_DAYS } from '../sprintRules'
import { CYBER_STORY_INCIDENT_PRIORITY } from './cyberStoryTypes'

describe('cyberStoryCatalog', () => {
  it('the six scene ids are unique and cover the priority list exactly', () => {
    expect(new Set(CYBER_STORY_INCIDENT_PRIORITY).size).toBe(6)
    expect(cyberCatalogMatchesPriority()).toBe(true)
  })

  it('the catalog lists every choice referenced by the Feature 19 spec, per scene', () => {
    const byId = Object.fromEntries(CYBER_STORY_CATALOG.map((d) => [d.id, d.choiceIds]))
    expect(byId['executive-phishing-request']).toEqual(['send-requested-data', 'verify-through-known-channel', 'escalate-phishing-to-security'])
    expect(byId['supply-chain-update']).toEqual(['install-update-immediately', 'keep-current-version', 'review-and-pin-dependency'])
    expect(byId['shadow-it-log-upload']).toEqual(['upload-raw-logs-to-personal-cloud', 'sanitize-logs-manually', 'configure-secure-log-sharing'])
    expect(byId['secret-committed-to-repository']).toEqual(['remove-secret-in-new-commit', 'rewrite-repository-history', 'rotate-and-secure-secret'])
    expect(byId['mfa-fatigue-attack']).toEqual(['change-password-only', 'revoke-sessions-and-investigate', 'enable-phishing-resistant-auth'])
    expect(byId['external-ai-data-disclosure']).toEqual(['allow-unrestricted-ai-tools', 'ban-external-ai-tools', 'configure-controlled-ai-gateway'])
  })

  it('all six incidents are blocking (mandatory)', () => {
    expect(CYBER_STORY_CATALOG.every((d) => d.blocking)).toBe(true)
  })
})

describe('isValidCyberChoice', () => {
  it('accepts only catalog choices for the given incident', () => {
    expect(isValidCyberChoice('executive-phishing-request', 'send-requested-data')).toBe(true)
    expect(isValidCyberChoice('executive-phishing-request', 'install-update-immediately')).toBe(false)
    expect(isValidCyberChoice('executive-phishing-request', 'hack-the-planet')).toBe(false)
  })
})

describe('trigger: executive-phishing-request', () => {
  it('requires both developers hired, an active sprint, and not the kickoff day', () => {
    expect(canUnlockExecutivePhishing({ kirillHired: true, alinaHired: true, sprintPhase: 'active', day: 2 })).toBe(true)
    expect(canUnlockExecutivePhishing({ kirillHired: false, alinaHired: true, sprintPhase: 'active', day: 2 })).toBe(false)
    expect(canUnlockExecutivePhishing({ kirillHired: true, alinaHired: false, sprintPhase: 'active', day: 2 })).toBe(false)
    expect(canUnlockExecutivePhishing({ kirillHired: true, alinaHired: true, sprintPhase: 'planning', day: 2 })).toBe(false)
    expect(canUnlockExecutivePhishing({ kirillHired: true, alinaHired: true, sprintPhase: 'active', day: 1 })).toBe(false)
  })
})

describe('trigger: supply-chain-update', () => {
  it('requires Kirill hired, >=3 done tasks, 1-2 workdays before review, and the AUTH task active/done', () => {
    const base = { kirillHired: true, completedProductTasks: 3, sprintPhase: 'active' as const, authTaskActiveOrDone: true }
    expect(canUnlockSupplyChainUpdate({ ...base, day: SPRINT_DAYS - 1 })).toBe(true)
    expect(canUnlockSupplyChainUpdate({ ...base, day: SPRINT_DAYS - 2 })).toBe(true)
    expect(canUnlockSupplyChainUpdate({ ...base, day: SPRINT_DAYS })).toBe(false) // review itself, not "1-2 days before"
    expect(canUnlockSupplyChainUpdate({ ...base, day: SPRINT_DAYS - 3 })).toBe(false) // too early
    expect(canUnlockSupplyChainUpdate({ ...base, day: SPRINT_DAYS - 1, completedProductTasks: 2 })).toBe(false)
    expect(canUnlockSupplyChainUpdate({ ...base, day: SPRINT_DAYS - 1, kirillHired: false })).toBe(false)
    expect(canUnlockSupplyChainUpdate({ ...base, day: SPRINT_DAYS - 1, authTaskActiveOrDone: false })).toBe(false)
    expect(canUnlockSupplyChainUpdate({ ...base, day: SPRINT_DAYS - 1, sprintPhase: 'planning' })).toBe(false)
  })
})

describe('trigger: shadow-it-log-upload', () => {
  it('requires both developers hired, frontend-test-data resolved, and the first prototype ready', () => {
    const base = { kirillHired: true, alinaHired: true, frontendTestDataResolved: true, firstPrototypeReady: true }
    expect(canUnlockShadowItLogUpload(base)).toBe(true)
    expect(canUnlockShadowItLogUpload({ ...base, frontendTestDataResolved: false })).toBe(false)
    expect(canUnlockShadowItLogUpload({ ...base, firstPrototypeReady: false })).toBe(false)
    expect(canUnlockShadowItLogUpload({ ...base, kirillHired: false })).toBe(false)
    expect(canUnlockShadowItLogUpload({ ...base, alinaHired: false })).toBe(false)
  })
})

describe('trigger: secret-committed-to-repository', () => {
  it('requires Kirill hired, real backend progress, and no other cyber scene triggered the same day', () => {
    const base = { kirillHired: true, hasBackendProgress: true, otherIncidentAvailableOrResolvedToday: false }
    expect(canUnlockSecretCommittedToRepository(base)).toBe(true)
    expect(canUnlockSecretCommittedToRepository({ ...base, kirillHired: false })).toBe(false)
    expect(canUnlockSecretCommittedToRepository({ ...base, hasBackendProgress: false })).toBe(false)
    expect(canUnlockSecretCommittedToRepository({ ...base, otherIncidentAvailableOrResolvedToday: true })).toBe(false)
  })
})

describe('trigger: mfa-fatigue-attack', () => {
  it('requires Kirill hired, a real first prototype, not the kickoff day, and phishing settled (resolved, or the campaign already past sprint 1), plus spacing', () => {
    const base = { kirillHired: true, hasFirstPrototype: true, phishingResolved: true, sprintNumber: 1, day: 2, otherIncidentAvailableOrResolvedToday: false }
    expect(canUnlockMfaFatigueAttack(base)).toBe(true)
    expect(canUnlockMfaFatigueAttack({ ...base, kirillHired: false })).toBe(false)
    expect(canUnlockMfaFatigueAttack({ ...base, hasFirstPrototype: false })).toBe(false)
    expect(canUnlockMfaFatigueAttack({ ...base, day: 1 })).toBe(false)
    expect(canUnlockMfaFatigueAttack({ ...base, phishingResolved: false, sprintNumber: 1 })).toBe(false)
    expect(canUnlockMfaFatigueAttack({ ...base, phishingResolved: false, sprintNumber: 2 })).toBe(true)
    expect(canUnlockMfaFatigueAttack({ ...base, otherIncidentAvailableOrResolvedToday: true })).toBe(false)
  })
})

describe('trigger: external-ai-data-disclosure', () => {
  it('requires Alina hired, real frontend progress, sprint <= 5, and spacing', () => {
    const base = { alinaHired: true, hasFrontendProgress: true, sprintNumber: 3, otherIncidentAvailableOrResolvedToday: false }
    expect(canUnlockExternalAiDataDisclosure(base)).toBe(true)
    expect(canUnlockExternalAiDataDisclosure({ ...base, alinaHired: false })).toBe(false)
    expect(canUnlockExternalAiDataDisclosure({ ...base, hasFrontendProgress: false })).toBe(false)
    expect(canUnlockExternalAiDataDisclosure({ ...base, sprintNumber: 6 })).toBe(false)
    expect(canUnlockExternalAiDataDisclosure({ ...base, otherIncidentAvailableOrResolvedToday: true })).toBe(false)
  })
})

describe('isCyberConsequenceId', () => {
  it('recognizes all eight consequence ids (Feature 19A + 19B) and rejects unknown strings', () => {
    const ids = [
      'phishing-targeted-followup',
      'supply-chain-unknown-connection',
      'shadow-it-external-download',
      'external-credential-usage',
      'credential-found-in-ci-cache',
      'hijacked-session-activity',
      'unrestricted-ai-recurrence',
      'shadow-ai-personal-use',
    ]
    for (const id of ids) expect(isCyberConsequenceId(id)).toBe(true)
    expect(isCyberConsequenceId('not-a-real-consequence')).toBe(false)
  })
})

describe('priority & blocking (only one incident blocking at a time)', () => {
  it('no incident available -> no active id', () => {
    expect(getActiveBlockingCyberIncidentId(initialCyberStoryRecords())).toBeUndefined()
  })

  it('a running incident always wins over any available one', () => {
    const records = initialCyberStoryRecords()
    records['shadow-it-log-upload'] = { ...records['shadow-it-log-upload'], status: 'available' }
    records['executive-phishing-request'] = { ...records['executive-phishing-request'], status: 'running' }
    expect(getActiveBlockingCyberIncidentId(records)).toBe('executive-phishing-request')
  })

  it('among several available incidents, the catalog priority order wins', () => {
    const records = initialCyberStoryRecords()
    records['shadow-it-log-upload'] = { ...records['shadow-it-log-upload'], status: 'available' }
    records['supply-chain-update'] = { ...records['supply-chain-update'], status: 'available' }
    expect(getActiveBlockingCyberIncidentId(records)).toBe('supply-chain-update')
  })

  it('a resolved incident is never blocking', () => {
    const records = initialCyberStoryRecords()
    records['executive-phishing-request'] = { ...records['executive-phishing-request'], status: 'resolved', selectedChoiceId: 'send-requested-data', effectsApplied: true }
    expect(getActiveBlockingCyberIncidentId(records)).toBeUndefined()
  })
})

describe('persistence normalisation', () => {
  it('normalizes a fresh/empty blob into six locked records', () => {
    const { incidents, activeIncidentId } = normalizeCyberStoryRecords(undefined)
    expect(Object.keys(incidents)).toHaveLength(6)
    expect(Object.values(incidents).every((r) => r.status === 'locked')).toBe(true)
    expect(activeIncidentId).toBeUndefined()
  })

  it('a running status never survives normalisation - it rolls back to available', () => {
    const { incidents } = normalizeCyberStoryRecords({ incidents: { 'executive-phishing-request': { status: 'running' } } })
    expect(incidents['executive-phishing-request'].status).toBe('available')
  })

  it('a resolved record without a valid choice rolls back to available', () => {
    const { incidents } = normalizeCyberStoryRecords({ incidents: { 'supply-chain-update': { status: 'resolved' } } })
    expect(incidents['supply-chain-update'].status).toBe('available')
  })

  it('an invalid selectedChoiceId is dropped and the status repaired', () => {
    const { incidents } = normalizeCyberStoryRecords({ incidents: { 'shadow-it-log-upload': { status: 'resolved', selectedChoiceId: 'not-a-real-choice' } } })
    expect(incidents['shadow-it-log-upload'].selectedChoiceId).toBeUndefined()
    expect(incidents['shadow-it-log-upload'].status).toBe('available')
  })

  it('a garbage blob normalizes without throwing', () => {
    expect(() => normalizeCyberStoryRecords('not an object' as unknown)).not.toThrow()
    expect(() => normalizeCyberStoryRecords(null)).not.toThrow()
  })
})
