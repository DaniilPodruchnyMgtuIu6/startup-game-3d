import { useProductStore } from '../game/productStore'
import { useEconomyStore } from '../game/economyStore'
import { getProductTask } from '../game/productTaskCatalog'
import { getEmployee } from '../game/teamCatalog'
import { getFirstPrototypeCompletion, hasFirstPrototype, type WorkdayEmployeeProgress } from '../game/productRules'
import { calculateBalance, dailyExpenseId, formatRubles } from '../game/economyRules'
import './ui.css'

function EmployeeLine({ result }: { result: WorkdayEmployeeProgress }) {
  const employee = getEmployee(result.employeeId)
  if (result.idleReason || !result.taskId) {
    return (
      <div className="dr-emp">
        <div className="dr-emp-name">{employee?.name}</div>
        <div className="dr-emp-idle">Нет назначенных задач. День прошёл без прогресса.</div>
      </div>
    )
  }
  const def = getProductTask(result.taskId)
  return (
    <div className="dr-emp">
      <div className="dr-emp-name">{employee?.name}</div>
      <div className="dr-emp-task">
        {def?.title}: {result.beforeProgressDays}/{def?.effortDays} → {result.afterProgressDays}/{def?.effortDays}
      </div>
      {result.completedTask ? <div className="dr-emp-done">Задача завершена</div> : null}
    </div>
  )
}

// Blocking end-of-day report. Only «Продолжить» closes it - clicking the
// backdrop does nothing. Closing does not move time or re-run any calculation;
// if the tenth day was completed, the sprint review is revealed underneath.
export function DailyReport() {
  const report = useProductStore((s) => s.activeReport)
  const taskStates = useProductStore((s) => s.taskStates)
  const close = useProductStore((s) => s.closeReport)
  const transactions = useEconomyStore((s) => s.transactions)

  if (!report) return null

  const dayExpense = transactions.find((t) => t.id === dailyExpenseId(report.sprintNumber, report.day))?.amount ?? 0
  const balance = calculateBalance(transactions)
  const milestone = getFirstPrototypeCompletion(taskStates)
  const milestoneToday =
    hasFirstPrototype(taskStates) && milestone?.sprintNumber === report.sprintNumber && milestone?.day === report.day

  return (
    <div className="overlay-backdrop">
      <div className="daily-report" onClick={(e) => e.stopPropagation()}>
        <h2 className="dr-title">Итоги дня {report.day}</h2>

        <div className="dr-employees">
          {report.employeeResults.map((r) => (
            <EmployeeLine key={r.employeeId} result={r} />
          ))}
        </div>

        {milestoneToday ? (
          <div className="dr-milestone">
            <div className="dr-milestone-title">Первый рабочий прототип OfficeFlow готов</div>
            <div className="dr-milestone-text">
              Команда собрала вход, каталог переговорных и бронирование в единый рабочий сценарий.
            </div>
          </div>
        ) : null}

        <div className="dr-summary">
          <div>
            Готовность OfficeFlow: {report.productProgressBefore}% → {report.productProgressAfter}%
          </div>
          <div>Расходы за день: {formatRubles(dayExpense)}</div>
          <div>Остаток бюджета: {formatRubles(balance)}</div>
        </div>

        <button className="primary" onClick={close}>
          Продолжить
        </button>
      </div>
    </div>
  )
}
