import { useGameStore, type ChoiceOption, type DialogueLine } from '../gameStore'
import { useTeamStore } from '../teamStore'
import { useRiskStore } from '../riskStore'
import { useEconomyStore } from '../economyStore'
import { useSecurityAuditStore } from '../securityAuditStore'
import { hasSecuritySpecialist } from '../teamRules'
import { getActualRiskLevel } from '../riskRules'
import { createStoryDecisionTransaction } from '../economyRules'
import { registerStoryFailure } from '../registerGameFailure'
import { toWorkdayIndex } from '../workdayIndex'
import { STORY_BALANCE } from '../balance/storyBalance'
import { LEVEL1_TIMELINE_BALANCE } from '../balance/timelineBalance'
import type { StoryMoment } from '../securityStoryRules'
import type { BoardTask } from '../tasks'
import type { RiskDomain } from '../riskCatalog'
import type { ServerIncidentId } from '../serverIncidentCatalog'
import { femalePm } from '../../character/characters/femalePm'
import { kirillMorozov } from '../../character/characters/kirillMorozov'
import { alinaBelova } from '../../character/characters/alinaBelova'
import { ilyaVlasov } from '../../character/characters/ilyaVlasov'
import { security1 } from '../../character/characters/security1'
import { useStoryDecisionStore } from './storyDecisionStore'
import { useStoryConsequenceStore } from './storyConsequenceStore'
import { useStoryWorkStore } from './storyWorkStore'
import { storyConsequenceSignal } from './storyRiskSignals'
import { getBaselinePath, getRestoreReadiness } from './storyEffectSelectors'
import { BASELINE_AUDIT_RESULT_TASK, INTERNAL_REVIEW_TASK } from './storyFollowUps'
import {
  CLEANUP_ASSIGNMENT_ID,
  CLEANUP_TEST_DATA_TASK_ID,
  CONFIRM_RESTORE_TASK_ID,
  LATE_DRILL_ASSIGNMENT_ID,
  RECOVERY_ASSIGNMENT_ID,
  RECOVER_PROJECT_TASK_ID,
  type StoryConsequenceId,
} from './level1Checkpoints'

// Feature 17C: the consequence checkpoints and their mandatory scenes. All
// triggers are deterministic facts (workday index, resolved choices, risk
// levels, incident records); every effect is guarded by a stable effect id in
// the consequence store, so scenes can replay visually without re-applying
// anything. Dialogue only here - failures go through registerStoryFailure.

const sonya = (text: string): DialogueLine => ({ speaker: femalePm.persona!.name, speakerRole: femalePm.persona!.role, portrait: femalePm.portraitWorried ?? femalePm.portrait, text })
const sonyaCalm = (text: string): DialogueLine => ({ speaker: femalePm.persona!.name, speakerRole: femalePm.persona!.role, portrait: femalePm.portrait, text })
const kirill = (text: string): DialogueLine => ({ speaker: kirillMorozov.persona!.name, speakerRole: kirillMorozov.persona!.role, portrait: kirillMorozov.portrait, text })
const alina = (text: string): DialogueLine => ({ speaker: alinaBelova.persona!.name, speakerRole: alinaBelova.persona!.role, portrait: alinaBelova.portrait, text })
const ilya = (text: string): DialogueLine => ({ speaker: ilyaVlasov.persona!.name, speakerRole: ilyaVlasov.persona!.role, portrait: ilyaVlasov.portrait, text })
const auditor = (text: string): DialogueLine => ({ speaker: 'Аудитор', speakerRole: 'Внешний аудит', portrait: security1.portrait, text })

const LATE_DRILL_CHOICE_ID = 'run-late-restore-drill'
const LATE_DRILL_DECLINE_ID = 'postpone-again'
export const LATE_DRILL_TRANSACTION_ID = 'story:late-restore-drill'
export const RECOVERY_TRANSACTION_ID = 'story:recover-unverified-backup'

export const CONFIRM_RESTORE_TASK: BoardTask = {
  id: CONFIRM_RESTORE_TASK_ID,
  text: 'Подтвердите возможность восстановления проекта',
  done: false,
}
export const CLEANUP_TEST_DATA_TASK: BoardTask = {
  id: CLEANUP_TEST_DATA_TASK_ID,
  text: 'Удалить копию реальных данных из тестовой среды',
  done: false,
}
export const RECOVER_PROJECT_TASK: BoardTask = {
  id: RECOVER_PROJECT_TASK_ID,
  text: 'Восстановить проект из непроверенной копии',
  done: false,
}

function addTaskOnce(task: BoardTask): void {
  const game = useGameStore.getState()
  if (!game.tasks.some((t) => t.id === task.id)) game.addTask({ ...task })
}

function ilyaHired(): boolean {
  return hasSecuritySpecialist(useTeamStore.getState().hires)
}

function choiceOf(id: 'developer-admin-access' | 'frontend-test-data' | 'architecture-boundary' | 'suspicious-activity-disclosure' | 'backup-and-restore-strategy'): string | undefined {
  const record = useStoryDecisionStore.getState().decisions[id]
  return record.status === 'resolved' ? record.selectedChoiceId : undefined
}

function riskMomentOf(moment: StoryMoment) {
  return { ...moment, workdayIndex: toWorkdayIndex(moment.sprintNumber, moment.day) }
}

function addSignalOnce(effectId: string, domain: RiskDomain, impact: number, moment: StoryMoment): void {
  if (!useStoryConsequenceStore.getState().markEffectAppliedOnce(effectId)) return
  useRiskStore.getState().addSignalsOnce(storyConsequenceSignal(effectId, domain, impact, riskMomentOf(moment)))
}

// The remaining effort of a late restore drill: the configure-only day already
// spent counts toward the full drill.
export function getLateDrillEffortDays(): number {
  const configured = choiceOf('backup-and-restore-strategy') === 'configure-backups-only'
  return Math.max(1, STORY_BALANCE.backupRestore.fullDrillEffortDays - (configured ? STORY_BALANCE.backupRestore.configureOnlyEffortDays : 0))
}

// Starts the late restore drill (from the backup warning or the final warning).
// Same cost as the original drill, never duplicating the configure-only money.
export function startLateRestoreDrill(moment: StoryMoment): void {
  const conseq = useStoryConsequenceStore.getState()
  if (conseq.lateRestoreDrillCompleted) return
  useEconomyStore
    .getState()
    .applyOneTimeExpense(
      createStoryDecisionTransaction(LATE_DRILL_TRANSACTION_ID, 'story-decision', 'Полная проверка восстановления из копии', STORY_BALANCE.backupRestore.fullDrillCostRub, moment.sprintNumber, moment.day),
    )
  useStoryWorkStore.getState().addAssignmentOnce({
    id: LATE_DRILL_ASSIGNMENT_ID,
    employeeId: 'kirill-morozov',
    title: 'Полное восстановление проекта из копии',
    remainingDays: getLateDrillEffortDays(),
  })
  addTaskOnce({ ...CONFIRM_RESTORE_TASK })
}

// --- Scene scripts -----------------------------------------------------------

export interface ConsequenceScript {
  lines: DialogueLine[]
  // Optional decision inside a warning scene (the late drill offer).
  choices?: ChoiceOption[]
  reaction?: (choiceId: string) => DialogueLine[]
}

export function buildConsequenceScript(id: StoryConsequenceId): ConsequenceScript {
  const hired = ilyaHired()
  switch (id) {
    case 'baseline-review-overdue':
      return {
        lines: [
          sonya('Мы выбрали внутреннюю проверку, но у нас всё ещё нет ни специалиста, ни результата.'),
          sonya('Если продолжим без проверки, мы будем принимать следующие решения вслепую.'),
        ],
      }
    case 'baseline-audit-result':
      return {
        lines: [
          auditor('Критической компрометации мы не нашли. Но доступы, резервные копии и тестовые данные нужно привести в контролируемое состояние.'),
          sonyaCalm('Хорошо. Теперь у нас есть список, а не только предположения.'),
        ],
      }
    case 'internal-review-complete':
      return {
        lines: [ilya('Я закончил первичную проверку. Система не выглядит потерянной, но несколько решений нужно принять до следующего этапа.')],
      }
    case 'admin-access-consequence': {
      const permanent = choiceOf('developer-admin-access') === 'grant-permanent-admin'
      return permanent
        ? {
            lines: [
              hired
                ? ilya('Подозрительная сессия использовала те же права, которые мы оставили постоянными.')
                : kirill('Подозрительная сессия использовала те же права, которые мы оставили постоянными.'),
              kirill('Это ещё не доказывает, что доступ украли. Но область возможного ущерба стала больше.'),
            ],
          }
        : {
            lines: [
              kirill('Подозрительная сессия упёрлась в ограниченные права. Доступ был локализован — решение с временными правами сработало.'),
            ],
          }
    }
    case 'test-data-consequence': {
      const production = choiceOf('frontend-test-data') === 'copy-production-data'
      return production
        ? {
            lines: [
              alina('В тестовой среде осталась копия реальных данных. Я думала удалить её после проверки, но мы так и не зафиксировали этот шаг.'),
              hired
                ? ilya('Теперь придётся считать, что подозрительный доступ мог затронуть и её.')
                : kirill('Теперь придётся считать, что подозрительный доступ мог затронуть и её.'),
            ],
          }
        : {
            lines: [alina('Тестовая среда осталась чистой: в ней нет реальных данных, и текущие проверки её не затронули.')],
          }
    }
    case 'backup-warning-scene': {
      const configured = choiceOf('backup-and-restore-strategy') === 'configure-backups-only'
      return {
        lines: configured
          ? [kirill('Копии создаются по расписанию. Но я всё ещё не проверял, что проект реально поднимается из них целиком.')]
          : [kirill('Мы снова отложили резервное копирование. Сейчас единственная рабочая версия проекта — та, с которой работает команда.')],
        choices: [
          {
            id: LATE_DRILL_CHOICE_ID,
            label: 'Провести полную проверку сейчас',
            hint: 'Подтверждает восстановление проекта. Потребует денег и рабочих дней Кирилла.',
          },
          { id: LATE_DRILL_DECLINE_ID, label: 'Вернуться к этому позже', hint: 'Не тратит время сейчас. Восстановление останется неподтверждённым.' },
        ],
        reaction: (choiceId) =>
          choiceId === LATE_DRILL_CHOICE_ID
            ? [kirill('Хорошо. Останавливаю текущую задачу и поднимаю проект из копии с нуля.')]
            : [sonya('Записываю как открытый вопрос. Вернуться к нему придётся до контрольного этапа.')],
      }
    }
    case 'data-loss-final-warning':
      return {
        lines: [
          sonya('У нас нет завершённой проверки системы. И мы не доказали, что можем восстановить проект.'),
          sonya('Это уже не просто технический долг. Следующий серьёзный сбой может оставить нас без рабочей версии.'),
          kirill('Мне нужен хотя бы один день, чтобы проверить копию и журналы.'),
          hired
            ? ilya('Если отложим ещё раз, я не смогу обещать, что восстановление вообще возможно.')
            : kirill('Если отложим ещё раз, я не смогу обещать, что восстановление вообще возможно.'),
        ],
        choices: [
          {
            id: LATE_DRILL_CHOICE_ID,
            label: 'Проверить восстановление немедленно',
            hint: 'Кирилл начнёт полную проверку копии. Потребует денег и его рабочих дней.',
          },
          { id: LATE_DRILL_DECLINE_ID, label: 'Продолжить без проверки', hint: 'Риск потери проекта останется критическим.' },
        ],
        reaction: (choiceId) =>
          choiceId === LATE_DRILL_CHOICE_ID
            ? [kirill('Начинаю немедленно. Каждый день без проверенной копии — это ставка на удачу.')]
            : [sonya('Тогда я фиксирую: мы осознанно продолжаем без подтверждённого восстановления.')],
      }
    case 'project-files-destroyed':
      return {
        lines: [
          kirill('Репозиторий не открывается. Общая папка тоже пустая.'),
          alina('У меня осталась только вчерашняя сборка интерфейса. Исходников и макетов нет.'),
          sonya('Резервная копия?'),
          kirill('Проверенной копии нет. Журналы обрываются ночью.'),
          hired
            ? ilya('Это мог быть взлом, вредоносный пакет или ошибочная команда. Без аудита и журналов мы не докажем причину.')
            : kirill('Причину без аудита и полных журналов мы уже не установим.'),
          sonya('Но главное уже понятно: восстановить проект в срок мы не можем.'),
        ],
      }
    case 'project-recovered-unverified':
      return {
        lines: [
          kirill('Основная версия повреждена. Копия есть, но она не поднимается автоматически. Мне придётся вручную собирать проект и проверять целостность.'),
          sonya('Сколько времени?'),
          kirill('Три рабочих дня, если внутри копии нет новых повреждений.'),
        ],
      }
    case 'project-recovered-verified':
      return {
        lines: [kirill('Основная версия повреждена, но проверенная копия поднялась штатно. Мы потеряли часы, а не проект.')],
      }
    case 'architecture-incident-consequence': {
      const shared = choiceOf('architecture-boundary') === 'keep-shared-architecture'
      return shared
        ? { lines: [kirill('Проблема началась в одном контуре, но общий технический доступ затронул и соседние операции.')] }
        : {
            lines: [
              hired
                ? ilya('Инцидент остался внутри своего контура. Разделение доступов сработало так, как мы рассчитывали.')
                : kirill('Инцидент остался внутри своего контура. Разделение доступов сработало так, как мы рассчитывали.'),
            ],
          }
    }
    case 'disclosure-incident-consequence': {
      const choice = choiceOf('suspicious-activity-disclosure')
      if (choice === 'report-activity-immediately') {
        return { lines: [sonyaCalm('Руководство уже знает контекст. Нам не нужно объяснять, почему мы молчали.')] }
      }
      const investigationClosed = !useStoryWorkStore.getState().assignments.some((a) => a.id.startsWith('story-decision:suspicious-activity-disclosure:investigate-quietly'))
      return investigationClosed
        ? {
            lines: [
              hired
                ? ilya('Мы успели проверить сигнал до инцидента. Хронология у нас на руках — объясняться будет проще.')
                : kirill('Мы успели проверить сигнал до инцидента. Хронология у нас на руках — объясняться будет проще.'),
            ],
          }
        : {
            lines: [sonya('Руководство узнало, что мы видели сигнал и не сообщили. Теперь вопросы задают уже нам.')],
          }
    }
    case 'dismissed-warning-incident':
      return {
        lines: [
          sonya('Нам уже задавали вопрос об этой активности. Мы решили, что это ложное срабатывание.'),
          sonya('Теперь придётся объяснить, почему проверка не была проведена.'),
        ],
      }
    case 'concealed-risk-discovered':
      return {
        lines: [
          sonya('Руководство сверило отчёт с фактическим состоянием системы.'),
          sonya('Расхождение обнаружено: критический риск не был указан. Решение по проекту принимает уже не наш отдел.'),
        ],
      }
  }
}

// --- Effects (idempotent per effect id) --------------------------------------

export function applyConsequenceEffects(id: StoryConsequenceId, moment: StoryMoment, choiceId?: string): void {
  const conseq = useStoryConsequenceStore.getState()
  switch (id) {
    case 'baseline-review-overdue':
      // governance +2 shares the 17B missed-deadline signal id (never doubled)
      addSignalOnce('story-decision:security-baseline-path:hire-deadline-missed', 'governance', STORY_BALANCE.internalSecurityReview.missedDeadlineGovernanceImpact, moment)
      return
    case 'baseline-audit-result':
      conseq.setBaselineReviewCompleted()
      useGameStore.getState().completeTask(BASELINE_AUDIT_RESULT_TASK.id)
      return
    case 'internal-review-complete':
      conseq.setBaselineReviewCompleted()
      useGameStore.getState().completeTask(INTERNAL_REVIEW_TASK.id)
      return
    case 'admin-access-consequence':
      if (choiceOf('developer-admin-access') === 'grant-permanent-admin') {
        addSignalOnce('story-consequence:admin-access', 'identity-access', STORY_BALANCE.consequences.adminConsequenceIdentityImpact, moment)
      }
      return
    case 'test-data-consequence':
      if (choiceOf('frontend-test-data') === 'copy-production-data') {
        addSignalOnce('story-consequence:test-data', 'sensitive-data', STORY_BALANCE.consequences.testDataConsequenceSensitiveImpact, moment)
        if (conseq.markEffectAppliedOnce('story-consequence:test-data:cleanup')) {
          addTaskOnce(CLEANUP_TEST_DATA_TASK)
          useStoryWorkStore.getState().addAssignmentOnce({
            id: CLEANUP_ASSIGNMENT_ID,
            employeeId: ilyaHired() ? 'ilya-vlasov' : 'alina-belova',
            title: 'Удаление реальных данных из тестовой среды',
            remainingDays: STORY_BALANCE.consequences.testDataCleanupEffortDays,
          })
        }
      }
      return
    case 'backup-warning-scene':
    case 'data-loss-final-warning':
      if (id === 'data-loss-final-warning') conseq.setFinalWarningShown(toWorkdayIndex(moment.sprintNumber, moment.day))
      if (choiceId === LATE_DRILL_CHOICE_ID && conseq.markEffectAppliedOnce('story-consequence:late-restore-drill')) {
        startLateRestoreDrill(moment)
      }
      return
    case 'project-files-destroyed':
      if (conseq.markEffectAppliedOnce('story-consequence:project-files-destroyed')) {
        registerStoryFailure('unrecoverable-project-data-loss', 'story:project-files-destroyed')
      }
      return
    case 'project-recovered-unverified':
      if (conseq.markEffectAppliedOnce('story-consequence:project-recovered-unverified')) {
        useEconomyStore
          .getState()
          .applyOneTimeExpense(
            createStoryDecisionTransaction(RECOVERY_TRANSACTION_ID, 'security-recovery', 'Восстановление проекта из непроверенной копии', STORY_BALANCE.dataLoss.recoveryCostRub, moment.sprintNumber, moment.day),
          )
        useStoryWorkStore.getState().addAssignmentOnce({
          id: RECOVERY_ASSIGNMENT_ID,
          employeeId: 'kirill-morozov',
          title: 'Ручное восстановление проекта из копии',
          remainingDays: STORY_BALANCE.dataLoss.recoveryEffortDays,
        })
        addTaskOnce(RECOVER_PROJECT_TASK)
        useRiskStore
          .getState()
          .addSignalsOnce(storyConsequenceSignal('story-consequence:recover-unverified', 'service-continuity', STORY_BALANCE.dataLoss.recoveryContinuityImpact, riskMomentOf(moment)))
      }
      return
    case 'project-recovered-verified':
      addSignalOnce('story-consequence:recover-verified', 'service-continuity', STORY_BALANCE.dataLoss.verifiedRestoreContinuityMitigation, moment)
      return
    case 'architecture-incident-consequence':
    case 'disclosure-incident-consequence':
      // incident-time effects (cost/effort/neighbor/complaint) are applied by
      // applyStoryIncidentConsequences; the scenes only narrate them. The
      // successful quiet investigation earns its mitigation here, once.
      if (
        id === 'disclosure-incident-consequence' &&
        choiceOf('suspicious-activity-disclosure') === 'investigate-quietly' &&
        !useSecurityAuditStore.getState().leadershipComplaint
      ) {
        addSignalOnce('story-consequence:investigation-succeeded', 'governance', STORY_BALANCE.consequences.investigationSuccessGovernanceMitigation, moment)
      }
      return
    case 'dismissed-warning-incident':
      addSignalOnce('story-consequence:dismissed-warning', 'governance', STORY_BALANCE.consequences.dismissEscalationGovernanceImpact, moment)
      return
    case 'concealed-risk-discovered':
      if (conseq.markEffectAppliedOnce('story-consequence:concealed-risk')) {
        registerStoryFailure('concealed-critical-release-risk', 'story:concealed-risk-discovered')
      }
      return
  }
}

// --- Checkpoint evaluation (runs inside completeWorkday) ---------------------

export interface CheckpointEvaluationContext {
  sprintNumber: number
  day: number
  completedWorkdayIndex: number
}

function baselineResolvedIndex(): number | undefined {
  const record = useStoryDecisionStore.getState().decisions['security-baseline-path']
  if (record.status !== 'resolved' || !record.resolvedAt) return undefined
  return toWorkdayIndex(record.resolvedAt.sprintNumber, record.resolvedAt.day)
}

function isBaselineLegacy(): boolean {
  return useStoryDecisionStore.getState().decisions['security-baseline-path'].migratedFromLegacy === true
}

export function evaluateStoryCheckpoints(ctx: CheckpointEvaluationContext): void {
  const conseq = useStoryConsequenceStore.getState()
  const signals = useRiskStore.getState().signals
  const idx = ctx.completedWorkdayIndex

  // 1. baseline-review-deadline: the hire path must produce a review in time;
  //    the audit path waits for its real result and is never penalized.
  if (conseq.checkpoints['baseline-review-deadline'].status === 'pending' && !isBaselineLegacy()) {
    const resolvedIndex = baselineResolvedIndex()
    const path = getBaselinePath()
    if (conseq.baselineSecurityReviewCompleted) {
      conseq.markCheckpoint('baseline-review-deadline', 'passed', idx)
    } else if (path === 'internal-review' && resolvedIndex !== undefined && idx >= resolvedIndex + LEVEL1_TIMELINE_BALANCE.baselineReviewDeadlineWorkdays) {
      conseq.markCheckpoint('baseline-review-deadline', 'triggered', idx)
      conseq.queueConsequenceOnce('baseline-review-overdue')
    }
  }

  // 2. backup-warning: two workdays after configure-only / postpone.
  if (conseq.checkpoints['backup-warning'].status === 'pending') {
    const backup = useStoryDecisionStore.getState().decisions['backup-and-restore-strategy']
    if (backup.status === 'resolved' && backup.resolvedAt) {
      if (backup.selectedChoiceId === 'run-full-restore-drill') {
        conseq.markCheckpoint('backup-warning', 'passed', idx)
      } else if (idx >= toWorkdayIndex(backup.resolvedAt.sprintNumber, backup.resolvedAt.day) + LEVEL1_TIMELINE_BALANCE.backupWarningAfterChoiceWorkdays) {
        conseq.markCheckpoint('backup-warning', 'triggered', idx)
        conseq.queueConsequenceOnce('backup-warning-scene')
      }
    }
  }

  const continuityHigh = ['high', 'critical'].includes(getActualRiskLevel(signals, 'service-continuity'))
  const sensitiveHigh = ['high', 'critical'].includes(getActualRiskLevel(signals, 'sensitive-data'))
  const restore = getRestoreReadiness()
  const reviewDone = useStoryConsequenceStore.getState().baselineSecurityReviewCompleted

  // 3. data-loss-final-warning at Sprint 4 Day 3.
  if (conseq.checkpoints['data-loss-final-warning'].status === 'pending' && idx >= toWorkdayIndex(LEVEL1_TIMELINE_BALANCE.dataLossFinalWarning.sprintNumber, LEVEL1_TIMELINE_BALANCE.dataLossFinalWarning.day)) {
    if (!reviewDone && restore !== 'verified' && (continuityHigh || sensitiveHigh)) {
      conseq.markCheckpoint('data-loss-final-warning', 'triggered', idx)
      conseq.queueConsequenceOnce('data-loss-final-warning')
    } else {
      conseq.markCheckpoint('data-loss-final-warning', 'passed', idx)
    }
  }

  // 4. data-loss-resolution at Sprint 4 Day 6: catastrophe / recovery / relief.
  //    Without the final warning the terminal branch is impossible (§17.13).
  if (conseq.checkpoints['data-loss-resolution'].status === 'pending' && idx >= toWorkdayIndex(LEVEL1_TIMELINE_BALANCE.dataLossResolution.sprintNumber, LEVEL1_TIMELINE_BALANCE.dataLossResolution.day)) {
    const warned = useStoryConsequenceStore.getState().finalWarningShownAtWorkdayIndex !== undefined
    if (warned && !reviewDone && (continuityHigh || sensitiveHigh)) {
      conseq.markCheckpoint('data-loss-resolution', 'triggered', idx)
      if (restore === 'absent' || restore === 'unknown') conseq.queueConsequenceOnce('project-files-destroyed')
      else if (restore === 'configured') conseq.queueConsequenceOnce('project-recovered-unverified')
      else conseq.queueConsequenceOnce('project-recovered-verified')
    } else {
      conseq.markCheckpoint('data-loss-resolution', 'passed', idx)
    }
  }

  // 5. access-consequence-check: high identity risk (or the AUTH incident,
  //    handled by the incident hook) surfaces the admin-access consequence.
  if (conseq.checkpoints['access-consequence-check'].status === 'pending') {
    const adminChoice = choiceOf('developer-admin-access')
    if (adminChoice && ['high', 'critical'].includes(getActualRiskLevel(signals, 'identity-access'))) {
      conseq.markCheckpoint('access-consequence-check', 'triggered', idx)
      conseq.queueConsequenceOnce('admin-access-consequence')
    }
  }

  // 6. test-data-consequence-check: sensitive data reaching high.
  if (conseq.checkpoints['test-data-consequence-check'].status === 'pending') {
    const dataChoice = choiceOf('frontend-test-data')
    if (dataChoice && sensitiveHigh) {
      conseq.markCheckpoint('test-data-consequence-check', 'triggered', idx)
      conseq.queueConsequenceOnce('test-data-consequence')
    }
  }
}

// --- Incident-time hook (called by serverIncidentStore on real incidents) ----

const NEIGHBOR_DOMAIN: Partial<Record<ServerIncidentId, RiskDomain>> = {
  'auth-account-incident': 'sensitive-data',
  'database-exposure-review': 'identity-access',
}

export function applyStoryIncidentConsequences(incidentId: ServerIncidentId, moment: StoryMoment): void {
  const conseq = useStoryConsequenceStore.getState()
  const isAuthOrDb = incidentId === 'auth-account-incident' || incidentId === 'database-exposure-review'

  // Architecture: shared access spreads the incident to the neighbor domain.
  if (isAuthOrDb && choiceOf('architecture-boundary')) {
    if (choiceOf('architecture-boundary') === 'keep-shared-architecture') {
      addSignalOnce(`story-consequence:arch-neighbor:${incidentId}`, NEIGHBOR_DOMAIN[incidentId]!, STORY_BALANCE.consequences.architectureNeighborImpact, moment)
    }
    if (conseq.checkpoints['architecture-consequence'].status === 'pending') {
      conseq.markCheckpoint('architecture-consequence', 'triggered', toWorkdayIndex(moment.sprintNumber, moment.day))
    }
    conseq.queueConsequenceOnce('architecture-incident-consequence')
  }

  // Disclosure: the incident narrates the earlier decision.
  const disclosure = choiceOf('suspicious-activity-disclosure')
  if (disclosure) {
    if (conseq.checkpoints['disclosure-consequence'].status === 'pending') {
      conseq.markCheckpoint('disclosure-consequence', 'triggered', toWorkdayIndex(moment.sprintNumber, moment.day))
    }
    if (disclosure === 'dismiss-as-false-positive') conseq.queueConsequenceOnce('dismissed-warning-incident')
    else conseq.queueConsequenceOnce('disclosure-incident-consequence')
  }

  // Admin access: the AUTH incident surfaces the rights consequence.
  if (incidentId === 'auth-account-incident' && choiceOf('developer-admin-access')) {
    if (conseq.checkpoints['access-consequence-check'].status === 'pending') {
      conseq.markCheckpoint('access-consequence-check', 'triggered', toWorkdayIndex(moment.sprintNumber, moment.day))
    }
    conseq.queueConsequenceOnce('admin-access-consequence')
  }
}

// A mandatory consequence scene awaits the player - the day must not complete.
export function isStoryConsequencePending(): boolean {
  const s = useStoryConsequenceStore.getState()
  return s.pendingConsequenceIds.length > 0 || s.runningConsequenceId !== undefined
}
