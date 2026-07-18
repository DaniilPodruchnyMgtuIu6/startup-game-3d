// Pure, deterministic rules for the security-breach story beat. No Zustand, no
// side effects, no scene start - only eligibility, normalisation and choice
// mapping, all unit-testable. The launch date is determined by game state, not
// a timer or randomness.

export type SecurityBreachStatus = 'not-started' | 'running' | 'completed'
export type SecurityBreachDecision = 'take-responsibility' | 'blame-project-manager'

export interface StoryMoment {
  sprintNumber: number
  day: number
}

export interface SecurityBreachData {
  status: SecurityBreachStatus
  firstStartedAt?: StoryMoment
  completedAt?: StoryMoment
  decision?: SecurityBreachDecision
  effectsApplied: boolean
}

export const INITIAL_SECURITY_BREACH: SecurityBreachData = { status: 'not-started', effectsApplied: false }

export interface SecurityBreachTriggerContext {
  gamePhase: string
  sprintPhase: string
  sprintNumber: number
  day: number
  hasBackendDeveloper: boolean
  hasFrontendDeveloper: boolean
  hasFirstPrototype: boolean
  securityBreachStatus: SecurityBreachStatus
  isCutsceneRunning: boolean
  isServerMinigameOpen: boolean
  isBlockingOverlayOpen: boolean
  isBlockingDialogueOpen: boolean
}

export type SecurityBreachBlockingReason =
  | 'game-phase'
  | 'sprint-phase'
  | 'first-sprint'
  | 'first-day'
  | 'team-incomplete'
  | 'prototype-missing'
  | 'already-running'
  | 'already-completed'
  | 'cutscene-running'
  | 'server-minigame-open'
  | 'overlay-open'
  | 'dialogue-open'

export interface SecurityBreachEligibility {
  allowed: boolean
  blockingReasons: SecurityBreachBlockingReason[]
}

// All conditions must hold. Story gates (phase/day/team/prototype/status) come
// first, then the transient "UI is busy" gates that only defer the launch.
export function getSecurityBreachEligibility(ctx: SecurityBreachTriggerContext): SecurityBreachEligibility {
  const reasons: SecurityBreachBlockingReason[] = []
  if (ctx.gamePhase !== 'free') reasons.push('game-phase')
  if (ctx.sprintPhase !== 'active') reasons.push('sprint-phase')
  if (ctx.sprintNumber < 2) reasons.push('first-sprint')
  if (ctx.day < 2) reasons.push('first-day')
  if (!ctx.hasBackendDeveloper || !ctx.hasFrontendDeveloper) reasons.push('team-incomplete')
  if (!ctx.hasFirstPrototype) reasons.push('prototype-missing')
  if (ctx.securityBreachStatus === 'running') reasons.push('already-running')
  if (ctx.securityBreachStatus === 'completed') reasons.push('already-completed')
  if (ctx.isCutsceneRunning) reasons.push('cutscene-running')
  if (ctx.isServerMinigameOpen) reasons.push('server-minigame-open')
  if (ctx.isBlockingOverlayOpen) reasons.push('overlay-open')
  if (ctx.isBlockingDialogueOpen) reasons.push('dialogue-open')
  return { allowed: reasons.length === 0, blockingReasons: reasons }
}

export function canTriggerSecurityBreach(ctx: SecurityBreachTriggerContext): boolean {
  return getSecurityBreachEligibility(ctx).allowed
}

// The scene's two choices map to a stable decision id. Kept a function so an
// older choice id (the pre-Feature-05 'accept'/'blame') still resolves safely.
export function mapCutsceneChoiceToSecurityDecision(choiceId: string): SecurityBreachDecision | undefined {
  switch (choiceId) {
    case 'take-responsibility':
    case 'accept':
      return 'take-responsibility'
    case 'blame-project-manager':
    case 'blame':
      return 'blame-project-manager'
    default:
      return undefined
  }
}

// --- Persistence normalisation ---------------------------------------------

const STATUSES: SecurityBreachStatus[] = ['not-started', 'running', 'completed']
const DECISIONS: SecurityBreachDecision[] = ['take-responsibility', 'blame-project-manager']

function validMoment(raw: unknown): StoryMoment | undefined {
  if (!raw || typeof raw !== 'object') return undefined
  const { sprintNumber, day } = raw as Record<string, unknown>
  if (typeof sprintNumber !== 'number' || !Number.isInteger(sprintNumber) || sprintNumber < 1) return undefined
  if (typeof day !== 'number' || !Number.isInteger(day) || day < 1 || day > 10) return undefined
  return { sprintNumber, day }
}

// Coerce a loaded/corrupt blob into safe SecurityBreachData. A `running` status
// (interrupted by a reload) normalises to `not-started` so the scene can start
// again, while firstStartedAt / decision / effectsApplied are preserved so the
// side-effects are never re-applied and the saved choice stays the truth.
export function normalizeSecurityStoryState(persisted: unknown): SecurityBreachData {
  const source = (persisted && typeof persisted === 'object' ? (persisted as { securityBreach?: unknown }).securityBreach : persisted) as
    | Record<string, unknown>
    | undefined
  if (!source || typeof source !== 'object') return { ...INITIAL_SECURITY_BREACH }

  const rawStatus = STATUSES.includes(source.status as SecurityBreachStatus) ? (source.status as SecurityBreachStatus) : 'not-started'
  const decision = DECISIONS.includes(source.decision as SecurityBreachDecision) ? (source.decision as SecurityBreachDecision) : undefined
  const firstStartedAt = validMoment(source.firstStartedAt)
  const completedAt = validMoment(source.completedAt)
  const effectsApplied = source.effectsApplied === true

  // running never survives a reload; completed is final only with a valid date.
  let status: SecurityBreachStatus = rawStatus
  if (status === 'running') status = 'not-started'
  if (status === 'completed' && !completedAt) status = 'not-started'

  return {
    status,
    ...(firstStartedAt ? { firstStartedAt } : {}),
    ...(status === 'completed' && completedAt ? { completedAt } : {}),
    ...(decision ? { decision } : {}),
    effectsApplied,
  }
}
