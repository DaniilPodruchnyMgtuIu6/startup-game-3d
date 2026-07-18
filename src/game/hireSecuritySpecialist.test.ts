import { describe, it, expect, beforeEach } from 'vitest'
import { hireSecuritySpecialist, reconcileSecurityHire } from './hireSecuritySpecialist'
import { useSprintStore } from './sprintStore'
import { useTeamStore } from './teamStore'
import { useGameStore } from './gameStore'
import { useEconomyStore } from './economyStore'
import { useProductStore } from './productStore'
import { useServerIncidentsStore } from './serverIncidentsStore'
import { useSecurityStoryStore, HIRE_SECURITY_TASK } from './securityStoryStore'
import { useCutsceneStore } from '../cutscenes/cutsceneStore'
import { SECURITY_SPECIALIST_ID } from './teamCatalog'
import { hasSecuritySpecialist, type HireRecord } from './teamRules'
import { INITIAL_SECURITY_BREACH, type SecurityStaffingDecision } from './securityStoryRules'
import { initialTransactions, calculateBalance, INITIAL_BUDGET } from './economyRules'
import { BOARD_TASKS } from './tasks'

const hire = (employeeId: string): HireRecord => ({ employeeId, hiredAtSprint: 2, hiredAtDay: 3 })
const hires = () => useTeamStore.getState().hires
const balance = () => calculateBalance(useEconomyStore.getState().transactions)
const hireTaskDone = () => useGameStore.getState().tasks.find((t) => t.id === HIRE_SECURITY_TASK.id)?.done

// Seeds the "approve" state right after the post-audit conversation completed,
// with the hire task present but not done, plus the two developers.
function seedApproved(decision: SecurityStaffingDecision = 'approve-security-hire') {
  useSecurityStoryStore.setState({
    securityBreach: { ...INITIAL_SECURITY_BREACH, status: 'completed', completedAt: { sprintNumber: 2, day: 3 }, decision: 'take-responsibility', effectsApplied: true },
    postAuditConversation: { status: 'completed', staffingDecision: decision, completedAt: { sprintNumber: 2, day: 3 }, effectsApplied: true },
  })
  useSprintStore.setState({ sprintNumber: 2, day: 3, phase: 'active', confirmingEndDay: false })
  useTeamStore.setState({ hires: [hire('kirill-morozov'), hire('alina-belova')], panelOpen: false })
  useEconomyStore.setState({ transactions: initialTransactions(), panelOpen: false })
  useProductStore.setState({ boardOpen: false, prototypeOpen: false, activeReport: null })
  useServerIncidentsStore.setState({ activeMinigame: null })
  useCutsceneStore.setState({ activeSceneId: null, actors: {} })
  useGameStore.setState({ tasks: [...BOARD_TASKS.map((t) => ({ ...t })), { ...HIRE_SECURITY_TASK }] })
  window.localStorage.clear()
}

describe('hireSecuritySpecialist', () => {
  beforeEach(() => seedApproved())

  it('approve: hires Ilya, completes the task, no money or time moved', () => {
    const result = hireSecuritySpecialist()
    expect(result).toEqual({ hired: true, employeeId: SECURITY_SPECIALIST_ID })
    expect(hasSecuritySpecialist(hires())).toBe(true)
    expect(hireTaskDone()).toBe(true)
    expect(balance()).toBe(INITIAL_BUDGET) // no immediate charge
    expect(useSprintStore.getState().day).toBe(3) // day not advanced
  })

  it('decline: returns decision-not-approved and hires nobody', () => {
    seedApproved('decline-security-hire')
    const result = hireSecuritySpecialist()
    expect(result).toEqual({ hired: false, reason: 'decision-not-approved' })
    expect(hasSecuritySpecialist(hires())).toBe(false)
  })

  it('conversation not completed blocks the hire', () => {
    useSecurityStoryStore.setState({
      postAuditConversation: { status: 'pending', staffingDecision: 'approve-security-hire', effectsApplied: true },
    })
    expect(hireSecuritySpecialist()).toEqual({ hired: false, reason: 'conversation-not-completed' })
  })

  it('review blocks the hire (invalid-game-state)', () => {
    useSprintStore.setState({ phase: 'review' })
    expect(hireSecuritySpecialist()).toEqual({ hired: false, reason: 'invalid-game-state' })
  })

  it('a second hire is idempotent (already-hired, no duplicate record or task change)', () => {
    expect(hireSecuritySpecialist().hired).toBe(true)
    const second = hireSecuritySpecialist()
    expect(second).toEqual({ hired: false, reason: 'already-hired' })
    expect(hires().filter((h) => h.employeeId === SECURITY_SPECIALIST_ID)).toHaveLength(1)
    expect(hireTaskDone()).toBe(true)
  })
})

describe('reconcileSecurityHire', () => {
  beforeEach(() => seedApproved())

  it('drops an invalid Ilya hire on the decline branch and reverts the task', () => {
    useSecurityStoryStore.setState({
      postAuditConversation: { status: 'completed', staffingDecision: 'decline-security-hire', completedAt: { sprintNumber: 2, day: 3 }, effectsApplied: true },
    })
    useTeamStore.setState({ hires: [...hires(), hire(SECURITY_SPECIALIST_ID)] })
    useGameStore.getState().completeTask(HIRE_SECURITY_TASK.id)

    reconcileSecurityHire()
    expect(hasSecuritySpecialist(hires())).toBe(false)
    expect(hireTaskDone()).toBe(false)
  })

  it('a valid hire syncs the task to done', () => {
    useTeamStore.setState({ hires: [...hires(), hire(SECURITY_SPECIALIST_ID)] })
    // task still not done in the persisted blob
    expect(hireTaskDone()).toBe(false)
    reconcileSecurityHire()
    expect(hireTaskDone()).toBe(true)
  })

  it('a done hire task without a hire record is reverted', () => {
    useGameStore.getState().completeTask(HIRE_SECURITY_TASK.id) // done but nobody hired
    expect(hasSecuritySpecialist(hires())).toBe(false)
    reconcileSecurityHire()
    expect(hireTaskDone()).toBe(false)
  })
})
