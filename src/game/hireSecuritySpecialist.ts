import { useSprintStore } from './sprintStore'
import { useTeamStore } from './teamStore'
import { useGameStore } from './gameStore'
import { useEconomyStore } from './economyStore'
import { useProductStore } from './productStore'
import { useServerIncidentsStore } from './serverIncidentsStore'
import { useSecurityStoryStore, HIRE_SECURITY_TASK } from './securityStoryStore'
import { useCutsceneStore } from '../cutscenes/cutsceneStore'
import { SECURITY_SPECIALIST_ID, getEmployee } from './teamCatalog'
import { hasSecuritySpecialist } from './teamRules'
import { canHireSecuritySpecialist, type SecurityHireContext } from './securityHiring'

// The single game operation for hiring the fixed security specialist (Feature
// 07). Reads the staffing decision, checks eligibility, records the hire via the
// team store and completes the department task - never moving time or charging
// money (the salary lands in the NEXT completed day's expense). Idempotent: a
// second call returns already-hired without duplicating anything.

export type HireSecuritySpecialistResult =
  | { hired: true; employeeId: typeof SECURITY_SPECIALIST_ID }
  | {
      hired: false
      reason: 'decision-not-approved' | 'conversation-not-completed' | 'already-hired' | 'invalid-game-state' | 'unknown-employee'
    }

// Live eligibility context. The team panel is deliberately NOT counted as a
// blocking overlay - it is the surface the hire is triggered from.
function buildContext(): SecurityHireContext {
  const conversation = useSecurityStoryStore.getState().postAuditConversation
  const product = useProductStore.getState()
  return {
    staffingDecision: conversation.staffingDecision,
    postAuditConversationStatus: conversation.status,
    isAlreadyHired: hasSecuritySpecialist(useTeamStore.getState().hires),
    sprintPhase: useSprintStore.getState().phase,
    isCutsceneRunning: useCutsceneStore.getState().activeSceneId !== null,
    isServerMinigameOpen: useServerIncidentsStore.getState().activeMinigame !== null,
    isBlockingOverlayOpen:
      useEconomyStore.getState().panelOpen || product.boardOpen || product.activeReport !== null || product.prototypeOpen,
  }
}

export function hireSecuritySpecialist(): HireSecuritySpecialistResult {
  const { blockingReasons } = canHireSecuritySpecialist(buildContext())
  if (blockingReasons.includes('decision-not-approved')) return { hired: false, reason: 'decision-not-approved' }
  if (blockingReasons.includes('conversation-not-completed')) return { hired: false, reason: 'conversation-not-completed' }
  if (blockingReasons.includes('already-hired')) return { hired: false, reason: 'already-hired' }
  if (blockingReasons.length > 0) return { hired: false, reason: 'invalid-game-state' }

  if (!getEmployee(SECURITY_SPECIALIST_ID)) return { hired: false, reason: 'unknown-employee' }

  const sprint = useSprintStore.getState()
  const result = useTeamStore.getState().hireEmployee(SECURITY_SPECIALIST_ID, {
    sprintNumber: sprint.sprintNumber,
    day: sprint.day,
  })
  if (!result.hired) {
    if (result.reason === 'already-hired') return { hired: false, reason: 'already-hired' }
    if (result.reason === 'unknown-employee') return { hired: false, reason: 'unknown-employee' }
    return { hired: false, reason: 'invalid-game-state' }
  }

  // The hire fulfils the Feature 06 department task; money/time are untouched.
  useGameStore.getState().completeTask(HIRE_SECURITY_TASK.id)
  return { hired: true, employeeId: SECURITY_SPECIALIST_ID }
}

// Cross-store repair for loaded/corrupt saves (spec §17). Keeps the security
// hire, its task and the staffing decision consistent without resetting other
// stores. Safe to call once at startup.
export function reconcileSecurityHire(): void {
  const decision = useSecurityStoryStore.getState().postAuditConversation.staffingDecision
  const team = useTeamStore.getState()
  const game = useGameStore.getState()
  const hasIlya = hasSecuritySpecialist(team.hires)

  // A hire record on the decline / no-decision branch is invalid - drop it and
  // un-complete the task so the state matches the story decision.
  if (hasIlya && decision !== 'approve-security-hire') {
    team.removeHire(SECURITY_SPECIALIST_ID)
    game.uncompleteTask(HIRE_SECURITY_TASK.id)
    return
  }
  // Otherwise sync the task to the presence of a valid hire record.
  if (hasIlya) game.completeTask(HIRE_SECURITY_TASK.id)
  else game.uncompleteTask(HIRE_SECURITY_TASK.id)
}
