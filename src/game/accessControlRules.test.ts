import { describe, it, expect } from 'vitest'
import {
  canAssignAccessControlEmployee,
  canTriggerOfficeIntrusion,
  canUnlockAccessControlProposal,
  getAccessControlEffortDays,
  getEmployeeActiveSecurityWork,
  getOfficeIntrusionResponseCost,
  getRemainingAccessControlEffort,
  isOfficeIntrusionBlocking,
  normalizeAccessControlState,
  normalizeIntrusionState,
  reconcileIntrusionThreatRules,
  INITIAL_ACCESS_CONTROL,
  type AccessControlState,
  type IntrusionThreatContext,
  type OfficeIntrusionTriggerContext,
} from './accessControlRules'
import { initializeSecurityFindings, assignFindingState, type SecurityFindingState } from './securityAuditRules'

const SONYA = 'sonya-sokolova'
const ILYA = 'ilya-vlasov'
const TECH = 'account-access-review'

describe('proposal unlock', () => {
  it('unlocks only at elevated or higher detected risk', () => {
    expect(canUnlockAccessControlProposal('controlled')).toBe(false)
    expect(canUnlockAccessControlProposal('low')).toBe(false)
    expect(canUnlockAccessControlProposal('elevated')).toBe(true)
    expect(canUnlockAccessControlProposal('high')).toBe(true)
    expect(canUnlockAccessControlProposal('critical')).toBe(true)
  })
})

describe('effort & assignment', () => {
  it('Sonya needs 3 days, Ilya needs 2', () => {
    expect(getAccessControlEffortDays(SONYA)).toBe(3)
    expect(getAccessControlEffortDays(ILYA)).toBe(2)
  })

  it('remaining effort follows the current assignee and caps progress', () => {
    expect(getRemainingAccessControlEffort({ ...INITIAL_ACCESS_CONTROL, assignedEmployeeId: SONYA, progressDays: 1 })).toBe(2)
    expect(getRemainingAccessControlEffort({ ...INITIAL_ACCESS_CONTROL, assignedEmployeeId: ILYA, progressDays: 1 })).toBe(1)
    expect(getRemainingAccessControlEffort({ ...INITIAL_ACCESS_CONTROL, assignedEmployeeId: ILYA, progressDays: 5 })).toBe(0)
  })

  const ctx = (over: Partial<Parameters<typeof canAssignAccessControlEmployee>[0]> = {}) => ({
    employeeId: SONYA as 'sonya-sokolova' | 'ilya-vlasov',
    proposalStatus: 'approved' as const,
    hasIlya: true,
    findingStates: initializeSecurityFindings(),
    auditBlocking: false,
    ...over,
  })

  it('allows an eligible assignment', () => {
    expect(canAssignAccessControlEmployee(ctx())).toEqual({ allowed: true })
  })

  it.each<[string, Partial<Parameters<typeof canAssignAccessControlEmployee>[0]>, string]>([
    ['not approved yet', { proposalStatus: 'available' }, 'not-approved'],
    ['already active', { proposalStatus: 'active' }, 'already-active'],
    ['Ilya not hired', { employeeId: 'ilya-vlasov', hasIlya: false }, 'ilya-not-hired'],
    ['audit blocking', { auditBlocking: true }, 'audit-in-progress'],
  ])('blocks when %s', (_l, over, reason) => {
    expect(canAssignAccessControlEmployee(ctx(over)).reason).toBe(reason)
  })

  it('blocks an employee already on a finding, and reports their active work', () => {
    const findingStates = assignFindingState(initializeSecurityFindings(), TECH, ILYA)
    expect(canAssignAccessControlEmployee(ctx({ employeeId: ILYA, findingStates })).reason).toBe('employee-busy-finding')
    expect(getEmployeeActiveSecurityWork(ILYA, findingStates, INITIAL_ACCESS_CONTROL)).toEqual({ kind: 'finding', findingId: TECH })
  })

  it('access-control assignment counts as active security work', () => {
    const ac: AccessControlState = { ...INITIAL_ACCESS_CONTROL, proposalStatus: 'in-progress', assignedEmployeeId: SONYA, progressDays: 1 }
    expect(getEmployeeActiveSecurityWork(SONYA, initializeSecurityFindings(), ac)).toEqual({ kind: 'access-control' })
  })
})

describe('intrusion threat state machine', () => {
  const base = (over: Partial<IntrusionThreatContext> = {}): IntrusionThreatContext => ({
    currentWorkdayIndex: 12,
    actualOfficeAccessLevel: 'high',
    accessControlActive: false,
    intrusionStatus: 'dormant',
    ...over,
  })

  it('arms at high risk with due = current + 4', () => {
    const t = reconcileIntrusionThreatRules(base())
    expect(t).toMatchObject({ status: 'armed', armedAtWorkdayIndex: 12, dueWorkdayIndex: 16, changed: true })
  })

  it('does not arm below high', () => {
    expect(reconcileIntrusionThreatRules(base({ actualOfficeAccessLevel: 'elevated' })).status).toBe('dormant')
  })

  it('disarms when risk drops before due', () => {
    const t = reconcileIntrusionThreatRules(base({ intrusionStatus: 'armed', armedAtWorkdayIndex: 12, dueWorkdayIndex: 16, actualOfficeAccessLevel: 'elevated', currentWorkdayIndex: 14 }))
    expect(t).toMatchObject({ status: 'dormant', changed: true })
  })

  it('becomes pending once due is reached and risk is still high', () => {
    const t = reconcileIntrusionThreatRules(base({ intrusionStatus: 'armed', armedAtWorkdayIndex: 12, dueWorkdayIndex: 16, currentWorkdayIndex: 16 }))
    expect(t.status).toBe('pending')
  })

  it('active СКУД prevents a not-yet-resolved threat', () => {
    expect(reconcileIntrusionThreatRules(base({ intrusionStatus: 'armed', accessControlActive: true })).status).toBe('prevented')
    expect(reconcileIntrusionThreatRules(base({ intrusionStatus: 'pending', accessControlActive: true })).status).toBe('prevented')
  })

  it('resolved and prevented are final', () => {
    expect(reconcileIntrusionThreatRules(base({ intrusionStatus: 'resolved' })).changed).toBe(false)
    expect(reconcileIntrusionThreatRules(base({ intrusionStatus: 'prevented' })).changed).toBe(false)
  })
})

describe('trigger, cost & blocking', () => {
  const trig = (over: Partial<OfficeIntrusionTriggerContext> = {}): OfficeIntrusionTriggerContext => ({
    intrusionStatus: 'pending',
    isDailyReportOpen: false,
    isFollowUpAuditActive: false,
    isCutsceneRunning: false,
    isServerMinigameOpen: false,
    isBlockingOverlayOpen: false,
    isBlockingDialogueOpen: false,
    ...over,
  })

  it('fires only when pending and the UI is free', () => {
    expect(canTriggerOfficeIntrusion(trig())).toBe(true)
    expect(canTriggerOfficeIntrusion(trig({ intrusionStatus: 'armed' }))).toBe(false)
    expect(canTriggerOfficeIntrusion(trig({ isDailyReportOpen: true }))).toBe(false)
    expect(canTriggerOfficeIntrusion(trig({ isFollowUpAuditActive: true }))).toBe(false)
    expect(canTriggerOfficeIntrusion(trig({ isCutsceneRunning: true }))).toBe(false)
  })

  it('response cost is 60k with the specialist and 140k without', () => {
    expect(getOfficeIntrusionResponseCost(true)).toBe(60_000)
    expect(getOfficeIntrusionResponseCost(false)).toBe(140_000)
  })

  it('pending/running block the next day', () => {
    expect(isOfficeIntrusionBlocking({ status: 'pending', effectsApplied: false })).toBe(true)
    expect(isOfficeIntrusionBlocking({ status: 'running', effectsApplied: false })).toBe(true)
    expect(isOfficeIntrusionBlocking({ status: 'resolved', effectsApplied: true })).toBe(false)
  })
})

describe('normalisation', () => {
  it('a missing access-control state derives the proposal from detected risk', () => {
    expect(normalizeAccessControlState(undefined, 'controlled').proposalStatus).toBe('locked')
    expect(normalizeAccessControlState(undefined, 'elevated').proposalStatus).toBe('available')
  })

  it('active without completedAt downgrades to in-progress; fractional progress clamps', () => {
    const s = normalizeAccessControlState({ proposalStatus: 'active', progressDays: -2 }, 'high')
    expect(s.proposalStatus).toBe('in-progress')
    expect(s.progressDays).toBe(0)
  })

  it('running intrusion hydrates to pending; due before armed is repaired', () => {
    expect(normalizeIntrusionState({ status: 'running', armedAtWorkdayIndex: 12, dueWorkdayIndex: 16 }).status).toBe('pending')
    const repaired = normalizeIntrusionState({ status: 'armed', armedAtWorkdayIndex: 20, dueWorkdayIndex: 5 })
    expect(repaired.dueWorkdayIndex).toBe(24)
  })
})
