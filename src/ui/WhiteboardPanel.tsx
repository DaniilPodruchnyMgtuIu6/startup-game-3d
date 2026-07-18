import { useEffect, useState } from 'react'
import { useProductStore, type BoardTab } from '../game/productStore'
import { useSprintStore } from '../game/sprintStore'
import { useTeamStore } from '../game/teamStore'
import { useEconomyStore } from '../game/economyStore'
import { useGameStore } from '../game/gameStore'
import { PRODUCT_TASK_CATALOG, getProductTask, type ProductTaskDefinition } from '../game/productTaskCatalog'
import { getEmployee, DEVELOPER_CATALOG, PROJECT_MANAGER } from '../game/teamCatalog'
import { isEmployeeHired, hasSecuritySpecialist } from '../game/teamRules'
import { useSecurityAuditStore, isFollowUpAuditBlocking } from '../game/securityAuditStore'
import { getSecurityFinding } from '../game/securityFindingCatalog'
import {
  getEligibleEmployeesForFinding,
  getEmployeeActiveSecurityFinding,
  getRemainingSecurityEffort,
  type SecurityFindingState,
  type SecurityStaffContext,
} from '../game/securityAuditRules'
import { toWorkdayIndex, fromWorkdayIndex, getDaysUntilAudit } from '../game/workdayIndex'
import { useRiskStore } from '../game/riskStore'
import { buildRiskObservations, getUnacknowledgedDetectedCount } from '../game/riskRules'
import { RISK_LEVEL_LABEL } from '../game/riskCatalog'
import { useAccessControlStore } from '../game/accessControlStore'
import { getAccessControlEffortDays, getRemainingAccessControlEffort, type AccessControlAssigneeId } from '../game/accessControlRules'
import { ACCESS_CONTROL_INVESTMENT_COST } from '../game/economyRules'
import { registerGameFailureIfNeeded } from '../game/registerGameFailure'
import { useGameOutcomeStore } from '../game/gameOutcomeStore'
import { getUnresolvedFindingIds } from '../game/securityAuditRules'
import { useServerIncidentStore } from '../game/serverIncidentStore'
import { getServerIncident } from '../game/serverIncidentCatalog'
import { getEmployeeActiveSecurityWork, getRemainingServerRecoveryEffort, getServerDowntimeCost, getServerRecoveryEffort } from '../game/serverIncidentRules'
import {
  completedInSprint,
  firstPrototypeDoneCount,
  hasFirstPrototype,
  incompletePlanned,
  loadStatus,
  plannedLoadForEmployee,
  productReadiness,
  remainingEffort,
  type ProductTaskState,
} from '../game/productRules'
import { startSprintWithPlan, canStartSprintWithPlan, getStartSprintWarnings } from '../game/startSprintWithPlan'
import { completeSprintAndPrepareNextPlanning } from '../game/completeSprintReview'
import { formatRubles, calculateBalance, sprintExpenseTotal, type MoneyTransaction } from '../game/economyRules'
import './ui.css'

const START_REASON_TEXT: Record<string, string> = {
  'team-incomplete': 'Сначала наймите backend- и frontend-разработчика (кнопка «Команда» в HUD).',
  'first-sprint-needs-both-roles': 'В первом спринте нужна хотя бы одна задача каждому разработчику.',
  'no-planned-tasks': 'Добавьте в спринт хотя бы одну незавершённую задачу.',
  'not-planning': 'Спринт уже идёт.',
}

function TaskProgress({ state }: { state: ProductTaskState }) {
  const def = getProductTask(state.taskId)!
  return (
    <span className="pb-task-progress">
      {state.progressDays}/{def.effortDays}
    </span>
  )
}

function DeveloperQueue({ employeeId, states, phase }: { employeeId: string; states: ProductTaskState[]; phase: string }) {
  const employee = getEmployee(employeeId)!
  const move = useProductStore((s) => s.moveTask)
  const remove = useProductStore((s) => s.removeTaskFromPlan)
  const load = plannedLoadForEmployee(states, employeeId)
  const status = loadStatus(load)
  const queue = states
    .filter((s) => getProductTask(s.taskId)?.assigneeEmployeeId === employeeId && (s.status === 'planned' || s.status === 'in-progress'))
    .sort((a, b) => (a.planOrder ?? 0) - (b.planOrder ?? 0))
  const planning = phase === 'planning'

  return (
    <div className="pb-queue">
      <div className="pb-queue-head">
        <span className="pb-queue-name">
          {employee.name} · {employee.role === 'backend-developer' ? 'Backend' : 'Frontend'}
        </span>
        <span className={`pb-load pb-load--${status}`}>Загрузка: {load}/10 рабочих дней</span>
      </div>
      {queue.length === 0 ? (
        <p className="pb-empty">Нет задач в этом спринте.</p>
      ) : (
        <ul className="pb-queue-list">
          {queue.map((s, i) => {
            const def = getProductTask(s.taskId)!
            return (
              <li key={s.taskId} className="pb-queue-item">
                <div className="pb-queue-item-main">
                  <span className="pb-task-title">{def.title}</span>
                  <span className="pb-task-remaining">осталось {remainingEffort(s)} дн · <TaskProgress state={s} /></span>
                </div>
                {planning ? (
                  <div className="pb-queue-item-actions">
                    <button className="pb-mini" disabled={i === 0} onClick={() => move(s.taskId, 'up')} aria-label="Вверх">
                      ▲
                    </button>
                    <button className="pb-mini" disabled={i === queue.length - 1} onClick={() => move(s.taskId, 'down')} aria-label="Вниз">
                      ▼
                    </button>
                    <button className="pb-mini pb-mini--remove" onClick={() => remove(s.taskId)} aria-label="Удалить">
                      ✕
                    </button>
                  </div>
                ) : null}
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}

function BacklogCard({ def, state }: { def: ProductTaskDefinition; state: ProductTaskState }) {
  const add = useProductStore((s) => s.addTaskToPlan)
  const employee = getEmployee(def.assigneeEmployeeId)
  return (
    <div className="pb-card">
      <div className="pb-card-head">
        <span className="pb-task-title">{def.title}</span>
        <span className={`pb-group pb-group--${def.group}`}>{def.group === 'prototype' ? 'Первый прототип' : 'MVP'}</span>
      </div>
      <p className="pb-card-desc">{def.description}</p>
      <div className="pb-card-meta">
        <span>{employee?.name}</span>
        <span>
          {remainingEffort(state)}/{def.effortDays} дн
        </span>
      </div>
      <button className="pb-add" onClick={() => add(def.id)}>
        Добавить в спринт
      </button>
    </div>
  )
}

// Confirmation before starting a sprint (overload / idle-developer warnings).
function StartConfirm({ onClose }: { onClose: () => void }) {
  const warnings = getStartSprintWarnings()
  const idleNames = warnings.employeesWithoutPlan.map((id) => getEmployee(id)?.name).filter(Boolean)
  const confirm = () => {
    startSprintWithPlan()
    onClose()
  }
  return (
    <div className="overlay-backdrop" onClick={onClose}>
      <div className="sprint-confirm" onClick={(e) => e.stopPropagation()}>
        <h3 className="sprint-confirm-title">Начать спринт?</h3>
        {warnings.overloaded ? (
          <p className="sprint-warning sprint-warning--low">
            План спринта перегружен. Не все задачи будут завершены за 10 рабочих дней.
          </p>
        ) : null}
        {idleNames.map((name) => (
          <p key={name} className="sprint-warning sprint-warning--low">
            {name} не получил(а) задач на этот спринт. Зарплата всё равно будет списываться.
          </p>
        ))}
        <div className="sprint-confirm-actions">
          <button className="primary" onClick={confirm}>
            Начать спринт
          </button>
          <button className="sprint-secondary" onClick={onClose}>
            Вернуться к планированию
          </button>
        </div>
      </div>
    </div>
  )
}

function ProductBoard() {
  const states = useProductStore((s) => s.taskStates)
  const openPrototype = useProductStore((s) => s.openPrototype)
  const phase = useSprintStore((s) => s.phase)
  const sprintNumber = useSprintStore((s) => s.sprintNumber)
  const day = useSprintStore((s) => s.day)
  const transactions = useEconomyStore((s) => s.transactions)
  const [confirming, setConfirming] = useState(false)

  const readiness = productReadiness(states)
  const prototypeReady = hasFirstPrototype(states)
  const overloaded = DEVELOPER_CATALOG.some((e) => plannedLoadForEmployee(states, e.id) > 10)
  const startCheck = canStartSprintWithPlan()

  const phaseLine =
    phase === 'planning'
      ? `Планирование спринта ${sprintNumber}`
      : phase === 'active'
        ? `Спринт ${sprintNumber} · День ${day}/10 · План зафиксирован`
        : `Спринт ${sprintNumber} завершён`

  const backlog = PRODUCT_TASK_CATALOG.map((def) => ({ def, state: states.find((s) => s.taskId === def.id)! })).filter(
    ({ state }) => state.status === 'backlog',
  )
  const done = states.filter((s) => s.status === 'done')

  return (
    <div className="pb">
      <div className="pb-header">
        <h2 className="pb-title">OfficeFlow</h2>
        <div className="pb-readiness">Готовность продукта: {readiness}%</div>
        <div className={prototypeReady ? 'pb-proto pb-proto--ready' : 'pb-proto'}>
          Первый прототип: {prototypeReady ? 'готов' : 'не готов'} ({firstPrototypeDoneCount(states)}/6)
        </div>
        <div className="pb-phase">{phaseLine}</div>
      </div>

      <div className="pb-queues">
        {DEVELOPER_CATALOG.map((e) => (
          <DeveloperQueue key={e.id} employeeId={e.id} states={states} phase={phase} />
        ))}
      </div>

      {overloaded ? (
        <p className="sprint-warning sprint-warning--low">
          План превышает доступные 10 рабочих дней. Часть задач может перейти в следующий спринт.
        </p>
      ) : null}

      {phase === 'planning' ? (
        <div className="pb-section">
          <h3 className="pb-subtitle">Backlog</h3>
          {backlog.length === 0 ? (
            <p className="pb-empty">Все задачи распределены.</p>
          ) : (
            <div className="pb-backlog">
              {backlog.map(({ def, state }) => (
                <BacklogCard key={def.id} def={def} state={state} />
              ))}
            </div>
          )}
          {startCheck.started ? (
            <button className="primary pb-start" onClick={() => setConfirming(true)}>
              Начать спринт
            </button>
          ) : (
            <p className="pb-hint">{START_REASON_TEXT[startCheck.reason] ?? ''}</p>
          )}
        </div>
      ) : null}

      {phase === 'review' ? <SprintResults states={states} sprintNumber={sprintNumber} transactions={transactions} /> : null}

      {done.length > 0 && phase !== 'review' ? (
        <div className="pb-section">
          <h3 className="pb-subtitle">Готово</h3>
          <ul className="pb-done">
            {done.map((s) => (
              <li key={s.taskId}>{getProductTask(s.taskId)?.title}</li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="pb-section">
        <button
          className="sprint-secondary"
          disabled={!prototypeReady}
          onClick={openPrototype}
          title={prototypeReady ? 'Открыть макет OfficeFlow' : 'Прототип станет доступен после завершения основных задач.'}
        >
          Открыть прототип
        </button>
        {!prototypeReady ? <p className="pb-hint">Прототип станет доступен после завершения основных задач.</p> : null}
      </div>

      {confirming ? <StartConfirm onClose={() => setConfirming(false)} /> : null}
    </div>
  )
}

function SprintResults({
  states,
  sprintNumber,
  transactions,
}: {
  states: ProductTaskState[]
  sprintNumber: number
  transactions: MoneyTransaction[]
}) {
  const completed = completedInSprint(states, sprintNumber)
  const incomplete = incompletePlanned(states, sprintNumber)
  return (
    <div className="pb-section">
      <h3 className="pb-subtitle">Итоги спринта {sprintNumber}</h3>
      <div className="pb-results">
        <div>Завершено задач: {completed.length}</div>
        <div>Не завершено: {incomplete.length}</div>
        <div>Готовность OfficeFlow: {productReadiness(states)}%</div>
        <div>Первый прототип: {hasFirstPrototype(states) ? 'готов' : `${firstPrototypeDoneCount(states)}/6`}</div>
        <div>Расходы за спринт: {formatRubles(sprintExpenseTotal(transactions, sprintNumber))}</div>
        <div>Остаток бюджета: {formatRubles(calculateBalance(transactions))}</div>
      </div>
      {completed.length > 0 ? (
        <>
          <div className="pb-results-label">Завершённые:</div>
          <ul className="pb-done">
            {completed.map((s) => (
              <li key={s.taskId}>{getProductTask(s.taskId)?.title}</li>
            ))}
          </ul>
        </>
      ) : null}
      {incomplete.length > 0 ? (
        <>
          <div className="pb-results-label">Не завершены (перейдут в backlog):</div>
          <ul className="pb-done">
            {incomplete.map((s) => (
              <li key={s.taskId}>
                {getProductTask(s.taskId)?.title} — <TaskProgress state={s} />
              </li>
            ))}
          </ul>
        </>
      ) : null}
    </div>
  )
}

function DepartmentTasks() {
  const tasks = useGameStore((s) => s.tasks)
  return (
    <ul className="taskboard-list">
      {tasks.map((task) => (
        <li key={task.id} className={task.done ? 'taskboard-done' : ''}>
          <span className="taskboard-checkbox">{task.done ? '✔' : ''}</span>
          <span>{task.text}</span>
        </li>
      ))}
    </ul>
  )
}

const SEVERITY_LABEL: Record<'medium' | 'high', string> = { medium: 'Средняя серьёзность', high: 'Высокая серьёзность' }

function securityEmployeeName(id: string): string {
  if (id === PROJECT_MANAGER.id) return PROJECT_MANAGER.name
  return getEmployee(id)?.name ?? id
}

// Deadline / status banner for the corrective-action plan.
function SecurityDeadline() {
  const followUpAudit = useSecurityAuditStore((s) => s.followUpAudit)
  const sprintNumber = useSprintStore((s) => s.sprintNumber)
  const day = useSprintStore((s) => s.day)

  if (followUpAudit.status === 'passed') {
    return <div className="sb-deadline sb-deadline--ok">Замечания закрыты. Повторная проверка пройдена.</div>
  }
  if (followUpAudit.status === 'critical-escalation') {
    return <div className="sb-deadline sb-deadline--crit">Аудиторы рекомендуют приостановить проект.</div>
  }
  if (isFollowUpAuditBlocking(followUpAudit)) {
    return <div className="sb-deadline">Проверка проводится.</div>
  }
  const next = followUpAudit.nextAuditWorkdayIndex
  if (next === undefined) return null
  const remaining = getDaysUntilAudit(toWorkdayIndex(sprintNumber, day), next)
  if (remaining === 0) {
    return <div className="sb-deadline sb-deadline--due">Повторная проверка назначена на конец текущего дня.</div>
  }
  const at = fromWorkdayIndex(next)
  return (
    <div className="sb-deadline">
      <div>
        Следующая проверка: Спринт {at.sprintNumber} · День {at.day}
      </div>
      <div>Осталось рабочих дней: {remaining}</div>
    </div>
  )
}

function FindingCard({ state, ctx, blocked }: { state: SecurityFindingState; ctx: SecurityStaffContext; blocked: boolean }) {
  const assign = useSecurityAuditStore((s) => s.assignFinding)
  const unassign = useSecurityAuditStore((s) => s.unassignFinding)
  const findings = useSecurityAuditStore((s) => s.findings)
  const def = getSecurityFinding(state.findingId)
  if (!def) return null

  if (state.status === 'closed') {
    return (
      <div className="sb-card sb-card--closed">
        <div className="sb-card-title">{def.title}</div>
        <div className="sb-card-status">
          Закрыто{state.closedAt ? ` · Спринт ${state.closedAt.sprintNumber} · День ${state.closedAt.day}` : ''}
        </div>
      </div>
    )
  }

  const eligible = getEligibleEmployeesForFinding(state.findingId, ctx)
  return (
    <div className="sb-card">
      <div className="sb-card-title">{def.title}</div>
      <div className={`sb-card-sev sb-card-sev--${def.severity}`}>{SEVERITY_LABEL[def.severity]}</div>
      <p className="sb-card-desc">{def.description}</p>
      <div className="sb-card-progress">
        Прогресс: {state.progressDays}/{def.effortDays} · осталось {getRemainingSecurityEffort(state)} дн
      </div>
      {state.assignedEmployeeId ? (
        <div className="sb-card-assignee">
          <span>Исполнитель: {securityEmployeeName(state.assignedEmployeeId)}</span>
          <button className="sb-btn" disabled={blocked} onClick={() => unassign(state.findingId)}>
            Снять назначение
          </button>
        </div>
      ) : (
        <div className="sb-card-assign">
          <span className="sb-card-assign-label">Назначить:</span>
          {eligible.length === 0 ? (
            <span className="sb-card-none">нет доступных сотрудников</span>
          ) : (
            eligible.map((empId) => {
              const busy = getEmployeeActiveSecurityFinding(findings, empId)
              return (
                <button
                  key={empId}
                  className="sb-btn"
                  disabled={blocked || !!busy}
                  title={busy ? 'Сотрудник уже занимается другим замечанием' : undefined}
                  onClick={() => assign(state.findingId, empId)}
                >
                  {securityEmployeeName(empId)}
                </button>
              )
            })
          )}
        </div>
      )}
    </div>
  )
}

// Detected risk observations (Feature 09). Factors are shown only with Ilya.
function RiskObservations() {
  const signals = useRiskStore((s) => s.signals)
  const revealDetailedFactors = useTeamStore((s) => hasSecuritySpecialist(s.hires))
  const observations = buildRiskObservations(signals, { revealDetailedFactors })
  if (observations.length === 0) return null

  return (
    <div className="sb-observations">
      <h3 className="team-section-title">Наблюдения и риски</h3>
      {observations.map((o) => (
        <div className={`sb-obs sb-obs--${o.level}`} key={o.domain}>
          <div className="sb-obs-title">{o.title}</div>
          <div className="sb-obs-level">{RISK_LEVEL_LABEL[o.level]}</div>
          <p className="sb-obs-summary">{o.summary}</p>
          {o.factorLabels.length > 0 ? (
            <>
              <div className="sb-obs-factors-label">Факторы:</div>
              <ul className="sb-obs-factors">
                {o.factorLabels.map((f) => (
                  <li key={f}>{f}</li>
                ))}
              </ul>
            </>
          ) : null}
        </div>
      ))}
    </div>
  )
}

const ACCESS_CONTROL_ASSIGNEES: { id: AccessControlAssigneeId; name: string }[] = [
  { id: 'sonya-sokolova', name: 'Соня Соколова' },
  { id: 'ilya-vlasov', name: 'Илья Власов' },
]

function AccessControlConfirm({ onClose }: { onClose: () => void }) {
  const approve = useAccessControlStore((s) => s.approveAccessControl)
  const sprintNumber = useSprintStore((s) => s.sprintNumber)
  const day = useSprintStore((s) => s.day)
  const balance = calculateBalance(useEconomyStore((s) => s.transactions))
  const depletesBudget = balance - ACCESS_CONTROL_INVESTMENT_COST <= 0
  const confirm = () => {
    approve({ sprintNumber, day })
    // Feature 12: an optional cost that empties the budget registers the defeat
    // right after the confirmation closes (checked once, not via a balance watcher).
    registerGameFailureIfNeeded('security-investment:access-control', { sprintNumber, day })
    onClose()
  }
  return (
    <div className="overlay-backdrop" onClick={onClose}>
      <div className="sprint-confirm" onClick={(e) => e.stopPropagation()}>
        <h3 className="sprint-confirm-title">Одобрить внедрение СКУД?</h3>
        <dl className="sprint-confirm-figures">
          <div>
            <dt>Стоимость</dt>
            <dd>{formatRubles(ACCESS_CONTROL_INVESTMENT_COST)}</dd>
          </div>
          <div>
            <dt>Текущий бюджет</dt>
            <dd>{formatRubles(balance)}</dd>
          </div>
          <div>
            <dt>После оплаты останется</dt>
            <dd>{formatRubles(balance - ACCESS_CONTROL_INVESTMENT_COST)}</dd>
          </div>
        </dl>
        <p className="sprint-confirm-text">После оплаты потребуется назначить Соню или Илью на внедрение системы.</p>
        {depletesBudget ? (
          <p className="sprint-confirm-warning">
            После этой операции бюджет будет исчерпан. Проект будет закрыт из-за невозможности оплачивать работу команды.
          </p>
        ) : null}
        <div className="sprint-confirm-actions">
          <button className="primary" onClick={confirm}>
            Одобрить
          </button>
          <button className="sprint-secondary" onClick={onClose}>
            Отмена
          </button>
        </div>
      </div>
    </div>
  )
}

// Feature 12: the final leadership deadline after the third failed audit.
function LeadershipDeadline() {
  const review = useGameOutcomeStore((s) => s.leadershipReview)
  const findings = useSecurityAuditStore((s) => s.findings)
  const sprintNumber = useSprintStore((s) => s.sprintNumber)
  const day = useSprintStore((s) => s.day)
  if (review.status !== 'grace-period' || review.dueWorkdayIndex === undefined) return null
  const daysLeft = Math.max(0, review.dueWorkdayIndex - toWorkdayIndex(sprintNumber, day))
  const openFindings = getUnresolvedFindingIds(findings).length
  const critical = daysLeft <= 2
  return (
    <div className={critical ? 'sb-deadline sb-deadline--crit' : 'sb-deadline sb-deadline--due'}>
      <strong>Финальное требование руководства.</strong>{' '}
      {daysLeft === 0
        ? 'Сегодня руководство принимает решение по проекту.'
        : `До приостановки проекта: ${daysLeft} рабочих дней.`}{' '}
      Открытых замечаний: {openFindings}.
    </div>
  )
}

function AccessControlCard() {
  const accessControl = useAccessControlStore((s) => s.accessControl)
  const followUpAudit = useSecurityAuditStore((s) => s.followUpAudit)
  const findings = useSecurityAuditStore((s) => s.findings)
  const hires = useTeamStore((s) => s.hires)
  const postpone = useAccessControlStore((s) => s.postponeAccessControl)
  const assign = useAccessControlStore((s) => s.assignAccessControlImplementation)
  const unassign = useAccessControlStore((s) => s.unassignAccessControlImplementation)
  const sprintNumber = useSprintStore((s) => s.sprintNumber)
  const day = useSprintStore((s) => s.day)
  const [confirming, setConfirming] = useState(false)

  const status = accessControl.proposalStatus
  if (status === 'locked') return null

  const hasIlya = hasSecuritySpecialist(hires)
  const auditBlocked = isFollowUpAuditBlocking(followUpAudit)

  if (status === 'active') {
    return (
      <div className="sb-observations">
        <h3 className="team-section-title">Контроль доступа</h3>
        <div className="sb-card sb-card--closed">
          <div className="sb-card-title">Система контроля и управления доступом</div>
          <div className="sb-card-status">СКУД введена в эксплуатацию. Риск физического доступа снижен.</div>
        </div>
      </div>
    )
  }

  return (
    <div className="sb-observations">
      <h3 className="team-section-title">Контроль доступа</h3>
      <div className="sb-card">
        <div className="sb-card-title">Система контроля и управления доступом</div>
        {status === 'available' || status === 'postponed' ? (
          <>
            <p className="sb-card-desc">
              Наблюдения показывают, что сотрудники и посетители могут проходить в рабочие зоны без достаточного контроля.
            </p>
            <div className="sb-card-progress">
              Стоимость оборудования и настройки: {formatRubles(ACCESS_CONTROL_INVESTMENT_COST)}
              <br />
              Срок внедрения: 2 рабочих дня с Ильёй · 3 рабочих дня силами Сони.
            </div>
            {status === 'postponed' ? <p className="sb-card-status">Внедрение СКУД отложено.</p> : null}
            <div className="sb-card-assign">
              <button className="primary" onClick={() => setConfirming(true)}>
                {status === 'postponed' ? 'Вернуться к внедрению' : 'Одобрить внедрение'}
              </button>
              {status === 'available' ? (
                <button className="sb-btn" onClick={() => postpone({ sprintNumber, day })}>
                  Отложить решение
                </button>
              ) : null}
            </div>
          </>
        ) : (
          <>
            <div className="sb-card-progress">
              Внедрение СКУД · Прогресс: {accessControl.progressDays}/
              {accessControl.assignedEmployeeId ? getAccessControlEffortDays(accessControl.assignedEmployeeId) : 3}
              {accessControl.assignedEmployeeId ? ` · осталось ${getRemainingAccessControlEffort(accessControl)} дн` : ''}
            </div>
            {accessControl.assignedEmployeeId ? (
              <div className="sb-card-assignee">
                <span>Исполнитель: {securityEmployeeName(accessControl.assignedEmployeeId)}</span>
                <button className="sb-btn" disabled={auditBlocked} onClick={unassign}>
                  Снять назначение
                </button>
              </div>
            ) : (
              <div className="sb-card-assign">
                <span className="sb-card-assign-label">Исполнитель:</span>
                {ACCESS_CONTROL_ASSIGNEES.map((e) => {
                  const notHired = e.id === 'ilya-vlasov' && !hasIlya
                  const busy = !!getEmployeeActiveSecurityFinding(findings, e.id)
                  return (
                    <button
                      key={e.id}
                      className="sb-btn"
                      disabled={notHired || busy || auditBlocked}
                      title={notHired ? 'Илья не нанят' : busy ? 'Сотрудник занят замечанием' : undefined}
                      onClick={() => assign(e.id)}
                    >
                      {e.name}
                      {e.id === 'ilya-vlasov' ? ' (2 дн)' : ' (3 дн)'}
                    </button>
                  )
                })}
              </div>
            )}
          </>
        )}
      </div>
      {confirming ? <AccessControlConfirm onClose={() => setConfirming(false)} /> : null}
    </div>
  )
}

// Ongoing infrastructure incidents + their recovery assignment (Feature 11).
function ServerIncidentsCard() {
  const incidents = useServerIncidentStore((s) => s.incidents)
  const assign = useServerIncidentStore((s) => s.assignServerRecovery)
  const unassign = useServerIncidentStore((s) => s.unassignServerRecovery)
  const findings = useSecurityAuditStore((s) => s.findings)
  const followUpAudit = useSecurityAuditStore((s) => s.followUpAudit)
  const accessControl = useAccessControlStore((s) => s.accessControl)
  const hires = useTeamStore((s) => s.hires)

  const active = Object.values(incidents).filter((s) => s.status === 'recovery-required' || s.status === 'recovering')
  if (active.length === 0) return null

  const hasIlya = hasSecuritySpecialist(hires)
  const blocked = isFollowUpAuditBlocking(followUpAudit)
  const incidentStates = Object.values(incidents)

  return (
    <div className="sb-observations">
      <h3 className="team-section-title">Инфраструктурные инциденты</h3>
      {active.map((state) => {
        const def = getServerIncident(state.incidentId)!
        const effort = getServerRecoveryEffort(state.incidentId, state.hadSecuritySpecialistAtIncident === true)
        return (
          <div className="sb-card" key={state.incidentId}>
            <div className="sb-card-title">{def.title}</div>
            <div className="sb-card-status">Сервис ограничен</div>
            <div className="sb-card-progress">
              Простой: {formatRubles(getServerDowntimeCost(state.incidentId))} за рабочий день
              <br />
              Восстановление: {state.recoveryProgressDays}/{effort}
              {state.assignedEmployeeId ? ` · осталось ${getRemainingServerRecoveryEffort(state)} дн` : ''}
            </div>
            {state.assignedEmployeeId ? (
              <div className="sb-card-assignee">
                <span>Исполнитель: {securityEmployeeName(state.assignedEmployeeId)}</span>
                <button className="sb-btn" disabled={blocked} onClick={() => unassign(state.incidentId)}>
                  Снять назначение
                </button>
              </div>
            ) : (
              <div className="sb-card-assign">
                <span className="sb-card-assign-label">Исполнитель:</span>
                {def.eligibleEmployeeIds.map((empId) => {
                  const notHired = empId === 'ilya-vlasov' && !hasIlya
                  const active = getEmployeeActiveSecurityWork(empId, findings, accessControl, incidentStates)
                  const busy = !!active && !(active.kind === 'server-recovery' && active.id === state.incidentId)
                  return (
                    <button
                      key={empId}
                      className="sb-btn"
                      disabled={notHired || busy || blocked}
                      title={notHired ? 'Илья не нанят' : busy ? 'Сотрудник занят другой работой по безопасности' : undefined}
                      onClick={() => assign(state.incidentId, empId)}
                    >
                      {securityEmployeeName(empId)}
                    </button>
                  )
                })}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

function SecurityBoard() {
  const findings = useSecurityAuditStore((s) => s.findings)
  const followUpAudit = useSecurityAuditStore((s) => s.followUpAudit)
  const hires = useTeamStore((s) => s.hires)
  const acknowledge = useRiskStore((s) => s.acknowledgeDetectedSignals)
  const sprintNumber = useSprintStore((s) => s.sprintNumber)
  const day = useSprintStore((s) => s.day)
  const ctx: SecurityStaffContext = { hasKirill: isEmployeeHired(hires, 'kirill-morozov'), hasIlya: hasSecuritySpecialist(hires) }
  const blocked = isFollowUpAuditBlocking(followUpAudit)

  // Opening the security tab acknowledges the detected signals (clears the
  // badge) without changing the risk. No new detection can happen while the
  // board overlay is open, so acknowledging once on open is enough.
  useEffect(() => {
    acknowledge(toWorkdayIndex(sprintNumber, day))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div className="sb">
      <div className="pb-header">
        <h2 className="pb-title">Безопасность проекта</h2>
      </div>
      <SecurityDeadline />
      <LeadershipDeadline />
      <div className="sb-cards">
        {findings.map((f) => (
          <FindingCard key={f.findingId} state={f} ctx={ctx} blocked={blocked} />
        ))}
      </div>
      <ServerIncidentsCard />
      <AccessControlCard />
      <RiskObservations />
    </div>
  )
}

// The whiteboard panel: two tabs - OfficeFlow development (product board) and
// the existing department tasks. Blocks scene clicks via the shared backdrop.
export function WhiteboardPanel() {
  const open = useProductStore((s) => s.boardOpen)
  const close = useProductStore((s) => s.closeBoard)
  const tab = useProductStore((s) => s.boardTab)
  const setTab = useProductStore((s) => s.setTab)
  // The security tab only exists once the corrective-action plan is initialised.
  const securityInitialized = useSecurityAuditStore((s) => s.initialized)
  const unacknowledgedRisks = useRiskStore((s) => getUnacknowledgedDetectedCount(s.signals))

  if (!open) return null

  const select = (t: BoardTab) => () => setTab(t)
  // Guard against a persisted 'security' tab when the plan is not initialised.
  const activeTab: BoardTab = tab === 'security' && !securityInitialized ? 'product' : tab

  return (
    <div className="overlay-backdrop" onClick={close}>
      <div className="whiteboard-panel" onClick={(e) => e.stopPropagation()}>
        <button className="finance-close" onClick={close} aria-label="Закрыть">
          ✕
        </button>
        <div className="wb-tabs">
          <button className={activeTab === 'product' ? 'wb-tab wb-tab--active' : 'wb-tab'} onClick={select('product')}>
            Разработка OfficeFlow
          </button>
          <button className={activeTab === 'department' ? 'wb-tab wb-tab--active' : 'wb-tab'} onClick={select('department')}>
            Задачи отдела
          </button>
          {securityInitialized ? (
            <button className={activeTab === 'security' ? 'wb-tab wb-tab--active' : 'wb-tab'} onClick={select('security')}>
              Безопасность{unacknowledgedRisks > 0 ? ` (${unacknowledgedRisks})` : ''}
            </button>
          ) : null}
        </div>
        {activeTab === 'product' ? <ProductBoard /> : activeTab === 'security' ? <SecurityBoard /> : <DepartmentTasks />}
      </div>
    </div>
  )
}
