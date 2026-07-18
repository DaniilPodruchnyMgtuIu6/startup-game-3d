import type { RiskDomain } from './riskCatalog'
import { getSprintOverloadRiskImpact, type RiskSignal, type RiskSignalSource } from './riskRules'
import type { ServerRole } from './serverIncidentsStore'

// Pure builders for every risk signal (Feature 09). Each takes the moment it was
// created and returns immutable signals with stable ids; nothing here reads or
// mutates state. The integration use-cases add the results via
// riskStore.addSignalsOnce (idempotent by id).

export interface RiskCreationMoment {
  sprintNumber: number
  day: number
  workdayIndex: number
}

function make(
  id: string,
  domain: RiskDomain,
  impact: number,
  source: RiskSignalSource,
  sourceRef: string,
  moment: RiskCreationMoment,
  detectionDelayOverride?: number,
): RiskSignal {
  return {
    id,
    domain,
    impact,
    source,
    sourceRef,
    createdAt: { sprintNumber: moment.sprintNumber, day: moment.day },
    createdAtWorkdayIndex: moment.workdayIndex,
    ...(detectionDelayOverride !== undefined ? { detectionDelayOverride } : {}),
  }
}

// --- Staffing (Feature 06/07) -----------------------------------------------

export function declineStaffingSignals(moment: RiskCreationMoment): RiskSignal[] {
  return [
    make('staffing:decline-security-hire:governance', 'governance', 2, 'staffing-decision', 'decline-security-hire', moment),
    make('staffing:decline-security-hire:office-access', 'office-access', 1, 'staffing-decision', 'decline-security-hire', moment),
  ]
}

export function securityHireSignals(moment: RiskCreationMoment): RiskSignal[] {
  return [make('staffing:ilya-vlasov-hired:governance', 'governance', -1, 'security-hire', 'ilya-vlasov', moment)]
}

// --- Findings (Feature 08) --------------------------------------------------

export function findingClosedSignals(findingId: string, moment: RiskCreationMoment): RiskSignal[] {
  const s = (id: string, domain: RiskDomain, impact: number) => make(id, domain, impact, 'security-finding', findingId, moment)
  switch (findingId) {
    case 'workstation-locking-training':
      return [s('finding:workstation-locking-training:closed', 'office-access', -2)]
    case 'account-access-review':
      return [s('finding:account-access-review:closed', 'identity-access', -3)]
    case 'incident-response-procedure':
      return [
        s('finding:incident-response-procedure:closed:governance', 'governance', -1),
        s('finding:incident-response-procedure:closed:continuity', 'service-continuity', -1),
      ]
    case 'sensitive-data-logging-review':
      return [s('finding:sensitive-data-logging-review:closed', 'sensitive-data', -3)]
    default:
      return []
  }
}

// --- Follow-up audits (Feature 08) ------------------------------------------

export function auditSignals(auditNumber: number, passed: boolean, moment: RiskCreationMoment): RiskSignal[] {
  if (passed) {
    return [make(`audit:${auditNumber}:passed:governance`, 'governance', -3, 'security-audit', `audit:${auditNumber}:passed`, moment)]
  }
  const ref = `audit:${auditNumber}:failed`
  if (auditNumber === 1) return [make('audit:1:failed:governance', 'governance', 2, 'security-audit', ref, moment)]
  if (auditNumber === 2) return [make('audit:2:failed:governance', 'governance', 3, 'security-audit', ref, moment)]
  if (auditNumber === 3) return [make('audit:3:failed:governance', 'governance', 4, 'security-audit', ref, moment, 0)] // immediate
  return []
}

// --- Server mini-games (Feature 05) -----------------------------------------

const SERVER_FAILURE_DOMAIN: Record<'gateway' | 'auth' | 'database', RiskDomain> = {
  gateway: 'service-continuity',
  auth: 'identity-access',
  database: 'sensitive-data',
}

// Only the first two failures of each rack add a point (failureNumber 1 or 2).
export function serverFailureSignals(role: ServerRole, failureNumber: number, moment: RiskCreationMoment): RiskSignal[] {
  const domain = SERVER_FAILURE_DOMAIN[role as 'gateway' | 'auth' | 'database']
  if (!domain || failureNumber < 1 || failureNumber > 2) return []
  const ref = `server:${role}:failure:${failureNumber}`
  return [make(ref, domain, 1, 'server-minigame', ref, moment)]
}

export function serverStabilizedSignals(role: ServerRole, moment: RiskCreationMoment): RiskSignal[] {
  const domain = SERVER_FAILURE_DOMAIN[role as 'gateway' | 'auth' | 'database']
  if (!domain) return []
  const ref = `server:${role}:stabilized`
  return [make(ref, domain, -2, 'server-minigame', ref, moment)]
}

// --- Sprint plan (Feature 04) ----------------------------------------------

export interface SprintLoad {
  employeeId: string
  plannedLoadDays: number
}

// One overload signal per employee over capacity; a single balanced signal when
// nobody is overloaded but overload risk was accrued before (mitigates by 1).
export function sprintPlanSignals(
  sprintNumber: number,
  loads: SprintLoad[],
  hadPositiveOverloadHistory: boolean,
  moment: RiskCreationMoment,
): RiskSignal[] {
  const signals: RiskSignal[] = []
  let anyOverload = false
  for (const { employeeId, plannedLoadDays } of loads) {
    const impact = getSprintOverloadRiskImpact(plannedLoadDays)
    if (impact <= 0) continue
    anyOverload = true
    signals.push(
      make(
        `sprint:${sprintNumber}:overload:${employeeId}`,
        'delivery-pressure',
        impact,
        'sprint-plan',
        `sprint:${sprintNumber}:${employeeId}:load-${plannedLoadDays}`,
        moment,
      ),
    )
  }
  if (!anyOverload && hadPositiveOverloadHistory) {
    signals.push(make(`sprint:${sprintNumber}:balanced-plan`, 'delivery-pressure', -1, 'sprint-plan', `sprint:${sprintNumber}:balanced`, moment))
  }
  return signals
}

// --- Access control & office intrusion (Feature 10) -------------------------

export function accessControlPostponedSignals(moment: RiskCreationMoment): RiskSignal[] {
  return [
    make('access-control:postponed:office-access', 'office-access', 1, 'access-control-decision', 'postpone-access-control', moment),
    make('access-control:postponed:governance', 'governance', 1, 'access-control-decision', 'postpone-access-control', moment),
  ]
}

export function accessControlActiveSignals(moment: RiskCreationMoment): RiskSignal[] {
  return [
    make('access-control:active:office-access', 'office-access', -4, 'access-control-implementation', 'access-control-active', moment),
    make('access-control:active:governance', 'governance', -1, 'access-control-implementation', 'access-control-active', moment),
  ]
}

// Incident consequences differ by whether Ilya contained it early (no
// sensitive-data exposure) or the intruder reached a workstation.
export function officeIntrusionSignals(hasSecuritySpecialist: boolean, moment: RiskCreationMoment): RiskSignal[] {
  if (hasSecuritySpecialist) {
    return [
      make('incident:office-intrusion:office-access', 'office-access', 2, 'access-control-incident', 'office-intrusion:contained-early', moment),
      make('incident:office-intrusion:governance', 'governance', 1, 'access-control-incident', 'office-intrusion:contained-early', moment),
    ]
  }
  return [
    make('incident:office-intrusion:office-access', 'office-access', 3, 'access-control-incident', 'office-intrusion:workstation-reached', moment),
    make('incident:office-intrusion:governance', 'governance', 1, 'access-control-incident', 'office-intrusion:workstation-reached', moment),
    make('incident:office-intrusion:sensitive-data', 'sensitive-data', 2, 'access-control-incident', 'office-intrusion:possible-data-exposure', moment),
  ]
}

// --- Migration rebuild (from an old Feature 08 save) ------------------------

export interface RiskRebuildSnapshot {
  currentWorkdayIndex: number
  currentMoment: { sprintNumber: number; day: number }
  staffingDecision?: 'approve-security-hire' | 'decline-security-hire'
  ilyaHired: boolean
  closedFindings: { findingId: string; closedAt?: { sprintNumber: number; day: number; workdayIndex: number } }[]
  auditRecords: { auditNumber: number; passed: boolean; evaluatedAt: { sprintNumber: number; day: number; workdayIndex: number } }[]
  // Cumulative server failures per rack and racks ever stabilised (usually empty
  // after a reload, since server incidents are not persisted).
  serverFailures: { role: ServerRole; failures: number }[]
  serverStabilized: ServerRole[]
}

// Rebuild the risk signals implied by facts already in the save. Idempotent when
// combined with addSignalsOnce. Overload is NOT guessed - it only accrues from
// future sprint starts if no history exists.
export function rebuildRiskSignalsFromGameState(snapshot: RiskRebuildSnapshot): RiskSignal[] {
  const now: RiskCreationMoment = { ...snapshot.currentMoment, workdayIndex: snapshot.currentWorkdayIndex }
  const signals: RiskSignal[] = []

  if (snapshot.staffingDecision === 'decline-security-hire') signals.push(...declineStaffingSignals(now))
  if (snapshot.ilyaHired) signals.push(...securityHireSignals(now))

  for (const f of snapshot.closedFindings) {
    signals.push(...findingClosedSignals(f.findingId, f.closedAt ? { ...f.closedAt } : now))
  }
  for (const a of snapshot.auditRecords) {
    signals.push(...auditSignals(a.auditNumber, a.passed, { ...a.evaluatedAt }))
  }
  for (const sf of snapshot.serverFailures) {
    for (let n = 1; n <= Math.min(2, sf.failures); n++) signals.push(...serverFailureSignals(sf.role, n, now))
  }
  for (const role of snapshot.serverStabilized) {
    signals.push(...serverStabilizedSignals(role, now))
  }
  return signals
}
