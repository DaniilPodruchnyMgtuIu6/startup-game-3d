import { describe, it, expect, beforeEach } from 'vitest'
import { completeWorkday } from './completeWorkday'
import { initializeSecurityAuditIfReady } from './initializeSecurityAudit'
import { shouldEscalateAccessControl } from './accessControlRules'
import { useSprintStore } from './sprintStore'
import { useEconomyStore } from './economyStore'
import { useTeamStore } from './teamStore'
import { useProductStore } from './productStore'
import { useRiskStore } from './riskStore'
import { useSecurityStoryStore } from './securityStoryStore'
import { useSecurityAuditStore, INITIAL_SECURITY_AUDIT } from './securityAuditStore'
import { useAccessControlStore, INITIAL_ACCESS_CONTROL_DATA } from './accessControlStore'
import { INITIAL_SECURITY_BREACH } from './securityStoryRules'
import { initialTransactions } from './economyRules'
import { initialTaskStates } from './productRules'
import { getActualRiskScore, type RiskSignal } from './riskRules'
import { toWorkdayIndex } from './workdayIndex'

const acS = () => useAccessControlStore.getState()
const officeAccess = () => getActualRiskScore(useRiskStore.getState().signals, 'office-access')

// an already-detected office-access signal (counts for actual AND detected)
function discovery(impact: number): RiskSignal {
  return {
    id: 'corrective-plan:workstation-discipline:office-access',
    domain: 'office-access',
    impact,
    source: 'security-finding',
    sourceRef: 'workstation-locking-training:discovered',
    createdAt: { sprintNumber: 2, day: 1 },
    createdAtWorkdayIndex: 11,
    detectedAtWorkdayIndex: 11,
  }
}
function closeWorkstationLocking(): RiskSignal {
  return {
    id: 'finding:workstation-locking-training:closed',
    domain: 'office-access',
    impact: -2,
    source: 'security-finding',
    sourceRef: 'workstation-locking-training',
    createdAt: { sprintNumber: 2, day: 2 },
    createdAtWorkdayIndex: 12,
    detectedAtWorkdayIndex: 12,
  }
}

function completeDay() {
  useSprintStore.setState({ confirmingEndDay: true })
  const r = completeWorkday()
  useProductStore.getState().closeReport()
  return r
}

const ELEVATED = 'elevated' as const
const HIGH = 'high' as const
const LOW = 'low' as const

describe('shouldEscalateAccessControl (pure §9)', () => {
  const base = { proposalStatus: 'available' as const, currentWorkdayIndex: 15, availableAtWorkdayIndex: 13, detectedOfficeAccessLevel: ELEVATED, actualOfficeAccessLevel: ELEVATED }
  it('fires when the proposal is available/postponed and risk is still elevated 2 days on', () => {
    expect(shouldEscalateAccessControl(base)).toBe(true)
    expect(shouldEscalateAccessControl({ ...base, proposalStatus: 'postponed' })).toBe(true)
  })
  it('does NOT fire when addressed or too early or risk reduced', () => {
    expect(shouldEscalateAccessControl({ ...base, proposalStatus: 'approved' })).toBe(false)
    expect(shouldEscalateAccessControl({ ...base, proposalStatus: 'in-progress' })).toBe(false)
    expect(shouldEscalateAccessControl({ ...base, proposalStatus: 'active' })).toBe(false)
    expect(shouldEscalateAccessControl({ ...base, availableAtWorkdayIndex: undefined })).toBe(false)
    expect(shouldEscalateAccessControl({ ...base, currentWorkdayIndex: 14 })).toBe(false) // only 1 day
    expect(shouldEscalateAccessControl({ ...base, actualOfficeAccessLevel: LOW })).toBe(false)
    expect(shouldEscalateAccessControl({ ...base, detectedOfficeAccessLevel: LOW })).toBe(false)
  })
})

function seedIgnoredScudo(officeAccessSignals: RiskSignal[]) {
  // sprint 2 day 3 → completing this day is index 13; proposal became available 2
  // days ago (index 11) and was left unaddressed.
  useSprintStore.setState({ sprintNumber: 2, day: 3, phase: 'active', confirmingEndDay: false })
  useTeamStore.setState({
    hires: [
      { employeeId: 'kirill-morozov', hiredAtSprint: 1, hiredAtDay: 1 },
      { employeeId: 'alina-belova', hiredAtSprint: 1, hiredAtDay: 1 },
    ],
    panelOpen: false,
  })
  useEconomyStore.setState({ transactions: initialTransactions(), panelOpen: false })
  useProductStore.setState({ taskStates: initialTaskStates(), workdayHistory: [], activeReport: null })
  useRiskStore.setState({ signals: officeAccessSignals })
  useSecurityStoryStore.setState({
    securityBreach: { ...INITIAL_SECURITY_BREACH, status: 'completed', decision: 'take-responsibility', effectsApplied: true },
    postAuditConversation: { status: 'completed', staffingDecision: 'decline-security-hire', completedAt: { sprintNumber: 2, day: 1 }, effectsApplied: true },
    hasIntroducedSecuritySpecialist: false,
  })
  useSecurityAuditStore.setState({ ...INITIAL_SECURITY_AUDIT, auditResultToAcknowledge: null })
  useAccessControlStore.setState({
    ...INITIAL_ACCESS_CONTROL_DATA,
    accessControl: { ...INITIAL_ACCESS_CONTROL_DATA.accessControl, proposalStatus: 'available', availableAtWorkdayIndex: toWorkdayIndex(2, 1) },
    intrusionResultToAcknowledge: null,
  })
  window.localStorage.clear()
}

describe('Feature 16 §9: the corrective plan discovers the office-access risk', () => {
  it('initializing the plan raises office-access to elevated (score 3)', () => {
    seedIgnoredScudo([])
    useSecurityAuditStore.setState({ ...INITIAL_SECURITY_AUDIT }) // not yet initialised
    initializeSecurityAuditIfReady()
    expect(useSecurityAuditStore.getState().initialized).toBe(true)
    expect(officeAccess()).toBe(3) // discovery +3 = elevated → proposal can unlock
  })
})

describe('Feature 16 §9: ignoring СКУД reaches the office intrusion', () => {
  beforeEach(() => seedIgnoredScudo([discovery(3)]))

  it('escalates → arms → pending when the proposal is left unaddressed', () => {
    expect(officeAccess()).toBe(3)
    // day 3: escalation fires (+2 → high) and the threat arms
    completeDay()
    expect(officeAccess()).toBe(5)
    expect(acS().intrusion.status).toBe('armed')
    // keep ignoring it → after the 4-day due window the threat becomes pending
    let pending = false
    for (let i = 0; i < 6; i++) {
      const r = completeDay()
      if (acS().intrusion.status === 'pending') { pending = true; break }
      if (!r.completed) break
    }
    expect(pending).toBe(true)
  })

  it('closing the workstation-locking finding drops the risk and prevents the escalation', () => {
    // the player addresses the finding → office-access back to low (3 - 2 = 1)
    useRiskStore.setState({ signals: [discovery(3), closeWorkstationLocking()] })
    expect(officeAccess()).toBe(1)
    for (let i = 0; i < 6; i++) completeDay()
    // no escalation signal, threat never armed
    expect(useRiskStore.getState().signals.some((s) => s.id === 'access-control:not-implemented-in-time:office-access')).toBe(false)
    expect(acS().intrusion.status).toBe('dormant')
  })
})
