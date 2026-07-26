import { describe, it, expect, beforeEach } from 'vitest'
import {
  beginApproachToStoryScene,
  getSceneLeadNpcId,
  getSceneLeadCharacterId,
  runStoryDecisionConversation,
} from './storyDecisionInteraction'
import { useStoryDecisionStore } from './storyDecisionStore'
import { useStoryWorkStore } from './storyWorkStore'
import { useGameStore } from '../gameStore'
import { useSprintStore } from '../sprintStore'
import { useTeamStore } from '../teamStore'
import { useEconomyStore } from '../economyStore'
import { useRiskStore } from '../riskStore'
import { useProductStore } from '../productStore'
import { useCharacterStore, PLAYER_ID } from '../../character/characterStore'
import { initialTransactions, calculateBalance, INITIAL_BUDGET } from '../economyRules'
import { STORY_BALANCE } from '../balance/storyBalance'
import { initialTaskStates } from '../productRules'
import { INITIAL_SPRINT_STATE } from '../sprintRules'
import { BOARD_TASKS } from '../tasks'

const tick = () => new Promise((r) => setTimeout(r, 0))
const chars = () => useCharacterStore.getState()
const story = () => useStoryDecisionStore.getState()

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
  useSprintStore.setState({ ...INITIAL_SPRINT_STATE, sprintNumber: 1, day: 1, phase: 'active', confirmingEndDay: false })
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
  story().resetLevel1Story()
  useStoryWorkStore.getState().resetStoryWork()
})

describe('scene lead selection (17B §9)', () => {
  it('picks the deterministic lead per scene; disclosure falls back to Kirill without Ilya', () => {
    expect(getSceneLeadNpcId('security-baseline-path', false)).toBe('sonya-sokolova')
    expect(getSceneLeadNpcId('developer-admin-access', true)).toBe('kirill-morozov')
    expect(getSceneLeadNpcId('frontend-test-data', false)).toBe('alina-belova')
    expect(getSceneLeadNpcId('security-first-priority', true)).toBe('ilya-vlasov')
    expect(getSceneLeadNpcId('suspicious-activity-disclosure', true)).toBe('ilya-vlasov')
    expect(getSceneLeadNpcId('suspicious-activity-disclosure', false)).toBe('kirill-morozov')
    expect(getSceneLeadNpcId('release-risk-decision', false)).toBe('sonya-sokolova')
  })
})

describe('approach & scene run (baseline scene)', () => {
  it('walks the player to the lead without opening a dialogue', () => {
    chars().spawnCharacter(getSceneLeadCharacterId('security-baseline-path'), [-2, 0, 6.3], Math.PI)
    story().unlockDecision('security-baseline-path', { sprintNumber: 1, day: 1 })
    expect(beginApproachToStoryScene('security-baseline-path')).toBe(true)
    expect(chars().characters[PLAYER_ID].state.kind).toBe('walking')
    expect(useGameStore.getState().activeDialogue).toBeNull()
  })

  it('runs to completion, applies the audit expense and hands control back', async () => {
    chars().spawnCharacter(getSceneLeadCharacterId('security-baseline-path'), [-2, 0, 6.3], Math.PI)
    story().unlockDecision('security-baseline-path', { sprintNumber: 1, day: 1 })
    const { choiceShown } = await play(() => runStoryDecisionConversation('security-baseline-path'), 'commission-security-audit')
    expect(choiceShown).toBe(true)
    expect(story().decisions['security-baseline-path'].status).toBe('resolved')
    expect(calculateBalance(useEconomyStore.getState().transactions)).toBe(INITIAL_BUDGET - STORY_BALANCE.baselineAudit.costRub)
    expect(chars().inputLocked).toBe(false)
    expect(chars().sceneOwned.size).toBe(0)
  })

  it('an interrupted run reuses the saved choice without asking again', async () => {
    chars().spawnCharacter(getSceneLeadCharacterId('security-baseline-path'), [-2, 0, 6.3], Math.PI)
    story().unlockDecision('security-baseline-path', { sprintNumber: 1, day: 1 })
    await play(() => runStoryDecisionConversation('security-baseline-path'), 'hire-security-specialist-first')
    useStoryDecisionStore.setState({
      decisions: {
        ...story().decisions,
        'security-baseline-path': { ...story().decisions['security-baseline-path'], status: 'available' },
      },
    })
    const second = await play(() => runStoryDecisionConversation('security-baseline-path'), 'commission-security-audit')
    expect(second.choiceShown).toBe(false)
    expect(story().decisions['security-baseline-path'].selectedChoiceId).toBe('hire-security-specialist-first')
  })
})

describe('Ilya-gated third options in a live scene (scene 2)', () => {
  it('without Ilya only two options are offered; with him - three', async () => {
    chars().spawnCharacter(getSceneLeadCharacterId('developer-admin-access'), [-2, 0, 6.3], Math.PI)
    story().unlockDecision('developer-admin-access', { sprintNumber: 1, day: 1 })
    const withoutIlya = await play(() => runStoryDecisionConversation('developer-admin-access'), 'grant-permanent-admin')
    expect(withoutIlya.offeredChoiceIds).toEqual(['grant-permanent-admin', 'use-just-in-time-access'])

    story().resetLevel1Story()
    useStoryWorkStore.getState().resetStoryWork()
    useTeamStore.setState({ hires: WITH_ILYA, panelOpen: false })
    story().unlockDecision('developer-admin-access', { sprintNumber: 1, day: 1 })
    const withIlya = await play(() => runStoryDecisionConversation('developer-admin-access'), 'configure-controlled-access')
    expect(withIlya.offeredChoiceIds).toEqual(['grant-permanent-admin', 'use-just-in-time-access', 'configure-controlled-access'])
    expect(useStoryWorkStore.getState().isEmployeeBusy('ilya-vlasov')).toBe(true)
  })
})
