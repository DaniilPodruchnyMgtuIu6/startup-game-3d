import type { DialogueLine } from '../gameStore'
import { useEconomyStore } from '../economyStore'
import { useRiskStore } from '../riskStore'
import { createStoryDecisionTransaction } from '../economyRules'
import { toWorkdayIndex } from '../workdayIndex'
import { CYBER_STORY_BALANCE } from '../balance/cyberStoryBalance'
import { ADDITIONAL_CYBER_STORY_BALANCE } from '../balance/additionalCyberStoryBalance'
import type { StoryMoment } from '../securityStoryRules'
import { femalePm } from '../../character/characters/femalePm'
import { kirillMorozov } from '../../character/characters/kirillMorozov'
import { alinaBelova } from '../../character/characters/alinaBelova'
import { ilyaVlasov } from '../../character/characters/ilyaVlasov'
import { hasSecuritySpecialist } from '../teamRules'
import { useTeamStore } from '../teamStore'
import { useCyberStoryStore } from './cyberStoryStore'
import { cyberConsequenceSignal } from './cyberStoryRiskSignals'
import type { CyberConsequenceId } from './cyberStoryTypes'

// Feature 19: the one-shot delayed consequence of each cyber incident's risky
// (variant A) choice. Fires once its scheduled due-workday arrives (see
// cyberStoryStore's evaluateCyberStoryConsequences, called once per completed
// day from completeWorkday.ts) and applies its effects idempotently, mirroring
// storyConsequences.ts's checkpoint pattern at a smaller scale (one hook per
// incident, no checkpoint chain).

type Cue = DialogueLine['cue']
const sonya = (text: string, cue?: Cue): DialogueLine => ({ speaker: femalePm.persona!.name, speakerRole: femalePm.persona!.role, portrait: femalePm.portraitWorried ?? femalePm.portrait, text, cue })
const kirill = (text: string, cue?: Cue): DialogueLine => ({ speaker: kirillMorozov.persona!.name, speakerRole: kirillMorozov.persona!.role, portrait: kirillMorozov.portrait, text, cue })
const alina = (text: string, cue?: Cue): DialogueLine => ({ speaker: alinaBelova.persona!.name, speakerRole: alinaBelova.persona!.role, portrait: alinaBelova.portrait, text, cue })
const ilya = (text: string, cue?: Cue): DialogueLine => ({ speaker: ilyaVlasov.persona!.name, speakerRole: ilyaVlasov.persona!.role, portrait: ilyaVlasov.portrait, text, cue })

function ilyaHired(): boolean {
  return hasSecuritySpecialist(useTeamStore.getState().hires)
}

export interface CyberConsequenceScript {
  lines: DialogueLine[]
}

export function buildCyberConsequenceScript(id: CyberConsequenceId): CyberConsequenceScript {
  const hired = ilyaHired()
  switch (id) {
    case 'phishing-targeted-followup':
      return {
        lines: [
          kirill('Мне пришло письмо, адресованное лично мне — с точным именем моей должности и структурой команды.', { speakerEmotion: 'surprised' }),
          kirill('Неизвестный адрес использовал сведения, которые мы раньше отправили без проверки.', { speakerEmotion: 'concerned' }),
          hired
            ? ilya('Заблокирую этот адрес тоже и добавлю его в тот же список.', { speakerEmotion: 'focused' })
            : sonya('Больше никаких срочных запросов без проверки известным каналом.', { speakerEmotion: 'concerned' }),
        ],
      }
    case 'supply-chain-unknown-connection':
      return {
        lines: [
          kirill('С сервера идёт соединение, которое я не заказывал.', { speakerEmotion: 'surprised' }),
          kirill('Оно появилось после того обновления, которое мы поставили без review.', { speakerEmotion: 'concerned' }),
          hired
            ? ilya('Похоже на тестовый токен, а не боевой ключ. Но соединение нужно закрыть и пересобрать зависимость.', { speakerEmotion: 'focused' })
            : kirill('Закрою соединение и пересоберу зависимость с нуля.', { speakerEmotion: 'focused' }),
        ],
      }
    case 'shadow-it-external-download':
      return {
        lines: [
          kirill('Ссылка на архив логов открывалась ночью — не нами.', { speakerEmotion: 'surprised' }),
          kirill('Судя по всему, файл успели скачать ещё раз, пока ссылка была активна.', { speakerEmotion: 'concerned' }),
          hired
            ? ilya('Отзову тестовые сессии из архива и подготовлю список затронутых данных для отчёта.', { speakerEmotion: 'focused' })
            : sonya('Придётся честно зафиксировать это в отчёте по безопасности.', { speakerEmotion: 'concerned' }),
        ],
      }
    case 'external-credential-usage':
      return {
        lines: [
          kirill('В журналах внешней интеграции — ночной всплеск запросов с незнакомого адреса.', { speakerEmotion: 'surprised' }),
          kirill('Это тот самый ключ, который мы удалили новым коммитом. В истории он остался.', { speakerEmotion: 'concerned' }),
          hired
            ? ilya('Отзываю его прямо сейчас и завожу новый через защищённое хранилище.', { speakerEmotion: 'focused' })
            : kirill('Отзываю его прямо сейчас и завожу новый.', { speakerEmotion: 'focused' }),
        ],
      }
    case 'credential-found-in-ci-cache':
      return {
        lines: [
          kirill('В кэше сборки неожиданно нашёлся тот самый старый ключ.', { speakerEmotion: 'surprised' }),
          kirill('Историю мы переписали, но кэш CI хранил его отдельно.', { speakerEmotion: 'concerned' }),
          kirill('Раз уж нашли — сделаю ротацию прямо сейчас.', { speakerEmotion: 'focused' }),
        ],
      }
    case 'hijacked-session-activity':
      return {
        lines: [
          kirill('В сборке появился новый CI-токен, который никто из нас не создавал.', { speakerEmotion: 'surprised' }),
          kirill('И настройки деплоя отличаются от вчерашних.', { speakerEmotion: 'concerned' }),
          hired
            ? ilya('Это работала та самая ночная сессия. Отзываю всё и проверяю, что ещё она успела сделать.', { speakerEmotion: 'focused' })
            : sonya('Придётся честно разобрать, что успела сделать эта сессия.', { speakerEmotion: 'concerned' }),
        ],
      }
    case 'unrestricted-ai-recurrence':
      return {
        lines: [
          alina('ИИ-помощник только что предложил фрагмент кода, который выглядит очень знакомым.', { speakerEmotion: 'surprised' }),
          alina('Это часть нашего внутреннего URL — того самого, что я отправляла раньше.', { speakerEmotion: 'concerned' }),
          hired
            ? ilya('Мы не можем точно сказать, обучилась ли модель на этом или это совпадение. Но проверить и приостановить использование нужно сейчас.', { speakerEmotion: 'focused' })
            : sonya('Мы не знаем точно, откуда это взялось. Но использовать инструмент без ограничений больше нельзя.', { speakerEmotion: 'concerned' }),
        ],
      }
    case 'shadow-ai-personal-use':
      return {
        lines: [
          kirill('Признаюсь — на прошлой неделе один раз воспользовался личным AI-помощником для маленького фрагмента.', { speakerEmotion: 'neutral' }),
          alina('Я тоже. Без инструмента совсем неудобно, а рабочей альтернативы нам не предложили.', { speakerEmotion: 'concerned' }),
          sonya('Значит, запрет без рабочей альтернативы просто ушёл в тень. Стоит вернуться к контролируемому варианту.', { speakerEmotion: 'focused' }),
        ],
      }
  }
}

// Applies (or safely re-applies) the effects of a landed consequence.
// Idempotent per effect id via cyberStoryStore.markEffectAppliedOnce.
export function applyCyberConsequenceEffects(id: CyberConsequenceId, moment: StoryMoment): void {
  const riskMoment = { sprintNumber: moment.sprintNumber, day: moment.day, workdayIndex: toWorkdayIndex(moment.sprintNumber, moment.day) }
  switch (id) {
    case 'phishing-targeted-followup': {
      const effectId = `cyber-consequence:${id}:identity-access`
      if (useCyberStoryStore.getState().markEffectAppliedOnce(effectId)) {
        useRiskStore.getState().addSignalsOnce(cyberConsequenceSignal(id, 'identity-access', CYBER_STORY_BALANCE.executivePhishing.followUpIdentityImpact, riskMoment))
      }
      return
    }
    case 'supply-chain-unknown-connection': {
      const effectId = `cyber-consequence:${id}:service-continuity`
      if (useCyberStoryStore.getState().markEffectAppliedOnce(effectId)) {
        useRiskStore.getState().addSignalsOnce(cyberConsequenceSignal(id, 'service-continuity', CYBER_STORY_BALANCE.supplyChainUpdate.unknownConnectionServiceContinuityImpact, riskMoment))
      }
      return
    }
    case 'shadow-it-external-download': {
      const costEffectId = `cyber-consequence:${id}:cost`
      if (useCyberStoryStore.getState().markEffectAppliedOnce(costEffectId)) {
        useEconomyStore
          .getState()
          .applyOneTimeExpense(
            createStoryDecisionTransaction(costEffectId, 'story-decision', 'Сдерживание утечки логов из личного облака', CYBER_STORY_BALANCE.shadowItLogs.futureContainmentCostRub, moment.sprintNumber, moment.day),
          )
      }
      const sensitiveEffectId = `cyber-consequence:${id}:sensitive-data`
      if (useCyberStoryStore.getState().markEffectAppliedOnce(sensitiveEffectId)) {
        useRiskStore.getState().addSignalsOnce(cyberConsequenceSignal(id, 'sensitive-data', CYBER_STORY_BALANCE.shadowItLogs.externalDownloadSensitiveImpact, riskMoment))
      }
      const governanceEffectId = `cyber-consequence:${id}:governance`
      if (useCyberStoryStore.getState().markEffectAppliedOnce(governanceEffectId)) {
        useRiskStore.getState().addSignalsOnce(cyberConsequenceSignal(id, 'governance', CYBER_STORY_BALANCE.shadowItLogs.externalDownloadGovernanceImpact, riskMoment))
      }
      return
    }
    case 'external-credential-usage': {
      const bal = ADDITIONAL_CYBER_STORY_BALANCE.repositorySecret
      const costEffectId = `cyber-consequence:${id}:cost`
      if (useCyberStoryStore.getState().markEffectAppliedOnce(costEffectId)) {
        useEconomyStore
          .getState()
          .applyOneTimeExpense(createStoryDecisionTransaction(costEffectId, 'story-decision', 'Отзыв скомпрометированного ключа внешней интеграции', bal.exposedCredentialIncidentCostRub, moment.sprintNumber, moment.day))
      }
      const identityEffectId = `cyber-consequence:${id}:identity-access`
      if (useCyberStoryStore.getState().markEffectAppliedOnce(identityEffectId)) {
        useRiskStore.getState().addSignalsOnce(cyberConsequenceSignal(id, 'identity-access', bal.exposedCredentialIdentityAccessImpact, riskMoment))
      }
      return
    }
    case 'credential-found-in-ci-cache': {
      const bal = ADDITIONAL_CYBER_STORY_BALANCE.repositorySecret
      const costEffectId = `cyber-consequence:${id}:cost`
      if (useCyberStoryStore.getState().markEffectAppliedOnce(costEffectId)) {
        useEconomyStore
          .getState()
          .applyOneTimeExpense(createStoryDecisionTransaction(costEffectId, 'story-decision', 'Поздняя ротация ключа, найденного в CI-кэше', bal.exposedCredentialIncidentCostRubAfterRewrite, moment.sprintNumber, moment.day))
      }
      return
    }
    case 'hijacked-session-activity': {
      const bal = ADDITIONAL_CYBER_STORY_BALANCE.mfaFatigue
      const costEffectId = `cyber-consequence:${id}:cost`
      if (useCyberStoryStore.getState().markEffectAppliedOnce(costEffectId)) {
        useEconomyStore
          .getState()
          .applyOneTimeExpense(createStoryDecisionTransaction(costEffectId, 'story-decision', 'Сдерживание активности захваченной сессии', bal.hijackedSessionIncidentCostRub, moment.sprintNumber, moment.day))
      }
      const continuityEffectId = `cyber-consequence:${id}:service-continuity`
      if (useCyberStoryStore.getState().markEffectAppliedOnce(continuityEffectId)) {
        useRiskStore.getState().addSignalsOnce(cyberConsequenceSignal(id, 'service-continuity', bal.hijackedSessionServiceContinuityImpact, riskMoment))
      }
      return
    }
    case 'unrestricted-ai-recurrence': {
      const bal = ADDITIONAL_CYBER_STORY_BALANCE.externalAi
      const costEffectId = `cyber-consequence:${id}:cost`
      if (useCyberStoryStore.getState().markEffectAppliedOnce(costEffectId)) {
        useEconomyStore
          .getState()
          .applyOneTimeExpense(createStoryDecisionTransaction(costEffectId, 'story-decision', 'Аудит и приостановка неограниченного использования AI-инструмента', bal.shadowAiAuditCostRub, moment.sprintNumber, moment.day))
      }
      const governanceEffectId = `cyber-consequence:${id}:governance`
      if (useCyberStoryStore.getState().markEffectAppliedOnce(governanceEffectId)) {
        useRiskStore.getState().addSignalsOnce(cyberConsequenceSignal(id, 'governance', bal.shadowAiGovernanceImpact, riskMoment))
      }
      return
    }
    case 'shadow-ai-personal-use':
      // Deliberately no cost/risk signal - §"Это не должно автоматически
      // создавать катастрофу": a ban without a working alternative pushing
      // usage into the shadows is an OBSERVATION the dialogue makes, not a
      // second punishment on top of the (already safer) ban choice.
      return
  }
}

// Called once per completed day (from completeWorkday.ts, right after the
// Feature 17C checkpoint evaluation): moves every scheduled consequence whose
// due workday has arrived into the mandatory play queue. Pure due-day compare
// against cyberStoryStore's own schedule - no timers, no randomness.
export function evaluateCyberStoryConsequences(completedWorkdayIndex: number): void {
  const store = useCyberStoryStore.getState()
  for (const id of Object.keys(store.scheduledConsequences) as CyberConsequenceId[]) {
    const schedule = store.scheduledConsequences[id]
    if (!schedule) continue
    if (completedWorkdayIndex >= schedule.dueWorkdayIndex) {
      useCyberStoryStore.getState().queueConsequenceOnce(id)
    }
  }
}

// A queued/running cyber consequence awaits the player - the day must not
// auto-complete (mirrors isStoryConsequencePending).
export function isCyberConsequencePending(): boolean {
  const s = useCyberStoryStore.getState()
  return s.pendingConsequenceIds.length > 0 || s.runningConsequenceId !== undefined
}
