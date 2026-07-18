import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import { WhiteboardPanel } from './WhiteboardPanel'
import { PrototypeMock } from './PrototypeMock'
import { DailyReport } from './DailyReport'
import { useProductStore } from '../game/productStore'
import { useSprintStore } from '../game/sprintStore'
import { useTeamStore } from '../game/teamStore'
import { useEconomyStore } from '../game/economyStore'
import { INITIAL_SPRINT_STATE } from '../game/sprintRules'
import { addToPlan, initialTaskStates } from '../game/productRules'
import { PRODUCT_TASK_CATALOG } from '../game/productTaskCatalog'
import { initialTransactions } from '../game/economyRules'

const bothHired = () =>
  useTeamStore.setState({
    hires: [
      { employeeId: 'kirill-morozov', hiredAtSprint: 1, hiredAtDay: 1 },
      { employeeId: 'alina-belova', hiredAtSprint: 1, hiredAtDay: 1 },
    ],
    panelOpen: false,
  })

beforeEach(() => {
  useSprintStore.setState({ ...INITIAL_SPRINT_STATE, phase: 'planning', confirmingEndDay: false })
  useEconomyStore.setState({ transactions: initialTransactions(), panelOpen: false })
  bothHired()
  useProductStore.setState({
    taskStates: initialTaskStates(),
    workdayHistory: [],
    activeReport: null,
    boardOpen: false,
    boardTab: 'product',
    planningDismissed: false,
    prototypeOpen: false,
  })
})
afterEach(cleanup)

describe('WhiteboardPanel', () => {
  it('shows the OfficeFlow product board with backlog during planning', () => {
    useProductStore.setState({ boardOpen: true, boardTab: 'product' })
    render(<WhiteboardPanel />)
    expect(screen.getByText('OfficeFlow')).toBeTruthy()
    expect(screen.getByText('Готовность продукта: 0%')).toBeTruthy()
    // a couple of backlog task titles are visible
    expect(screen.getByText('API авторизации')).toBeTruthy()
    expect(screen.getByText('Экран входа')).toBeTruthy()
    // 14 "Добавить в спринт" buttons (all backlog)
    expect(screen.getAllByText('Добавить в спринт')).toHaveLength(PRODUCT_TASK_CATALOG.length)
  })

  it('blocks the start until both roles are planned', () => {
    useProductStore.setState({ boardOpen: true, taskStates: addToPlan(initialTaskStates(), 'auth-api', 1) })
    render(<WhiteboardPanel />)
    // only backend planned -> start hint shown, no start button
    expect(screen.queryByRole('button', { name: 'Начать спринт' })).toBeNull()
    expect(screen.getByText(/хотя бы одна задача каждому/)).toBeTruthy()
  })
})

describe('PrototypeMock button gating', () => {
  it('is disabled before the milestone', () => {
    useProductStore.setState({ boardOpen: true })
    render(<WhiteboardPanel />)
    const btn = screen.getByRole('button', { name: 'Открыть прототип' }) as HTMLButtonElement
    expect(btn.disabled).toBe(true)
  })

  it('the mock renders the login screen once opened', () => {
    useProductStore.setState({ prototypeOpen: true })
    render(<PrototypeMock />)
    expect(screen.getByText('Вход сотрудника')).toBeTruthy()
  })
})

describe('DailyReport', () => {
  it('renders per-developer results and the readiness delta', () => {
    useProductStore.setState({
      activeReport: {
        id: 'product-work:sprint-1:day-1',
        sprintNumber: 1,
        day: 1,
        employeeResults: [
          { employeeId: 'kirill-morozov', taskId: 'auth-api', beforeProgressDays: 2, afterProgressDays: 3, completedTask: true },
          { employeeId: 'alina-belova', idleReason: 'no-planned-task' },
        ],
        productProgressBefore: 4,
        productProgressAfter: 7,
      },
    })
    render(<DailyReport />)
    expect(screen.getByText('Итоги дня 1')).toBeTruthy()
    expect(screen.getByText('Задача завершена')).toBeTruthy()
    expect(screen.getByText('Нет назначенных задач. День прошёл без прогресса.')).toBeTruthy()
    expect(screen.getByText('Готовность OfficeFlow: 4% → 7%')).toBeTruthy()
  })
})
