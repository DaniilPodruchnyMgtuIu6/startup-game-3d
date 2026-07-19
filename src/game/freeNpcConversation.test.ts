import { describe, it, expect, beforeEach } from 'vitest'
import { canOpenFreeNpcConversation, npcRequiredInteractionPending, type FreeNpcConversationContext } from './freeNpcConversation'
import { useGameStore } from './gameStore'
import { useSecurityStoryStore } from './securityStoryStore'
import { INITIAL_SECURITY_BREACH } from './securityStoryRules'

// Feature 16 §5: a mandatory story interaction always outranks the optional
// DeepSeek free chat — you can never open free chat instead of an unfinished
// story conversation, and the free-chat marker is hidden while one is pending.

const base: FreeNpcConversationContext = {
  npcId: 'sonya-sokolova',
  gamePhase: 'free',
  campaignOver: false,
  npcPresent: true,
  requiredInteractionPending: false,
  inputLocked: false,
  activeDialogue: false,
  activeChoice: false,
  cutsceneRunning: false,
  minigameOpen: false,
  blockingOverlayOpen: false,
}

describe('free chat vs mandatory story', () => {
  it('a pending required interaction blocks free chat', () => {
    expect(canOpenFreeNpcConversation({ ...base, requiredInteractionPending: true })).toEqual({
      eligible: false,
      reason: 'required-interaction',
    })
    // and it is eligible when nothing mandatory is pending
    expect(canOpenFreeNpcConversation(base).eligible).toBe(true)
  })

  describe('npcRequiredInteractionPending', () => {
    beforeEach(() => {
      window.localStorage.clear()
      useSecurityStoryStore.setState({
        securityBreach: { ...INITIAL_SECURITY_BREACH, status: 'completed', decision: 'take-responsibility', effectsApplied: true },
        postAuditConversation: { status: 'completed', staffingDecision: 'decline-security-hire', completedAt: { sprintNumber: 2, day: 1 }, effectsApplied: true },
        hasIntroducedSecuritySpecialist: false,
      })
    })

    it('is true for Sonya while the meet-the-PM story is unfinished', () => {
      useGameStore.setState({ phase: 'meetPm' })
      expect(npcRequiredInteractionPending('sonya-sokolova')).toBe(true)
    })

    it('is true for Sonya while the post-audit conversation is pending', () => {
      useGameStore.setState({ phase: 'free' })
      useSecurityStoryStore.setState((s) => ({ postAuditConversation: { ...s.postAuditConversation, status: 'pending' } }))
      expect(npcRequiredInteractionPending('sonya-sokolova')).toBe(true)
    })

    it('is false for developers (Kirill/Alina never have story beats)', () => {
      useGameStore.setState({ phase: 'free' })
      expect(npcRequiredInteractionPending('kirill-morozov')).toBe(false)
      expect(npcRequiredInteractionPending('alina-belova')).toBe(false)
    })
  })
})
