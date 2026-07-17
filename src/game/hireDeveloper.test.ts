import { describe, it, expect, beforeEach } from 'vitest'
import { hireDeveloper, BUILD_TEAM_TASK_ID } from './hireDeveloper'
import { completeWorkday } from './completeWorkday'
import { useSprintStore } from './sprintStore'
import { useEconomyStore } from './economyStore'
import { useTeamStore } from './teamStore'
import { useGameStore } from './gameStore'
import { INITIAL_SPRINT_STATE, SPRINT_DAYS } from './sprintRules'
import { INITIAL_BUDGET, calculateBalance, initialTransactions, sprintExpenseTotal } from './economyRules'
import { BOARD_TASKS } from './tasks'

const KIRILL = 'kirill-morozov'
const ALINA = 'alina-belova'
const balance = () => calculateBalance(useEconomyStore.getState().transactions)
const buildTeamDone = () => useGameStore.getState().tasks.find((t) => t.id === BUILD_TEAM_TASK_ID)?.done

function resetAll() {
  useSprintStore.setState({ ...INITIAL_SPRINT_STATE, phase: 'active', confirmingEndDay: false })
  useEconomyStore.setState({ transactions: initialTransactions(), panelOpen: false })
  useTeamStore.setState({ hires: [], panelOpen: false })
  useGameStore.setState({ tasks: BOARD_TASKS.map((t) => ({ ...t, done: false })) })
  window.localStorage.clear()
}

// Confirm-then-complete a day at the given day number.
function completeDay(day: number) {
  useSprintStore.setState({ day, phase: 'active', confirmingEndDay: true })
  return completeWorkday()
}

describe('daily cost by team composition', () => {
  beforeEach(resetAll)

  it('no developers -> 20 000 ₽/day', () => {
    completeDay(1)
    expect(INITIAL_BUDGET - balance()).toBe(20_000)
  })

  it('only Kirill -> 29 000 ₽/day', () => {
    useTeamStore.setState({ hires: [{ employeeId: KIRILL, hiredAtSprint: 1, hiredAtDay: 1 }], panelOpen: false })
    completeDay(1)
    expect(INITIAL_BUDGET - balance()).toBe(29_000)
  })

  it('only Alina -> 28 000 ₽/day', () => {
    useTeamStore.setState({ hires: [{ employeeId: ALINA, hiredAtSprint: 1, hiredAtDay: 1 }], panelOpen: false })
    completeDay(1)
    expect(INITIAL_BUDGET - balance()).toBe(28_000)
  })

  it('both -> 37 000 ₽/day, journal breakdown has 6 items including both salaries', () => {
    useTeamStore.setState({
      hires: [
        { employeeId: KIRILL, hiredAtSprint: 1, hiredAtDay: 1 },
        { employeeId: ALINA, hiredAtSprint: 1, hiredAtDay: 1 },
      ],
      panelOpen: false,
    })
    completeDay(1)
    expect(INITIAL_BUDGET - balance()).toBe(37_000)
    const tx = useEconomyStore.getState().transactions.find((t) => t.id === 'operations:sprint-1:day-1')!
    expect(tx.amount).toBe(37_000)
    expect(tx.breakdown).toHaveLength(6)
    expect(tx.breakdown?.map((i) => i.code)).toContain('salary:kirill-morozov')
    expect(tx.breakdown?.map((i) => i.code)).toContain('salary:alina-belova')
  })

  it('a past day transaction is not changed retroactively when a developer is hired later', () => {
    completeDay(1) // day 1 with no team -> 20 000
    useTeamStore.setState({ hires: [{ employeeId: KIRILL, hiredAtSprint: 1, hiredAtDay: 2 }], panelOpen: false })
    completeDay(2) // day 2 with Kirill -> 29 000
    const day1 = useEconomyStore.getState().transactions.find((t) => t.id === 'operations:sprint-1:day-1')!
    const day2 = useEconomyStore.getState().transactions.find((t) => t.id === 'operations:sprint-1:day-2')!
    expect(day1.amount).toBe(20_000)
    expect(day2.amount).toBe(29_000)
  })

  it('a full sprint with both developers costs 370 000 ₽, leaving 2 130 000 ₽', () => {
    useTeamStore.setState({
      hires: [
        { employeeId: KIRILL, hiredAtSprint: 1, hiredAtDay: 1 },
        { employeeId: ALINA, hiredAtSprint: 1, hiredAtDay: 1 },
      ],
      panelOpen: false,
    })
    for (let day = 1; day <= SPRINT_DAYS; day++) completeDay(day)
    expect(sprintExpenseTotal(useEconomyStore.getState().transactions, 1)).toBe(370_000)
    expect(balance()).toBe(2_130_000)
  })
})

describe('hireDeveloper use-case', () => {
  beforeEach(resetAll)

  it('one hire does not complete the build-team task; both hires complete it', () => {
    useSprintStore.setState({ sprintNumber: 1, day: 1, phase: 'planning', confirmingEndDay: false })
    expect(hireDeveloper(KIRILL).hired).toBe(true)
    expect(buildTeamDone()).toBe(false)
    expect(hireDeveloper(ALINA).hired).toBe(true)
    expect(buildTeamDone()).toBe(true)
  })

  it('records the current sprint/day as the hire context', () => {
    useSprintStore.setState({ sprintNumber: 1, day: 4, phase: 'active', confirmingEndDay: false })
    hireDeveloper(KIRILL)
    expect(useTeamStore.getState().hires).toEqual([{ employeeId: KIRILL, hiredAtSprint: 1, hiredAtDay: 4 }])
  })

  it('is blocked during a sprint review', () => {
    useSprintStore.setState({ sprintNumber: 1, day: 10, phase: 'review', confirmingEndDay: false })
    expect(hireDeveloper(KIRILL)).toEqual({ hired: false, reason: 'invalid-game-state' })
    expect(useTeamStore.getState().hires).toEqual([])
  })
})
