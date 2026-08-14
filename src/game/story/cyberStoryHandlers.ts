import { useEconomyStore } from '../economyStore'
import { useRiskStore } from '../riskStore'
import { useTeamStore } from '../teamStore'
import { hasSecuritySpecialist } from '../teamRules'
import { useStoryDecisionStore } from './storyDecisionStore'
import { createStoryDecisionTransaction } from '../economyRules'
import { toWorkdayIndex } from '../workdayIndex'
import { CYBER_STORY_BALANCE } from '../balance/cyberStoryBalance'
import type { StoryMoment } from '../securityStoryRules'
import { useStoryWorkStore } from './storyWorkStore'
import { cyberStoryChoiceSignals } from './cyberStoryRiskSignals'
import {
  cyberStoryOperationId,
  type CyberConsequenceId,
  type CyberStoryChoiceId,
  type CyberStoryFlags,
  type CyberStoryIncidentId,
  type CyberStoryRecord,
} from './cyberStoryTypes'
import { ADDITIONAL_CYBER_STORY_BALANCE } from '../balance/additionalCyberStoryBalance'
import { useProductStore } from '../productStore'
import { applyCentralLoggingDetectionSpeedup, hasSecureLogMasking, hasStrongPhishingDefense } from './cyberStoryLinkedEffects'

// Explicit effect handlers - one per fixed cyber incident (mirrors
// storyDecisionHandlers.ts). A handler never writes back into cyberStoryStore
// directly (that would create a store <-> handlers import cycle); instead it
// RETURNS what the store should persist (flags, a consequence to schedule),
// and cyberStoryStore.resolveIncident applies that after recording the choice.
// Idempotency: every money/work/signal id embeds the operation id
// `cyber-story:{incidentId}:{choiceId}`, so a repeated or partially-failed
// resolve safely completes the missing side effects without duplicating.

// CyberStoryFlags/initialCyberStoryFlags live in cyberStoryTypes.ts (a leaf
// module) so cyberStoryLinkedEffects.ts can depend on the type without
// creating a handlers -> linkedEffects -> store -> handlers import cycle.

export interface CyberStoryEffectContext {
  incidentId: CyberStoryIncidentId
  choiceId: CyberStoryChoiceId
  operationId: string
  moment: StoryMoment
  // The store's flags AT THE START of this resolve call - read-only context
  // for cross-scene links (cyberStoryLinkedEffects.ts), never mutated here.
  currentFlags: CyberStoryFlags
}

export interface CyberStoryEffectResult {
  operationId: string
  effectsChanged: boolean
  flagsToSet?: Partial<CyberStoryFlags>
  scheduleConsequence?: { id: CyberConsequenceId; delayWorkdays: number }
}

const B = CYBER_STORY_BALANCE

function riskMomentOf(ctx: CyberStoryEffectContext) {
  return { ...ctx.moment, workdayIndex: toWorkdayIndex(ctx.moment.sprintNumber, ctx.moment.day) }
}

function charge(ctx: CyberStoryEffectContext, title: string, amount: number): boolean {
  return useEconomyStore.getState().applyOneTimeExpense(createStoryDecisionTransaction(ctx.operationId, 'story-decision', title, amount, ctx.moment.sprintNumber, ctx.moment.day)).applied
}

function occupy(ctx: CyberStoryEffectContext, employeeId: string, days: number, title: string): boolean {
  return useStoryWorkStore.getState().addAssignmentOnce({ id: `${ctx.operationId}:${employeeId}`, employeeId, title, remainingDays: days }).added
}

// security-first-priority resolved with the training choice already teaches
// the team to double-check urgent, no-call requests through a known channel.
function securityTrainingCompleted(): boolean {
  const record = useStoryDecisionStore.getState().decisions['security-first-priority']
  return record.status === 'resolved' && record.selectedChoiceId === 'prioritize-security-training'
}

function addChoiceSignals(ctx: CyberStoryEffectContext, opts: Parameters<typeof cyberStoryChoiceSignals>[3] = {}): boolean {
  return useRiskStore.getState().addSignalsOnce(cyberStoryChoiceSignals(ctx.incidentId, ctx.choiceId, riskMomentOf(ctx), opts)).added.length > 0
}

// --- 1. executive-phishing-request ---------------------------------------------

function resolveExecutivePhishingChoice(ctx: CyberStoryEffectContext): CyberStoryEffectResult {
  const bal = B.executivePhishing
  const trained = securityTrainingCompleted()
  const trainingSuppressed = ctx.choiceId === 'send-requested-data' && trained
  let changed = addChoiceSignals(ctx, { trainingSuppressed })
  let flagsToSet: Partial<CyberStoryFlags> | undefined
  let scheduleConsequence: CyberStoryEffectResult['scheduleConsequence']

  if (ctx.choiceId === 'send-requested-data') {
    // A well-trained team catches the fake domain before real exposure - no
    // flag, no delayed follow-up, no future AUTH cost modifier when trained.
    if (!trained) {
      flagsToSet = { phishingInformationExposed: true }
      scheduleConsequence = { id: 'phishing-targeted-followup', delayWorkdays: bal.followUpDelayWorkdays }
    }
  }
  if (ctx.choiceId === 'verify-through-known-channel') {
    changed = occupy(ctx, 'sonya-sokolova', bal.verificationEffortDays, 'Проверка срочного запроса известным каналом') || changed
    flagsToSet = { phishingVerifiedAndRejected: true }
  }
  if (ctx.choiceId === 'escalate-phishing-to-security') {
    changed = charge(ctx, 'Блокировка фишингового домена и защита почты', bal.securityEscalationCostRub) || changed
    changed = occupy(ctx, 'ilya-vlasov', bal.securityEscalationEffortDays, 'Блокировка домена и разбор фишингового письма с командой') || changed
    flagsToSet = { phishingEscalatedToSecurity: true }
  }
  return { operationId: ctx.operationId, effectsChanged: changed, flagsToSet, scheduleConsequence }
}

// --- 2. supply-chain-update ------------------------------------------------

function resolveSupplyChainChoice(ctx: CyberStoryEffectContext): CyberStoryEffectResult {
  const bal = B.supplyChainUpdate
  let changed = addChoiceSignals(ctx)
  let flagsToSet: Partial<CyberStoryFlags> | undefined
  let scheduleConsequence: CyberStoryEffectResult['scheduleConsequence']

  if (ctx.choiceId === 'install-update-immediately') {
    flagsToSet = { supplyChainUpdateInstalled: true }
    scheduleConsequence = { id: 'supply-chain-unknown-connection', delayWorkdays: bal.unknownConnectionDelayWorkdays }
  }
  // keep-current-version: no cost, no time now - the demo-penalty signal
  // above (delivery-pressure) already carries the trade-off.
  if (ctx.choiceId === 'review-and-pin-dependency') {
    changed = charge(ctx, 'Проверка происхождения обновления и фиксация версии', bal.reviewCostRub) || changed
    changed = occupy(ctx, 'kirill-morozov', bal.reviewEffortDays, 'Проверка обновления библиотеки авторизации') || changed
    flagsToSet = { supplyChainReviewedAndPinned: true }
  }
  return { operationId: ctx.operationId, effectsChanged: changed, flagsToSet, scheduleConsequence }
}

// --- 3. shadow-it-log-upload -------------------------------------------------

function resolveShadowItChoice(ctx: CyberStoryEffectContext): CyberStoryEffectResult {
  const bal = B.shadowItLogs
  let changed = addChoiceSignals(ctx)
  let flagsToSet: Partial<CyberStoryFlags> | undefined
  let scheduleConsequence: CyberStoryEffectResult['scheduleConsequence']

  if (ctx.choiceId === 'upload-raw-logs-to-personal-cloud') {
    flagsToSet = { rawLogsExternallyShared: true }
    scheduleConsequence = { id: 'shadow-it-external-download', delayWorkdays: bal.externalDownloadDelayWorkdays }
  }
  if (ctx.choiceId === 'sanitize-logs-manually') {
    changed = occupy(ctx, 'kirill-morozov', bal.manualSanitizationEffortDays, 'Ручная очистка логов от чувствительных данных') || changed
    flagsToSet = { logsManuallySanitized: true }
  }
  if (ctx.choiceId === 'configure-secure-log-sharing') {
    changed = charge(ctx, 'Настройка защищённого канала передачи логов', bal.secureSharingCostRub) || changed
    changed = occupy(ctx, 'kirill-morozov', bal.secureSharingKirillEffortDays, 'Настройка защищённого канала передачи логов') || changed
    if (hasSecuritySpecialist(useTeamStore.getState().hires)) {
      changed = occupy(ctx, 'ilya-vlasov', bal.secureSharingIlyaEffortDays, 'Настройка автоматического маскирования логов') || changed
    }
    flagsToSet = { secureLogSharingConfigured: true }
  }
  return { operationId: ctx.operationId, effectsChanged: changed, flagsToSet, scheduleConsequence }
}

// --- 4. secret-committed-to-repository ---------------------------------------

const AB = ADDITIONAL_CYBER_STORY_BALANCE

function resolveSecretChoice(ctx: CyberStoryEffectContext): CyberStoryEffectResult {
  const bal = AB.repositorySecret
  let changed = addChoiceSignals(ctx)
  let flagsToSet: Partial<CyberStoryFlags> | undefined
  let scheduleConsequence: CyberStoryEffectResult['scheduleConsequence']

  if (ctx.choiceId === 'remove-secret-in-new-commit') {
    // Deleting the line in a new commit does NOT delete it from git history -
    // the key must be treated as potentially exposed either way.
    flagsToSet = { credentialExposureState: 'history-retained' }
    // §"связь с Feature 19A": central logging (security-first-priority)
    // already shortens every risk signal's detection delay - it shortens this
    // consequence's due-day the same way, so an old credential's external use
    // is noticed sooner.
    scheduleConsequence = { id: 'external-credential-usage', delayWorkdays: applyCentralLoggingDetectionSpeedup(bal.exposedUseDelayWorkdaysAfterRemove) }
  }
  if (ctx.choiceId === 'rewrite-repository-history') {
    changed = occupy(ctx, 'kirill-morozov', bal.rewriteKirillEffortDays, 'Переписывание истории репозитория') || changed
    changed = occupy(ctx, 'alina-belova', bal.rewriteAlinaEffortDays, 'Повторная синхронизация после переписывания истории') || changed
    // Reduced, not zero: a rewrite lowers the chance of casual re-exposure
    // but the key may already live in a fork/cache/local clone.
    flagsToSet = { credentialExposureState: 'reduced' }
    scheduleConsequence = { id: 'credential-found-in-ci-cache', delayWorkdays: applyCentralLoggingDetectionSpeedup(bal.exposedUseDelayWorkdaysAfterRewrite) }
  }
  if (ctx.choiceId === 'rotate-and-secure-secret') {
    changed = charge(ctx, 'Отзыв ключа и перенос секрета в защищённое хранилище', bal.rotationAndVaultCostRub) || changed
    // Kirill is occupied at most ONCE per branch (addAssignmentOnce dedups by
    // `${operationId}:${employeeId}`) - the without-Ilya extra day is folded
    // into the same assignment instead of a second occupy() call that would
    // silently collide with the first and be dropped.
    const ilyaAvailable = hasSecuritySpecialist(useTeamStore.getState().hires)
    const kirillDays = bal.rotationKirillEffortDays + (ilyaAvailable ? 0 : bal.rotationWithoutIlyaExtraDays)
    const kirillTitle = ilyaAvailable ? 'Переподключение интеграции с новым ключом' : 'Переподключение интеграции и самостоятельная настройка secret scanning'
    changed = occupy(ctx, 'kirill-morozov', kirillDays, kirillTitle) || changed
    if (ilyaAvailable) {
      changed = occupy(ctx, 'ilya-vlasov', bal.rotationIlyaEffortDays, 'Настройка secrets management и secret scanning') || changed
    }
    // A real rotation actually revokes the old key - no consequence to schedule.
    flagsToSet = { credentialExposureState: 'rotated' }
  }
  return { operationId: ctx.operationId, effectsChanged: changed, flagsToSet, scheduleConsequence }
}

// --- 5. mfa-fatigue-attack ----------------------------------------------------

function resolveMfaFatigueChoice(ctx: CyberStoryEffectContext): CyberStoryEffectResult {
  const bal = AB.mfaFatigue
  // §"связь с Feature 19A": a strong prior phishing defence plays this scene
  // as a weaker attempt - the identity-access impact of doing the least
  // (change-password-only) is reduced, not the scene itself skipped.
  const defended = hasStrongPhishingDefense(ctx.currentFlags)
  const passwordOnlyImpact = defended ? Math.round(bal.passwordOnlyIdentityAccessImpact / 2) : bal.passwordOnlyIdentityAccessImpact
  let changed = addChoiceSignals(ctx, { impactOverrides: { 'identity-access': passwordOnlyImpact } })
  let flagsToSet: Partial<CyberStoryFlags> | undefined
  let scheduleConsequence: CyberStoryEffectResult['scheduleConsequence']

  if (ctx.choiceId === 'change-password-only') {
    changed = occupy(ctx, 'kirill-morozov', bal.passwordChangeKirillEffortDays, 'Смена пароля после ночных MFA-запросов') || changed
    // A new password never revokes an ALREADY active session by itself.
    flagsToSet = { unknownSessionState: 'active' }
    scheduleConsequence = { id: 'hijacked-session-activity', delayWorkdays: bal.hijackedSessionDelayWorkdays }
  }
  if (ctx.choiceId === 'revoke-sessions-and-investigate') {
    changed = charge(ctx, 'Расследование неизвестной активной сессии', bal.investigationCostRub) || changed
    changed = occupy(ctx, 'kirill-morozov', bal.investigationKirillEffortDays, 'Отзыв сессий и проверка изменений') || changed
    if (hasSecuritySpecialist(useTeamStore.getState().hires)) {
      changed = occupy(ctx, 'ilya-vlasov', bal.investigationIlyaEffortDays, 'Расследование неизвестной сессии') || changed
    } else {
      changed = occupy(ctx, 'sonya-sokolova', bal.investigationWithoutIlyaSonyaEffortDays, 'Координация расследования без штатного специалиста') || changed
    }
    flagsToSet = { unknownSessionState: 'revoked' }
  }
  if (ctx.choiceId === 'enable-phishing-resistant-auth') {
    changed = charge(ctx, 'Внедрение устойчивой к фишингу аутентификации', bal.phishingResistantAuthCostRub) || changed
    const effortDays = hasSecuritySpecialist(useTeamStore.getState().hires)
      ? bal.phishingResistantAuthEffortDays
      : bal.phishingResistantAuthEffortDays + bal.phishingResistantAuthWithoutIlyaExtraDays
    changed = occupy(ctx, 'kirill-morozov', effortDays, 'Настройка phishing-resistant аутентификации') || changed
    // The strongest choice also revokes the current unknown session.
    flagsToSet = { unknownSessionState: 'revoked' }
  }
  return { operationId: ctx.operationId, effectsChanged: changed, flagsToSet, scheduleConsequence }
}

// --- 6. external-ai-data-disclosure ------------------------------------------

function resolveExternalAiChoice(ctx: CyberStoryEffectContext): CyberStoryEffectResult {
  const bal = AB.externalAi
  // §"связь с Feature 19A": logs already masked by shadow-it-log-upload's
  // secure-sharing choice carry less real sensitive-data risk in a prompt.
  const masked = hasSecureLogMasking(ctx.currentFlags)
  const unrestrictedImpact = masked ? Math.max(1, bal.unrestrictedSensitiveDataImpact - 2) : bal.unrestrictedSensitiveDataImpact
  let changed = addChoiceSignals(ctx, { impactOverrides: { 'sensitive-data': unrestrictedImpact } })
  let flagsToSet: Partial<CyberStoryFlags> | undefined
  let scheduleConsequence: CyberStoryEffectResult['scheduleConsequence']

  if (ctx.choiceId === 'allow-unrestricted-ai-tools') {
    // Bounded, ONE-TIME acceleration (days * uses) via the SAME use-case
    // Feature 17B's keep-shared-architecture already uses - never an
    // open-ended buff, never re-applied (applyStoryEffortReduction only
    // moves existing task progress forward once, capped by remaining effort).
    useProductStore.getState().applyStoryEffortReduction('alina-belova', bal.unrestrictedAccelerationDays * bal.unrestrictedAccelerationUses)
    flagsToSet = { shadowAiPolicy: 'unrestricted' }
    scheduleConsequence = { id: 'unrestricted-ai-recurrence', delayWorkdays: bal.unrestrictedRecurrenceDelayWorkdays }
  }
  if (ctx.choiceId === 'ban-external-ai-tools') {
    // Bounded, one-time friction cost - banAffectedTaskCount documents WHICH
    // tasks feel it (flavour/reporting only), not a second per-task multiplier.
    changed = occupy(ctx, 'alina-belova', bal.banExtraEffortDays, 'Адаптация процесса без внешних AI-инструментов') || changed
    flagsToSet = { shadowAiPolicy: 'banned' }
    scheduleConsequence = { id: 'shadow-ai-personal-use', delayWorkdays: bal.shadowUseDelayWorkdaysAfterBan }
  }
  if (ctx.choiceId === 'configure-controlled-ai-gateway') {
    changed = charge(ctx, 'Настройка контролируемого AI gateway', bal.controlledGatewayCostRub) || changed
    // Same dedup-by-id reason as resolveSecretChoice's rotation branch above -
    // fold the without-Ilya extra day into Kirill's single assignment.
    const ilyaAvailable = hasSecuritySpecialist(useTeamStore.getState().hires)
    const kirillDays = bal.controlledGatewayKirillEffortDays + (ilyaAvailable ? 0 : bal.controlledGatewayWithoutIlyaExtraDays)
    const kirillTitle = ilyaAvailable ? 'Интеграция контролируемого AI gateway' : 'Интеграция AI gateway и самостоятельная настройка правил маскирования'
    changed = occupy(ctx, 'kirill-morozov', kirillDays, kirillTitle) || changed
    if (ilyaAvailable) {
      changed = occupy(ctx, 'ilya-vlasov', bal.controlledGatewayIlyaEffortDays, 'Правила маскирования и allowlist моделей') || changed
    }
    flagsToSet = { shadowAiPolicy: 'controlled-gateway' }
  }
  return { operationId: ctx.operationId, effectsChanged: changed, flagsToSet, scheduleConsequence }
}

const HANDLERS: Record<CyberStoryIncidentId, (ctx: CyberStoryEffectContext) => CyberStoryEffectResult> = {
  'executive-phishing-request': resolveExecutivePhishingChoice,
  'supply-chain-update': resolveSupplyChainChoice,
  'shadow-it-log-upload': resolveShadowItChoice,
  'secret-committed-to-repository': resolveSecretChoice,
  'mfa-fatigue-attack': resolveMfaFatigueChoice,
  'external-ai-data-disclosure': resolveExternalAiChoice,
}

// Applies (or safely re-applies) the effects of a recorded choice.
export function applyCyberStoryChoiceEffects(record: CyberStoryRecord, moment: StoryMoment, currentFlags: CyberStoryFlags): CyberStoryEffectResult {
  const choiceId = record.selectedChoiceId
  if (!choiceId) throw new Error(`cyber story incident ${record.incidentId} has no selected choice`)
  const operationId = cyberStoryOperationId(record.incidentId, choiceId)
  return HANDLERS[record.incidentId]({ incidentId: record.incidentId, choiceId, operationId, moment, currentFlags })
}
