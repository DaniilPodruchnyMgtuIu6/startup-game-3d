import type { StoryMoment } from '../securityStoryRules'
import { storyDecisionOperationId, type StoryDecisionRecord } from './storyDecisionRules'
import type { Level1StoryDecisionId } from './level1Timeline'

// Explicit effect handlers - one per fixed decision (17A §4). No generic
// command arrays, no scripting. In 17A the handlers apply NO gameplay effects
// (the demo node stores only the choice); 17B fills each handler with its real
// consequences, reading every number from src/game/balance/storyBalance and
// using `operationId` as the idempotency key for transactions / risk signals /
// tasks, so a repeated or partially-failed resolve can never double-apply.

export interface StoryDecisionEffectContext {
  decisionId: Level1StoryDecisionId
  choiceId: string
  operationId: string
  moment: StoryMoment
  // True when the record came from the pre-17 save migration - its effects were
  // applied by the legacy path and the handler must change nothing.
  migratedFromLegacy: boolean
}

export interface StoryDecisionEffectResult {
  operationId: string
  // Whether this call performed any effect work (17A: always false).
  effectsChanged: boolean
}

function noEffects(ctx: StoryDecisionEffectContext): StoryDecisionEffectResult {
  return { operationId: ctx.operationId, effectsChanged: false }
}

export function resolveSecurityBaselineChoice(ctx: StoryDecisionEffectContext): StoryDecisionEffectResult {
  // 17A: the baseline scene records the choice only. The legacy post-audit
  // conversation keeps applying the staffing consequences at its own point in
  // the story (see postAuditInteraction), exactly as before this feature.
  return noEffects(ctx)
}

export function resolveDeveloperAdminAccessChoice(ctx: StoryDecisionEffectContext): StoryDecisionEffectResult {
  return noEffects(ctx)
}

export function resolveFrontendTestDataChoice(ctx: StoryDecisionEffectContext): StoryDecisionEffectResult {
  return noEffects(ctx)
}

export function resolveSecurityPriorityChoice(ctx: StoryDecisionEffectContext): StoryDecisionEffectResult {
  return noEffects(ctx)
}

export function resolveBackupStrategyChoice(ctx: StoryDecisionEffectContext): StoryDecisionEffectResult {
  return noEffects(ctx)
}

export function resolveArchitectureBoundaryChoice(ctx: StoryDecisionEffectContext): StoryDecisionEffectResult {
  return noEffects(ctx)
}

export function resolveSuspiciousActivityDisclosureChoice(ctx: StoryDecisionEffectContext): StoryDecisionEffectResult {
  return noEffects(ctx)
}

export function resolveReleaseRiskChoice(ctx: StoryDecisionEffectContext): StoryDecisionEffectResult {
  return noEffects(ctx)
}

const HANDLERS: Record<Level1StoryDecisionId, (ctx: StoryDecisionEffectContext) => StoryDecisionEffectResult> = {
  'security-baseline-path': resolveSecurityBaselineChoice,
  'developer-admin-access': resolveDeveloperAdminAccessChoice,
  'frontend-test-data': resolveFrontendTestDataChoice,
  'security-first-priority': resolveSecurityPriorityChoice,
  'backup-and-restore-strategy': resolveBackupStrategyChoice,
  'architecture-boundary': resolveArchitectureBoundaryChoice,
  'suspicious-activity-disclosure': resolveSuspiciousActivityDisclosureChoice,
  'release-risk-decision': resolveReleaseRiskChoice,
}

// Applies (or safely re-applies) the effects of a recorded choice. Migrated
// records are never touched - their consequences already exist in the save.
export function applyStoryDecisionEffects(record: StoryDecisionRecord, moment: StoryMoment): StoryDecisionEffectResult {
  const choiceId = record.selectedChoiceId
  if (!choiceId) throw new Error(`story decision ${record.decisionId} has no selected choice`)
  const operationId = storyDecisionOperationId(record.decisionId, choiceId)
  if (record.migratedFromLegacy) return { operationId, effectsChanged: false }
  return HANDLERS[record.decisionId]({
    decisionId: record.decisionId,
    choiceId,
    operationId,
    moment,
    migratedFromLegacy: false,
  })
}
