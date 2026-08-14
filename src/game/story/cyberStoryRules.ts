import type { StoryMoment } from '../securityStoryRules'
import { SPRINT_DAYS } from '../sprintRules'
import {
  CYBER_STORY_INCIDENT_PRIORITY,
  cyberIncidentPriorityRank,
  cyberStoryOperationId,
  initialCyberStoryRecords,
  type CyberConsequenceId,
  type CyberStoryChoiceId,
  type CyberStoryIncidentId,
  type CyberStoryRecords,
} from './cyberStoryTypes'
import { getCyberStoryDefinition } from './cyberStoryCatalog'

// Pure, deterministic rules for the three Feature 19 cyber incidents. No
// Zustand, no side effects - status transitions, eligibility, priority and
// persistence normalisation, all unit-testable. Mirrors storyDecisionRules.ts.

export { initialCyberStoryRecords, cyberStoryOperationId }

export function isValidCyberChoice(incidentId: CyberStoryIncidentId, choiceId: string): choiceId is CyberStoryChoiceId {
  return getCyberStoryDefinition(incidentId)?.choiceIds.includes(choiceId as CyberStoryChoiceId) ?? false
}

// --- Eligibility --------------------------------------------------------------

// 1. executive-phishing-request: both developers hired, the first sprint is
// under way (not the day-1 kickoff), not resolved yet. Security training
// (security-first-priority: prioritize-security-training) does not skip the
// scene - it changes which choices the dialogue offers (cyberStoryDialogues.ts).
export interface ExecutivePhishingUnlockContext {
  kirillHired: boolean
  alinaHired: boolean
  sprintPhase: string
  day: number
}

export function canUnlockExecutivePhishing(ctx: ExecutivePhishingUnlockContext): boolean {
  return ctx.kirillHired && ctx.alinaHired && ctx.sprintPhase === 'active' && ctx.day > 1
}

// 2. supply-chain-update: Kirill hired, at least 3 product tasks done, review
// is 1-2 workdays away (days SPRINT_DAYS-2 / SPRINT_DAYS-1 of an active
// sprint), and the AUTH task is active or already shipped.
export interface SupplyChainUpdateUnlockContext {
  kirillHired: boolean
  completedProductTasks: number
  sprintPhase: string
  day: number
  authTaskActiveOrDone: boolean
}

export function canUnlockSupplyChainUpdate(ctx: SupplyChainUpdateUnlockContext): boolean {
  return (
    ctx.kirillHired &&
    ctx.completedProductTasks >= 3 &&
    ctx.sprintPhase === 'active' &&
    ctx.day >= SPRINT_DAYS - 2 &&
    ctx.day < SPRINT_DAYS &&
    ctx.authTaskActiveOrDone
  )
}

// 3. shadow-it-log-upload: both developers hired, the frontend-test-data
// Level 1 decision is already resolved (real working frontend + real test
// data context) and the first prototype exists (there are real logs to argue
// about).
export interface ShadowItLogUploadUnlockContext {
  kirillHired: boolean
  alinaHired: boolean
  frontendTestDataResolved: boolean
  firstPrototypeReady: boolean
}

export function canUnlockShadowItLogUpload(ctx: ShadowItLogUploadUnlockContext): boolean {
  return ctx.kirillHired && ctx.alinaHired && ctx.frontendTestDataResolved && ctx.firstPrototypeReady
}

// §"Event priority": at least one ordinary completed workday between two
// major cyber-story scenes - no two cyber incidents unlock the same day.
// `otherIncidentAvailableOrResolvedToday` is computed by the caller
// (evaluateCyberStoryUnlocks.ts) from the OTHER five incidents' records.
export interface CyberSceneSpacingContext {
  otherIncidentAvailableOrResolvedToday: boolean
}

// 4. secret-committed-to-repository: Kirill hired, at least one backend task
// done, not the same day as another cyber scene (explicitly not the same day
// as supply-chain-update - subsumed by the general one-incident-per-day rule).
export interface SecretCommittedUnlockContext extends CyberSceneSpacingContext {
  kirillHired: boolean
  hasBackendProgress: boolean
}

export function canUnlockSecretCommittedToRepository(ctx: SecretCommittedUnlockContext): boolean {
  return ctx.kirillHired && ctx.hasBackendProgress && !ctx.otherIncidentAvailableOrResolvedToday
}

// 5. mfa-fatigue-attack: Kirill hired, a real working login/account system
// exists (hasFirstPrototype - there is something worth attacking), not the
// kickoff day, executive-phishing-request already settled (resolved) or the
// campaign has moved past its first sprint anyway (so a campaign where
// phishing never fired is not blocked forever), spacing. hasFirstPrototype is
// the load-bearing gate here - without it this trigger fired as early as
// sprint 2 day 1 with only a hire, colliding with Feature 16's Workday Flow
// kickoff/auto-complete e2e tests that seed exactly that state.
export interface MfaFatigueUnlockContext extends CyberSceneSpacingContext {
  kirillHired: boolean
  hasFirstPrototype: boolean
  phishingResolved: boolean
  sprintNumber: number
  day: number
}

export function canUnlockMfaFatigueAttack(ctx: MfaFatigueUnlockContext): boolean {
  const phishingSettled = ctx.phishingResolved || ctx.sprintNumber >= 2
  return ctx.kirillHired && ctx.hasFirstPrototype && ctx.day > 1 && phishingSettled && !ctx.otherIncidentAvailableOrResolvedToday
}

// 6. external-ai-data-disclosure: Alina hired, she has real frontend progress
// (a real defect to fix), enough sprints remain before the MVP deadline
// (sprint 6) for the choice and its consequence to play out, spacing.
export interface ExternalAiUnlockContext extends CyberSceneSpacingContext {
  alinaHired: boolean
  hasFrontendProgress: boolean
  sprintNumber: number
}

export function canUnlockExternalAiDataDisclosure(ctx: ExternalAiUnlockContext): boolean {
  return ctx.alinaHired && ctx.hasFrontendProgress && ctx.sprintNumber <= 5 && !ctx.otherIncidentAvailableOrResolvedToday
}

// --- Priority & blocking -------------------------------------------------------

export function getActiveBlockingCyberIncidentId(records: CyberStoryRecords): CyberStoryIncidentId | undefined {
  const candidates = CYBER_STORY_INCIDENT_PRIORITY.filter((id) => {
    const record = records[id]
    const def = getCyberStoryDefinition(id)
    return def?.blocking === true && (record.status === 'running' || record.status === 'available')
  })
  if (candidates.length === 0) return undefined
  const running = candidates.find((id) => records[id].status === 'running')
  if (running) return running
  return candidates.sort((a, b) => cyberIncidentPriorityRank(a) - cyberIncidentPriorityRank(b))[0]
}

export function isBlockingCyberIncidentPending(records: CyberStoryRecords): boolean {
  return getActiveBlockingCyberIncidentId(records) !== undefined
}

// --- Persistence normalisation --------------------------------------------------

const STATUSES = ['locked', 'available', 'running', 'resolved'] as const

function validMoment(raw: unknown): StoryMoment | undefined {
  if (!raw || typeof raw !== 'object') return undefined
  const { sprintNumber, day } = raw as Record<string, unknown>
  if (typeof sprintNumber !== 'number' || !Number.isInteger(sprintNumber) || sprintNumber < 1) return undefined
  if (typeof day !== 'number' || !Number.isInteger(day) || day < 1 || day > SPRINT_DAYS) return undefined
  return { sprintNumber, day }
}

function normalizeRecord(id: CyberStoryIncidentId, raw: unknown) {
  const fresh = { incidentId: id, status: 'locked' as const, effectsApplied: false }
  if (!raw || typeof raw !== 'object') return fresh
  const r = raw as Record<string, unknown>

  let status = (STATUSES as readonly string[]).includes(r.status as string) ? (r.status as (typeof STATUSES)[number]) : 'locked'
  const selectedChoiceId = typeof r.selectedChoiceId === 'string' && isValidCyberChoice(id, r.selectedChoiceId) ? r.selectedChoiceId : undefined

  // running never survives a reload; a resolved record without a valid choice
  // rolls back to available so the scene can be held again.
  if (status === 'running') status = 'available'
  if (status === 'resolved' && !selectedChoiceId) status = 'available'

  const availableAt = validMoment(r.availableAt)
  const startedAt = validMoment(r.startedAt)
  const resolvedAt = validMoment(r.resolvedAt)

  return {
    incidentId: id,
    status,
    ...(availableAt ? { availableAt } : {}),
    ...(startedAt ? { startedAt } : {}),
    ...(status === 'resolved' && resolvedAt ? { resolvedAt } : {}),
    ...(selectedChoiceId ? { selectedChoiceId } : {}),
    effectsApplied: r.effectsApplied === true && selectedChoiceId !== undefined,
  }
}

export interface NormalizedCyberStoryRecords {
  incidents: CyberStoryRecords
  activeIncidentId?: CyberStoryIncidentId
}

// Coerce a loaded/corrupt blob into a complete, consistent record set - one
// record per catalog incident, statuses repaired, the active id re-derived.
export function normalizeCyberStoryRecords(persisted: unknown): NormalizedCyberStoryRecords {
  const source = persisted && typeof persisted === 'object' ? (persisted as Record<string, unknown>) : {}
  const rawIncidents = source.incidents && typeof source.incidents === 'object' ? (source.incidents as Record<string, unknown>) : {}

  const incidents = {} as CyberStoryRecords
  for (const id of CYBER_STORY_INCIDENT_PRIORITY) {
    incidents[id] = normalizeRecord(id, rawIncidents[id])
  }

  return { incidents, activeIncidentId: getActiveBlockingCyberIncidentId(incidents) }
}

// --- Consequence schedule normalisation ----------------------------------------

const CONSEQUENCE_IDS = [
  'phishing-targeted-followup',
  'supply-chain-unknown-connection',
  'shadow-it-external-download',
  'external-credential-usage',
  'credential-found-in-ci-cache',
  'hijacked-session-activity',
  'unrestricted-ai-recurrence',
  'shadow-ai-personal-use',
] as const

export function isCyberConsequenceId(x: unknown): x is CyberConsequenceId {
  return typeof x === 'string' && (CONSEQUENCE_IDS as readonly string[]).includes(x)
}

function validDueIndex(raw: unknown): number | undefined {
  return typeof raw === 'number' && Number.isInteger(raw) && raw >= 1 ? raw : undefined
}

export interface NormalizedCyberScheduled {
  id: CyberConsequenceId
  dueWorkdayIndex: number
}

export function normalizeScheduledConsequences(raw: unknown): NormalizedCyberScheduled[] {
  if (!raw || typeof raw !== 'object') return []
  const out: NormalizedCyberScheduled[] = []
  for (const id of CONSEQUENCE_IDS) {
    const entry = (raw as Record<string, unknown>)[id]
    if (!entry || typeof entry !== 'object') continue
    const dueWorkdayIndex = validDueIndex((entry as Record<string, unknown>).dueWorkdayIndex)
    if (dueWorkdayIndex === undefined) continue
    out.push({ id, dueWorkdayIndex })
  }
  return out
}
