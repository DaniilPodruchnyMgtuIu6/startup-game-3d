import { describe, it, expect, beforeEach } from 'vitest'
import { reconcileStoryDecisionsAtStartup } from './reconcileStoryDecisions'
import { useStoryDecisionStore } from './storyDecisionStore'
import { useSecurityStoryStore } from '../securityStoryStore'
import { useSprintStore } from '../sprintStore'
import { useTeamStore } from '../teamStore'
import { useGameStore } from '../gameStore'
import { useRiskStore } from '../riskStore'
import { INITIAL_SPRINT_STATE } from '../sprintRules'
import { INITIAL_SECURITY_BREACH } from '../securityStoryRules'
import { BOARD_TASKS } from '../tasks'

const story = () => useStoryDecisionStore.getState()
const baseline = () => story().decisions['security-baseline-path']

const BOTH_DEVS = [
  { employeeId: 'kirill-morozov', hiredAtSprint: 1, hiredAtDay: 1 },
  { employeeId: 'alina-belova', hiredAtSprint: 1, hiredAtDay: 1 },
]

beforeEach(() => {
  window.localStorage.clear()
  useSprintStore.setState({ ...INITIAL_SPRINT_STATE, confirmingEndDay: false })
  useTeamStore.setState({ hires: [], panelOpen: false })
  useGameStore.setState({ phase: 'free', activeDialogue: null, activeChoice: null, tasks: BOARD_TASKS.map((t) => ({ ...t })) })
  useRiskStore.setState({ signals: [] })
  useSecurityStoryStore.setState({
    securityBreach: { ...INITIAL_SECURITY_BREACH },
    postAuditConversation: { status: 'locked', effectsApplied: false },
    hasIntroducedSecuritySpecialist: false,
  })
  story().resetLevel1Story()
})

describe('reconcileStoryDecisionsAtStartup (17A §9)', () => {
  it('a legacy staffing decision resolves the baseline via migration metadata, without effects', () => {
    useSecurityStoryStore.setState({
      securityBreach: { ...INITIAL_SECURITY_BREACH, status: 'completed', completedAt: { sprintNumber: 2, day: 3 }, effectsApplied: true },
      postAuditConversation: { status: 'completed', staffingDecision: 'approve-security-hire', completedAt: { sprintNumber: 2, day: 4 }, effectsApplied: true },
      hasIntroducedSecuritySpecialist: false,
    })
    useSprintStore.setState({ sprintNumber: 3, day: 2, phase: 'active', confirmingEndDay: false })
    const tasksBefore = useGameStore.getState().tasks.length
    const signalsBefore = useRiskStore.getState().signals.length

    reconcileStoryDecisionsAtStartup()

    expect(baseline().status).toBe('resolved')
    expect(baseline().selectedChoiceId).toBe('hire-security-specialist-first')
    expect(baseline().migratedFromLegacy).toBe(true)
    expect(baseline().resolvedAt).toEqual({ sprintNumber: 2, day: 4 })
    // no scene replay, no retroactive effects
    expect(useGameStore.getState().tasks.length).toBe(tasksBefore)
    expect(useRiskStore.getState().signals.length).toBe(signalsBefore)
    expect(story().activeDecisionId).toBeUndefined()
  })

  it('a save at the exact baseline point (devs hired, sprint 1 planning) unlocks the scene', () => {
    useTeamStore.setState({ hires: BOTH_DEVS, panelOpen: false })
    reconcileStoryDecisionsAtStartup()
    expect(baseline().status).toBe('available')
    expect(story().activeDecisionId).toBe('security-baseline-path')
  })

  it('a mid-campaign save without a legacy decision keeps the baseline locked (no retroactive scenes)', () => {
    useTeamStore.setState({ hires: BOTH_DEVS, panelOpen: false })
    useSprintStore.setState({ sprintNumber: 2, day: 5, phase: 'active', confirmingEndDay: false })
    reconcileStoryDecisionsAtStartup()
    expect(baseline().status).toBe('locked')
  })

  it('a fresh game (nobody hired) stays locked', () => {
    reconcileStoryDecisionsAtStartup()
    expect(baseline().status).toBe('locked')
  })

  it('is idempotent across repeated startups', () => {
    useTeamStore.setState({ hires: BOTH_DEVS, panelOpen: false })
    reconcileStoryDecisionsAtStartup()
    const first = JSON.stringify(story().decisions)
    reconcileStoryDecisionsAtStartup()
    expect(JSON.stringify(story().decisions)).toBe(first)
  })

  it('never touches the other seven nodes', () => {
    useSecurityStoryStore.setState({
      securityBreach: { ...INITIAL_SECURITY_BREACH, status: 'completed', completedAt: { sprintNumber: 2, day: 3 }, effectsApplied: true },
      postAuditConversation: { status: 'completed', staffingDecision: 'decline-security-hire', completedAt: { sprintNumber: 2, day: 4 }, effectsApplied: true },
      hasIntroducedSecuritySpecialist: false,
    })
    reconcileStoryDecisionsAtStartup()
    const others = Object.values(story().decisions).filter((r) => r.decisionId !== 'security-baseline-path')
    expect(others.every((r) => r.status === 'locked')).toBe(true)
  })
})
