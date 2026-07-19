import { describe, it, expect, beforeEach } from 'vitest'
import { canAutoAdvanceWorkday, getDailyBeat, type WorkdayFlowContext } from './workdayFlow'
import { autoCompleteWorkday } from './WorkdayFlowController'
import { useSprintStore } from './sprintStore'
import { useEconomyStore } from './economyStore'
import { useTeamStore } from './teamStore'
import { useProductStore } from './productStore'
import { useSecurityStoryStore } from './securityStoryStore'
import { useSecurityAuditStore, INITIAL_SECURITY_AUDIT } from './securityAuditStore'
import { useAccessControlStore, INITIAL_ACCESS_CONTROL_DATA } from './accessControlStore'
import { useServerIncidentStore, INITIAL_SERVER_INCIDENT_DATA } from './serverIncidentStore'
import { useGameStore } from './gameStore'
import { INITIAL_SPRINT_STATE } from './sprintRules'
import { INITIAL_SECURITY_BREACH } from './securityStoryRules'
import { initialTransactions, calculateBalance } from './economyRules'
import { initialTaskStates, addToPlan } from './productRules'

const clear: WorkdayFlowContext = {
  gamePhase: 'free',
  sprintPhase: 'active',
  outcomeBlocking: false,
  busy: false,
  requiredStoryPending: false,
  followUpAuditBlocking: false,
  officeIntrusionBlocking: false,
  serverIncidentBlocking: false,
}

describe('canAutoAdvanceWorkday', () => {
  it('advances only in active free play with nothing mandatory open', () => {
    expect(canAutoAdvanceWorkday(clear)).toBe(true)
  })
  it('is blocked by every guard (event priority)', () => {
    expect(canAutoAdvanceWorkday({ ...clear, gamePhase: 'meetPm' })).toBe(false)
    expect(canAutoAdvanceWorkday({ ...clear, sprintPhase: 'planning' })).toBe(false)
    expect(canAutoAdvanceWorkday({ ...clear, sprintPhase: 'review' })).toBe(false)
    expect(canAutoAdvanceWorkday({ ...clear, outcomeBlocking: true })).toBe(false)
    expect(canAutoAdvanceWorkday({ ...clear, busy: true })).toBe(false)
    expect(canAutoAdvanceWorkday({ ...clear, requiredStoryPending: true })).toBe(false)
    expect(canAutoAdvanceWorkday({ ...clear, followUpAuditBlocking: true })).toBe(false)
    expect(canAutoAdvanceWorkday({ ...clear, officeIntrusionBlocking: true })).toBe(false)
    expect(canAutoAdvanceWorkday({ ...clear, serverIncidentBlocking: true })).toBe(false)
  })
})

describe('getDailyBeat', () => {
  it('is a kickoff on day 1, status on days 5 and 9, quiet otherwise', () => {
    expect(getDailyBeat(1, 1).kind).toBe('kickoff')
    expect(getDailyBeat(2, 5).kind).toBe('mid-sprint')
    expect(getDailyBeat(2, 9).kind).toBe('pre-review')
    expect(getDailyBeat(2, 3).kind).toBe('quiet')
    expect(getDailyBeat(2, 7).kind).toBe('quiet')
  })
})

describe('autoCompleteWorkday (single idempotent day-advance)', () => {
  beforeEach(() => {
    window.localStorage.clear()
    useSprintStore.setState({ ...INITIAL_SPRINT_STATE, phase: 'active', day: 1, confirmingEndDay: false })
    useEconomyStore.setState({ transactions: initialTransactions(), panelOpen: false })
    useTeamStore.setState({
      hires: [
        { employeeId: 'kirill-morozov', hiredAtSprint: 1, hiredAtDay: 1 },
        { employeeId: 'alina-belova', hiredAtSprint: 1, hiredAtDay: 1 },
      ],
      panelOpen: false,
    })
    let states = initialTaskStates()
    states = addToPlan(states, 'auth-api', 1)
    states = addToPlan(states, 'login-screen', 1)
    useProductStore.setState({ taskStates: states, workdayHistory: [], activeReport: null })
    useSecurityStoryStore.setState({
      securityBreach: { ...INITIAL_SECURITY_BREACH, status: 'completed', decision: 'take-responsibility', effectsApplied: true },
      postAuditConversation: { status: 'completed', staffingDecision: 'decline-security-hire', completedAt: { sprintNumber: 1, day: 1 }, effectsApplied: true },
      hasIntroducedSecuritySpecialist: false,
    })
    useSecurityAuditStore.setState({ ...INITIAL_SECURITY_AUDIT })
    useAccessControlStore.setState({ ...INITIAL_ACCESS_CONTROL_DATA })
    useServerIncidentStore.setState({ ...INITIAL_SERVER_INCIDENT_DATA })
    useGameStore.setState({ phase: 'free' })
  })

  it('advances the day exactly once and charges the day once', () => {
    const before = calculateBalance(useEconomyStore.getState().transactions)
    autoCompleteWorkday()
    expect(useSprintStore.getState().day).toBe(2)
    expect(useProductStore.getState().workdayHistory).toHaveLength(1)
    const afterOne = calculateBalance(useEconomyStore.getState().transactions)
    expect(afterOne).toBeLessThan(before) // exactly one day charged
    // a stray second call with no fresh confirm does not re-charge day 1
    useSprintStore.setState({ day: 1, confirmingEndDay: false })
    autoCompleteWorkday() // day 1 already in history → idempotent, no double charge
    expect(useProductStore.getState().workdayHistory).toHaveLength(1)
  })
})
