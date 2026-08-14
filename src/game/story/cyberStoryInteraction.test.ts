import { describe, it, expect, beforeEach, vi } from 'vitest'

// The real playVideoCutscene() only resolves once VideoCutsceneOverlay (a
// mounted React component) fires onEnded/onError/the 30s watchdog - none of
// which exist in this pure-store unit test. Every scene/office-intrusion/etc.
// test in this codebase avoids driving that promise; here we simulate exactly
// what happens today in production (no .mp4 registered yet) - the insert
// falls back immediately, same as a real 404/missing-codec resolution.
vi.mock('../../cutscenes/videoCutscene', () => ({ playVideoCutscene: vi.fn(() => Promise.resolve(false)) }))

import { playVideoCutscene } from '../../cutscenes/videoCutscene'
import {
  beginApproachToCyberScene,
  getSceneLeadCharacterId,
  getSceneLeadNpcId,
  runCyberConsequenceScene,
  runCyberStoryConversation,
  runCyberStoryConversationVisualOnly,
} from './cyberStoryInteraction'
import { useCyberStoryStore } from './cyberStoryStore'
import { useStoryWorkStore } from './storyWorkStore'
import { useStoryDecisionStore } from './storyDecisionStore'
import { initialStoryDecisionRecords } from './storyDecisionRules'
import { useGameStore } from '../gameStore'
import { useSprintStore } from '../sprintStore'
import { useTeamStore } from '../teamStore'
import { useEconomyStore } from '../economyStore'
import { useRiskStore } from '../riskStore'
import { useProductStore } from '../productStore'
import { useCharacterStore, PLAYER_ID } from '../../character/characterStore'
import { initialTransactions, calculateBalance, INITIAL_BUDGET } from '../economyRules'
import { CYBER_STORY_BALANCE } from '../balance/cyberStoryBalance'
import { initialTaskStates } from '../productRules'
import { INITIAL_SPRINT_STATE } from '../sprintRules'
import { BOARD_TASKS } from '../tasks'

const tick = () => new Promise((r) => setTimeout(r, 0))
const chars = () => useCharacterStore.getState()
const cyber = () => useCyberStoryStore.getState()

const BOTH_DEVS = [
  { employeeId: 'kirill-morozov', hiredAtSprint: 1, hiredAtDay: 1 },
  { employeeId: 'alina-belova', hiredAtSprint: 1, hiredAtDay: 1 },
]
const WITH_ILYA = [...BOTH_DEVS, { employeeId: 'ilya-vlasov', hiredAtSprint: 2, hiredAtDay: 1 }]

async function play(run: () => Promise<void>, pick: string): Promise<{ choiceShown: boolean; offeredChoiceIds: string[] }> {
  let done = false
  let choiceShown = false
  let offeredChoiceIds: string[] = []
  const promise = run().then(() => {
    done = true
  })
  for (let i = 0; i < 300 && !done; i++) {
    await tick()
    const g = useGameStore.getState()
    if (g.activeChoice) {
      choiceShown = true
      offeredChoiceIds = g.activeChoice.options.map((o) => o.id)
      g.chooseOption(pick)
    } else if (g.activeDialogue) {
      g.advanceDialogue()
    }
  }
  await promise
  return { choiceShown, offeredChoiceIds }
}

beforeEach(() => {
  window.localStorage.clear()
  useSprintStore.setState({ ...INITIAL_SPRINT_STATE, sprintNumber: 1, day: 2, phase: 'active', confirmingEndDay: false })
  useGameStore.setState({ phase: 'free', activeDialogue: null, activeChoice: null, tasks: BOARD_TASKS.map((t) => ({ ...t })) })
  useEconomyStore.setState({ transactions: initialTransactions(), panelOpen: false })
  useRiskStore.setState({ signals: [] })
  useTeamStore.setState({ hires: BOTH_DEVS, panelOpen: false })
  useProductStore.setState({ taskStates: initialTaskStates(), activeReport: null, boardOpen: false, prototypeOpen: false, releaseCheckOpen: false })
  useCharacterStore.setState({
    characters: { [PLAYER_ID]: { state: { kind: 'idle' }, position: [-2, 0, 5.3], rotationY: 0 } },
    sceneOwned: new Set(),
    inputLocked: false,
  })
  useStoryDecisionStore.setState({ decisions: initialStoryDecisionRecords(), activeDecisionId: undefined, completedCheckpointIds: [] })
  cyber().resetCyberStory()
  useStoryWorkStore.getState().resetStoryWork()
  vi.mocked(playVideoCutscene).mockClear()
})

describe('scene lead selection', () => {
  it('picks the deterministic lead per incident', () => {
    expect(getSceneLeadNpcId('executive-phishing-request')).toBe('sonya-sokolova')
    expect(getSceneLeadNpcId('supply-chain-update')).toBe('kirill-morozov')
    expect(getSceneLeadNpcId('shadow-it-log-upload')).toBe('kirill-morozov')
    expect(getSceneLeadNpcId('secret-committed-to-repository')).toBe('kirill-morozov')
    expect(getSceneLeadNpcId('mfa-fatigue-attack')).toBe('kirill-morozov')
    expect(getSceneLeadNpcId('external-ai-data-disclosure')).toBe('alina-belova')
  })
})

describe('approach & scene run (executive-phishing-request)', () => {
  it('walks the player to the lead without opening a dialogue', () => {
    chars().spawnCharacter(getSceneLeadCharacterId('executive-phishing-request'), [-2, 0, 6.3], Math.PI)
    cyber().unlockIncident('executive-phishing-request', { sprintNumber: 1, day: 2 })
    expect(beginApproachToCyberScene('executive-phishing-request')).toBe(true)
    expect(chars().characters[PLAYER_ID].state.kind).toBe('walking')
    expect(useGameStore.getState().activeDialogue).toBeNull()
  })

  it('runs to completion, applies the escalation expense and hands control back', async () => {
    useTeamStore.setState({ hires: WITH_ILYA, panelOpen: false })
    chars().spawnCharacter(getSceneLeadCharacterId('executive-phishing-request'), [-2, 0, 6.3], Math.PI)
    cyber().unlockIncident('executive-phishing-request', { sprintNumber: 1, day: 2 })
    const { choiceShown } = await play(() => runCyberStoryConversation('executive-phishing-request'), 'escalate-phishing-to-security')
    expect(choiceShown).toBe(true)
    expect(cyber().incidents['executive-phishing-request'].status).toBe('resolved')
    expect(calculateBalance(useEconomyStore.getState().transactions)).toBe(INITIAL_BUDGET - CYBER_STORY_BALANCE.executivePhishing.securityEscalationCostRub)
    expect(chars().inputLocked).toBe(false)
    expect(chars().sceneOwned.size).toBe(0)
  })

  it('an interrupted run reuses the saved choice without asking again', async () => {
    chars().spawnCharacter(getSceneLeadCharacterId('executive-phishing-request'), [-2, 0, 6.3], Math.PI)
    cyber().unlockIncident('executive-phishing-request', { sprintNumber: 1, day: 2 })
    await play(() => runCyberStoryConversation('executive-phishing-request'), 'verify-through-known-channel')
    useCyberStoryStore.setState({
      incidents: { ...cyber().incidents, 'executive-phishing-request': { ...cyber().incidents['executive-phishing-request'], status: 'available' } },
    })
    const second = await play(() => runCyberStoryConversation('executive-phishing-request'), 'send-requested-data')
    expect(second.choiceShown).toBe(false)
    expect(cyber().incidents['executive-phishing-request'].selectedChoiceId).toBe('verify-through-known-channel')
  })
})

describe('Ilya-gated third option in a live scene (shadow-it-log-upload)', () => {
  it('without Ilya only two options are offered; with him - three, and he is occupied', async () => {
    chars().spawnCharacter(getSceneLeadCharacterId('shadow-it-log-upload'), [-2, 0, 6.3], Math.PI)
    cyber().unlockIncident('shadow-it-log-upload', { sprintNumber: 1, day: 2 })
    const withoutIlya = await play(() => runCyberStoryConversation('shadow-it-log-upload'), 'sanitize-logs-manually')
    expect(withoutIlya.offeredChoiceIds).toEqual(['upload-raw-logs-to-personal-cloud', 'sanitize-logs-manually'])

    cyber().resetCyberStory()
    useStoryWorkStore.getState().resetStoryWork()
    useTeamStore.setState({ hires: WITH_ILYA, panelOpen: false })
    cyber().unlockIncident('shadow-it-log-upload', { sprintNumber: 1, day: 2 })
    const withIlya = await play(() => runCyberStoryConversation('shadow-it-log-upload'), 'configure-secure-log-sharing')
    expect(withIlya.offeredChoiceIds).toEqual(['upload-raw-logs-to-personal-cloud', 'sanitize-logs-manually', 'configure-secure-log-sharing'])
    expect(useStoryWorkStore.getState().isEmployeeBusy('ilya-vlasov')).toBe(true)
  })
})

describe('approach & scene run (secret-committed-to-repository)', () => {
  it('runs to completion, applies the rotation expense and hands control back', async () => {
    chars().spawnCharacter(getSceneLeadCharacterId('secret-committed-to-repository'), [-2, 0, 6.3], Math.PI)
    cyber().unlockIncident('secret-committed-to-repository', { sprintNumber: 1, day: 2 })
    const { choiceShown } = await play(() => runCyberStoryConversation('secret-committed-to-repository'), 'rotate-and-secure-secret')
    expect(choiceShown).toBe(true)
    expect(cyber().incidents['secret-committed-to-repository'].status).toBe('resolved')
    expect(cyber().flags.credentialExposureState).toBe('rotated')
    expect(chars().inputLocked).toBe(false)
    expect(chars().sceneOwned.size).toBe(0)
  })
})

describe('approach & scene run (mfa-fatigue-attack)', () => {
  it('without Ilya, investigate occupies Kirill and Sonya and revokes the unknown session', async () => {
    chars().spawnCharacter(getSceneLeadCharacterId('mfa-fatigue-attack'), [-2, 0, 6.3], Math.PI)
    cyber().unlockIncident('mfa-fatigue-attack', { sprintNumber: 1, day: 2 })
    const { choiceShown } = await play(() => runCyberStoryConversation('mfa-fatigue-attack'), 'revoke-sessions-and-investigate')
    expect(choiceShown).toBe(true)
    expect(cyber().incidents['mfa-fatigue-attack'].status).toBe('resolved')
    expect(cyber().flags.unknownSessionState).toBe('revoked')
    expect(useStoryWorkStore.getState().isEmployeeBusy('sonya-sokolova')).toBe(true)
    expect(chars().inputLocked).toBe(false)
  })
})

describe('approach & scene run (external-ai-data-disclosure)', () => {
  it('the ban choice occupies Alina and disables further unrestricted use', async () => {
    chars().spawnCharacter(getSceneLeadCharacterId('external-ai-data-disclosure'), [-2, 0, 6.3], Math.PI)
    cyber().unlockIncident('external-ai-data-disclosure', { sprintNumber: 1, day: 2 })
    const { choiceShown } = await play(() => runCyberStoryConversation('external-ai-data-disclosure'), 'ban-external-ai-tools')
    expect(choiceShown).toBe(true)
    expect(cyber().incidents['external-ai-data-disclosure'].status).toBe('resolved')
    expect(cyber().flags.shadowAiPolicy).toBe('banned')
    expect(useStoryWorkStore.getState().isEmployeeBusy('alina-belova')).toBe(true)
    expect(chars().inputLocked).toBe(false)
  })
})

describe('delayed consequence playback (runCyberConsequenceScene)', () => {
  async function drainConsequence(run: () => Promise<void>): Promise<void> {
    let done = false
    const promise = run().then(() => {
      done = true
    })
    for (let i = 0; i < 50 && !done; i++) {
      await tick()
      const g = useGameStore.getState()
      if (g.activeDialogue) g.advanceDialogue()
    }
    await promise
  }

  it('requests the registered insert clip for a consequence that has one, then still plays the dialogue', async () => {
    cyber().scheduleConsequenceOnce('supply-chain-unknown-connection', 1)
    cyber().queueConsequenceOnce('supply-chain-unknown-connection')
    await drainConsequence(() => runCyberConsequenceScene('supply-chain-unknown-connection'))
    expect(playVideoCutscene).toHaveBeenCalledWith('/cutscenes/supply-chain-update-consequence-insert.mp4')
    expect(cyber().completedConsequenceIds).toContain('supply-chain-unknown-connection')
  })

  it('requests the second registered insert clip (shadow-it-external-download) with its own distinct path', async () => {
    cyber().scheduleConsequenceOnce('shadow-it-external-download', 1)
    cyber().queueConsequenceOnce('shadow-it-external-download')
    await drainConsequence(() => runCyberConsequenceScene('shadow-it-external-download'))
    expect(playVideoCutscene).toHaveBeenCalledWith('/cutscenes/shadow-it-log-upload-consequence-insert.mp4')
    expect(cyber().completedConsequenceIds).toContain('shadow-it-external-download')
  })

  it('never calls playVideoCutscene for a consequence with no registered clip (unchanged Feature 19A dialogue-only behaviour)', async () => {
    cyber().scheduleConsequenceOnce('phishing-targeted-followup', 1)
    cyber().queueConsequenceOnce('phishing-targeted-followup')
    await drainConsequence(() => runCyberConsequenceScene('phishing-targeted-followup'))
    expect(playVideoCutscene).not.toHaveBeenCalled()
    expect(cyber().completedConsequenceIds).toContain('phishing-targeted-followup')
  })
})

describe('visual-only playback (dev QA)', () => {
  it('plays the full dialogue/choice but never touches the store or any other side effect', async () => {
    chars().spawnCharacter(getSceneLeadCharacterId('supply-chain-update'), [-2, 0, 6.3], Math.PI)
    const before = calculateBalance(useEconomyStore.getState().transactions)
    const { choiceShown } = await play(() => runCyberStoryConversationVisualOnly('supply-chain-update'), 'install-update-immediately')
    expect(choiceShown).toBe(true)
    expect(cyber().incidents['supply-chain-update'].status).toBe('locked') // never started/resolved
    expect(calculateBalance(useEconomyStore.getState().transactions)).toBe(before)
    expect(useRiskStore.getState().signals).toEqual([])
    expect(chars().inputLocked).toBe(false)
  })
})
