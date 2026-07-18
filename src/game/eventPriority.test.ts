import { describe, it, expect, beforeEach } from 'vitest'
import { completeWorkday } from './completeWorkday'
import { useSprintStore } from './sprintStore'
import { useEconomyStore } from './economyStore'
import { useTeamStore } from './teamStore'
import { useProductStore } from './productStore'
import { useRiskStore } from './riskStore'
import { useSecurityStoryStore } from './securityStoryStore'
import { useSecurityAuditStore, INITIAL_SECURITY_AUDIT } from './securityAuditStore'
import { useAccessControlStore, INITIAL_ACCESS_CONTROL_DATA } from './accessControlStore'
import { useServerIncidentStore, INITIAL_SERVER_INCIDENT_DATA } from './serverIncidentStore'
import { useGameOutcomeStore } from './gameOutcomeStore'
import { getNextPendingServerIncident } from './serverIncidentRules'
import { INITIAL_SECURITY_BREACH } from './securityStoryRules'
import { initialTransactions } from './economyRules'
import { initialTaskStates } from './productRules'
import type { CampaignSuccessSnapshot } from './mvpReleaseRules'
import type { GameFailureSnapshot } from './gameOutcomeRules'

// Feature 15 §15: the documented mandatory-event order after a completed day is
// Daily report → follow-up audit → office intrusion → server incidents
// (GATEWAY → AUTH → DATABASE) → pending defeat → sprint review. These tests pin
// the deterministic pieces: server-incident queue priority, the completeWorkday
// guard precedence, and win/loss mutual exclusivity.

function baseSetup() {
  window.localStorage.clear()
  useSprintStore.setState({ sprintNumber: 3, day: 2, phase: 'active', confirmingEndDay: false })
  useTeamStore.setState({ hires: [{ employeeId: 'kirill-morozov', hiredAtSprint: 1, hiredAtDay: 1 }, { employeeId: 'alina-belova', hiredAtSprint: 1, hiredAtDay: 1 }], panelOpen: false })
  useEconomyStore.setState({ transactions: initialTransactions(), panelOpen: false })
  useProductStore.setState({ taskStates: initialTaskStates(), workdayHistory: [], activeReport: null })
  useRiskStore.setState({ signals: [] })
  useSecurityStoryStore.setState({ securityBreach: { ...INITIAL_SECURITY_BREACH, status: 'completed', decision: 'take-responsibility', effectsApplied: true }, postAuditConversation: { status: 'completed', staffingDecision: 'decline-security-hire', completedAt: { sprintNumber: 3, day: 1 }, effectsApplied: true }, hasIntroducedSecuritySpecialist: false })
  useSecurityAuditStore.setState({ ...INITIAL_SECURITY_AUDIT, auditResultToAcknowledge: null })
  useAccessControlStore.setState({ ...INITIAL_ACCESS_CONTROL_DATA, intrusionResultToAcknowledge: null })
  useServerIncidentStore.setState({ ...INITIAL_SERVER_INCIDENT_DATA, incidentResultToAcknowledge: null })
  useGameOutcomeStore.getState().resetGameOutcome()
}

beforeEach(baseSetup)

describe('server incident queue priority (GATEWAY → AUTH → DATABASE)', () => {
  it('returns the highest-priority pending incident first', () => {
    const incidents = useServerIncidentStore.getState().incidents
    const pending = (id: string) => ({ ...incidents[id as keyof typeof incidents], status: 'pending' as const })
    useServerIncidentStore.setState({ incidents: { ...incidents, 'database-exposure-review': pending('database-exposure-review'), 'auth-account-incident': pending('auth-account-incident'), 'gateway-outage': pending('gateway-outage') } })
    expect(getNextPendingServerIncident(Object.values(useServerIncidentStore.getState().incidents))?.incidentId).toBe('gateway-outage')
    // resolve gateway → auth is next
    const after = useServerIncidentStore.getState().incidents
    useServerIncidentStore.setState({ incidents: { ...after, 'gateway-outage': { ...after['gateway-outage'], status: 'resolved' } } })
    expect(getNextPendingServerIncident(Object.values(useServerIncidentStore.getState().incidents))?.incidentId).toBe('auth-account-incident')
  })
})

describe('completeWorkday guard precedence (the day waits for every mandatory event)', () => {
  const tryComplete = () => {
    useSprintStore.setState({ confirmingEndDay: true })
    return completeWorkday()
  }
  it('a pending follow-up audit blocks the day', () => {
    useSecurityAuditStore.setState({ followUpAudit: { status: 'pending', records: [] } })
    expect(tryComplete()).toEqual({ completed: false, reason: 'required-follow-up-audit' })
  })
  it('a pending office intrusion blocks the day', () => {
    const intrusion = useAccessControlStore.getState().intrusion
    useAccessControlStore.setState({ intrusion: { ...intrusion, status: 'pending' } })
    expect(tryComplete()).toEqual({ completed: false, reason: 'required-office-intrusion' })
  })
  it('a pending server incident blocks the day', () => {
    const incidents = useServerIncidentStore.getState().incidents
    useServerIncidentStore.setState({ incidents: { ...incidents, 'gateway-outage': { ...incidents['gateway-outage'], status: 'pending' } } })
    expect(tryComplete()).toEqual({ completed: false, reason: 'required-server-incident' })
  })
  it('a registered defeat outranks everything else', () => {
    // both an audit AND a pending failure → the outcome guard wins
    useSecurityAuditStore.setState({ followUpAudit: { status: 'pending', records: [] } })
    useGameOutcomeStore.getState().registerPendingFailure(failureSnapshot())
    expect(tryComplete()).toEqual({ completed: false, reason: 'game-outcome-pending' })
  })
})

describe('win and loss are mutually exclusive (one deterministic winner)', () => {
  it('a pending failure blocks registering success; failure wins', () => {
    useGameOutcomeStore.getState().registerPendingFailure(failureSnapshot())
    expect(useGameOutcomeStore.getState().registerPendingSuccess(successSnapshot()).registered).toBe(false)
    expect(useGameOutcomeStore.getState().status).toBe('failure-pending')
  })
  it('a pending success blocks registering a failure; success wins', () => {
    expect(useGameOutcomeStore.getState().registerPendingSuccess(successSnapshot()).registered).toBe(true)
    expect(useGameOutcomeStore.getState().registerPendingFailure(failureSnapshot()).registered).toBe(false)
    expect(useGameOutcomeStore.getState().status).toBe('success-pending')
  })
})

function failureSnapshot(): GameFailureSnapshot {
  return { reason: 'budget-exhausted', contributingReasons: [], failedAt: { sprintNumber: 3, day: 2 }, balance: -1, productProgressPercent: 0, completedProductTasks: 0, totalProductTasks: 14, completedSprints: 2, totalAuditFines: 0, unresolvedSecurityFindings: 0, unresolvedServerIncidentIds: [], primarySourceRef: 't' }
}
function successSnapshot(): CampaignSuccessSnapshot {
  return { releasedAt: { sprintNumber: 3, day: 2 }, releaseWorkdayIndex: 22, resultTier: 'stable-launch', campaignScore: 80, balance: 500_000, completedProductTasks: 14, totalProductTasks: 14, productProgressPercent: 100, completedSprints: 2, metDeadlineEarly: true, teamEmployeeIds: [], securitySpecialistHired: false, accessControlActive: false, auditRecords: 0, failedAuditRecords: 0, totalAuditFines: 0, leadershipComplaint: false, shutdownRecommendation: false, officeIntrusionOutcome: 'not-triggered', occurredServerIncidentIds: [], totalServerDowntimeCost: 0, totalServerIncidentCost: 0, actualRiskLevels: {} as never, detectedRiskLevels: {} as never, warningsAtRelease: [] }
}
