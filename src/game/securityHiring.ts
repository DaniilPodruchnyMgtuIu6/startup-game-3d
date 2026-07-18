import type { HireRecord } from './teamRules'
import { getHiredEmployeeIds } from './teamRules'
import type { PostAuditConversationStatus, SecurityStaffingDecision } from './securityStoryRules'

// Pure, deterministic rules for hiring the fixed security specialist (Feature
// 07). No Zustand, no side effects - only eligibility and the team-capacity
// label, all unit-testable. The candidate exists only on the "approve" branch
// of the post-audit staffing decision.

export interface SecurityHireContext {
  staffingDecision?: SecurityStaffingDecision
  postAuditConversationStatus: PostAuditConversationStatus
  isAlreadyHired: boolean
  sprintPhase: string
  isCutsceneRunning: boolean
  isServerMinigameOpen: boolean
  isBlockingOverlayOpen: boolean
}

export type SecurityHireBlockingReason =
  | 'decision-not-approved'
  | 'conversation-not-completed'
  | 'already-hired'
  | 'sprint-phase'
  | 'cutscene-running'
  | 'server-minigame-open'
  | 'overlay-open'

export interface SecurityHireEligibility {
  allowed: boolean
  blockingReasons: SecurityHireBlockingReason[]
}

// The candidate may be hired only after the player approved the hire in the
// post-audit conversation, the conversation is completed, Ilya is not already
// hired, the sprint is not in review, and no cutscene/minigame/overlay is open.
export function canHireSecuritySpecialist(ctx: SecurityHireContext): SecurityHireEligibility {
  const reasons: SecurityHireBlockingReason[] = []
  if (ctx.staffingDecision !== 'approve-security-hire') reasons.push('decision-not-approved')
  if (ctx.postAuditConversationStatus !== 'completed') reasons.push('conversation-not-completed')
  if (ctx.isAlreadyHired) reasons.push('already-hired')
  if (ctx.sprintPhase !== 'active' && ctx.sprintPhase !== 'planning') reasons.push('sprint-phase')
  if (ctx.isCutsceneRunning) reasons.push('cutscene-running')
  if (ctx.isServerMinigameOpen) reasons.push('server-minigame-open')
  if (ctx.isBlockingOverlayOpen) reasons.push('overlay-open')
  return { allowed: reasons.length === 0, blockingReasons: reasons }
}

// Whether the security-specialist candidate card should be shown at all. The
// decline branch never sees the candidate (no card, no locked button).
export function isSecuritySpecialistCandidateAvailable(
  staffingDecision: SecurityStaffingDecision | undefined,
  conversationStatus: PostAuditConversationStatus,
): boolean {
  return staffingDecision === 'approve-security-hire' && conversationStatus === 'completed'
}

// Team capacity label for the HUD counter. The PM plus every hired employee is
// the current count; capacity is 4 only on the approve branch (a slot for the
// specialist), otherwise 3.
//   approve + not hired -> "3/4"; approve + hired -> "4/4"; decline / none -> "3/3"
export function getCurrentTeamCapacityLabel(
  staffingDecision: SecurityStaffingDecision | undefined,
  hires: HireRecord[],
): string {
  const current = 1 + getHiredEmployeeIds(hires).length
  const capacity = staffingDecision === 'approve-security-hire' ? 4 : 3
  return `${current}/${capacity}`
}
