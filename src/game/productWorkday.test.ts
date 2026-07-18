import { describe, it, expect, beforeEach } from 'vitest'
import { completeWorkday } from './completeWorkday'
import { startSprintWithPlan, canStartSprintWithPlan } from './startSprintWithPlan'
import { completeSprintAndPrepareNextPlanning } from './completeSprintReview'
import { useSprintStore } from './sprintStore'
import { useEconomyStore } from './economyStore'
import { useTeamStore } from './teamStore'
import { useProductStore } from './productStore'
import { INITIAL_SPRINT_STATE, SPRINT_DAYS } from './sprintRules'
import { INITIAL_BUDGET, calculateBalance, initialTransactions } from './economyRules'
import { addToPlan, initialTaskStates, productReadiness } from './productRules'

const KIRILL = 'kirill-morozov'
const ALINA = 'alina-belova'
const balance = () => calculateBalance(useEconomyStore.getState().transactions)
const taskStatus = (id: string) => useProductStore.getState().taskStates.find((t) => t.taskId === id)?.status

function planTasks(ids: string[]) {
  let states = initialTaskStates()
  for (const id of ids) states = addToPlan(states, id, 1)
  useProductStore.setState({ taskStates: states })
}

function resetAll() {
  useSprintStore.setState({ ...INITIAL_SPRINT_STATE, phase: 'active', confirmingEndDay: false })
  useEconomyStore.setState({ transactions: initialTransactions(), panelOpen: false })
  useTeamStore.setState({
    hires: [
      { employeeId: KIRILL, hiredAtSprint: 1, hiredAtDay: 1 },
      { employeeId: ALINA, hiredAtSprint: 1, hiredAtDay: 1 },
    ],
    panelOpen: false,
  })
  useProductStore.setState({ taskStates: initialTaskStates(), workdayHistory: [], activeReport: null, boardOpen: false, boardTab: 'product' })
  window.localStorage.clear()
}

const completeDay = (day: number) => {
  useSprintStore.setState({ day, phase: 'active', confirmingEndDay: true })
  return completeWorkday()
}

describe('completeWorkday applies product + finance + advance together', () => {
  beforeEach(resetAll)

  it('one day: +1 progress per dev, charged once, day advanced, report shown', () => {
    planTasks(['auth-api', 'login-screen'])
    const result = completeDay(1)
    expect(result.completed).toBe(true)
    expect(taskStatus('auth-api')).toBe('in-progress')
    expect(useProductStore.getState().taskStates.find((t) => t.taskId === 'auth-api')?.progressDays).toBe(1)
    expect(useProductStore.getState().taskStates.find((t) => t.taskId === 'login-screen')?.progressDays).toBe(1)
    expect(balance()).toBe(INITIAL_BUDGET - 37_000) // both salaries charged once
    expect(useSprintStore.getState().day).toBe(2)
    expect(useProductStore.getState().activeReport?.day).toBe(1) // daily report queued
  })

  it('a repeated confirm does not progress or charge twice', () => {
    planTasks(['auth-api', 'login-screen'])
    completeDay(1) // confirmingEndDay cleared, day advanced to 2
    const second = completeWorkday() // no open confirmation -> rejected
    expect(second.completed).toBe(false)
    expect(useProductStore.getState().taskStates.find((t) => t.taskId === 'auth-api')?.progressDays).toBe(1)
    expect(balance()).toBe(INITIAL_BUDGET - 37_000)
  })

  it('re-running the same day id is idempotent even if the confirmation is forced open', () => {
    planTasks(['auth-api', 'login-screen'])
    completeDay(1)
    // force the sprint back to day 1 confirming (simulates a corrupted/replayed state)
    useSprintStore.setState({ day: 1, phase: 'active', confirmingEndDay: true })
    completeWorkday()
    // product day-1 and finance day-1 were already applied -> no doubling
    expect(useProductStore.getState().taskStates.find((t) => t.taskId === 'auth-api')?.progressDays).toBe(1)
    expect(balance()).toBe(INITIAL_BUDGET - 37_000)
    expect(useProductStore.getState().workdayHistory).toHaveLength(1)
  })

  it('idle developer makes no progress but salary is still charged', () => {
    planTasks(['auth-api']) // only Kirill planned
    completeDay(1)
    expect(useProductStore.getState().taskStates.find((t) => t.taskId === 'auth-api')?.progressDays).toBe(1)
    const alina = useProductStore.getState().activeReport?.employeeResults.find((r) => r.employeeId === ALINA)
    expect(alina?.idleReason).toBe('no-planned-task')
    expect(balance()).toBe(INITIAL_BUDGET - 37_000) // Alina salary still charged
  })

  it('finishing all six prototype tasks takes two sprints and yields the prototype at 34% readiness', () => {
    const proto = ['auth-api', 'rooms-api', 'booking-api', 'login-screen', 'rooms-screen', 'booking-form']
    planTasks(proto)
    // Feature 15 balance: prototype is Kirill 16 / Alina 14 days — sprint 1 is
    // no longer enough, the rest carries over into sprint 2.
    for (let day = 1; day <= SPRINT_DAYS; day++) completeDay(day)
    useSprintStore.setState({ phase: 'review' })
    completeSprintAndPrepareNextPlanning()
    let states = useProductStore.getState().taskStates
    for (const id of proto) {
      if (states.find((t) => t.taskId === id)?.status !== 'done') states = addToPlan(states, id, 2)
    }
    useProductStore.setState({ taskStates: states })
    for (let day = 1; day <= 6; day++) completeDay(day)

    const finalStates = useProductStore.getState().taskStates
    expect(proto.every((id) => finalStates.find((t) => t.taskId === id)?.status === 'done')).toBe(true)
    expect(productReadiness(finalStates)).toBe(34) // 30/87
    expect(balance()).toBe(INITIAL_BUDGET - 16 * 37_000) // 16 charged days
  })
})

describe('startSprintWithPlan', () => {
  beforeEach(resetAll)

  it('first sprint blocked without a task for each developer', () => {
    useSprintStore.setState({ sprintNumber: 1, day: 1, phase: 'planning', confirmingEndDay: false })
    planTasks(['auth-api']) // only backend
    expect(canStartSprintWithPlan()).toEqual({ started: false, reason: 'first-sprint-needs-both-roles' })
    planTasks(['auth-api', 'login-screen'])
    expect(startSprintWithPlan()).toEqual({ started: true })
    expect(useSprintStore.getState().phase).toBe('active')
  })

  it('later sprint needs at least one planned incomplete task', () => {
    useSprintStore.setState({ sprintNumber: 2, day: 1, phase: 'planning', confirmingEndDay: false })
    expect(canStartSprintWithPlan()).toEqual({ started: false, reason: 'no-planned-tasks' })
    planTasks(['rooms-api'])
    expect(startSprintWithPlan()).toEqual({ started: true })
  })
})

describe('completeSprintAndPrepareNextPlanning', () => {
  beforeEach(resetAll)

  it('carries incomplete tasks to backlog, keeps done, advances to next planning, no charge', () => {
    // auth-api done, rooms-api partially done, both planned in sprint 1
    useProductStore.setState({
      taskStates: initialTaskStates().map((t) => {
        if (t.taskId === 'auth-api') return { ...t, status: 'done', progressDays: 3, plannedSprintNumber: 1, planOrder: 1, completedAt: { sprintNumber: 1, day: 3 } }
        if (t.taskId === 'rooms-api') return { ...t, status: 'in-progress', progressDays: 2, plannedSprintNumber: 1, planOrder: 2 }
        return t
      }),
    })
    useSprintStore.setState({ sprintNumber: 1, day: SPRINT_DAYS, phase: 'review', confirmingEndDay: false })
    const before = balance()
    completeSprintAndPrepareNextPlanning()
    const auth = useProductStore.getState().taskStates.find((t) => t.taskId === 'auth-api')!
    const rooms = useProductStore.getState().taskStates.find((t) => t.taskId === 'rooms-api')!
    expect(auth.status).toBe('done')
    expect(rooms.status).toBe('backlog')
    expect(rooms.progressDays).toBe(2) // partial progress carried over
    expect(rooms.plannedSprintNumber).toBeUndefined()
    expect(useSprintStore.getState()).toMatchObject({ sprintNumber: 2, day: 1, phase: 'planning' })
    expect(balance()).toBe(before) // no money moved
  })
})
