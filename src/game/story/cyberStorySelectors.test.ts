import { describe, it, expect, beforeEach } from 'vitest'
import { useCyberStoryStore } from './cyberStoryStore'
import { isCyberStoryBlockingNow, isCyberStoryPendingFor } from './cyberStorySelectors'

const cyber = () => useCyberStoryStore.getState()
const M = { sprintNumber: 1, day: 1 }

beforeEach(() => {
  window.localStorage.clear()
  cyber().resetCyberStory()
})

describe('isCyberStoryBlockingNow', () => {
  it('false with nothing available, true once an incident is available, false again once resolved', () => {
    expect(isCyberStoryBlockingNow()).toBe(false)
    cyber().unlockIncident('executive-phishing-request', M)
    expect(isCyberStoryBlockingNow()).toBe(true)
    cyber().resolveIncident('executive-phishing-request', 'verify-through-known-channel', M)
    expect(isCyberStoryBlockingNow()).toBe(false)
  })
})

describe('isCyberStoryPendingFor (hides the optional DeepSeek marker)', () => {
  it('true for a participant of the active incident, false for a bystander', () => {
    cyber().unlockIncident('executive-phishing-request', M)
    expect(isCyberStoryPendingFor('sonya-sokolova')).toBe(true)
    expect(isCyberStoryPendingFor('kirill-morozov')).toBe(true) // participant
    expect(isCyberStoryPendingFor('ilya-vlasov')).toBe(false) // not a phishing-scene participant
  })

  it('false once nothing is blocking', () => {
    expect(isCyberStoryPendingFor('sonya-sokolova')).toBe(false)
  })
})
