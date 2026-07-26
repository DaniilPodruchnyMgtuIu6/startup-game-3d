import { useEconomyStore } from '../economyStore'
import { useRiskStore } from '../riskStore'
import { useGameStore } from '../gameStore'
import { useProductStore } from '../productStore'
import { useTeamStore } from '../teamStore'
import { useServerIncidentStore } from '../serverIncidentStore'
import { useSecurityAuditStore } from '../securityAuditStore'
import { HIRE_SECURITY_TASK } from '../securityStoryStore'
import { hasSecuritySpecialist } from '../teamRules'
import { createStoryDecisionTransaction } from '../economyRules'
import { getDetectedRiskLevel } from '../riskRules'
import { RISK_DOMAINS, type RiskDomain } from '../riskCatalog'
import { toWorkdayIndex } from '../workdayIndex'
import { STORY_BALANCE } from '../balance/storyBalance'
import type { StoryMoment } from '../securityStoryRules'
import type { BoardTask } from '../tasks'
import { storyDecisionOperationId, type StoryDecisionRecord } from './storyDecisionRules'
import type { Level1StoryDecisionId } from './level1Timeline'
import { useStoryWorkStore } from './storyWorkStore'
import { storyChoiceSignals, dismissedWarningDomainSignal, hardeningMitigationSignals } from './storyRiskSignals'
import { BASELINE_AUDIT_RESULT_TASK, ensureInternalReviewStarted } from './storyFollowUps'
import { HARDENING_TASK_ID } from './level1Checkpoints'

// Explicit effect handlers - one per fixed decision (Feature 17B §9: effects
// apply through exactly one handler). Idempotency: every money/task/signal/
// assignment id embeds the operation id `story-decision:{decisionId}:{choiceId}`,
// so a repeated or partially-failed resolve safely completes the missing side
// effects without duplicating the applied ones. All numbers from storyBalance.

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
  effectsChanged: boolean
}

const B = STORY_BALANCE

const SEPARATE_BOUNDARIES_TASK: BoardTask = {
  id: 'separate-security-boundaries-work',
  text: 'Разделить доступы и границы системы OfficeFlow',
  done: false,
}

function addTaskOnce(task: BoardTask): boolean {
  const game = useGameStore.getState()
  if (game.tasks.some((t) => t.id === task.id)) return false
  game.addTask({ ...task })
  return true
}

function charge(ctx: StoryDecisionEffectContext, category: 'security-audit' | 'story-decision' | 'security-investment', title: string, amount: number, id?: string): boolean {
  return useEconomyStore
    .getState()
    .applyOneTimeExpense(createStoryDecisionTransaction(id ?? ctx.operationId, category, title, amount, ctx.moment.sprintNumber, ctx.moment.day))
    .applied
}

function occupy(ctx: StoryDecisionEffectContext, employeeId: string, days: number, title: string): boolean {
  return useStoryWorkStore.getState().addAssignmentOnce({ id: `${ctx.operationId}:${employeeId}`, employeeId, title, remainingDays: days }).added
}

function addChoiceSignals(ctx: StoryDecisionEffectContext): boolean {
  const momentWithIndex = { ...ctx.moment, workdayIndex: toWorkdayIndex(ctx.moment.sprintNumber, ctx.moment.day) }
  return useRiskStore.getState().addSignalsOnce(storyChoiceSignals(ctx.decisionId, ctx.choiceId, momentWithIndex)).added.length > 0
}

function riskMomentOf(ctx: StoryDecisionEffectContext) {
  return { ...ctx.moment, workdayIndex: toWorkdayIndex(ctx.moment.sprintNumber, ctx.moment.day) }
}

// --- 1. security-baseline-path ----------------------------------------------

export function resolveSecurityBaselineChoice(ctx: StoryDecisionEffectContext): StoryDecisionEffectResult {
  let changed = addChoiceSignals(ctx)
  if (ctx.choiceId === 'commission-security-audit') {
    changed = charge(ctx, 'security-audit', 'Формальный аудит безопасности офиса', B.baselineAudit.costRub, 'story:baseline-security-audit') || changed
    changed = addTaskOnce(BASELINE_AUDIT_RESULT_TASK) || changed
  } else {
    // hire-first: the hire task appears now; the review itself starts on the
    // real hire (storyFollowUps), the deadline is enforced day by day.
    changed = addTaskOnce({ ...HIRE_SECURITY_TASK }) || changed
    ensureInternalReviewStarted()
  }
  return { operationId: ctx.operationId, effectsChanged: changed }
}

// --- 2. developer-admin-access ----------------------------------------------

export function resolveDeveloperAdminAccessChoice(ctx: StoryDecisionEffectContext): StoryDecisionEffectResult {
  let changed = addChoiceSignals(ctx)
  if (ctx.choiceId === 'use-just-in-time-access') {
    changed = occupy(ctx, 'kirill-morozov', B.adminAccess.jitProductDaysLost, 'Настройка временных доступов по задачам') || changed
  }
  if (ctx.choiceId === 'configure-controlled-access') {
    changed = charge(ctx, 'security-investment', 'Контролируемое повышение прав доступа', B.adminAccess.controlledCostRub) || changed
    changed = occupy(ctx, 'ilya-vlasov', B.adminAccess.controlledIlyaEffortDays, 'Настройка контролируемого повышения прав') || changed
  }
  return { operationId: ctx.operationId, effectsChanged: changed }
}

// --- 3. frontend-test-data ---------------------------------------------------

export function resolveFrontendTestDataChoice(ctx: StoryDecisionEffectContext): StoryDecisionEffectResult {
  let changed = addChoiceSignals(ctx)
  if (ctx.choiceId === 'create-synthetic-data') {
    changed = charge(ctx, 'story-decision', 'Подготовка синтетических тестовых данных', B.testData.syntheticCostRub) || changed
    changed = occupy(ctx, 'alina-belova', B.testData.syntheticAlinaDaysLost, 'Создание синтетических тестовых данных') || changed
  }
  if (ctx.choiceId === 'mask-data-with-security') {
    changed = charge(ctx, 'security-investment', 'Маскирование тестовой копии данных', B.testData.maskedCostRub) || changed
    changed = occupy(ctx, 'ilya-vlasov', B.testData.maskedIlyaEffortDays, 'Маскирование тестовых данных') || changed
  }
  return { operationId: ctx.operationId, effectsChanged: changed }
}

// --- 4. security-first-priority ----------------------------------------------

export function resolveSecurityPriorityChoice(ctx: StoryDecisionEffectContext): StoryDecisionEffectResult {
  let changed = addChoiceSignals(ctx)
  if (ctx.choiceId === 'prioritize-endpoint-protection') {
    changed = charge(ctx, 'security-investment', 'Защита рабочих станций', B.firstPriority.endpointCostRub) || changed
    changed = occupy(ctx, 'ilya-vlasov', B.firstPriority.endpointIlyaEffortDays, 'Внедрение защиты рабочих станций') || changed
  }
  if (ctx.choiceId === 'prioritize-central-logging') {
    changed = charge(ctx, 'security-investment', 'Централизованные журналы событий', B.firstPriority.loggingCostRub) || changed
    changed = occupy(ctx, 'ilya-vlasov', B.firstPriority.loggingIlyaEffortDays, 'Настройка центральных журналов') || changed
  }
  if (ctx.choiceId === 'prioritize-security-training') {
    changed = charge(ctx, 'story-decision', 'Обучение сотрудников основам безопасности', B.firstPriority.trainingCostRub) || changed
    changed = occupy(ctx, 'ilya-vlasov', B.firstPriority.trainingIlyaEffortDays, 'Подготовка и проведение обучения') || changed
    changed = occupy(ctx, 'sonya-sokolova', B.firstPriority.trainingSonyaEffortDays, 'Организация обучения сотрудников') || changed
  }
  return { operationId: ctx.operationId, effectsChanged: changed }
}

// --- 5. backup-and-restore-strategy ------------------------------------------

export function resolveBackupStrategyChoice(ctx: StoryDecisionEffectContext): StoryDecisionEffectResult {
  let changed = addChoiceSignals(ctx)
  if (ctx.choiceId === 'run-full-restore-drill') {
    changed = charge(ctx, 'story-decision', 'Полная проверка восстановления из копии', B.backupRestore.fullDrillCostRub) || changed
    changed = occupy(ctx, 'kirill-morozov', B.backupRestore.fullDrillEffortDays, 'Полное восстановление проекта из копии') || changed
  }
  if (ctx.choiceId === 'configure-backups-only') {
    changed = charge(ctx, 'story-decision', 'Настройка расписания резервных копий', B.backupRestore.configureOnlyCostRub) || changed
    changed = occupy(ctx, 'kirill-morozov', B.backupRestore.configureOnlyEffortDays, 'Настройка резервного копирования') || changed
  }
  // postpone: no money and no time now - the risk signal and the delayed
  // warning (storyFollowUps) carry the consequence.
  return { operationId: ctx.operationId, effectsChanged: changed }
}

// --- 6. architecture-boundary ------------------------------------------------

export function resolveArchitectureBoundaryChoice(ctx: StoryDecisionEffectContext): StoryDecisionEffectResult {
  let changed = addChoiceSignals(ctx)
  if (ctx.choiceId === 'keep-shared-architecture') {
    changed = useProductStore.getState().applyStoryEffortReduction('kirill-morozov', B.architecture.sharedBackendEffortReductionDays).reducedDays > 0 || changed
  }
  if (ctx.choiceId === 'separate-security-boundaries') {
    changed = occupy(ctx, 'kirill-morozov', B.architecture.separateBackendExtraDays, 'Разделение доступов и границ системы') || changed
    changed = addTaskOnce(SEPARATE_BOUNDARIES_TASK) || changed
  }
  if (ctx.choiceId === 'request-architecture-review') {
    changed = charge(ctx, 'story-decision', 'Внешнее архитектурное review', B.architecture.reviewCostRub) || changed
    changed = occupy(ctx, 'kirill-morozov', B.architecture.reviewDelayWorkdays, 'Работа с внешним архитектурным review') || changed
  }
  return { operationId: ctx.operationId, effectsChanged: changed }
}

// --- 7. suspicious-activity-disclosure ---------------------------------------

export function resolveSuspiciousActivityDisclosureChoice(ctx: StoryDecisionEffectContext): StoryDecisionEffectResult {
  let changed = addChoiceSignals(ctx)
  const ilyaHired = hasSecuritySpecialist(useTeamStore.getState().hires)
  if (ctx.choiceId === 'report-activity-immediately') {
    changed = charge(ctx, 'story-decision', 'Официальная проверка подозрительной активности', B.disclosure.reportCostRub) || changed
    changed = occupy(ctx, 'kirill-morozov', B.disclosure.reportLimitedWorkdays, 'Ограниченная работа на время официальной проверки') || changed
    useSecurityAuditStore.getState().clearLeadershipComplaint()
  }
  if (ctx.choiceId === 'investigate-quietly') {
    const investigator = ilyaHired ? 'ilya-vlasov' : 'kirill-morozov'
    changed = occupy(ctx, investigator, B.disclosure.investigateEffortDays, 'Тихое расследование подозрительной активности') || changed
  }
  if (ctx.choiceId === 'dismiss-as-false-positive') {
    const domain = dismissedDomain()
    changed = useRiskStore.getState().addSignalsOnce(dismissedWarningDomainSignal(domain, riskMomentOf(ctx))).added.length > 0 || changed
  }
  return { operationId: ctx.operationId, effectsChanged: changed }
}

// Which domain the dismissed warning belonged to: an armed AUTH threat (or a
// critical identity risk) points at identity-access, otherwise sensitive-data.
function dismissedDomain(): RiskDomain {
  const incidents = useServerIncidentStore.getState().incidents
  const signals = useRiskStore.getState().signals
  const authArmed = incidents['auth-account-incident']?.status === 'armed'
  const identityCritical = getDetectedRiskLevel(signals, 'identity-access') === 'critical'
  return authArmed || identityCritical ? 'identity-access' : 'sensitive-data'
}

// --- 8. release-risk-decision ------------------------------------------------

export function resolveReleaseRiskChoice(ctx: StoryDecisionEffectContext): StoryDecisionEffectResult {
  let changed = addChoiceSignals(ctx)
  if (ctx.choiceId === 'delay-for-hardening') {
    const signals = useRiskStore.getState().signals
    const domains = RISK_DOMAINS.filter((d) => {
      const level = getDetectedRiskLevel(signals, d)
      return level === 'high' || level === 'critical'
    })
    changed = useRiskStore.getState().addSignalsOnce(hardeningMitigationSignals(domains, riskMomentOf(ctx))).added.length > 0 || changed
    // 17C §12: the hardening work is visible - a task plus a real assignment
    // for the best available employee; daily costs keep running as usual.
    changed = addTaskOnce({ id: HARDENING_TASK_ID, text: 'Завершить укрепление системы перед выпуском', done: false }) || changed
    const worker = hasSecuritySpecialist(useTeamStore.getState().hires) ? 'ilya-vlasov' : 'kirill-morozov'
    changed = occupy(ctx, worker, B.release.hardeningDelayWorkdays, 'Укрепление системы перед выпуском') || changed
  }
  // known-risk and hide-open-risk act through the score/readiness selectors.
  return { operationId: ctx.operationId, effectsChanged: changed }
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
