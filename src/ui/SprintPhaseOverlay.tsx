import { useGameStore } from '../game/gameStore'
import { useSprintStore } from '../game/sprintStore'
import { useEconomyStore } from '../game/economyStore'
import { useProductStore } from '../game/productStore'
import { useSecurityAuditStore, isFollowUpAuditBlocking } from '../game/securityAuditStore'
import { useAccessControlStore } from '../game/accessControlStore'
import { isOfficeIntrusionBlocking } from '../game/accessControlRules'
import { useServerIncidentStore } from '../game/serverIncidentStore'
import { anyServerIncidentBlocking } from '../game/serverIncidentRules'
import { useGameOutcomeStore } from '../game/gameOutcomeStore'
import { SPRINT_DAYS } from '../game/sprintRules'
import { calculateBalance, formatRubles, sprintExpenseTotal } from '../game/economyRules'
import {
  completedInSprint,
  completedProductTaskCount,
  firstPrototypeDoneCount,
  hasCompletedCoreMvp,
  hasFirstPrototype,
  incompletePlanned,
  productReadiness,
} from '../game/productRules'
import { PRODUCT_TASK_CATALOG, getProductTask } from '../game/productTaskCatalog'
import {
  completeSprintAndPrepareNextPlanning,
  completeCampaignDeadlineMet,
  failCampaignDeadlineMissed,
} from '../game/completeSprintReview'
import { CAMPAIGN_DEADLINE_SPRINT } from '../game/gameOutcomeRules'
import './ui.css'

// Planning is a dismissable intro (not a hard blocker): the sprint is actually
// started from the whiteboard. Review is a full-screen summary of the sprint's
// development and finances. Both only in free play.
export function SprintPhaseOverlay() {
  const gamePhase = useGameStore((s) => s.phase)
  const sprintNumber = useSprintStore((s) => s.sprintNumber)
  const sprintPhase = useSprintStore((s) => s.phase)
  const planningDismissed = useProductStore((s) => s.planningDismissed)
  const dismissPlanning = useProductStore((s) => s.dismissPlanning)
  const transactions = useEconomyStore((s) => s.transactions)
  const taskStates = useProductStore((s) => s.taskStates)
  // On the tenth day a due follow-up audit or a pending office intrusion takes
  // priority over the review: the review stays hidden until both are resolved.
  const followUpAudit = useSecurityAuditStore((s) => s.followUpAudit)
  const intrusion = useAccessControlStore((s) => s.intrusion)
  const serverIncidentBlocking = useServerIncidentStore((s) => anyServerIncidentBlocking(Object.values(s.incidents)))
  // A registered defeat (pending or final) hands the screen to the game-over
  // overlay: both planning and review are suppressed, so a hard failure preempts
  // the review and the deadline review disappears once its defeat is registered.
  const outcomeBlocking = useGameOutcomeStore((s) => s.status !== 'playing')

  if (gamePhase !== 'free' || outcomeBlocking) return null

  if (sprintPhase === 'planning' && !planningDismissed) {
    return (
      <div className="overlay-backdrop">
        <div className="sprint-panel">
          <h2 className="sprint-panel-title">Планирование спринта {sprintNumber}</h2>
          <p className="sprint-panel-text">
            Спринт длится {SPRINT_DAYS} условных рабочих дней. Время идёт только когда вы завершаете рабочий день.
            Подойдите к доске задач у входа в серверную, распределите работу между разработчиками и запустите спринт с доски.
          </p>
          {sprintNumber < CAMPAIGN_DEADLINE_SPRINT ? (
            <p className="sprint-panel-deadline">
              {sprintNumber >= 5
                ? `До дедлайна MVP осталось ${CAMPAIGN_DEADLINE_SPRINT - sprintNumber} спринт(а). Готовность OfficeFlow: ${productReadiness(taskStates)}%`
                : `Дедлайн первого этапа: конец спринта ${CAMPAIGN_DEADLINE_SPRINT}`}
            </p>
          ) : (
            <p className="sprint-panel-deadline sprint-panel-deadline--final">
              Финальный спринт первого этапа. Незавершённых задач:{' '}
              {PRODUCT_TASK_CATALOG.length - completedProductTaskCount(taskStates)}. После этого спринта проект должен
              быть готов к выпуску.
            </p>
          )}
          <button className="primary" onClick={dismissPlanning}>
            Перейти в офис
          </button>
        </div>
      </div>
    )
  }

  if (sprintPhase === 'review' && !isFollowUpAuditBlocking(followUpAudit) && !isOfficeIntrusionBlocking(intrusion) && !serverIncidentBlocking) {
    const spent = sprintExpenseTotal(transactions, sprintNumber)
    const balance = calculateBalance(transactions)
    const completed = completedInSprint(taskStates, sprintNumber)
    const incomplete = incompletePlanned(taskStates, sprintNumber)
    return (
      <div className="overlay-backdrop">
        <div className="sprint-panel sprint-panel--review">
          <h2 className="sprint-panel-title">Спринт {sprintNumber} завершён</h2>
          <dl className="sprint-review-figures">
            <div>
              <dt>Завершено задач</dt>
              <dd>{completed.length}</dd>
            </div>
            <div>
              <dt>Не завершено</dt>
              <dd>{incomplete.length}</dd>
            </div>
            <div>
              <dt>Готовность OfficeFlow</dt>
              <dd>{productReadiness(taskStates)}%</dd>
            </div>
            <div>
              <dt>Первый прототип</dt>
              <dd>{hasFirstPrototype(taskStates) ? 'готов' : `${firstPrototypeDoneCount(taskStates)}/6`}</dd>
            </div>
            <div>
              <dt>Расходы за спринт</dt>
              <dd>{formatRubles(spent)}</dd>
            </div>
            <div>
              <dt>Остаток бюджета</dt>
              <dd>{formatRubles(balance)}</dd>
            </div>
          </dl>

          {completed.length > 0 ? (
            <div className="sprint-review-tasks">
              <div className="sprint-review-tasks-label">Завершённые задачи:</div>
              <ul>
                {completed.map((s) => (
                  <li key={s.taskId}>{getProductTask(s.taskId)?.title}</li>
                ))}
              </ul>
            </div>
          ) : null}
          {incomplete.length > 0 ? (
            <div className="sprint-review-tasks">
              <div className="sprint-review-tasks-label">Перейдут в backlog:</div>
              <ul>
                {incomplete.map((s) => (
                  <li key={s.taskId}>
                    {getProductTask(s.taskId)?.title} — {s.progressDays}/{getProductTask(s.taskId)?.effortDays}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {sprintNumber === CAMPAIGN_DEADLINE_SPRINT ? (
            hasCompletedCoreMvp(taskStates) ? (
              <>
                <div className="sprint-deadline sprint-deadline--met">
                  <div className="sprint-deadline-title">Дедлайн первого этапа</div>
                  <p>Все задачи OfficeFlow завершены. Основной объём MVP подготовлен в срок.</p>
                </div>
                <button className="primary" onClick={() => completeCampaignDeadlineMet()}>
                  Продолжить подготовку к выпуску
                </button>
              </>
            ) : (
              <>
                <div className="sprint-deadline sprint-deadline--missed">
                  <div className="sprint-deadline-title">MVP не подготовлен к дедлайну</div>
                  <p>
                    Завершено задач: {completedProductTaskCount(taskStates)} из {PRODUCT_TASK_CATALOG.length}. Готовность
                    OfficeFlow: {productReadiness(taskStates)}%.
                  </p>
                </div>
                <button className="primary" onClick={() => failCampaignDeadlineMissed()}>
                  Посмотреть итог проекта
                </button>
              </>
            )
          ) : (
            <button className="primary" onClick={() => completeSprintAndPrepareNextPlanning()}>
              Перейти к следующему спринту
            </button>
          )}
        </div>
      </div>
    )
  }

  return null
}
