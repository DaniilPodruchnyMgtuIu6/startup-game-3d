import { useGameStore } from '../game/gameStore'
import { useSprintStore } from '../game/sprintStore'
import { useEconomyStore } from '../game/economyStore'
import { useProductStore } from '../game/productStore'
import { useSecurityAuditStore, isFollowUpAuditBlocking } from '../game/securityAuditStore'
import { SPRINT_DAYS } from '../game/sprintRules'
import { calculateBalance, formatRubles, sprintExpenseTotal } from '../game/economyRules'
import {
  completedInSprint,
  firstPrototypeDoneCount,
  hasFirstPrototype,
  incompletePlanned,
  productReadiness,
} from '../game/productRules'
import { getProductTask } from '../game/productTaskCatalog'
import { completeSprintAndPrepareNextPlanning } from '../game/completeSprintReview'
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
  // On the tenth day a due follow-up audit takes priority over the review: the
  // review stays hidden until the audit is resolved (spec §16).
  const followUpAudit = useSecurityAuditStore((s) => s.followUpAudit)

  if (gamePhase !== 'free') return null

  if (sprintPhase === 'planning' && !planningDismissed) {
    return (
      <div className="overlay-backdrop">
        <div className="sprint-panel">
          <h2 className="sprint-panel-title">Планирование спринта {sprintNumber}</h2>
          <p className="sprint-panel-text">
            Спринт длится {SPRINT_DAYS} условных рабочих дней. Время идёт только когда вы завершаете рабочий день.
            Подойдите к доске задач в переговорной, распределите работу между разработчиками и запустите спринт с доски.
          </p>
          <button className="primary" onClick={dismissPlanning}>
            Перейти в офис
          </button>
        </div>
      </div>
    )
  }

  if (sprintPhase === 'review' && !isFollowUpAuditBlocking(followUpAudit)) {
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

          <button className="primary" onClick={() => completeSprintAndPrepareNextPlanning()}>
            Перейти к следующему спринту
          </button>
        </div>
      </div>
    )
  }

  return null
}
