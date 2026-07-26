import { useGameStore } from '../gameStore'
import { useTeamStore } from '../teamStore'
import { useRiskStore } from '../riskStore'
import { hasSecuritySpecialist } from '../teamRules'
import { toWorkdayIndex } from '../workdayIndex'
import { STORY_BALANCE } from '../balance/storyBalance'
import type { BoardTask } from '../tasks'
import { useStoryDecisionStore } from './storyDecisionStore'
import { useStoryWorkStore } from './storyWorkStore'
import { useStoryConsequenceStore } from './storyConsequenceStore'
import { missedHireDeadlineSignals } from './storyRiskSignals'
import { getBaselinePath } from './storyEffectSelectors'
import {
  CLEANUP_ASSIGNMENT_ID,
  CLEANUP_TEST_DATA_TASK_ID,
  CONFIRM_RESTORE_TASK_ID,
  HARDENING_ASSIGNMENT_PREFIX,
  HARDENING_TASK_ID,
  LATE_DRILL_ASSIGNMENT_ID,
  RECOVERY_ASSIGNMENT_ID,
  RECOVER_PROJECT_TASK_ID,
} from './level1Checkpoints'

// Delayed follow-ups of the Level 1 decisions (Features 17B/17C): the baseline
// audit result and internal review land as mandatory result scenes, the hire
// deadline raises governance once, and finished story work closes its visible
// tasks. Every step is idempotent (stable task/signal/assignment/scene ids).

export const BASELINE_AUDIT_RESULT_TASK: BoardTask = {
  id: 'complete-baseline-security-audit',
  text: 'Получить результаты аудита безопасности',
  done: false,
}

export const INTERNAL_REVIEW_TASK: BoardTask = {
  id: 'complete-internal-security-review',
  text: 'Провести внутреннюю проверку безопасности (Илья)',
  done: false,
}

export const MISSED_HIRE_DEADLINE_SIGNAL_ID = 'story-decision:security-baseline-path:hire-deadline-missed:governance'

export const INTERNAL_REVIEW_ASSIGNMENT_ID = 'story-decision:security-baseline-path:hire-security-specialist-first:internal-review:ilya-vlasov'

function addTaskOnce(task: BoardTask): void {
  const game = useGameStore.getState()
  if (!game.tasks.some((t) => t.id === task.id)) game.addTask({ ...task })
}

function baselineRecord() {
  return useStoryDecisionStore.getState().decisions['security-baseline-path']
}

function baselineResolvedIndex(): number | undefined {
  const record = baselineRecord()
  if (record.status !== 'resolved' || !record.resolvedAt) return undefined
  return toWorkdayIndex(record.resolvedAt.sprintNumber, record.resolvedAt.day)
}

// The internal review starts the moment Ilya is REALLY hired on the
// hire-first path: his review task appears and he is busy for its effort.
// Reactive (called from the trigger evaluator) and idempotent.
export function ensureInternalReviewStarted(): void {
  const record = baselineRecord()
  if (record.migratedFromLegacy) return // the legacy campaign has its own audit flow
  if (getBaselinePath() !== 'internal-review') return
  if (!hasSecuritySpecialist(useTeamStore.getState().hires)) return
  addTaskOnce(INTERNAL_REVIEW_TASK)
  useStoryWorkStore.getState().addAssignmentOnce({
    id: INTERNAL_REVIEW_ASSIGNMENT_ID,
    employeeId: 'ilya-vlasov',
    title: 'Внутренняя проверка безопасности',
    remainingDays: STORY_BALANCE.internalSecurityReview.effortDays,
  })
}

export interface StoryFollowUpContext {
  sprintNumber: number
  day: number
  completedWorkdayIndex: number
  finishedAssignmentIds: string[]
}

// Runs inside completeWorkday after the day's work is applied. Deterministic
// and idempotent for a given completed day.
export function applyStoryFollowUpsForWorkday(ctx: StoryFollowUpContext): void {
  const record = baselineRecord()
  const resolvedIndex = baselineResolvedIndex()
  const path = getBaselinePath()
  const conseq = useStoryConsequenceStore.getState()

  // 1. External audit: the result report lands N completed workdays after the
  //    order as a mandatory result scene (17C §3) - never twice.
  if (!record.migratedFromLegacy && path === 'external-audit' && resolvedIndex !== undefined) {
    if (ctx.completedWorkdayIndex >= resolvedIndex + STORY_BALANCE.baselineAudit.resultDelayWorkdays) {
      conseq.queueConsequenceOnce('baseline-audit-result')
    }
  }

  // 2. Hire-first path: the review starts on a real hire; a hire that never
  //    happened within the deadline raises governance once.
  ensureInternalReviewStarted()
  if (!record.migratedFromLegacy && path === 'internal-review' && resolvedIndex !== undefined) {
    const ilyaHired = hasSecuritySpecialist(useTeamStore.getState().hires)
    if (!ilyaHired && ctx.completedWorkdayIndex >= resolvedIndex + STORY_BALANCE.internalSecurityReview.hireDeadlineWorkdays) {
      useRiskStore.getState().addSignalsOnce(
        missedHireDeadlineSignals({ sprintNumber: ctx.sprintNumber, day: ctx.day, workdayIndex: ctx.completedWorkdayIndex }),
      )
    }
  }

  // 3. Ilya's finished review lands as its result scene (17C §3).
  if (ctx.finishedAssignmentIds.includes(INTERNAL_REVIEW_ASSIGNMENT_ID)) {
    conseq.queueConsequenceOnce('internal-review-complete')
  }

  // 4. Finished consequence work closes its visible tasks (17C).
  const game = useGameStore.getState()
  if (ctx.finishedAssignmentIds.includes(LATE_DRILL_ASSIGNMENT_ID)) {
    conseq.setLateRestoreDrillCompleted()
    game.completeTask(CONFIRM_RESTORE_TASK_ID)
  }
  if (ctx.finishedAssignmentIds.includes(RECOVERY_ASSIGNMENT_ID)) {
    game.completeTask(RECOVER_PROJECT_TASK_ID)
  }
  if (ctx.finishedAssignmentIds.includes(CLEANUP_ASSIGNMENT_ID)) {
    game.completeTask(CLEANUP_TEST_DATA_TASK_ID)
  }
  if (ctx.finishedAssignmentIds.some((id) => id.startsWith(HARDENING_ASSIGNMENT_PREFIX))) {
    game.completeTask(HARDENING_TASK_ID)
  }
}
