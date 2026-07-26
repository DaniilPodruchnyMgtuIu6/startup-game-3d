// The fixed Level 1 consequence checkpoints (Feature 17C §1). Deterministic:
// every checkpoint is evaluated against the workday index exactly once and its
// record is immutable afterwards. No randomness, no timers.

export type Level1CheckpointId =
  | 'baseline-review-deadline'
  | 'access-consequence-check'
  | 'test-data-consequence-check'
  | 'backup-warning'
  | 'data-loss-final-warning'
  | 'data-loss-resolution'
  | 'architecture-consequence'
  | 'disclosure-consequence'
  | 'release-consequence'

export const LEVEL1_CHECKPOINT_IDS: readonly Level1CheckpointId[] = [
  'baseline-review-deadline',
  'access-consequence-check',
  'test-data-consequence-check',
  'backup-warning',
  'data-loss-final-warning',
  'data-loss-resolution',
  'architecture-consequence',
  'disclosure-consequence',
  'release-consequence',
] as const

export type CheckpointStatus = 'pending' | 'triggered' | 'passed' | 'skipped-migration'

// Mandatory consequence scenes the checkpoints can queue. Ordered by the fixed
// §13 priority: the data-loss pair first, then disclosure, architecture, and
// the acknowledgement scenes.
export type StoryConsequenceId =
  | 'data-loss-final-warning'
  | 'project-files-destroyed'
  | 'project-recovered-unverified'
  | 'project-recovered-verified'
  | 'disclosure-incident-consequence'
  | 'dismissed-warning-incident'
  | 'architecture-incident-consequence'
  | 'admin-access-consequence'
  | 'test-data-consequence'
  | 'baseline-review-overdue'
  | 'baseline-audit-result'
  | 'internal-review-complete'
  | 'backup-warning-scene'
  | 'concealed-risk-discovered'

export const CONSEQUENCE_PRIORITY: readonly StoryConsequenceId[] = [
  'data-loss-final-warning',
  'project-files-destroyed',
  'project-recovered-unverified',
  'project-recovered-verified',
  'concealed-risk-discovered',
  'disclosure-incident-consequence',
  'dismissed-warning-incident',
  'architecture-incident-consequence',
  'admin-access-consequence',
  'test-data-consequence',
  'baseline-review-overdue',
  'baseline-audit-result',
  'internal-review-complete',
  'backup-warning-scene',
] as const

export function consequencePriorityRank(id: StoryConsequenceId): number {
  return CONSEQUENCE_PRIORITY.indexOf(id)
}

// Stable ids shared between the consequence effects and the workday follow-ups
// (kept in this leaf module so no import cycle can form).
export const LATE_DRILL_ASSIGNMENT_ID = 'story-consequence:late-restore-drill:kirill-morozov'
export const RECOVERY_ASSIGNMENT_ID = 'story-consequence:recover-unverified:kirill-morozov'
export const CLEANUP_ASSIGNMENT_ID = 'story-consequence:test-data:cleanup:worker'
export const HARDENING_ASSIGNMENT_PREFIX = 'story-decision:release-risk-decision:delay-for-hardening'
export const CONFIRM_RESTORE_TASK_ID = 'confirm-project-restore'
export const RECOVER_PROJECT_TASK_ID = 'recover-project-from-unverified-backup'
export const CLEANUP_TEST_DATA_TASK_ID = 'remove-production-test-data'
export const HARDENING_TASK_ID = 'complete-release-security-hardening'
