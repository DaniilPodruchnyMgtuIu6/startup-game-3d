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
import { correctivePlanOfficeAccessSignals } from '../../src/game/riskSignals'
import { riskMomentAt } from '../../src/game/riskContext'
import { useSecurityStoryStore } from '../../src/game/securityStoryStore'
import { useSecurityAuditStore, INITIAL_SECURITY_AUDIT } from '../../src/game/securityAuditStore'
import { useAccessControlStore, INITIAL_ACCESS_CONTROL_DATA } from '../../src/game/accessControlStore'
import { useServerIncidentStore, INITIAL_SERVER_INCIDENT_DATA } from '../../src/game/serverIncidentStore'
import { useServerIncidentsStore } from '../../src/game/serverIncidentsStore'
import { useGameOutcomeStore } from '../../src/game/gameOutcomeStore'
import { useStoryDecisionStore } from '../../src/game/story/storyDecisionStore'
import { useStoryWorkStore } from '../../src/game/story/storyWorkStore'
import { useStoryConsequenceStore } from '../../src/game/story/storyConsequenceStore'
import { applyConsequenceEffects } from '../../src/game/story/storyConsequences'
import type { StoryConsequenceId } from '../../src/game/story/level1Checkpoints'
import type { Level1StoryDecisionId } from '../../src/game/story/level1Timeline'
import { useCutsceneStore } from '../../src/cutscenes/cutsceneStore'
import { completeWorkday } from '../../src/game/completeWorkday'
import { hireDeveloper } from '../../src/game/hireDeveloper'
import { startSprintWithPlan } from '../../src/game/startSprintWithPlan'
import { completeSprintAndPrepareNextPlanning, completeCampaignDeadlineMet } from '../../src/game/completeSprintReview'
import { releaseOfficeFlowMvp, finalizeMvpReleaseSuccess } from '../../src/game/releaseOfficeFlowMvp'
import { INITIAL_SECURITY_BREACH } from '../../src/game/securityStoryRules'
import { getSecurityFinding } from '../../src/game/securityFindingCatalog'
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
  // Model the Feature 08 corrective plan (4 findings + follow-up audit) the way
  // the real post-audit branch creates it. With Ilya he closes findings (Kirill
  // stays on product); without him Kirill is diverted for the technical ones.
  withCorrectivePlan?: boolean
  // Feature 17C: when false, the baseline story record is NOT pre-resolved via
  // legacy migration - the scenario drives the real Level 1 decisions itself.
  legacyBaseline?: boolean
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
  // Feature 17A: the sim models a campaign whose staffing fork is already
  // decided (see the story preset above) - the baseline node mirrors that.
  useStoryDecisionStore.getState().resetLevel1Story()
  useStoryWorkStore.getState().resetStoryWork()
  useStoryConsequenceStore.getState().resetConsequences()
  if (opts.legacyBaseline !== false) {
    useStoryDecisionStore
      .getState()
      .recordLegacyBaselineResolution(opts.withIlya ? 'approve-security-hire' : 'decline-security-hire', { sprintNumber: 1, day: 1 })
  }
  // No CutsceneRunner in the sim — clear any scene id the harness left set.
  useCutsceneStore.setState({ activeSceneId: null })

  const hires = [
    { employeeId: KIRILL, hiredAtSprint: 1, hiredAtDay: 1 },
    { employeeId: ALINA, hiredAtSprint: 1, hiredAtDay: 1 },
    ...(opts.withIlya ? [{ employeeId: ILYA, hiredAtSprint: 2, hiredAtDay: 1 }] : []),
  ]
  useTeamStore.setState({ hires, panelOpen: false })

  if (opts.withCorrectivePlan) {
    useSecurityAuditStore.getState().initializeCorrectiveActionPlan({
      currentWorkdayIndex: 1,
      staffingDecision: opts.withIlya ? 'approve-security-hire' : 'decline-security-hire',
    })
    // Feature 16 §9: the plan discovers the office-access risk, exactly like the
    // real initializeSecurityAuditIfReady. A disciplined run closes the finding,
    // so office-access drops and no intrusion arms.
    useRiskStore.getState().addSignalsOnce(correctivePlanOfficeAccessSignals(riskMomentAt(1, 1)))
  }
}

// Assign every open finding to an eligible free employee. A disciplined player
// with Ilya NEVER diverts Kirill from product — a technical finding waits in
// Ilya's queue until he is free (assigned on a later day).
export function assignOpenFindings(): void {
  const withIlya = useTeamStore.getState().hires.some((h) => h.employeeId === ILYA)
  for (const f of useSecurityAuditStore.getState().findings) {
    if (f.status === 'closed' || f.assignedEmployeeId) continue
    const def = getSecurityFinding(f.findingId)
    if (!def) continue
    const order = withIlya ? def.eligibleEmployeeIds.filter((e) => e !== KIRILL) : def.eligibleEmployeeIds
    for (const emp of order) {
      if (useSecurityAuditStore.getState().assignFinding(f.findingId, emp).assigned) break
    }
  }
}

// The follow-up audit scene's deterministic commit (the sim has no scene runner).
export function resolvePendingAuditIfAny(): void {
  if (useSecurityAuditStore.getState().followUpAudit.status !== 'pending') return
  const s = useSprintStore.getState()
  useSecurityAuditStore.getState().markAuditRunning()
  useSecurityAuditStore.getState().resolvePendingAudit({ sprintNumber: s.sprintNumber, day: s.day })
  useSecurityAuditStore.getState().acknowledgeAuditResult()
  note('follow-up audit resolved')
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

// Feature 17C: resolve a Level 1 decision through the real store + handlers.
export function decideStory(id: Level1StoryDecisionId, choiceId: string): void {
  const s = useSprintStore.getState()
  const moment = { sprintNumber: s.sprintNumber, day: s.day }
  useStoryDecisionStore.getState().unlockDecision(id, moment)
  useStoryDecisionStore.getState().resolveDecision(id, choiceId, moment)
  note(`story ${id} -> ${choiceId}`)
}

// Feature 17C: hold every queued mandatory consequence scene deterministically
// (no dialogue runner in the sim) - the same effects the real scene applies.
// `choices` picks an option for warning scenes (defaults to declining).
export function resolvePendingStoryConsequences(choices: Partial<Record<StoryConsequenceId, string>> = {}): StoryConsequenceId[] {
  const held: StoryConsequenceId[] = []
  for (let guard = 0; guard < 20; guard++) {
    const conseq = useStoryConsequenceStore.getState()
    const next = conseq.pendingConsequenceIds[0]
    if (!next) break
    conseq.startConsequence(next)
    const s = useSprintStore.getState()
    applyConsequenceEffects(next, { sprintNumber: s.sprintNumber, day: s.day }, choices[next])
    useStoryConsequenceStore.getState().completeConsequence(next)
    held.push(next)
    note(`consequence ${next}${choices[next] ? ` (${choices[next]})` : ''}`)
  }
  return held
}

export interface DayHooks {
  before?: () => void
  // Choice per warning consequence scene held before the day completes.
  consequenceChoices?: Partial<Record<StoryConsequenceId, string>>
}

// Completes one working day through the single real use-case, accumulating who
// worked on product vs was diverted to security/recovery.
export function completeDay(hooks: DayHooks = {}): ReturnType<typeof completeWorkday> {
  // mandatory events first, matching the real event order (audit before the day)
  resolvePendingAuditIfAny()
  assignOpenFindings()
  // Feature 17C: unheld consequence scenes block the day - hold them now.
  resolvePendingStoryConsequences(hooks.consequenceChoices)
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
  // in the real game a due audit takes priority over the review overlay
  resolvePendingAuditIfAny()
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
  resolvePendingAuditIfAny()
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
  if (hasCompletedCoreMvp(useProductStore.getState().taskStates)) {
    // finishing the last task on day 10 lands in the review — the review takes
    // priority (real event order), then the release happens in the next sprint
    if (useSprintStore.getState().phase === 'review') finishReview()
    releaseMvp()
  } else {
    note(`incomplete: ${completedProductTaskCount(useProductStore.getState().taskStates)}/14 done, phase ${useSprintStore.getState().phase}`)
  }
  return buildResult()
}
