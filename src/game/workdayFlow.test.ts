import { describe, it, expect, beforeEach } from 'vitest'
import { canAutoAdvanceWorkday, shouldOpenSprintKickoff, securityBreachStillDue, getDailyBeat, type WorkdayFlowContext } from './workdayFlow'
import { autoCompleteWorkday, currentFlowContext } from './WorkdayFlowController'
import { useSprintStore, loadKickoffShown } from './sprintStore'
import { useEconomyStore } from './economyStore'
import { useTeamStore } from './teamStore'
import { useProductStore } from './productStore'
import { useSecurityStoryStore } from './securityStoryStore'
import { useSecurityAuditStore, INITIAL_SECURITY_AUDIT } from './securityAuditStore'
import { useAccessControlStore, INITIAL_ACCESS_CONTROL_DATA } from './accessControlStore'
import { useServerIncidentStore, INITIAL_SERVER_INCIDENT_DATA } from './serverIncidentStore'
import { useServerIncidentsStore } from './serverIncidentsStore'
import { useGameOutcomeStore } from './gameOutcomeStore'
import { useCharacterStore } from '../character/characterStore'
import { useCutsceneStore } from '../cutscenes/cutsceneStore'
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

describe('securityBreachStillDue (ambient yields to the mandatory breach)', () => {
  it('is true only while the breach is unfinished AND it could fire (sprint ≥ 2, prototype ready)', () => {
    expect(securityBreachStillDue(false, 2, true)).toBe(true) // breach pending on a qualifying day → yield
    expect(securityBreachStillDue(true, 2, true)).toBe(false) // already done → conversations resume
    expect(securityBreachStillDue(false, 1, true)).toBe(false) // sprint 1: breach can't fire yet
    expect(securityBreachStillDue(false, 3, false)).toBe(false) // no prototype: breach can't fire yet
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

// Puts every store into an advanceable active day: free play, active sprint,
// team hired, nothing busy/blocking, no result overlay. currentFlowContext()
// then reports busy=false and canAutoAdvance=true (asserted below as baseline).
function seedAdvanceableDay(day = 3) {
  window.localStorage.clear()
  useSprintStore.setState({ ...INITIAL_SPRINT_STATE, phase: 'active', day, confirmingEndDay: false, kickoffShownForSprint: 1 })
  useEconomyStore.setState({ transactions: initialTransactions(), panelOpen: false })
  useTeamStore.setState({
    hires: [
      { employeeId: 'kirill-morozov', hiredAtSprint: 1, hiredAtDay: 1 },
      { employeeId: 'alina-belova', hiredAtSprint: 1, hiredAtDay: 1 },
    ],
    panelOpen: false,
  })
  useProductStore.setState({
    taskStates: addToPlan(initialTaskStates(), 'auth-api', 1),
    workdayHistory: [],
    activeReport: null,
    boardOpen: false,
    prototypeOpen: false,
    releaseCheckOpen: false,
  })
  useSecurityStoryStore.setState({
    securityBreach: { ...INITIAL_SECURITY_BREACH, status: 'completed', decision: 'take-responsibility', effectsApplied: true },
    postAuditConversation: { status: 'completed', staffingDecision: 'decline-security-hire', completedAt: { sprintNumber: 1, day: 1 }, effectsApplied: true },
    hasIntroducedSecuritySpecialist: false,
  })
  useSecurityAuditStore.setState({ ...INITIAL_SECURITY_AUDIT, auditResultToAcknowledge: null })
  useAccessControlStore.setState({ ...INITIAL_ACCESS_CONTROL_DATA, intrusionResultToAcknowledge: null })
  useServerIncidentStore.setState({ ...INITIAL_SERVER_INCIDENT_DATA, incidentResultToAcknowledge: null })
  useServerIncidentsStore.setState({ activeMinigame: null })
  useCharacterStore.setState({ inputLocked: false })
  useCutsceneStore.setState({ activeSceneId: null })
  useGameOutcomeStore.setState({ status: 'playing' })
  useGameStore.setState({ phase: 'free', activeDialogue: null, activeChoice: null })
}

// Bug A: after a scene resolves, a *ResultToAcknowledge overlay is shown while
// the event itself is no longer "blocking". The workday busy-gate must include
// these, or the day auto-advances behind the overlay the player is reading.
describe('currentFlowContext — result-acknowledge overlays block auto-advance (Bug A)', () => {
  beforeEach(() => seedAdvanceableDay(3))

  it('baseline: with no overlay the day is advanceable', () => {
    expect(currentFlowContext().busy).toBe(false)
    expect(canAutoAdvanceWorkday(currentFlowContext())).toBe(true)
  })

  it('an audit-result overlay pauses the day', () => {
    useSecurityAuditStore.setState({
      auditResultToAcknowledge: { auditNumber: 1, evaluatedAt: { sprintNumber: 2, day: 2 }, result: 'passed', unresolvedFindingIds: [], fineAmount: 0 },
    })
    expect(currentFlowContext().busy).toBe(true)
    expect(canAutoAdvanceWorkday(currentFlowContext())).toBe(false)
  })

  it('an intrusion-result overlay pauses the day', () => {
    useAccessControlStore.setState({ intrusionResultToAcknowledge: useAccessControlStore.getState().intrusion })
    expect(currentFlowContext().busy).toBe(true)
    expect(canAutoAdvanceWorkday(currentFlowContext())).toBe(false)
  })

  it('a server-incident-result overlay pauses the day', () => {
    useServerIncidentStore.setState({ incidentResultToAcknowledge: 'gateway-outage' })
    expect(currentFlowContext().busy).toBe(true)
    expect(canAutoAdvanceWorkday(currentFlowContext())).toBe(false)
  })
})

// Bug B: the "kickoff already shown" marker used to live in a React ref, so a
// reload on day 1 replayed the kickoff. It is now persisted in the sprint store.
describe('sprint kickoff marker (Bug B)', () => {
  beforeEach(() => {
    window.localStorage.clear()
    useSprintStore.getState().resetSprint()
  })

  it('shouldOpenSprintKickoff fires only on day 1 of an un-marked sprint', () => {
    expect(shouldOpenSprintKickoff(1, 1, null)).toBe(true)
    expect(shouldOpenSprintKickoff(1, 1, 1)).toBe(false) // already shown this sprint
    expect(shouldOpenSprintKickoff(2, 1, null)).toBe(false) // not day 1
    expect(shouldOpenSprintKickoff(1, 2, 1)).toBe(true) // new sprint, stale marker
  })

  it('markSprintKickoffShown persists, so a reload does not replay the kickoff', () => {
    useSprintStore.getState().markSprintKickoffShown(2)
    expect(useSprintStore.getState().kickoffShownForSprint).toBe(2)
    // a reload reads the marker straight back from storage
    expect(loadKickoffShown(window.localStorage, '')).toBe(2)
    expect(shouldOpenSprintKickoff(1, 2, loadKickoffShown(window.localStorage, ''))).toBe(false)
  })

  it('?intro wipes the marker', () => {
    useSprintStore.getState().markSprintKickoffShown(3)
    expect(loadKickoffShown(window.localStorage, '?intro')).toBeNull()
    expect(window.localStorage.getItem('startup-office-sprint-kickoff')).toBeNull()
  })

  it('resetSprint clears the marker in state and storage', () => {
    useSprintStore.getState().markSprintKickoffShown(4)
    useSprintStore.getState().resetSprint()
    expect(useSprintStore.getState().kickoffShownForSprint).toBeNull()
    expect(loadKickoffShown(window.localStorage, '')).toBeNull()
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
