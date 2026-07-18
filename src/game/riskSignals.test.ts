import { describe, it, expect } from 'vitest'
import {
  accessControlActiveSignals,
  accessControlPostponedSignals,
  auditSignals,
  declineStaffingSignals,
  findingClosedSignals,
  officeIntrusionSignals,
  serverIncidentOccurredSignals,
  serverIncidentRecoveredSignals,
  rebuildRiskSignalsFromGameState,
  securityHireSignals,
  serverFailureSignals,
  serverStabilizedSignals,
  sprintPlanSignals,
  type RiskCreationMoment,
} from './riskSignals'

const moment: RiskCreationMoment = { sprintNumber: 2, day: 2, workdayIndex: 12 }
const byId = (signals: { id: string }[]) => signals.map((s) => s.id).sort()

describe('staffing signals', () => {
  it('decline adds governance +2 and office-access +1', () => {
    const s = declineStaffingSignals(moment)
    expect(s.find((x) => x.domain === 'governance')).toMatchObject({ impact: 2, source: 'staffing-decision' })
    expect(s.find((x) => x.domain === 'office-access')).toMatchObject({ impact: 1 })
  })
  it('real hire adds governance -1', () => {
    expect(securityHireSignals(moment)).toEqual([
      expect.objectContaining({ id: 'staffing:ilya-vlasov-hired:governance', domain: 'governance', impact: -1, source: 'security-hire' }),
    ])
  })
})

describe('finding-closed signals', () => {
  it('maps each finding to its mitigation(s)', () => {
    expect(findingClosedSignals('workstation-locking-training', moment)).toMatchObject([{ domain: 'office-access', impact: -2 }])
    expect(findingClosedSignals('account-access-review', moment)).toMatchObject([{ domain: 'identity-access', impact: -3 }])
    expect(findingClosedSignals('sensitive-data-logging-review', moment)).toMatchObject([{ domain: 'sensitive-data', impact: -3 }])
    const incident = findingClosedSignals('incident-response-procedure', moment)
    expect(incident.map((s) => s.domain).sort()).toEqual(['governance', 'service-continuity'])
    expect(incident.every((s) => s.impact === -1)).toBe(true)
  })
})

describe('audit signals', () => {
  it('passed -> governance -3', () => {
    expect(auditSignals(1, true, moment)).toMatchObject([{ id: 'audit:1:passed:governance', domain: 'governance', impact: -3 }])
  })
  it('failures scale +2 / +3 / +4, third immediate', () => {
    expect(auditSignals(1, false, moment)).toMatchObject([{ impact: 2 }])
    expect(auditSignals(2, false, moment)).toMatchObject([{ impact: 3 }])
    const third = auditSignals(3, false, moment)
    expect(third).toMatchObject([{ impact: 4, detectionDelayOverride: 0 }])
  })
})

describe('server signals', () => {
  it('only the first two failures add a point, each in the right domain', () => {
    expect(serverFailureSignals('auth', 1, moment)).toMatchObject([{ id: 'server:auth:failure:1', domain: 'identity-access', impact: 1 }])
    expect(serverFailureSignals('auth', 2, moment)).toMatchObject([{ id: 'server:auth:failure:2', domain: 'identity-access', impact: 1 }])
    expect(serverFailureSignals('auth', 3, moment)).toEqual([])
    expect(serverFailureSignals('gateway', 1, moment)[0].domain).toBe('service-continuity')
    expect(serverFailureSignals('database', 1, moment)[0].domain).toBe('sensitive-data')
    expect(serverFailureSignals('backup', 1, moment)).toEqual([])
  })
  it('stabilisation is -2 in the same domain', () => {
    expect(serverStabilizedSignals('auth', moment)).toMatchObject([{ id: 'server:auth:stabilized', domain: 'identity-access', impact: -2 }])
  })
})

describe('sprint plan signals', () => {
  it('adds one overload signal per over-capacity employee', () => {
    const s = sprintPlanSignals(3, [{ employeeId: 'kirill-morozov', plannedLoadDays: 15 }, { employeeId: 'alina-belova', plannedLoadDays: 8 }], false, moment)
    expect(s).toHaveLength(1)
    expect(s[0]).toMatchObject({ id: 'sprint:3:overload:kirill-morozov', domain: 'delivery-pressure', impact: 2 })
  })
  it('a balanced sprint adds -1 only when overload was accrued before', () => {
    const balanced = sprintPlanSignals(4, [{ employeeId: 'kirill-morozov', plannedLoadDays: 8 }, { employeeId: 'alina-belova', plannedLoadDays: 9 }], true, moment)
    expect(balanced).toMatchObject([{ id: 'sprint:4:balanced-plan', impact: -1 }])
    const noHistory = sprintPlanSignals(4, [{ employeeId: 'kirill-morozov', plannedLoadDays: 8 }], false, moment)
    expect(noHistory).toEqual([])
  })
})

describe('access control & intrusion signals', () => {
  it('postpone adds office-access +1 and governance +1', () => {
    const s = accessControlPostponedSignals(moment)
    expect(s.find((x) => x.domain === 'office-access')).toMatchObject({ impact: 1, source: 'access-control-decision' })
    expect(s.find((x) => x.domain === 'governance')).toMatchObject({ impact: 1 })
  })
  it('active СКУД mitigates office-access -4 and governance -1', () => {
    const s = accessControlActiveSignals(moment)
    expect(s.find((x) => x.domain === 'office-access')).toMatchObject({ impact: -4, source: 'access-control-implementation' })
    expect(s.find((x) => x.domain === 'governance')).toMatchObject({ impact: -1 })
  })
  it('intrusion with Ilya: office +2, governance +1, no sensitive-data', () => {
    const s = officeIntrusionSignals(true, moment)
    expect(byId(s)).toEqual(['incident:office-intrusion:governance', 'incident:office-intrusion:office-access'])
    expect(s.find((x) => x.domain === 'office-access')!.impact).toBe(2)
    expect(s.some((x) => x.domain === 'sensitive-data')).toBe(false)
  })
  it('intrusion without Ilya: office +3, governance +1, sensitive-data +2', () => {
    const s = officeIntrusionSignals(false, moment)
    expect(s.find((x) => x.domain === 'office-access')!.impact).toBe(3)
    expect(s.find((x) => x.domain === 'sensitive-data')).toMatchObject({ impact: 2, source: 'access-control-incident' })
  })
})

describe('server incident signals', () => {
  it('occurred is +3 in the incident domain; recovered is -4', () => {
    expect(serverIncidentOccurredSignals('gateway-outage', 'service-continuity', moment)).toMatchObject([
      { id: 'server-incident:gateway-outage:occurred', domain: 'service-continuity', impact: 3, source: 'server-incident' },
    ])
    expect(serverIncidentRecoveredSignals('database-exposure-review', 'sensitive-data', moment)).toMatchObject([
      { id: 'server-incident:database-exposure-review:recovered', domain: 'sensitive-data', impact: -4 },
    ])
  })
})

describe('rebuild from Feature 08 snapshot', () => {
  it('reconstructs decisions, findings and audits with their moments; idempotent by id', () => {
    const signals = rebuildRiskSignalsFromGameState({
      currentWorkdayIndex: 41,
      currentMoment: { sprintNumber: 5, day: 1 },
      staffingDecision: 'decline-security-hire',
      ilyaHired: false,
      closedFindings: [{ findingId: 'account-access-review', closedAt: { sprintNumber: 3, day: 2, workdayIndex: 22 } }],
      auditRecords: [{ auditNumber: 1, passed: false, evaluatedAt: { sprintNumber: 3, day: 1, workdayIndex: 21 } }],
      serverFailures: [],
      serverStabilized: [],
    })
    expect(byId(signals)).toEqual(
      ['audit:1:failed:governance', 'finding:account-access-review:closed', 'staffing:decline-security-hire:governance', 'staffing:decline-security-hire:office-access'].sort(),
    )
    // finding uses its own closedAt moment, not "now"
    expect(signals.find((s) => s.id === 'finding:account-access-review:closed')!.createdAtWorkdayIndex).toBe(22)
    // no duplicate ids
    expect(new Set(signals.map((s) => s.id)).size).toBe(signals.length)
  })
})
