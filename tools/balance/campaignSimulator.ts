// Feature 15 deterministic campaign simulator. Drives the REAL pure use-cases and
// store actions (no React, no Three.js, no DeepSeek, no randomness) to prove
// balance and outcomes. It reads the real ledger for every cost — it never
// re-implements an economic formula. Test-only: it never writes user localStorage
// (jsdom localStorage is cleared each run).

import { useGameStore } from '../../src/game/gameStore'
import { useSprintStore } from '../../src/game/sprintStore'
import { useEconomyStore } from '../../src/game/economyStore'
import { useProductStore } from '../../src/game/productStore'
import { useTeamStore } from '../../src/game/teamStore'
import { useRiskStore } from '../../src/game/riskStore'
import { useSecurityStoryStore } from '../../src/game/securityStoryStore'
import { useSecurityAuditStore, INITIAL_SECURITY_AUDIT } from '../../src/game/securityAuditStore'
import { useAccessControlStore, INITIAL_ACCESS_CONTROL_DATA } from '../../src/game/accessControlStore'
import { useServerIncidentStore, INITIAL_SERVER_INCIDENT_DATA } from '../../src/game/serverIncidentStore'
import { useServerIncidentsStore } from '../../src/game/serverIncidentsStore'
import { useGameOutcomeStore } from '../../src/game/gameOutcomeStore'
import { useCutsceneStore } from '../../src/cutscenes/cutsceneStore'
import { completeWorkday } from '../../src/game/completeWorkday'
import { hireDeveloper } from '../../src/game/hireDeveloper'
import { startSprintWithPlan } from '../../src/game/startSprintWithPlan'
import { completeSprintAndPrepareNextPlanning, completeCampaignDeadlineMet } from '../../src/game/completeSprintReview'
import { releaseOfficeFlowMvp, finalizeMvpReleaseSuccess } from '../../src/game/releaseOfficeFlowMvp'
import { INITIAL_SECURITY_BREACH } from '../../src/game/securityStoryRules'
import { INITIAL_SPRINT_STATE } from '../../src/game/sprintRules'
import { initialTransactions, calculateBalance } from '../../src/game/economyRules'
import { initialTaskStates, productReadiness, hasCompletedCoreMvp, completedProductTaskCount } from '../../src/game/productRules'
import { PRODUCT_TASK_CATALOG } from '../../src/game/productTaskCatalog'
import { getActualRiskLevel } from '../../src/game/riskRules'
import { RISK_DOMAINS, type RiskDomain, type RiskLevel } from '../../src/game/riskCatalog'
import type { MoneyTransaction } from '../../src/game/economyRules'

const KIRILL = 'kirill-morozov'
const ALINA = 'alina-belova'
const ILYA = 'ilya-vlasov'

export interface CampaignTimelineEntry {
  sprintNumber: number
  day: number
  note: string
}

export interface CampaignSimulationResult {
  outcome: 'win' | 'loss' | 'incomplete'
  outcomeReason?: string
  releaseMoment?: { sprintNumber: number; day: number }
  completedSprints: number
  completedProductTaskIds: string[]
  productReadinessPercent: number
  finalBudget: number
  operationsCost: number
  salaryCost: number
  investmentsCost: number
  auditFines: number
  incidentCosts: number
  downtimeCosts: number
  securityWorkdaysByEmployee: Record<string, number>
  productWorkdaysByEmployee: Record<string, number>
  finalRiskLevels: Record<RiskDomain, RiskLevel>
  finalScore?: number
  timeline: CampaignTimelineEntry[]
}

const sim = {
  timeline: [] as CampaignTimelineEntry[],
  securityWorkdays: {} as Record<string, number>,
  productWorkdays: {} as Record<string, number>,
}

function note(text: string) {
  const s = useSprintStore.getState()
  sim.timeline.push({ sprintNumber: s.sprintNumber, day: s.day, note: text })
}

export interface ResetOptions {
  withIlya?: boolean
}

// Fresh, deterministic game. Story is pre-completed so completeWorkday is not
// blocked by the (visually cutscene-driven) mandatory conversations — their
// outcomes are what matter to the ledger.
export function resetCampaign(opts: ResetOptions = {}): void {
  window.localStorage.clear()
  sim.timeline = []
  sim.securityWorkdays = {}
  sim.productWorkdays = {}
  useGameStore.setState({ phase: 'free', playerName: 'Sim', activeDialogue: null, activeChoice: null, tasks: [], reprimands: 0 })
  useSprintStore.setState({ ...INITIAL_SPRINT_STATE, confirmingEndDay: false })
  useEconomyStore.setState({ transactions: initialTransactions(), panelOpen: false })
  useProductStore.setState({ taskStates: initialTaskStates(), workdayHistory: [], activeReport: null, boardOpen: false, boardTab: 'product', planningDismissed: true, prototypeOpen: false, releaseCheckOpen: false })
  useTeamStore.setState({ hires: [], panelOpen: false })
  useRiskStore.setState({ signals: [] })
  useSecurityStoryStore.setState({
    securityBreach: { ...INITIAL_SECURITY_BREACH, status: 'completed', decision: 'take-responsibility', effectsApplied: true },
    postAuditConversation: { status: 'completed', staffingDecision: opts.withIlya ? 'approve-security-hire' : 'decline-security-hire', completedAt: { sprintNumber: 2, day: 1 }, effectsApplied: true },
    hasIntroducedSecuritySpecialist: !!opts.withIlya,
  })
  useSecurityAuditStore.setState({ ...INITIAL_SECURITY_AUDIT, findings: [], followUpAudit: { status: 'not-scheduled', records: [] }, auditResultToAcknowledge: null })
  useAccessControlStore.setState({ ...INITIAL_ACCESS_CONTROL_DATA, intrusionResultToAcknowledge: null })
  useServerIncidentStore.setState({ ...INITIAL_SERVER_INCIDENT_DATA, incidentResultToAcknowledge: null })
  useServerIncidentsStore.getState().resetServerRacks()
  useGameOutcomeStore.getState().resetGameOutcome()
  // No CutsceneRunner in the sim — clear any scene id the harness left set.
  useCutsceneStore.setState({ activeSceneId: null })

  const hires = [
    { employeeId: KIRILL, hiredAtSprint: 1, hiredAtDay: 1 },
    { employeeId: ALINA, hiredAtSprint: 1, hiredAtDay: 1 },
    ...(opts.withIlya ? [{ employeeId: ILYA, hiredAtSprint: 2, hiredAtDay: 1 }] : []),
  ]
  useTeamStore.setState({ hires, panelOpen: false })
}

// Hire the two developers through the real use-case (idempotent).
export function hireDevelopers(): void {
  hireDeveloper(KIRILL)
  hireDeveloper(ALINA)
}

export function planAllRemaining(): void {
  const plan = useProductStore.getState()
  for (const def of PRODUCT_TASK_CATALOG) {
    const state = useProductStore.getState().taskStates.find((s) => s.taskId === def.id)
    if (state && state.status !== 'done') plan.addTaskToPlan(def.id)
  }
}

export function startSprint(): void {
  const r = startSprintWithPlan()
  note(`start sprint (${r.started ? 'ok' : 'blocked:' + (r as { reason?: string }).reason})`)
}

export interface DayHooks {
  before?: () => void
}

// Completes one working day through the single real use-case, accumulating who
// worked on product vs was diverted to security/recovery.
export function completeDay(hooks: DayHooks = {}): ReturnType<typeof completeWorkday> {
  hooks.before?.()
  useSprintStore.setState({ confirmingEndDay: true })
  const result = completeWorkday()
  if (result.completed && result.workday) {
    for (const emp of result.workday.employeeResults) {
      if (emp.taskId && (emp.afterProgressDays ?? 0) > (emp.beforeProgressDays ?? 0)) sim.productWorkdays[emp.employeeId] = (sim.productWorkdays[emp.employeeId] ?? 0) + 1
    }
    for (const empId of result.securityResult?.divertedEmployeeIds ?? []) sim.securityWorkdays[empId] = (sim.securityWorkdays[empId] ?? 0) + 1
    for (const empId of result.serverRecoveryResult?.divertedEmployeeIds ?? []) sim.securityWorkdays[empId] = (sim.securityWorkdays[empId] ?? 0) + 1
  }
  useProductStore.getState().closeReport()
  return result
}

// Injects a real server incident and assigns recovery (mirrors the Feature 11
// scene commit). Subsequent completeDay() calls charge downtime and recover it.
export function injectServerIncident(incidentId: string, assignee: string, withSpecialist: boolean): void {
  const s = useSprintStore.getState()
  const moment = { sprintNumber: s.sprintNumber, day: s.day }
  const srv = useServerIncidentStore.getState()
  const incidents = srv.incidents
  const state = incidents[incidentId as keyof typeof incidents]
  useServerIncidentStore.setState({ incidents: { ...incidents, [incidentId]: { ...state, status: 'pending', recoveryProgressDays: 0, effectsApplied: false } } })
  useServerIncidentStore.getState().markServerIncidentRunning(incidentId as never, moment, withSpecialist)
  useServerIncidentStore.getState().resolveServerIncidentScene(incidentId as never, moment)
  useServerIncidentStore.getState().acknowledgeServerIncidentResult()
  useServerIncidentStore.getState().assignServerRecovery(incidentId as never, assignee)
  note(`server incident ${incidentId} assigned to ${assignee}`)
}

export function finishReview(): void {
  const sprint = useSprintStore.getState()
  if (sprint.phase !== 'review') return
  if (sprint.sprintNumber === 6) {
    if (hasCompletedCoreMvp(useProductStore.getState().taskStates)) completeCampaignDeadlineMet()
    // an incomplete sprint-6 review is a deadline decision handled by callers
  } else {
    completeSprintAndPrepareNextPlanning()
  }
  note('review complete')
}

// Runs planning+development sprints until all 14 tasks are done or maxSprints hit.
export function developUntilComplete(maxSprints = 6): void {
  for (let s = 0; s < maxSprints; s++) {
    if (hasCompletedCoreMvp(useProductStore.getState().taskStates)) return
    if (useSprintStore.getState().phase === 'planning') {
      planAllRemaining()
      startSprint()
    }
    for (let d = 0; d < 10; d++) {
      if (useSprintStore.getState().phase !== 'active') break
      const r = completeDay()
      if (!r.completed) break
      if (hasCompletedCoreMvp(useProductStore.getState().taskStates)) return
    }
    if (useSprintStore.getState().phase === 'review') finishReview()
  }
}

// Player-confirmed release (readiness → running → deadline met → scene → success),
// with the scene finalize + success-screen open applied deterministically.
export function releaseMvp(): boolean {
  const s = useSprintStore.getState()
  const r = releaseOfficeFlowMvp({ sprintNumber: s.sprintNumber, day: s.day })
  if (!r.released) {
    note(`release blocked: ${(r as { reason?: string }).reason}`)
    return false
  }
  finalizeMvpReleaseSuccess()
  // Simulate the CutsceneRunner's cleanup (no runner in the sim).
  useCutsceneStore.setState({ activeSceneId: null })
  useGameOutcomeStore.getState().markSuccessScreenOpened()
  note('MVP released')
  return true
}

function sumCategory(txs: MoneyTransaction[], category: string): number {
  return txs.filter((t) => t.category === category).reduce((sum, t) => sum + t.amount, 0)
}
function sumSalaries(txs: MoneyTransaction[]): number {
  let total = 0
  for (const t of txs) for (const b of t.breakdown ?? []) if (b.code.startsWith('salary')) total += b.amount
  return total
}

export function buildResult(): CampaignSimulationResult {
  const txs = useEconomyStore.getState().transactions
  const outcomeStore = useGameOutcomeStore.getState()
  const taskStates = useProductStore.getState().taskStates
  const signals = useRiskStore.getState().signals
  const finalRiskLevels = {} as Record<RiskDomain, RiskLevel>
  for (const d of RISK_DOMAINS) finalRiskLevels[d] = getActualRiskLevel(signals, d)

  const outcome: CampaignSimulationResult['outcome'] =
    outcomeStore.status === 'succeeded' ? 'win' : outcomeStore.status === 'failed' || outcomeStore.status === 'failure-pending' ? 'loss' : 'incomplete'

  const operationsTotal = sumCategory(txs, 'operations')
  const salaryCost = sumSalaries(txs)

  return {
    outcome,
    outcomeReason: outcomeStore.failure?.reason ?? outcomeStore.pendingFailure?.reason,
    releaseMoment: outcomeStore.success?.releasedAt ?? outcomeStore.campaignRelease.releasedAt,
    completedSprints: Math.max(0, useSprintStore.getState().sprintNumber - 1),
    completedProductTaskIds: taskStates.filter((s) => s.status === 'done').map((s) => s.taskId),
    productReadinessPercent: productReadiness(taskStates),
    finalBudget: calculateBalance(txs),
    operationsCost: operationsTotal - salaryCost,
    salaryCost,
    investmentsCost: sumCategory(txs, 'security-investment'),
    auditFines: sumCategory(txs, 'audit-fine'),
    incidentCosts: sumCategory(txs, 'server-incident') + sumCategory(txs, 'security-incident'),
    downtimeCosts: sumCategory(txs, 'service-downtime'),
    securityWorkdaysByEmployee: { ...sim.securityWorkdays },
    productWorkdaysByEmployee: { ...sim.productWorkdays },
    finalRiskLevels,
    finalScore: outcomeStore.success?.campaignScore,
    timeline: [...sim.timeline],
  }
}

// Convenience: the disciplined clean campaign (develop everything, release once
// the 14 tasks are done and the game is still winnable).
export function runCleanCampaign(opts: ResetOptions = {}): CampaignSimulationResult {
  resetCampaign(opts)
  hireDevelopers()
  developUntilComplete(6)
  if (hasCompletedCoreMvp(useProductStore.getState().taskStates) && useSprintStore.getState().phase === 'active') {
    releaseMvp()
  } else {
    note(`incomplete: ${completedProductTaskCount(useProductStore.getState().taskStates)}/14 done, phase ${useSprintStore.getState().phase}`)
  }
  return buildResult()
}
