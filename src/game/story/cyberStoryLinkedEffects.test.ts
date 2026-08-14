import { describe, it, expect, beforeEach } from 'vitest'
import { applyCentralLoggingDetectionSpeedup, hasSecureLogMasking, hasStrongPhishingDefense } from './cyberStoryLinkedEffects'
import { useStoryDecisionStore } from './storyDecisionStore'
import { initialStoryDecisionRecords } from './storyDecisionRules'
import { initialCyberStoryFlags } from './cyberStoryTypes'

beforeEach(() => {
  useStoryDecisionStore.setState({ decisions: initialStoryDecisionRecords(), activeDecisionId: undefined, completedCheckpointIds: [] })
})

function resolveFirstPriority(choiceId: 'prioritize-central-logging' | 'prioritize-security-training' | 'prioritize-endpoint-protection') {
  useStoryDecisionStore.setState({
    decisions: { ...initialStoryDecisionRecords(), 'security-first-priority': { decisionId: 'security-first-priority', status: 'resolved', selectedChoiceId: choiceId, effectsApplied: true } },
  })
}

describe('hasStrongPhishingDefense', () => {
  it('is false on fresh flags and true only once escalate-phishing-to-security fired', () => {
    expect(hasStrongPhishingDefense(initialCyberStoryFlags())).toBe(false)
    expect(hasStrongPhishingDefense({ ...initialCyberStoryFlags(), phishingEscalatedToSecurity: true })).toBe(true)
  })

  it('other phishing outcomes do not count as a strong defence', () => {
    expect(hasStrongPhishingDefense({ ...initialCyberStoryFlags(), phishingVerifiedAndRejected: true })).toBe(false)
    expect(hasStrongPhishingDefense({ ...initialCyberStoryFlags(), phishingInformationExposed: true })).toBe(false)
  })
})

describe('hasSecureLogMasking', () => {
  it('is true only once configure-secure-log-sharing fired', () => {
    expect(hasSecureLogMasking(initialCyberStoryFlags())).toBe(false)
    expect(hasSecureLogMasking({ ...initialCyberStoryFlags(), secureLogSharingConfigured: true })).toBe(true)
  })
})

describe('applyCentralLoggingDetectionSpeedup', () => {
  it('leaves the delay untouched when central logging was never chosen', () => {
    expect(applyCentralLoggingDetectionSpeedup(5)).toBe(5)
  })

  it('leaves the delay untouched for an unrelated first-priority choice', () => {
    resolveFirstPriority('prioritize-endpoint-protection')
    expect(applyCentralLoggingDetectionSpeedup(5)).toBe(5)
  })

  it('shortens the delay by one workday once central logging was chosen, never below one', () => {
    resolveFirstPriority('prioritize-central-logging')
    expect(applyCentralLoggingDetectionSpeedup(5)).toBe(4)
    expect(applyCentralLoggingDetectionSpeedup(1)).toBe(1)
  })
})
