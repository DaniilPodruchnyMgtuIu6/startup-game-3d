import { describe, it, expect, beforeEach, vi } from 'vitest'

vi.mock('../../cutscenes/videoCutscene', () => ({ playVideoCutscene: () => Promise.resolve(false) }))

import { cyberStoryDevScenes, DEV_SCENE_IDS } from './cyberStoryDevLauncher'
import { useCyberStoryStore } from './cyberStoryStore'
import { useAccessControlStore } from '../accessControlStore'
import { useCutsceneStore } from '../../cutscenes/cutsceneStore'
import { useGameStore } from '../gameStore'
import { useSprintStore } from '../sprintStore'
import { useTeamStore } from '../teamStore'
import { useEconomyStore } from '../economyStore'
import { useRiskStore } from '../riskStore'
import { useProductStore } from '../productStore'
import { useStoryWorkStore } from './storyWorkStore'
import { useCharacterStore, PLAYER_ID } from '../../character/characterStore'
import { getSceneLeadCharacterId } from './cyberStoryInteraction'
import { initialTransactions, calculateBalance, INITIAL_BUDGET } from '../economyRules'
import { CYBER_STORY_BALANCE } from '../balance/cyberStoryBalance'
import { initialTaskStates } from '../productRules'
import { INITIAL_SPRINT_STATE } from '../sprintRules'
import { BOARD_TASKS } from '../tasks'

const cyber = () => useCyberStoryStore.getState()
const tick = () => new Promise((r) => setTimeout(r, 0))

// Drives every dialogue line/choice until `run()` resolves - the same pattern
// used by cyberStoryInteraction.test.ts, so the reaction line after the choice
// is drained too (otherwise the caller's `await run()` would hang forever).
async function play(run: () => Promise<void>, pick: string): Promise<{ choiceShown: boolean }> {
  let done = false
  let choiceShown = false
  const promise = run().then(() => {
    done = true
  })
  for (let i = 0; i < 300 && !done; i++) {
    await tick()
    const g = useGameStore.getState()
    if (g.activeChoice) {
      choiceShown = true
      g.chooseOption(pick)
    } else if (g.activeDialogue) {
      g.advanceDialogue()
    }
  }
  await promise
  return { choiceShown }
}

beforeEach(() => {
  window.localStorage.clear()
  cyber().resetCyberStory()
  useAccessControlStore.getState().resetAccessControl()
  useCutsceneStore.setState({ activeSceneId: null })
  useSprintStore.setState({ ...INITIAL_SPRINT_STATE, sprintNumber: 1, day: 2, phase: 'active', confirmingEndDay: false })
  useGameStore.setState({ phase: 'free', activeDialogue: null, activeChoice: null, tasks: BOARD_TASKS.map((t) => ({ ...t })) })
  useEconomyStore.setState({ transactions: initialTransactions(), panelOpen: false })
  useRiskStore.setState({ signals: [] })
  useTeamStore.setState({ hires: [], panelOpen: false })
  useProductStore.setState({ taskStates: initialTaskStates(), activeReport: null, boardOpen: false, prototypeOpen: false, releaseCheckOpen: false })
  useCharacterStore.setState({
    characters: {
      [PLAYER_ID]: { state: { kind: 'idle' }, position: [-2, 0, 5.3], rotationY: 0 },
      [getSceneLeadCharacterId('executive-phishing-request')]: { state: { kind: 'idle' }, position: [-2, 0, 6.3], rotationY: Math.PI },
      [getSceneLeadCharacterId('supply-chain-update')]: { state: { kind: 'idle' }, position: [1, 0, 6.3], rotationY: Math.PI },
    },
    sceneOwned: new Set(),
    inputLocked: false,
  })
  useStoryWorkStore.getState().resetStoryWork()
})

describe('list()', () => {
  it('contains all seven documented scenes with their current status', () => {
    expect(DEV_SCENE_IDS).toEqual([
      'executive-phishing-request',
      'supply-chain-update',
      'shadow-it-log-upload',
      'secret-committed-to-repository',
      'mfa-fatigue-attack',
      'external-ai-data-disclosure',
      'office-intrusion',
    ])
    const list = cyberStoryDevScenes.list()
    expect(list.map((s) => s.id)).toEqual(DEV_SCENE_IDS)
    expect(list.find((s) => s.id === 'office-intrusion')?.status).toBe('dormant')
  })
})

describe('prepare()', () => {
  it('unlocks a locked cyber incident to available (minimal state, real store method)', () => {
    expect(cyber().incidents['executive-phishing-request'].status).toBe('locked')
    cyberStoryDevScenes.prepare('executive-phishing-request')
    expect(cyber().incidents['executive-phishing-request'].status).toBe('available')
  })

  it('arms office-intrusion to pending', () => {
    cyberStoryDevScenes.prepare('office-intrusion')
    expect(useAccessControlStore.getState().intrusion.status).toBe('pending')
  })
})

describe('play()', () => {
  it('full-effects play uses the real production handler - the choice applies real effects', async () => {
    const { choiceShown } = await play(() => cyberStoryDevScenes.play('supply-chain-update'), 'review-and-pin-dependency')
    expect(choiceShown).toBe(true)
    expect(cyber().incidents['supply-chain-update'].status).toBe('resolved')
    expect(calculateBalance(useEconomyStore.getState().transactions)).toBe(INITIAL_BUDGET - CYBER_STORY_BALANCE.supplyChainUpdate.reviewCostRub)
  })

  it('visual-only play shows the same dialogue but applies zero effects', async () => {
    const before = calculateBalance(useEconomyStore.getState().transactions)
    const { choiceShown } = await play(() => cyberStoryDevScenes.play('supply-chain-update', { visualOnly: true }), 'install-update-immediately')
    expect(choiceShown).toBe(true)
    expect(cyber().incidents['supply-chain-update'].status).toBe('locked')
    expect(calculateBalance(useEconomyStore.getState().transactions)).toBe(before)
    expect(useRiskStore.getState().signals).toEqual([])
  })

  it('repeated full-effects play does not duplicate effects (idempotent)', async () => {
    await play(() => cyberStoryDevScenes.play('supply-chain-update'), 'keep-current-version')
    const afterFirst = calculateBalance(useEconomyStore.getState().transactions)
    // the incident is now resolved; a second play() call replays the dialogue
    // (no choice to pick) but never re-applies effects.
    await play(() => cyberStoryDevScenes.play('supply-chain-update'), 'keep-current-version')
    expect(calculateBalance(useEconomyStore.getState().transactions)).toBe(afterFirst)
  })

  it('office-intrusion plays through the real cutscene registry', async () => {
    await cyberStoryDevScenes.play('office-intrusion')
    expect(useCutsceneStore.getState().activeSceneId).toBe('office-intrusion')
  })

  it('plays a Feature 19B scene (secret-committed-to-repository) through the same real handler', async () => {
    const { choiceShown } = await play(() => cyberStoryDevScenes.play('secret-committed-to-repository'), 'rewrite-repository-history')
    expect(choiceShown).toBe(true)
    expect(cyber().incidents['secret-committed-to-repository'].status).toBe('resolved')
    expect(cyber().flags.credentialExposureState).toBe('reduced')
  })
})

describe('resolve()', () => {
  it('applies a specific choice directly through the real store, no 3D walk needed', () => {
    const res = cyberStoryDevScenes.resolve('executive-phishing-request', 'verify-through-known-channel')
    expect(res.applied).toBe(true)
    expect(cyber().incidents['executive-phishing-request'].status).toBe('resolved')
    expect(useStoryWorkStore.getState().isEmployeeBusy('sonya-sokolova')).toBe(true)
  })

  it('is idempotent - a repeated resolve with a different choice keeps the first', () => {
    cyberStoryDevScenes.resolve('executive-phishing-request', 'verify-through-known-channel')
    cyberStoryDevScenes.resolve('executive-phishing-request', 'send-requested-data')
    expect(cyber().incidents['executive-phishing-request'].selectedChoiceId).toBe('verify-through-known-channel')
  })

  it('resolves a Feature 19B scene (mfa-fatigue-attack) directly, no 3D walk needed', () => {
    const res = cyberStoryDevScenes.resolve('mfa-fatigue-attack', 'enable-phishing-resistant-auth')
    expect(res.applied).toBe(true)
    expect(cyber().flags.unknownSessionState).toBe('revoked')
  })
})

describe('playConsequence()', () => {
  it('queues a consequence once, without duplicating on a repeated call', () => {
    cyberStoryDevScenes.playConsequence('phishing-targeted-followup')
    cyberStoryDevScenes.playConsequence('phishing-targeted-followup')
    expect(cyber().pendingConsequenceIds).toEqual(['phishing-targeted-followup'])
  })

  it('queues a Feature 19B consequence (hijacked-session-activity) the same way', () => {
    cyberStoryDevScenes.playConsequence('hijacked-session-activity')
    cyberStoryDevScenes.playConsequence('hijacked-session-activity')
    expect(cyber().pendingConsequenceIds).toEqual(['hijacked-session-activity'])
  })
})

describe('reset()', () => {
  it('resets one cyber incident back to locked', () => {
    cyberStoryDevScenes.resolve('executive-phishing-request', 'send-requested-data')
    cyberStoryDevScenes.reset('executive-phishing-request')
    expect(cyber().incidents['executive-phishing-request'].status).toBe('locked')
  })

  it('resets office-intrusion back to dormant', () => {
    cyberStoryDevScenes.prepare('office-intrusion')
    cyberStoryDevScenes.reset('office-intrusion')
    expect(useAccessControlStore.getState().intrusion.status).toBe('dormant')
  })

  it('resets a Feature 19B scene (external-ai-data-disclosure) back to locked', () => {
    cyberStoryDevScenes.resolve('external-ai-data-disclosure', 'allow-unrestricted-ai-tools')
    cyberStoryDevScenes.reset('external-ai-data-disclosure')
    expect(cyber().incidents['external-ai-data-disclosure'].status).toBe('locked')
    expect(cyber().flags.shadowAiPolicy).toBe('unset')
  })
})
