import { useState } from 'react'
import { useProductStore, type BoardTab } from '../game/productStore'
import { useSprintStore } from '../game/sprintStore'
import { useTeamStore } from '../game/teamStore'
import { useEconomyStore } from '../game/economyStore'
import { useGameStore } from '../game/gameStore'
import { PRODUCT_TASK_CATALOG, getProductTask, type ProductTaskDefinition } from '../game/productTaskCatalog'
import { getEmployee, TEAM_CATALOG } from '../game/teamCatalog'
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
  const overloaded = TEAM_CATALOG.some((e) => plannedLoadForEmployee(states, e.id) > 10)
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
        {TEAM_CATALOG.map((e) => (
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

// The whiteboard panel: two tabs - OfficeFlow development (product board) and
// the existing department tasks. Blocks scene clicks via the shared backdrop.
export function WhiteboardPanel() {
  const open = useProductStore((s) => s.boardOpen)
  const close = useProductStore((s) => s.closeBoard)
  const tab = useProductStore((s) => s.boardTab)
  const setTab = useProductStore((s) => s.setTab)

  if (!open) return null

  const select = (t: BoardTab) => () => setTab(t)

  return (
    <div className="overlay-backdrop" onClick={close}>
      <div className="whiteboard-panel" onClick={(e) => e.stopPropagation()}>
        <button className="finance-close" onClick={close} aria-label="Закрыть">
          ✕
        </button>
        <div className="wb-tabs">
          <button className={tab === 'product' ? 'wb-tab wb-tab--active' : 'wb-tab'} onClick={select('product')}>
            Разработка OfficeFlow
          </button>
          <button className={tab === 'department' ? 'wb-tab wb-tab--active' : 'wb-tab'} onClick={select('department')}>
            Задачи отдела
          </button>
        </div>
        {tab === 'product' ? <ProductBoard /> : <DepartmentTasks />}
      </div>
    </div>
  )
}
