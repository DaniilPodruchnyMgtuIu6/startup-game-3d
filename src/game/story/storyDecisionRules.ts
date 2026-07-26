import type { StoryMoment, SecurityStaffingDecision } from '../securityStoryRules'
import { LEVEL1_DECISION_PRIORITY, decisionPriorityRank, type Level1StoryDecisionId } from './level1Timeline'
import { getStoryDecision } from './storyDecisionCatalog'

// Pure, deterministic rules for the Level 1 story decisions (Feature 17A). No
// Zustand, no side effects - status transitions, eligibility, priority and
// persistence normalisation, all unit-testable. This is NOT a generic event
// engine: it serves exactly the eight fixed decisions.

export type StoryDecisionStatus = 'locked' | 'available' | 'running' | 'resolved'

export interface StoryDecisionRecord {
  decisionId: Level1StoryDecisionId
  status: StoryDecisionStatus
  availableAt?: StoryMoment
  startedAt?: StoryMoment
  resolvedAt?: StoryMoment
  selectedChoiceId?: string
  effectsApplied: boolean
  // The record was created/resolved by save migration from the pre-17 story
  // (its effects were applied by the legacy path, never by a 17A+ handler).
  migratedFromLegacy?: boolean
}

export type StoryDecisionRecords = Record<Level1StoryDecisionId, StoryDecisionRecord>

export function initialStoryDecisionRecords(): StoryDecisionRecords {
  const records = {} as StoryDecisionRecords
  for (const id of LEVEL1_DECISION_PRIORITY) {
    records[id] = { decisionId: id, status: 'locked', effectsApplied: false }
  }
  return records
}

// Deterministic idempotency key of a choice application (17A §8).
export function storyDecisionOperationId(decisionId: Level1StoryDecisionId, choiceId: string): string {
  return `story-decision:${decisionId}:${choiceId}`
}

// 17A shipped the baseline audit choice as `order-external-audit`; 17B renamed
// it to the spec id. Old persisted choices map to the canonical id on load.
const LEGACY_CHOICE_ALIASES: Partial<Record<Level1StoryDecisionId, Record<string, string>>> = {
  'security-baseline-path': { 'order-external-audit': 'commission-security-audit' },
}

export function canonicalChoiceId(decisionId: Level1StoryDecisionId, choiceId: string): string {
  return LEGACY_CHOICE_ALIASES[decisionId]?.[choiceId] ?? choiceId
}

export function isValidChoiceForDecision(decisionId: Level1StoryDecisionId, choiceId: string): boolean {
  return getStoryDecision(decisionId)?.choiceIds.includes(canonicalChoiceId(decisionId, choiceId)) ?? false
}

// --- Eligibility (17A §6) ----------------------------------------------------
// One explicit pure predicate per decision - no expression parser, no DSL. In
// 17A only the baseline gate is wired into live play; the others are exercised
// by tests and picked up by the 17B scenes.

export interface SecurityBaselineUnlockContext {
  bothDevelopersHired: boolean
  sprintNumber: number
  sprintPhase: string
  // The legacy post-breach fork already decided the staffing path (old save).
  legacyStaffingDecided: boolean
}

// The mandatory office check happens after Kirill and Alina are hired but
// before the first sprint starts (planning phase of sprint 1).
export function canUnlockSecurityBaseline(ctx: SecurityBaselineUnlockContext): boolean {
  return ctx.bothDevelopersHired && ctx.sprintNumber === 1 && ctx.sprintPhase === 'planning' && !ctx.legacyStaffingDecided
}

// 2. Kirill's admin-access question: first active sprint, before his first
// backend progress lands (a save already past that point never replays it).
export interface DeveloperAdminAccessUnlockContext {
  kirillHired: boolean
  baselineResolved: boolean
  sprintNumber: number
  sprintPhase: string
  hasBackendProgress: boolean
}

export function canUnlockDeveloperAdminAccess(ctx: DeveloperAdminAccessUnlockContext): boolean {
  return ctx.kirillHired && ctx.baselineResolved && ctx.sprintNumber === 1 && ctx.sprintPhase === 'active' && !ctx.hasBackendProgress
}

// 3. Alina's test-data question opens once her first frontend task is really
// in work (progress exists), not merely planned.
export interface FrontendTestDataUnlockContext {
  alinaHired: boolean
  baselineResolved: boolean
  frontendTaskStarted: boolean
}

export function canUnlockFrontendTestData(ctx: FrontendTestDataUnlockContext): boolean {
  return ctx.alinaHired && ctx.baselineResolved && ctx.frontendTaskStarted
}

// 4. Ilya's first-priority question: he is really hired and his one-time
// introduction talk is over.
export interface SecurityPriorityUnlockContext {
  ilyaHired: boolean
  ilyaIntroduced: boolean
}

export function canUnlockSecurityPriority(ctx: SecurityPriorityUnlockContext): boolean {
  return ctx.ilyaHired && ctx.ilyaIntroduced
}

// 5. Backup strategy: the first prototype exists and the baseline follow-up
// (audit result / internal review) is finished or overdue.
export interface BackupStrategyUnlockContext {
  firstPrototypeReady: boolean
  baselineResolved: boolean
  baselineFollowUpSettled: boolean
}

export function canUnlockBackupStrategy(ctx: BackupStrategyUnlockContext): boolean {
  return ctx.firstPrototypeReady && ctx.baselineResolved && ctx.baselineFollowUpSettled
}

// 6. Architecture boundary: enough of the product exists to argue about, and
// neither AUTH nor DATABASE has already had its incident resolved.
export interface ArchitectureBoundaryUnlockContext {
  completedProductTasks: number
  baselineResolved: boolean
  authOrDatabaseIncidentResolved: boolean
}

export function canUnlockArchitectureBoundary(ctx: ArchitectureBoundaryUnlockContext): boolean {
  return ctx.completedProductTasks >= 6 && ctx.baselineResolved && !ctx.authOrDatabaseIncidentResolved
}

// 7. Suspicious activity: the first serious signal - an armed AUTH/DATABASE
// threat or a detected critical identity/sensitive risk.
export interface SuspiciousActivityUnlockContext {
  authOrDatabaseThreatArmed: boolean
  detectedIdentityOrSensitiveCritical: boolean
  baselineResolved: boolean
}

export function canUnlockSuspiciousActivityDisclosure(ctx: SuspiciousActivityUnlockContext): boolean {
  return ctx.baselineResolved && (ctx.authOrDatabaseThreatArmed || ctx.detectedIdentityOrSensitiveCritical)
}

// 8. Pre-release decision: the product is done and there is something honest
// to decide about (a detected high/critical risk or a risky-choice history).
export interface ReleaseRiskUnlockContext {
  allProductTasksDone: boolean
  releaseStarted: boolean
  hasDetectedHighOrCriticalRisk: boolean
  hasRiskyChoiceHistory: boolean
}

export function canUnlockReleaseRiskDecision(ctx: ReleaseRiskUnlockContext): boolean {
  return ctx.allProductTasksDone && !ctx.releaseStarted && (ctx.hasDetectedHighOrCriticalRisk || ctx.hasRiskyChoiceHistory)
}

// --- Priority & blocking -----------------------------------------------------

// The single decision the game should surface next: a running one first, then
// the highest-priority available one. Deterministic across calls.
export function getActiveBlockingDecisionId(records: StoryDecisionRecords): Level1StoryDecisionId | undefined {
  const candidates = LEVEL1_DECISION_PRIORITY.filter((id) => {
    const record = records[id]
    const def = getStoryDecision(id)
    return def?.blocking === true && (record.status === 'running' || record.status === 'available')
  })
  if (candidates.length === 0) return undefined
  const running = candidates.find((id) => records[id].status === 'running')
  if (running) return running
  return candidates.sort((a, b) => decisionPriorityRank(a) - decisionPriorityRank(b))[0]
}

// A blocking decision awaiting the player pauses the Workday Flow (17A §7).
export function isBlockingStoryDecisionPending(records: StoryDecisionRecords): boolean {
  return getActiveBlockingDecisionId(records) !== undefined
}

// --- Legacy fork mapping (17A §9) -------------------------------------------

// The baseline scene carries the same fork the old post-breach conversation
// held: "order an audit" keeps the findings on the team (decline the hire),
// "hire the specialist first" approves the hire.
export function mapBaselineChoiceToStaffingDecision(choiceId: string): SecurityStaffingDecision | undefined {
  const canonical = canonicalChoiceId('security-baseline-path', choiceId)
  if (canonical === 'commission-security-audit') return 'decline-security-hire'
  if (canonical === 'hire-security-specialist-first') return 'approve-security-hire'
  return undefined
}

export function mapStaffingDecisionToBaselineChoice(decision: SecurityStaffingDecision): string {
  return decision === 'approve-security-hire' ? 'hire-security-specialist-first' : 'commission-security-audit'
}

// --- Persistence normalisation ----------------------------------------------

const STATUSES: StoryDecisionStatus[] = ['locked', 'available', 'running', 'resolved']

function validMoment(raw: unknown): StoryMoment | undefined {
  if (!raw || typeof raw !== 'object') return undefined
  const { sprintNumber, day } = raw as Record<string, unknown>
  if (typeof sprintNumber !== 'number' || !Number.isInteger(sprintNumber) || sprintNumber < 1) return undefined
  if (typeof day !== 'number' || !Number.isInteger(day) || day < 1 || day > 10) return undefined
  return { sprintNumber, day }
}

function normalizeRecord(id: Level1StoryDecisionId, raw: unknown): StoryDecisionRecord {
  const fresh: StoryDecisionRecord = { decisionId: id, status: 'locked', effectsApplied: false }
  if (!raw || typeof raw !== 'object') return fresh
  const r = raw as Record<string, unknown>

  let status: StoryDecisionStatus = STATUSES.includes(r.status as StoryDecisionStatus) ? (r.status as StoryDecisionStatus) : 'locked'
  const selectedChoiceId =
    typeof r.selectedChoiceId === 'string' && isValidChoiceForDecision(id, r.selectedChoiceId)
      ? canonicalChoiceId(id, r.selectedChoiceId)
      : undefined

  // running never survives a reload; a resolved record without a valid choice
  // rolls back to available so the scene can be held again.
  if (status === 'running') status = 'available'
  if (status === 'resolved' && !selectedChoiceId) status = 'available'

  const availableAt = validMoment(r.availableAt)
  const startedAt = validMoment(r.startedAt)
  const resolvedAt = validMoment(r.resolvedAt)

  return {
    decisionId: id,
    status,
    ...(availableAt ? { availableAt } : {}),
    ...(startedAt ? { startedAt } : {}),
    ...(status === 'resolved' && resolvedAt ? { resolvedAt } : {}),
    ...(selectedChoiceId ? { selectedChoiceId } : {}),
    effectsApplied: r.effectsApplied === true && selectedChoiceId !== undefined,
    ...(r.migratedFromLegacy === true ? { migratedFromLegacy: true } : {}),
  }
}

export interface NormalizedStoryDecisionState {
  decisions: StoryDecisionRecords
  activeDecisionId?: Level1StoryDecisionId
  completedCheckpointIds: string[]
}

// Coerce a loaded/corrupt blob into a complete, consistent state: one record
// per timeline decision, statuses repaired, the active id re-derived from the
// records (never trusted from the save).
export function normalizeStoryDecisionState(persisted: unknown): NormalizedStoryDecisionState {
  const source = persisted && typeof persisted === 'object' ? (persisted as Record<string, unknown>) : {}
  const rawDecisions = source.decisions && typeof source.decisions === 'object' ? (source.decisions as Record<string, unknown>) : {}

  const decisions = {} as StoryDecisionRecords
  for (const id of LEVEL1_DECISION_PRIORITY) {
    decisions[id] = normalizeRecord(id, rawDecisions[id])
  }

  const completedCheckpointIds = Array.isArray(source.completedCheckpointIds)
    ? [...new Set(source.completedCheckpointIds.filter((x): x is string => typeof x === 'string' && x.length > 0))]
    : []

  return {
    decisions,
    activeDecisionId: getActiveBlockingDecisionId(decisions),
    completedCheckpointIds,
  }
}
