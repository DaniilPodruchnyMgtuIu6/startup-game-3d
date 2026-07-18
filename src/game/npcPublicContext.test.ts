import { describe, it, expect, beforeEach } from 'vitest'
import { buildPublicNpcGameContext, budgetBand, gatherGameSnapshot, type GameSnapshot } from './npcPublicContext'
import { useRiskStore } from './riskStore'
import { useSprintStore } from './sprintStore'
import { canOpenFreeNpcConversation, type FreeNpcConversationContext } from './freeNpcConversation'

function snap(overrides: Partial<GameSnapshot> = {}): GameSnapshot {
  return {
    campaignStatus: 'playing',
    sprint: { number: 3, day: 4, phase: 'active' },
    balance: 300_000,
    product: { progressPercent: 62, completedTaskCount: 9, firstPrototypeReady: true },
    hiredEmployeeIds: ['kirill-morozov', 'alina-belova'],
    visibleObjectives: ['Выпустить MVP OfficeFlow'],
    detectedRiskObservations: [{ domainLabel: 'Учётные записи и права доступа', levelLabel: 'Требует внимания' }],
    recentVisibleEvents: [{ label: 'восстановлен внешний шлюз' }],
    sonyaBlamed: false,
    assignmentByNpc: { 'sonya-sokolova': 'координация', 'kirill-morozov': 'API уведомлений', 'alina-belova': 'экран входа', 'ilya-vlasov': 'обход офиса' },
    ...overrides,
  }
}

describe('budgetBand', () => {
  it('maps balance to a band', () => {
    expect(budgetBand(150_000)).toBe('critical')
    expect(budgetBand(400_000)).toBe('low')
    expect(budgetBand(1_000_000)).toBe('stable')
    expect(budgetBand(1_000_001)).toBe('comfortable')
  })
})

describe('buildPublicNpcGameContext', () => {
  it('passes visible sprint, product and the NPC assignment', () => {
    const c = buildPublicNpcGameContext(snap(), 'kirill-morozov')
    expect(c.sprint).toEqual({ number: 3, day: 4, phase: 'active' })
    expect(c.product).toEqual({ progressPercent: 62, completedTaskCount: 9, totalTaskCount: 14, firstPrototypeReady: true })
    expect(c.currentNpc.currentVisibleAssignment).toBe('API уведомлений')
    expect(c.detectedRiskObservations).toHaveLength(1)
  })
  it('gives the exact balance only to Sonya', () => {
    expect(buildPublicNpcGameContext(snap(), 'sonya-sokolova').exactBalance).toBe(300_000)
    expect(buildPublicNpcGameContext(snap(), 'kirill-morozov').exactBalance).toBeUndefined()
    expect(buildPublicNpcGameContext(snap(), 'kirill-morozov').budgetBand).toBe('low')
  })
  it('surfaces the blame flag only to Sonya', () => {
    expect(buildPublicNpcGameContext(snap({ sonyaBlamed: true }), 'sonya-sokolova').sonyaBlamed).toBe(true)
    expect('sonyaBlamed' in buildPublicNpcGameContext(snap({ sonyaBlamed: true }), 'kirill-morozov')).toBe(false)
  })
})

describe('gatherGameSnapshot only exposes DETECTED risk (never actual/undetected)', () => {
  beforeEach(() => {
    window.localStorage.clear()
    useSprintStore.setState({ sprintNumber: 3, day: 4, phase: 'active' })
  })
  it('excludes an undetected high-risk signal from the observations', () => {
    useRiskStore.setState({
      signals: [
        { id: 'hidden', domain: 'governance', impact: 7, source: 'security-audit', sourceRef: 'x', createdAt: { sprintNumber: 3, day: 1 }, createdAtWorkdayIndex: 21 },
      ],
    })
    const s = gatherGameSnapshot()
    // actual governance risk is high, but it is not detected yet → not surfaced
    expect(s.detectedRiskObservations).toHaveLength(0)
    expect(s.sprint.number).toBe(3)
  })
})

describe('canOpenFreeNpcConversation', () => {
  const base: FreeNpcConversationContext = {
    npcId: 'kirill-morozov',
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
  it('opens in free play with nothing blocking', () => expect(canOpenFreeNpcConversation(base).eligible).toBe(true))
  it('not in free phase', () => expect(canOpenFreeNpcConversation({ ...base, gamePhase: 'meetPm' })).toEqual({ eligible: false, reason: 'not-free-phase' }))
  it('campaign over', () => expect(canOpenFreeNpcConversation({ ...base, campaignOver: true }).reason).toBe('campaign-over'))
  it('npc absent', () => expect(canOpenFreeNpcConversation({ ...base, npcPresent: false }).reason).toBe('npc-absent'))
  it('required interaction pending', () => expect(canOpenFreeNpcConversation({ ...base, requiredInteractionPending: true }).reason).toBe('required-interaction'))
  it('busy while a dialogue/cutscene/minigame/overlay is active', () => {
    for (const key of ['inputLocked', 'activeDialogue', 'activeChoice', 'cutsceneRunning', 'minigameOpen', 'blockingOverlayOpen'] as const) {
      expect(canOpenFreeNpcConversation({ ...base, [key]: true }).reason).toBe('busy')
    }
  })
})
