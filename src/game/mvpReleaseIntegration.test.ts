import { describe, it, expect, beforeEach } from 'vitest'
import { completeWorkday } from './completeWorkday'
import { hireDeveloper } from './hireDeveloper'
import { startSprintWithPlan } from './startSprintWithPlan'
import {
  releaseOfficeFlowMvp,
  finalizeMvpReleaseSuccess,
  ensureMvpReleaseTask,
  getMvpReleaseReadiness,
  MVP_RELEASE_TASK_ID,
  MVP_RELEASE_SCENE_ID,
} from './releaseOfficeFlowMvp'
import { useSprintStore } from './sprintStore'
import { useEconomyStore } from './economyStore'
import { useTeamStore } from './teamStore'
import { useProductStore } from './productStore'
import { useRiskStore } from './riskStore'
import { useSecurityStoryStore } from './securityStoryStore'
import { useSecurityAuditStore, INITIAL_SECURITY_AUDIT } from './securityAuditStore'
import { useAccessControlStore, INITIAL_ACCESS_CONTROL_DATA } from './accessControlStore'
import { useServerIncidentStore, INITIAL_SERVER_INCIDENT_DATA } from './serverIncidentStore'
import { useServerIncidentsStore } from './serverIncidentsStore'
import { useGameStore } from './gameStore'
import { useGameOutcomeStore, loadGameOutcome, saveGameOutcome } from './gameOutcomeStore'
import { useCutsceneStore } from '../cutscenes/cutsceneStore'
import { INITIAL_SECURITY_BREACH } from './securityStoryRules'
import { initialTransactions, calculateBalance } from './economyRules'
import { initialTaskStates } from './productRules'
import { useCyberStoryStore } from './story/cyberStoryStore'

const out = () => useGameOutcomeStore.getState()

function allTasksDone() {
  return initialTaskStates().map((s) => ({ ...s, status: 'done' as const, completedAt: { sprintNumber: 3, day: 1 } }))
}

// A fully release-ready state: all 14 tasks done, no blockers, still playing.
function releaseReady() {
  useSprintStore.setState({ sprintNumber: 4, day: 5, phase: 'active', confirmingEndDay: false })
  useTeamStore.setState({ hires: [{ employeeId: 'kirill-morozov', hiredAtSprint: 1, hiredAtDay: 1 }, { employeeId: 'alina-belova', hiredAtSprint: 1, hiredAtDay: 1 }], panelOpen: false })
  useEconomyStore.setState({ transactions: initialTransactions(), panelOpen: false })
  useProductStore.setState({ taskStates: allTasksDone(), workdayHistory: [], activeReport: null, releaseCheckOpen: false })
  useRiskStore.setState({ signals: [] })
  useSecurityStoryStore.setState({ securityBreach: { ...INITIAL_SECURITY_BREACH, status: 'completed', decision: 'take-responsibility', effectsApplied: true }, postAuditConversation: { status: 'completed', staffingDecision: 'decline-security-hire', completedAt: { sprintNumber: 3, day: 1 }, effectsApplied: true }, hasIntroducedSecuritySpecialist: false })
  useSecurityAuditStore.setState({ ...INITIAL_SECURITY_AUDIT, findings: [], followUpAudit: { status: 'not-scheduled', records: [] }, auditResultToAcknowledge: null })
  useAccessControlStore.setState({ ...INITIAL_ACCESS_CONTROL_DATA, intrusionResultToAcknowledge: null })
  useServerIncidentStore.setState({ ...INITIAL_SERVER_INCIDENT_DATA, incidentResultToAcknowledge: null })
  useServerIncidentsStore.getState().resetServerRacks()
  useCutsceneStore.setState({ activeSceneId: null })
  useGameStore.setState({ tasks: [], activeDialogue: null, activeChoice: null })
  useGameOutcomeStore.getState().resetGameOutcome()
  useCyberStoryStore.getState().resetCyberStory()
  window.localStorage.clear()
}

beforeEach(releaseReady)

describe('release readiness gating', () => {
  it('is ready when all 14 tasks are done and nothing blocks', () => {
    expect(getMvpReleaseReadiness().ready).toBe(true)
  })
  it('blocks with 13/14 tasks', () => {
    useProductStore.setState({ taskStates: allTasksDone().map((s, i) => (i === 0 ? { ...s, status: 'planned' as const } : s)) })
    const r = getMvpReleaseReadiness()
    expect(r.ready).toBe(false)
    expect(r.blockingReasons).toContain('product-incomplete')
  })
  it('blocks release when AUTH is recovering, then allows it once resolved', () => {
    useServerIncidentStore.setState({ incidents: { ...useServerIncidentStore.getState().incidents, 'auth-account-incident': { incidentId: 'auth-account-incident', status: 'recovering', recoveryProgressDays: 1, effectsApplied: true } } })
    expect(getMvpReleaseReadiness().blockingReasons).toContain('server-incident-unresolved')
    useServerIncidentStore.setState({ incidents: { ...useServerIncidentStore.getState().incidents, 'auth-account-incident': { incidentId: 'auth-account-incident', status: 'resolved', recoveryProgressDays: 2, effectsApplied: true } } })
    expect(getMvpReleaseReadiness().ready).toBe(true)
  })

  // Feature 19 regression: MVP release used to ignore a cyber-story incident
  // that was merely unlocked/available (marker showing, unclicked) or an
  // already-resolved incident's delayed consequence still awaiting the
  // player - a save could ship MVP with a mandatory marker still on the map.
  it('blocks release while a cyber-story incident is available but not yet resolved', () => {
    useCyberStoryStore.getState().unlockIncident('executive-phishing-request', { sprintNumber: 4, day: 5 })
    const r = getMvpReleaseReadiness()
    expect(r.ready).toBe(false)
    expect(r.blockingReasons).toContain('cyber-story-incident-pending')
  })

  it('allows release again once that incident is resolved', () => {
    useCyberStoryStore.getState().unlockIncident('executive-phishing-request', { sprintNumber: 4, day: 5 })
    useCyberStoryStore.getState().resolveIncident('executive-phishing-request', 'verify-through-known-channel', { sprintNumber: 4, day: 5 })
    expect(getMvpReleaseReadiness().ready).toBe(true)
  })

  it('blocks release while a landed delayed consequence is still pending/running', () => {
    useCyberStoryStore.getState().unlockIncident('executive-phishing-request', { sprintNumber: 4, day: 5 })
    useCyberStoryStore.getState().resolveIncident('executive-phishing-request', 'send-requested-data', { sprintNumber: 4, day: 5 })
    useCyberStoryStore.getState().queueConsequenceOnce('phishing-targeted-followup')
    const r = getMvpReleaseReadiness()
    expect(r.ready).toBe(false)
    expect(r.blockingReasons).toContain('cyber-story-incident-pending')
  })

  it('allows release again once the delayed consequence has completed', () => {
    useCyberStoryStore.getState().unlockIncident('executive-phishing-request', { sprintNumber: 4, day: 5 })
    useCyberStoryStore.getState().resolveIncident('executive-phishing-request', 'send-requested-data', { sprintNumber: 4, day: 5 })
    useCyberStoryStore.getState().queueConsequenceOnce('phishing-targeted-followup')
    useCyberStoryStore.getState().completeConsequence('phishing-targeted-followup')
    expect(getMvpReleaseReadiness().ready).toBe(true)
  })
})

describe('releaseOfficeFlowMvp use-case', () => {
  it('not-ready returns the blockers and does not start the scene', () => {
    useProductStore.setState({ taskStates: initialTaskStates() }) // nothing done
    const r = releaseOfficeFlowMvp({ sprintNumber: 4, day: 5 })
    expect(r.released).toBe(false)
    expect(r).toMatchObject({ reason: 'not-ready' })
    expect(useCutsceneStore.getState().activeSceneId).toBeNull()
  })

  it('ready: marks release running, meets the deadline early, starts the scene, moves neither day nor money', () => {
    const dayBefore = useSprintStore.getState().day
    const txBefore = useEconomyStore.getState().transactions.length
    const r = releaseOfficeFlowMvp({ sprintNumber: 4, day: 5 })
    expect(r.released).toBe(true)
    expect(out().campaignRelease.status).toBe('running')
    expect(out().campaignDeadline.status).toBe('met')
    expect(useCutsceneStore.getState().activeSceneId).toBe(MVP_RELEASE_SCENE_ID)
    expect(useSprintStore.getState().day).toBe(dayBefore)
    expect(useEconomyStore.getState().transactions.length).toBe(txBefore)
  })

  it('a second call while running does not start the scene again', () => {
    releaseOfficeFlowMvp({ sprintNumber: 4, day: 5 })
    useCutsceneStore.setState({ activeSceneId: null })
    const r = releaseOfficeFlowMvp({ sprintNumber: 4, day: 5 })
    expect(r).toEqual({ released: false, reason: 'already-running' })
    expect(useCutsceneStore.getState().activeSceneId).toBeNull()
  })
})

describe('scene finalize + success outcome', () => {
  it('finalize builds an immutable snapshot, registers success-pending and completes the task', () => {
    ensureMvpReleaseTask()
    releaseOfficeFlowMvp({ sprintNumber: 4, day: 5 })
    finalizeMvpReleaseSuccess()
    expect(out().status).toBe('success-pending')
    expect(out().pendingSuccess?.completedProductTasks).toBe(14)
    expect(out().pendingSuccess?.releasedAt).toEqual({ sprintNumber: 4, day: 5 })
    expect(useGameStore.getState().tasks.find((t) => t.id === MVP_RELEASE_TASK_ID)?.done).toBe(true)
  })

  it('markSuccessScreenOpened promotes to succeeded and marks the release released', () => {
    releaseOfficeFlowMvp({ sprintNumber: 4, day: 5 })
    finalizeMvpReleaseSuccess()
    const snap = out().pendingSuccess
    out().markSuccessScreenOpened()
    expect(out().status).toBe('succeeded')
    expect(out().success).toEqual(snap)
    expect(out().campaignRelease.status).toBe('released')
  })

  it('markMvpReleaseFailed rewinds the release to not-started', () => {
    releaseOfficeFlowMvp({ sprintNumber: 4, day: 5 })
    out().markMvpReleaseFailed()
    expect(out().campaignRelease.status).toBe('not-started')
    expect(out().status).toBe('playing')
  })
})

describe('failure/success mutual exclusion', () => {
  it('a pending failure blocks registering success', () => {
    out().registerPendingFailure({ reason: 'budget-exhausted', contributingReasons: [], failedAt: { sprintNumber: 4, day: 5 }, balance: -1, productProgressPercent: 100, completedProductTasks: 14, totalProductTasks: 14, completedSprints: 3, totalAuditFines: 0, unresolvedSecurityFindings: 0, unresolvedServerIncidentIds: [], primarySourceRef: 't' })
    const r = releaseOfficeFlowMvp({ sprintNumber: 4, day: 5 })
    expect(r).toEqual({ released: false, reason: 'game-not-playing' })
  })
  it('a pending success blocks registering a failure', () => {
    releaseOfficeFlowMvp({ sprintNumber: 4, day: 5 })
    finalizeMvpReleaseSuccess()
    const r = out().registerPendingFailure({ reason: 'budget-exhausted', contributingReasons: [], failedAt: { sprintNumber: 4, day: 5 }, balance: -1, productProgressPercent: 100, completedProductTasks: 14, totalProductTasks: 14, completedSprints: 3, totalAuditFines: 0, unresolvedSecurityFindings: 0, unresolvedServerIncidentIds: [], primarySourceRef: 't' })
    expect(r.registered).toBe(false)
    expect(out().status).toBe('success-pending')
  })
})

describe('the game is locked after a win', () => {
  beforeEach(() => {
    releaseOfficeFlowMvp({ sprintNumber: 4, day: 5 })
    finalizeMvpReleaseSuccess()
    out().markSuccessScreenOpened()
  })
  it('blocks completeWorkday', () => {
    useSprintStore.setState({ confirmingEndDay: true })
    expect(completeWorkday()).toEqual({ completed: false, reason: 'game-outcome-pending' })
  })
  it('blocks hiring', () => expect(hireDeveloper('kirill-morozov').hired).toBe(false))
  it('blocks starting a sprint', () => {
    useSprintStore.setState({ phase: 'planning' })
    expect(startSprintWithPlan().started).toBe(false)
  })
  it('blocks a server mini-game', () => {
    useServerIncidentsStore.getState().breakServer('gateway')
    useServerIncidentsStore.getState().beginRepair('gateway')
    expect(useServerIncidentsStore.getState().activeMinigame).toBeNull()
  })
})

describe('reload + reset', () => {
  it('a succeeded snapshot survives reload with the same score/tier', () => {
    releaseOfficeFlowMvp({ sprintNumber: 4, day: 5 })
    finalizeMvpReleaseSuccess()
    out().markSuccessScreenOpened()
    const before = out().success!
    saveGameOutcome(window.localStorage, { status: 'succeeded', success: before, leadershipReview: { status: 'inactive' }, campaignDeadline: { deadlineSprintNumber: 6, status: 'met' }, campaignRelease: { status: 'released' } })
    const loaded = loadGameOutcome(window.localStorage, '')
    expect(loaded.status).toBe('succeeded')
    expect(loaded.success?.campaignScore).toBe(before.campaignScore)
    expect(loaded.success?.resultTier).toBe(before.resultTier)
  })
  it('a persisted running release rewinds to not-started on load', () => {
    saveGameOutcome(window.localStorage, { status: 'playing', leadershipReview: { status: 'inactive' }, campaignDeadline: { deadlineSprintNumber: 6, status: 'met' }, campaignRelease: { status: 'running', startedAt: { sprintNumber: 4, day: 5 } } })
    expect(loadGameOutcome(window.localStorage, '').campaignRelease.status).toBe('not-started')
  })
  it('reset clears the success', () => {
    releaseOfficeFlowMvp({ sprintNumber: 4, day: 5 })
    finalizeMvpReleaseSuccess()
    out().markSuccessScreenOpened()
    out().resetGameOutcome()
    expect(out().status).toBe('playing')
    expect(out().success).toBeUndefined()
    expect(out().campaignRelease.status).toBe('not-started')
  })
})

describe('release task creation', () => {
  it('adds the task once for a playing save with 14 done, never twice', () => {
    ensureMvpReleaseTask()
    ensureMvpReleaseTask()
    expect(useGameStore.getState().tasks.filter((t) => t.id === MVP_RELEASE_TASK_ID)).toHaveLength(1)
  })
  it('does not add the task when tasks are incomplete', () => {
    useProductStore.setState({ taskStates: initialTaskStates() })
    ensureMvpReleaseTask()
    expect(useGameStore.getState().tasks.some((t) => t.id === MVP_RELEASE_TASK_ID)).toBe(false)
  })
  it('does not add an active release task to a failed save', () => {
    useGameStore.setState({ tasks: [] })
    out().registerPendingFailure({ reason: 'budget-exhausted', contributingReasons: [], failedAt: { sprintNumber: 4, day: 5 }, balance: -1, productProgressPercent: 100, completedProductTasks: 14, totalProductTasks: 14, completedSprints: 3, totalAuditFines: 0, unresolvedSecurityFindings: 0, unresolvedServerIncidentIds: [], primarySourceRef: 't' })
    ensureMvpReleaseTask()
    expect(useGameStore.getState().tasks.some((t) => t.id === MVP_RELEASE_TASK_ID)).toBe(false)
  })
})
