import { describe, it, expect } from 'vitest'
import {
  initializeSecurityFindings,
  getRemainingSecurityEffort,
  getEligibleEmployeesForFinding,
  canAssignEmployeeToFinding,
  assignFindingState,
  unassignFindingState,
  getEmployeeActiveSecurityFinding,
  getEmployeesAssignedToSecurity,
  applySecurityWorkdayRules,
  evaluateFollowUpAudit,
  getSecurityAuditFine,
  allSecurityFindingsClosed,
  normalizeSecurityFindingStates,
  type SecurityFindingState,
  type SecurityStaffContext,
} from './securityAuditRules'

const SONYA = 'sonya-sokolova'
const KIRILL = 'kirill-morozov'
const ILYA = 'ilya-vlasov'
const ALINA = 'alina-belova'
const PROCESS = 'workstation-locking-training' // effort 2, process
const TECH = 'account-access-review' // effort 3, technical

const full: SecurityStaffContext = { hasKirill: true, hasIlya: true }
const noIlya: SecurityStaffContext = { hasKirill: true, hasIlya: false }

const withAssignee = (states: SecurityFindingState[], findingId: string, employeeId: string) =>
  assignFindingState(states, findingId, employeeId)

describe('initialisation', () => {
  it('creates four open findings with zero progress', () => {
    const s = initializeSecurityFindings()
    expect(s).toHaveLength(4)
    expect(s.every((f) => f.status === 'open' && f.progressDays === 0 && !f.assignedEmployeeId)).toBe(true)
  })

  it('remaining effort matches the catalog', () => {
    const s = initializeSecurityFindings()
    expect(getRemainingSecurityEffort(s.find((f) => f.findingId === PROCESS)!)).toBe(2)
    expect(getRemainingSecurityEffort(s.find((f) => f.findingId === TECH)!)).toBe(3)
  })
})

describe('eligibility & assignment', () => {
  it('offers Sonya for process, Kirill for technical, and Ilya for both when hired', () => {
    expect(getEligibleEmployeesForFinding(PROCESS, full).sort()).toEqual([ILYA, SONYA].sort())
    expect(getEligibleEmployeesForFinding(TECH, full).sort()).toEqual([ILYA, KIRILL].sort())
  })

  it('drops Ilya when not really hired', () => {
    expect(getEligibleEmployeesForFinding(PROCESS, noIlya)).toEqual([SONYA])
    expect(getEligibleEmployeesForFinding(TECH, noIlya)).toEqual([KIRILL])
  })

  it('Alina is never eligible', () => {
    const states = initializeSecurityFindings()
    expect(canAssignEmployeeToFinding(states, PROCESS, ALINA, full).reason).toBe('not-eligible')
    expect(canAssignEmployeeToFinding(states, TECH, ALINA, full).reason).toBe('not-eligible')
  })

  it('Sonya only on process, Kirill only on technical', () => {
    const states = initializeSecurityFindings()
    expect(canAssignEmployeeToFinding(states, PROCESS, SONYA, full).allowed).toBe(true)
    expect(canAssignEmployeeToFinding(states, TECH, SONYA, full).reason).toBe('not-eligible')
    expect(canAssignEmployeeToFinding(states, TECH, KIRILL, full).allowed).toBe(true)
    expect(canAssignEmployeeToFinding(states, PROCESS, KIRILL, full).reason).toBe('not-eligible')
  })

  it('one employee cannot take a second finding', () => {
    let states = initializeSecurityFindings()
    states = withAssignee(states, TECH, ILYA)
    const check = canAssignEmployeeToFinding(states, 'sensitive-data-logging-review', ILYA, full)
    expect(check).toEqual({ allowed: false, reason: 'employee-busy' })
  })

  it('unassign frees the employee; a closed finding cannot be assigned', () => {
    let states = initializeSecurityFindings()
    states = withAssignee(states, TECH, ILYA)
    expect(getEmployeeActiveSecurityFinding(states, ILYA)?.findingId).toBe(TECH)
    states = unassignFindingState(states, TECH)
    expect(getEmployeeActiveSecurityFinding(states, ILYA)).toBeUndefined()

    const closed = states.map((s) => (s.findingId === TECH ? { ...s, status: 'closed' as const, progressDays: 3 } : s))
    expect(canAssignEmployeeToFinding(closed, TECH, ILYA, full).reason).toBe('finding-closed')
  })
})

describe('daily security progress', () => {
  it('assigned employees each advance one day; unassigned findings do not change', () => {
    let states = initializeSecurityFindings()
    states = withAssignee(states, PROCESS, SONYA)
    states = withAssignee(states, TECH, KIRILL)
    const calc = applySecurityWorkdayRules(states, { sprintNumber: 2, day: 3 })

    expect(calc.divertedEmployeeIds.sort()).toEqual([KIRILL, SONYA].sort())
    const process = calc.states.find((s) => s.findingId === PROCESS)!
    const tech = calc.states.find((s) => s.findingId === TECH)!
    expect(process.progressDays).toBe(1)
    expect(tech.progressDays).toBe(1)
    // an untouched finding stays at zero
    expect(calc.states.find((s) => s.findingId === 'incident-response-procedure')!.progressDays).toBe(0)
  })

  it('closes a finding on completion and frees its assignee', () => {
    let states = initializeSecurityFindings()
    states = withAssignee(states, PROCESS, SONYA) // effort 2
    states = applySecurityWorkdayRules(states, { sprintNumber: 2, day: 3 }).states
    const calc = applySecurityWorkdayRules(states, { sprintNumber: 2, day: 4 })
    const process = calc.states.find((s) => s.findingId === PROCESS)!
    expect(process.status).toBe('closed')
    expect(process.progressDays).toBe(2)
    expect(process.closedAt).toEqual({ sprintNumber: 2, day: 4 })
    expect(process.assignedEmployeeId).toBeUndefined()
    expect(calc.record.results.find((r) => r.findingId === PROCESS)?.closedFinding).toBe(true)
    // Sonya is free again
    expect(getEmployeesAssignedToSecurity(calc.states)).not.toContain(SONYA)
  })

  it('no assignments -> empty diversion and no progress', () => {
    const calc = applySecurityWorkdayRules(initializeSecurityFindings(), { sprintNumber: 2, day: 3 })
    expect(calc.divertedEmployeeIds).toEqual([])
    expect(calc.record.results).toEqual([])
  })
})

describe('audit evaluation & fines', () => {
  const allClosed = initializeSecurityFindings().map((s) => ({ ...s, status: 'closed' as const, progressDays: 99 }))

  it('all closed -> passed, no fine', () => {
    expect(allSecurityFindingsClosed(allClosed)).toBe(true)
    expect(evaluateFollowUpAudit(allClosed, 1)).toEqual({
      passed: true,
      unresolvedFindingIds: [],
      fineAmount: 0,
      leadershipComplaint: false,
      shutdownRecommendation: false,
    })
  })

  it('fine scale 120k / 250k / 500k, then 0 for unsupported', () => {
    expect(getSecurityAuditFine(1)).toBe(120_000)
    expect(getSecurityAuditFine(2)).toBe(250_000)
    expect(getSecurityAuditFine(3)).toBe(500_000)
    expect(getSecurityAuditFine(4)).toBe(0)
  })

  it('first failure: 120k, no complaint/shutdown', () => {
    const open = initializeSecurityFindings()
    const r = evaluateFollowUpAudit(open, 1)
    expect(r).toMatchObject({ passed: false, fineAmount: 120_000, leadershipComplaint: false, shutdownRecommendation: false })
    expect(r.unresolvedFindingIds).toHaveLength(4)
  })

  it('second failure: 250k + leadership complaint', () => {
    expect(evaluateFollowUpAudit(initializeSecurityFindings(), 2)).toMatchObject({
      passed: false,
      fineAmount: 250_000,
      leadershipComplaint: true,
      shutdownRecommendation: false,
    })
  })

  it('third failure: 500k + shutdown recommendation', () => {
    expect(evaluateFollowUpAudit(initializeSecurityFindings(), 3)).toMatchObject({
      passed: false,
      fineAmount: 500_000,
      leadershipComplaint: true,
      shutdownRecommendation: true,
    })
  })
})

describe('normalisation', () => {
  it('rebuilds all four findings, clamps progress, and syncs status', () => {
    const states = normalizeSecurityFindingStates([
      { findingId: PROCESS, status: 'open', progressDays: 99 }, // over effort -> closed
      { findingId: 'ghost', status: 'open', progressDays: 1 }, // unknown dropped
    ])
    expect(states).toHaveLength(4)
    const p = states.find((s) => s.findingId === PROCESS)!
    expect(p.status).toBe('closed')
    expect(p.progressDays).toBe(2)
  })

  it('clears an assignee on a closed finding and dedupes one employee across findings', () => {
    const states = normalizeSecurityFindingStates([
      { findingId: PROCESS, status: 'closed', progressDays: 2, assignedEmployeeId: ILYA, closedAt: { sprintNumber: 2, day: 3 } },
      { findingId: TECH, status: 'in-progress', progressDays: 1, assignedEmployeeId: ILYA },
      { findingId: 'sensitive-data-logging-review', status: 'in-progress', progressDays: 1, assignedEmployeeId: ILYA },
    ])
    // closed finding has no assignee
    expect(states.find((s) => s.findingId === PROCESS)!.assignedEmployeeId).toBeUndefined()
    // Ilya kept on the first (catalog order) non-closed finding only
    const assignedToIlya = states.filter((s) => s.assignedEmployeeId === ILYA)
    expect(assignedToIlya).toHaveLength(1)
    expect(assignedToIlya[0].findingId).toBe(TECH)
  })
})
