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

// ===========================================================================
// Feature 06 - post-audit conversation with Sonya & security-staffing decision
// ===========================================================================

export type PostAuditConversationStatus = 'locked' | 'pending' | 'running' | 'completed'
export type SecurityStaffingDecision = 'approve-security-hire' | 'decline-security-hire'

export interface PostAuditConversationState {
  status: PostAuditConversationStatus
  startedAt?: StoryMoment
  completedAt?: StoryMoment
  staffingDecision?: SecurityStaffingDecision
  effectsApplied: boolean
}

export const INITIAL_POST_AUDIT: PostAuditConversationState = { status: 'locked', effectsApplied: false }

// A conversation is required (blocks ending the day) while it is pending or
// running - the audit must be discussed before the next working day.
export function isPostAuditConversationRequired(state: PostAuditConversationState): boolean {
  return state.status === 'pending' || state.status === 'running'
}

// The conversation only exists once the security-breach scene is done.
export function getInitialPostAuditConversationState(breachStatus: SecurityBreachStatus): PostAuditConversationState {
  return breachStatus === 'completed' ? { status: 'pending', effectsApplied: false } : { ...INITIAL_POST_AUDIT }
}

export interface PostAuditConversationContext {
  gamePhase: string
  sprintPhase: string
  conversationStatus: PostAuditConversationStatus
  securityBreachStatus: SecurityBreachStatus
  isCutsceneRunning: boolean
  isServerMinigameOpen: boolean
  isBlockingOverlayOpen: boolean
  isBlockingDialogueOpen: boolean
}

export type PostAuditBlockingReason =
  | 'game-phase'
  | 'sprint-phase'
  | 'breach-not-completed'
  | 'not-pending'
  | 'cutscene-running'
  | 'server-minigame-open'
  | 'overlay-open'
  | 'dialogue-open'

export interface PostAuditEligibility {
  allowed: boolean
  blockingReasons: PostAuditBlockingReason[]
}

// The conversation may start in an active or planning sprint (not review), in
// free play, once the breach is completed and the conversation is pending, with
// no other cutscene / minigame / blocking overlay / dialogue open.
export function getPostAuditConversationEligibility(ctx: PostAuditConversationContext): PostAuditEligibility {
  const reasons: PostAuditBlockingReason[] = []
  if (ctx.gamePhase !== 'free') reasons.push('game-phase')
  if (ctx.sprintPhase !== 'active' && ctx.sprintPhase !== 'planning') reasons.push('sprint-phase')
  if (ctx.securityBreachStatus !== 'completed') reasons.push('breach-not-completed')
  if (ctx.conversationStatus !== 'pending') reasons.push('not-pending')
  if (ctx.isCutsceneRunning) reasons.push('cutscene-running')
  if (ctx.isServerMinigameOpen) reasons.push('server-minigame-open')
  if (ctx.isBlockingOverlayOpen) reasons.push('overlay-open')
  if (ctx.isBlockingDialogueOpen) reasons.push('dialogue-open')
  return { allowed: reasons.length === 0, blockingReasons: reasons }
}

export function canStartPostAuditConversation(ctx: PostAuditConversationContext): boolean {
  return getPostAuditConversationEligibility(ctx).allowed
}

export function mapPostAuditChoiceToStaffingDecision(choiceId: string): SecurityStaffingDecision | undefined {
  if (choiceId === 'approve-security-hire') return 'approve-security-hire'
  if (choiceId === 'decline-security-hire') return 'decline-security-hire'
  return undefined
}

export type PostAuditDialogueBranch = 'constructive' | 'conflict' | 'neutral'

// The tone of Sonya's opening lines follows the earlier breach choice.
export function getPostAuditDialogueBranch(breachDecision: SecurityBreachDecision | undefined): PostAuditDialogueBranch {
  if (breachDecision === 'take-responsibility') return 'constructive'
  if (breachDecision === 'blame-project-manager') return 'conflict'
  return 'neutral'
}

const POST_AUDIT_STATUSES: PostAuditConversationStatus[] = ['locked', 'pending', 'running', 'completed']
const STAFFING_DECISIONS: SecurityStaffingDecision[] = ['approve-security-hire', 'decline-security-hire']

// Coerce a loaded/corrupt blob into safe PostAuditConversationState, consistent
// with the current security-breach status. See Feature 06 §18.
export function normalizePostAuditConversationState(
  persisted: unknown,
  breachStatus: SecurityBreachStatus,
): PostAuditConversationState {
  const source = (persisted && typeof persisted === 'object' ? (persisted as { postAuditConversation?: unknown }).postAuditConversation : persisted) as
    | Record<string, unknown>
    | undefined

  // No stored conversation yet -> derive it from the breach status (migration).
  if (!source || typeof source !== 'object') return getInitialPostAuditConversationState(breachStatus)

  const rawStatus = POST_AUDIT_STATUSES.includes(source.status as PostAuditConversationStatus)
    ? (source.status as PostAuditConversationStatus)
    : 'locked'
  const staffingDecision = STAFFING_DECISIONS.includes(source.staffingDecision as SecurityStaffingDecision)
    ? (source.staffingDecision as SecurityStaffingDecision)
    : undefined
  const startedAt = validMoment(source.startedAt)
  const completedAt = validMoment(source.completedAt)
  const effectsApplied = source.effectsApplied === true && staffingDecision !== undefined

  let status: PostAuditConversationStatus = rawStatus
  if (status === 'running') status = 'pending' // interrupted by a reload
  if (breachStatus !== 'completed') status = 'locked' // conversation cannot exist yet
  else if (status === 'locked') status = 'pending' // breach done -> at least pending
  if (status === 'completed' && !staffingDecision) status = 'pending' // completed needs a decision

  return {
    status,
    ...(startedAt ? { startedAt } : {}),
    ...(status === 'completed' && completedAt ? { completedAt } : {}),
    ...(staffingDecision ? { staffingDecision } : {}),
    effectsApplied,
  }
}
