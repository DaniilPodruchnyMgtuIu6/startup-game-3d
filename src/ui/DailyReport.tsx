import { useProductStore } from '../game/productStore'
import { useEconomyStore } from '../game/economyStore'
import { useSecurityAuditStore, isFollowUpAuditBlocking } from '../game/securityAuditStore'
import { getProductTask } from '../game/productTaskCatalog'
import { getEmployee, PROJECT_MANAGER } from '../game/teamCatalog'
import { getFirstPrototypeCompletion, hasFirstPrototype, type WorkdayEmployeeProgress } from '../game/productRules'
import { getSecurityFinding } from '../game/securityFindingCatalog'
import { securityWorkdayId, type SecurityWorkdayRecord } from '../game/securityAuditRules'
import { getDaysUntilAudit, toWorkdayIndex } from '../game/workdayIndex'
import { calculateBalance, dailyExpenseId, formatRubles } from '../game/economyRules'
import './ui.css'

function securityEmployeeName(id: string): string {
  if (id === PROJECT_MANAGER.id) return PROJECT_MANAGER.name
  return getEmployee(id)?.name ?? id
}

function EmployeeLine({ result }: { result: WorkdayEmployeeProgress }) {
  const employee = getEmployee(result.employeeId)
  if (result.idleReason === 'security-diverted') {
    return (
      <div className="dr-emp">
        <div className="dr-emp-name">{employee?.name}</div>
        <div className="dr-emp-idle">Задача OfficeFlow не продвигалась: работал над замечанием аудита.</div>
      </div>
    )
  }
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

// Security corrective-work section + follow-up audit deadline for the completed
// day. Only shown once the corrective-action plan is initialised.
function SecuritySection({ record, sprintNumber, day }: { record: SecurityWorkdayRecord | undefined; sprintNumber: number; day: number }) {
  const followUpAudit = useSecurityAuditStore((s) => s.followUpAudit)
  const auditInProgress = isFollowUpAuditBlocking(followUpAudit)

  let deadlineText: string | null = null
  if (auditInProgress) {
    deadlineText = 'Сегодня проводится повторная проверка.'
  } else if (followUpAudit.status === 'scheduled' && followUpAudit.nextAuditWorkdayIndex !== undefined) {
    const remaining = getDaysUntilAudit(toWorkdayIndex(sprintNumber, day), followUpAudit.nextAuditWorkdayIndex)
    deadlineText = `До повторной проверки: ${remaining} рабочих дней`
  }

  return (
    <div className="dr-security">
      <div className="dr-security-title">Безопасность</div>
      {record && record.results.length > 0 ? (
        record.results.map((r) => {
          const def = getSecurityFinding(r.findingId)
          return (
            <div className="dr-emp" key={r.employeeId + r.findingId}>
              <div className="dr-emp-name">{securityEmployeeName(r.employeeId)}</div>
              <div className="dr-emp-task">
                {def?.title}: {r.beforeProgressDays}/{def?.effortDays} → {r.afterProgressDays}/{def?.effortDays}
              </div>
              {r.closedFinding ? <div className="dr-emp-done">Замечание закрыто</div> : null}
            </div>
          )
        })
      ) : (
        <div className="dr-emp-idle">Замечания аудита сегодня не исправлялись.</div>
      )}
      {deadlineText ? <div className="dr-security-deadline">{deadlineText}</div> : null}
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
  const auditInitialized = useSecurityAuditStore((s) => s.initialized)
  const securityHistory = useSecurityAuditStore((s) => s.workdayHistory)

  if (!report) return null

  const securityRecord = securityHistory.find((w) => w.id === securityWorkdayId(report.sprintNumber, report.day))

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

        {auditInitialized ? <SecuritySection record={securityRecord} sprintNumber={report.sprintNumber} day={report.day} /> : null}

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
