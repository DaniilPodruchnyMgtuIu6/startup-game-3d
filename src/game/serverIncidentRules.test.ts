import { describe, it, expect } from 'vitest'
import { SERVER_INCIDENT_CATALOG } from './serverIncidentCatalog'
import {
  canAssignServerRecovery,
  getEmployeeActiveSecurityWork,
  getNextPendingServerIncident,
  getRackStabilitySnapshot,
  getServerDowntimeCost,
  getServerIncidentImmediateCost,
  getServerRecoveryEffort,
  initialServerIncidents,
  isRackUnstable,
  isServerIncidentEligible,
  normalizeServerIncidents,
  reconcileServerIncidentThreatRules,
  type ServerIncidentState,
} from './serverIncidentRules'
import { INITIAL_ACCESS_CONTROL } from './accessControlRules'
import { initializeSecurityFindings, assignFindingState } from './securityAuditRules'
import type { RiskSignal } from './riskRules'

const KIRILL = 'kirill-morozov'
const ILYA = 'ilya-vlasov'

const failSig = (rack: string, n: number, idx: number): RiskSignal => ({
  id: `server:${rack}:failure:${n}`, domain: 'service-continuity', impact: 1, source: 'server-minigame', sourceRef: `server:${rack}:failure:${n}`,
  createdAt: { sprintNumber: 1, day: 1 }, createdAtWorkdayIndex: idx,
})
const stabSig = (rack: string, idx: number): RiskSignal => ({
  id: `server:${rack}:stabilized`, domain: 'service-continuity', impact: -2, source: 'server-minigame', sourceRef: `server:${rack}:stabilized`,
  createdAt: { sprintNumber: 1, day: 1 }, createdAtWorkdayIndex: idx,
})

describe('catalog', () => {
  it('has exactly three incidents, one per rack, with the documented costs/effort', () => {
    expect(SERVER_INCIDENT_CATALOG.map((i) => i.id)).toEqual(['gateway-outage', 'auth-account-incident', 'database-exposure-review'])
    expect(new Set(SERVER_INCIDENT_CATALOG.map((i) => i.rackId)).size).toBe(3)
    expect(getServerIncidentImmediateCost('gateway-outage', true)).toBe(80_000)
    expect(getServerIncidentImmediateCost('gateway-outage', false)).toBe(120_000)
    expect(getServerIncidentImmediateCost('auth-account-incident', false)).toBe(170_000)
    expect(getServerIncidentImmediateCost('database-exposure-review', false)).toBe(260_000)
    expect(getServerDowntimeCost('gateway-outage')).toBe(40_000)
    expect(getServerDowntimeCost('database-exposure-review')).toBe(50_000)
    expect(getServerRecoveryEffort('database-exposure-review', false)).toBe(3)
    expect(getServerRecoveryEffort('database-exposure-review', true)).toBe(2)
  })
})

describe('rack stability', () => {
  it('needs 2 failures after the last success to be unstable', () => {
    expect(isRackUnstable(getRackStabilitySnapshot('gateway', [failSig('gateway', 1, 5)]))).toBe(false)
    expect(isRackUnstable(getRackStabilitySnapshot('gateway', [failSig('gateway', 1, 5), failSig('gateway', 2, 6)]))).toBe(true)
  })

  it('a success resets the count; failures before it do not count', () => {
    const snap = getRackStabilitySnapshot('gateway', [failSig('gateway', 1, 5), failSig('gateway', 2, 6), stabSig('gateway', 7)])
    expect(snap.hasSuccessfulStabilization).toBe(true)
    expect(snap.failedAttemptsAfterLastSuccess).toBe(0)
    expect(isRackUnstable(snap)).toBe(false)
  })
})

describe('threat state machine', () => {
  const state = (over: Partial<ServerIncidentState> = {}): ServerIncidentState => ({ incidentId: 'gateway-outage', status: 'dormant', recoveryProgressDays: 0, effectsApplied: false, ...over })

  it('arms only at high risk + unstable rack, due = current + 4', () => {
    expect(reconcileServerIncidentThreatRules({ currentWorkdayIndex: 12, incidentState: state(), actualRiskLevel: 'elevated', rackUnstable: true }).status).toBe('dormant')
    expect(reconcileServerIncidentThreatRules({ currentWorkdayIndex: 12, incidentState: state(), actualRiskLevel: 'high', rackUnstable: false }).status).toBe('dormant')
    const armed = reconcileServerIncidentThreatRules({ currentWorkdayIndex: 12, incidentState: state(), actualRiskLevel: 'high', rackUnstable: true })
    expect(armed).toMatchObject({ status: 'armed', armedAtWorkdayIndex: 12, dueWorkdayIndex: 16, changed: true })
    expect(isServerIncidentEligible(SERVER_INCIDENT_CATALOG[0], state(), 'high', getRackStabilitySnapshot('gateway', [failSig('gateway', 1, 1), failSig('gateway', 2, 2)]))).toBe(true)
  })

  it('disarms when the risk drops or the rack stabilises', () => {
    const armed = state({ status: 'armed', armedAtWorkdayIndex: 12, dueWorkdayIndex: 16 })
    expect(reconcileServerIncidentThreatRules({ currentWorkdayIndex: 14, incidentState: armed, actualRiskLevel: 'elevated', rackUnstable: true }).status).toBe('dormant')
    expect(reconcileServerIncidentThreatRules({ currentWorkdayIndex: 14, incidentState: armed, actualRiskLevel: 'high', rackUnstable: false }).status).toBe('dormant')
  })

  it('becomes pending on the due day when still eligible; resolved is final', () => {
    const armed = state({ status: 'armed', armedAtWorkdayIndex: 12, dueWorkdayIndex: 16 })
    expect(reconcileServerIncidentThreatRules({ currentWorkdayIndex: 16, incidentState: armed, actualRiskLevel: 'high', rackUnstable: true }).status).toBe('pending')
    expect(reconcileServerIncidentThreatRules({ currentWorkdayIndex: 16, incidentState: state({ status: 'resolved' }), actualRiskLevel: 'high', rackUnstable: true }).changed).toBe(false)
  })
})

describe('priority queue', () => {
  it('picks gateway, then auth, then database', () => {
    const states: ServerIncidentState[] = [
      { incidentId: 'database-exposure-review', status: 'pending', recoveryProgressDays: 0, effectsApplied: false },
      { incidentId: 'auth-account-incident', status: 'pending', recoveryProgressDays: 0, effectsApplied: false },
    ]
    expect(getNextPendingServerIncident(states)?.incidentId).toBe('auth-account-incident')
    expect(getNextPendingServerIncident([{ incidentId: 'database-exposure-review', status: 'pending', recoveryProgressDays: 0, effectsApplied: false }])?.incidentId).toBe('database-exposure-review')
    expect(getNextPendingServerIncident([])).toBeUndefined()
  })
})

describe('recovery assignment & one-security-work rule', () => {
  const recoveryState: ServerIncidentState = { incidentId: 'auth-account-incident', status: 'recovery-required', recoveryProgressDays: 0, effectsApplied: false, hadSecuritySpecialistAtIncident: false }
  const ctx = (over = {}) => ({
    incidentId: 'auth-account-incident' as const,
    employeeId: KIRILL,
    incidentState: recoveryState,
    findingStates: initializeSecurityFindings(),
    accessControlState: INITIAL_ACCESS_CONTROL,
    serverIncidentStates: [recoveryState],
    hasIlya: true,
    auditBlocking: false,
    ...over,
  })

  it('allows an eligible employee; gateway is Kirill-only', () => {
    expect(canAssignServerRecovery(ctx())).toEqual({ allowed: true })
    expect(canAssignServerRecovery(ctx({ incidentId: 'gateway-outage', employeeId: ILYA, incidentState: { ...recoveryState, incidentId: 'gateway-outage' }, serverIncidentStates: [{ ...recoveryState, incidentId: 'gateway-outage' }] })).reason).toBe('not-eligible')
  })

  it('blocks Ilya when not hired, and an employee busy with a finding', () => {
    expect(canAssignServerRecovery(ctx({ employeeId: ILYA, hasIlya: false })).reason).toBe('ilya-not-hired')
    const findingStates = assignFindingState(initializeSecurityFindings(), 'account-access-review', KIRILL)
    expect(canAssignServerRecovery(ctx({ findingStates })).reason).toBe('employee-busy')
  })

  it('server recovery counts as active security work', () => {
    const recovering: ServerIncidentState = { ...recoveryState, status: 'recovering', assignedEmployeeId: KIRILL }
    expect(getEmployeeActiveSecurityWork(KIRILL, initializeSecurityFindings(), INITIAL_ACCESS_CONTROL, [recovering])).toEqual({ kind: 'server-recovery', id: 'auth-account-incident' })
  })
})

describe('normalisation', () => {
  it('rebuilds three incidents; running -> pending; clamps progress', () => {
    const states = normalizeServerIncidents({
      'gateway-outage': { incidentId: 'gateway-outage', status: 'running', armedAtWorkdayIndex: 12, dueWorkdayIndex: 16, hadSecuritySpecialistAtIncident: true, recoveryProgressDays: 99 },
      ghost: { incidentId: 'nope', status: 'pending' },
    })
    expect(Object.keys(states)).toHaveLength(3)
    expect(states['gateway-outage'].status).toBe('pending')
    expect(states['gateway-outage'].recoveryProgressDays).toBe(1) // effort with specialist = 1
  })

  it('a missing blob returns three dormant incidents', () => {
    expect(normalizeServerIncidents(undefined)).toEqual(initialServerIncidents())
  })
})
