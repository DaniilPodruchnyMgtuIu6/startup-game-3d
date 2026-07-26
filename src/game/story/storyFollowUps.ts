import { useGameStore } from '../gameStore'
import { useTeamStore } from '../teamStore'
import { useRiskStore } from '../riskStore'
import { hasSecuritySpecialist } from '../teamRules'
import { toWorkdayIndex } from '../workdayIndex'
import { STORY_BALANCE } from '../balance/storyBalance'
import type { BoardTask } from '../tasks'
import { useStoryDecisionStore } from './storyDecisionStore'
import { useStoryWorkStore } from './storyWorkStore'
import { missedHireDeadlineSignals } from './storyRiskSignals'
import { getBaselinePath } from './storyEffectSelectors'

// Delayed consequences of the Level 1 decisions (Feature 17B): the baseline
// audit result landing two workdays later, Ilya's internal review starting on
// his real hire (with the 3-workday hire deadline), and the postponed-backup
// warning. Every step is idempotent - stable task ids, stable signal ids,
// stable assignment ids - so reloads and repeated calls change nothing.

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

export const BACKUP_WARNING_TASK: BoardTask = {
  id: 'return-to-backup-restore-check',
  text: 'Вернуться к проверке восстановления резервных копий',
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

  // 1. External audit: the result report lands N completed workdays after the
  //    order - the department task closes.
  if (!record.migratedFromLegacy && path === 'external-audit' && resolvedIndex !== undefined) {
    if (ctx.completedWorkdayIndex >= resolvedIndex + STORY_BALANCE.baselineAudit.resultDelayWorkdays) {
      useGameStore.getState().completeTask(BASELINE_AUDIT_RESULT_TASK.id)
    }
  }

  // 2. Hire-first path: the review starts on a real hire; a hire that never
  //    happened within the deadline raises governance once and keeps a warning
  //    in the objective flow (the task stays open).
  ensureInternalReviewStarted()
  if (!record.migratedFromLegacy && path === 'internal-review' && resolvedIndex !== undefined) {
    const ilyaHired = hasSecuritySpecialist(useTeamStore.getState().hires)
    if (!ilyaHired && ctx.completedWorkdayIndex >= resolvedIndex + STORY_BALANCE.internalSecurityReview.hireDeadlineWorkdays) {
      useRiskStore.getState().addSignalsOnce(
        missedHireDeadlineSignals({ sprintNumber: ctx.sprintNumber, day: ctx.day, workdayIndex: ctx.completedWorkdayIndex }),
      )
    }
  }

  // 3. Ilya's finished review closes its task.
  if (ctx.finishedAssignmentIds.includes(INTERNAL_REVIEW_ASSIGNMENT_ID)) {
    useGameStore.getState().completeTask(INTERNAL_REVIEW_TASK.id)
  }

  // 4. Postponed backups: a visible warning task appears after the delay.
  const backup = useStoryDecisionStore.getState().decisions['backup-and-restore-strategy']
  if (backup.status === 'resolved' && backup.selectedChoiceId === 'postpone-backup-work' && backup.resolvedAt) {
    const backupIndex = toWorkdayIndex(backup.resolvedAt.sprintNumber, backup.resolvedAt.day)
    if (ctx.completedWorkdayIndex >= backupIndex + STORY_BALANCE.backupRestore.postponeWarningDelayWorkdays) {
      addTaskOnce(BACKUP_WARNING_TASK)
    }
  }
}
