import { describe, it, expect, beforeEach } from 'vitest'
import { useCyberStoryStore } from './cyberStoryStore'
import { getCyberStoryIncidentCostModifierRub, getCyberStoryReleaseScoreAdjustment } from './cyberStoryEffectSelectors'
import { applyCyberConsequenceEffects } from './cyberStoryConsequences'
import { CYBER_STORY_BALANCE } from '../balance/cyberStoryBalance'
import { ADDITIONAL_CYBER_STORY_BALANCE } from '../balance/additionalCyberStoryBalance'
import { useTeamStore } from '../teamStore'
import { useEconomyStore } from '../economyStore'
import { useRiskStore } from '../riskStore'
import { useStoryWorkStore } from './storyWorkStore'
import { initialTransactions } from '../economyRules'

const cyber = () => useCyberStoryStore.getState()
const M = { sprintNumber: 1, day: 1 }

beforeEach(() => {
  window.localStorage.clear()
  cyber().resetCyberStory()
  useTeamStore.setState({ hires: [] })
  useEconomyStore.setState({ transactions: initialTransactions() })
  useRiskStore.setState({ signals: [] })
  useStoryWorkStore.getState().resetStoryWork()
})

describe('getCyberStoryIncidentCostModifierRub (Feature 11 integration)', () => {
  it('zero when no cyber-story flag is set', () => {
    expect(getCyberStoryIncidentCostModifierRub('auth-account-incident')).toBe(0)
    expect(getCyberStoryIncidentCostModifierRub('gateway-outage')).toBe(0)
  })

  it('an unmitigated phishing exposure raises only the AUTH incident cost', () => {
    cyber().unlockIncident('executive-phishing-request', M)
    cyber().resolveIncident('executive-phishing-request', 'send-requested-data', M)
    expect(getCyberStoryIncidentCostModifierRub('auth-account-incident')).toBe(CYBER_STORY_BALANCE.executivePhishing.followUpAuthIncidentCostRub)
    expect(getCyberStoryIncidentCostModifierRub('database-exposure-review')).toBe(0)
  })

  it('escalating to security never raises the AUTH incident cost', () => {
    cyber().unlockIncident('executive-phishing-request', M)
    cyber().resolveIncident('executive-phishing-request', 'escalate-phishing-to-security', M)
    expect(getCyberStoryIncidentCostModifierRub('auth-account-incident')).toBe(0)
  })

  it('an unreviewed installed update raises GATEWAY and DATABASE incident cost', () => {
    cyber().unlockIncident('supply-chain-update', M)
    cyber().resolveIncident('supply-chain-update', 'install-update-immediately', M)
    expect(getCyberStoryIncidentCostModifierRub('gateway-outage')).toBe(CYBER_STORY_BALANCE.supplyChainUpdate.compromisedUpdateFutureCostRub)
    expect(getCyberStoryIncidentCostModifierRub('database-exposure-review')).toBe(CYBER_STORY_BALANCE.supplyChainUpdate.compromisedUpdateFutureCostRub)
    expect(getCyberStoryIncidentCostModifierRub('auth-account-incident')).toBe(0)
  })

  it('reviewing and pinning the dependency never raises the incident cost', () => {
    cyber().unlockIncident('supply-chain-update', M)
    cyber().resolveIncident('supply-chain-update', 'review-and-pin-dependency', M)
    expect(getCyberStoryIncidentCostModifierRub('gateway-outage')).toBe(0)
  })

  it('an unrotated exposed credential raises only the AUTH incident cost', () => {
    cyber().unlockIncident('secret-committed-to-repository', M)
    cyber().resolveIncident('secret-committed-to-repository', 'remove-secret-in-new-commit', M)
    expect(getCyberStoryIncidentCostModifierRub('auth-account-incident')).toBe(ADDITIONAL_CYBER_STORY_BALANCE.repositorySecret.unrotatedCredentialAuthIncidentCostRub)
    expect(getCyberStoryIncidentCostModifierRub('gateway-outage')).toBe(0)
  })

  it('an actual rotation never raises the AUTH incident cost', () => {
    cyber().unlockIncident('secret-committed-to-repository', M)
    cyber().resolveIncident('secret-committed-to-repository', 'rotate-and-secure-secret', M)
    expect(getCyberStoryIncidentCostModifierRub('auth-account-incident')).toBe(0)
  })

  it('a completed hijacked-session-activity consequence raises GATEWAY and DATABASE incident cost', () => {
    cyber().unlockIncident('mfa-fatigue-attack', M)
    cyber().resolveIncident('mfa-fatigue-attack', 'change-password-only', M)
    applyCyberConsequenceEffects('hijacked-session-activity', M)
    cyber().completeConsequence('hijacked-session-activity')
    expect(getCyberStoryIncidentCostModifierRub('gateway-outage')).toBe(ADDITIONAL_CYBER_STORY_BALANCE.mfaFatigue.hijackedSessionSupplyChainCostRub)
    expect(getCyberStoryIncidentCostModifierRub('database-exposure-review')).toBe(ADDITIONAL_CYBER_STORY_BALANCE.mfaFatigue.hijackedSessionSupplyChainCostRub)
    expect(getCyberStoryIncidentCostModifierRub('auth-account-incident')).toBe(0)
  })
})

describe('getCyberStoryReleaseScoreAdjustment (Feature 13 integration)', () => {
  it('zero when no cyber-story consequence has completed', () => {
    expect(getCyberStoryReleaseScoreAdjustment()).toBe(0)
  })

  it('sums the documented penalty for each landed Feature 19B consequence', () => {
    cyber().unlockIncident('secret-committed-to-repository', M)
    cyber().resolveIncident('secret-committed-to-repository', 'remove-secret-in-new-commit', M)
    applyCyberConsequenceEffects('external-credential-usage', M)
    cyber().completeConsequence('external-credential-usage')
    expect(getCyberStoryReleaseScoreAdjustment()).toBe(ADDITIONAL_CYBER_STORY_BALANCE.repositorySecret.exposedCredentialExternalUsagePenalty)
  })

  it('the softer shadow-ai-personal-use beat carries no release-score penalty', () => {
    cyber().unlockIncident('external-ai-data-disclosure', M)
    cyber().resolveIncident('external-ai-data-disclosure', 'ban-external-ai-tools', M)
    applyCyberConsequenceEffects('shadow-ai-personal-use', M)
    cyber().completeConsequence('shadow-ai-personal-use')
    expect(getCyberStoryReleaseScoreAdjustment()).toBe(0)
  })
})
