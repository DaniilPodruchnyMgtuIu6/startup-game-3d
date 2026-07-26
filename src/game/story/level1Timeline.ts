// The fixed Level 1 decision timeline (Feature 17A). Exactly eight story
// decisions exist in the first campaign stage - no generic event list, no
// dynamic registration. The array order IS the eligibility priority (§6 of
// 17A): when several decisions are eligible at once, the earliest entry wins.

export type Level1StoryDecisionId =
  | 'security-baseline-path'
  | 'developer-admin-access'
  | 'frontend-test-data'
  | 'security-first-priority'
  | 'backup-and-restore-strategy'
  | 'architecture-boundary'
  | 'suspicious-activity-disclosure'
  | 'release-risk-decision'

export const LEVEL1_DECISION_PRIORITY: readonly Level1StoryDecisionId[] = [
  'security-baseline-path',
  'developer-admin-access',
  'frontend-test-data',
  'security-first-priority',
  'backup-and-restore-strategy',
  'architecture-boundary',
  'suspicious-activity-disclosure',
  'release-risk-decision',
] as const

export function decisionPriorityRank(id: Level1StoryDecisionId): number {
  return LEVEL1_DECISION_PRIORITY.indexOf(id)
}
