import { describe, it, expect } from 'vitest'
import {
  EMPLOYEE_SPRINT_CAPACITY_DAYS,
  FIRST_PROTOTYPE_TASK_IDS,
  PRODUCT_TASK_CATALOG,
  TOTAL_EFFORT_DAYS,
} from './productTaskCatalog'
import {
  addToPlan,
  applyWorkdayProgress,
  canModifyPlan,
  getFirstPrototypeCompletion,
  hasFirstPrototype,
  initialTaskStates,
  isFirstSprintPlanValid,
  isPlanOverloaded,
  loadStatus,
  moveInPlan,
  normalizeTaskStates,
  plannedLoadForEmployee,
  prepareNextPlanning,
  productReadiness,
  removeFromPlan,
  type ProductTaskState,
} from './productRules'

const KIRILL = 'kirill-morozov'
const ALINA = 'alina-belova'
const BOTH = [KIRILL, ALINA]

// plan a task into sprint 1
const plan = (states: ProductTaskState[], id: string) => addToPlan(states, id, 1)

describe('product catalog', () => {
  it('has exactly 14 tasks with unique ids', () => {
    expect(PRODUCT_TASK_CATALOG).toHaveLength(14)
    expect(new Set(PRODUCT_TASK_CATALOG.map((t) => t.id)).size).toBe(14)
  })

  it('has 6 prototype tasks and 8 mvp tasks', () => {
    expect(PRODUCT_TASK_CATALOG.filter((t) => t.group === 'prototype')).toHaveLength(6)
    expect(PRODUCT_TASK_CATALOG.filter((t) => t.group === 'mvp')).toHaveLength(8)
  })

  it('assigns backend to Kirill and frontend to Alina', () => {
    for (const t of PRODUCT_TASK_CATALOG) {
      expect(t.assigneeEmployeeId).toBe(t.role === 'backend-developer' ? KIRILL : ALINA)
    }
  })

  it('total effort is 87 days, prototype is 30 (Feature 15 balance pass)', () => {
    expect(TOTAL_EFFORT_DAYS).toBe(87)
    expect(PRODUCT_TASK_CATALOG.filter((t) => t.group === 'prototype').reduce((s, t) => s + t.effortDays, 0)).toBe(30)
  })
})

describe('planning', () => {
  it('canModifyPlan only during planning', () => {
    expect(canModifyPlan('planning')).toBe(true)
    expect(canModifyPlan('active')).toBe(false)
    expect(canModifyPlan('review')).toBe(false)
  })

  it('add / remove / reorder', () => {
    let s = initialTaskStates()
    s = plan(s, 'auth-api')
    s = plan(s, 'rooms-api')
    expect(s.find((t) => t.taskId === 'auth-api')?.status).toBe('planned')
    // reorder: rooms-api up -> before auth-api
    const before = plannedLoadForEmployee(s, KIRILL)
    s = moveInPlan(s, 'rooms-api', 'up')
    const authOrder = s.find((t) => t.taskId === 'auth-api')!.planOrder!
    const roomsOrder = s.find((t) => t.taskId === 'rooms-api')!.planOrder!
    expect(roomsOrder).toBeLessThan(authOrder)
    expect(plannedLoadForEmployee(s, KIRILL)).toBe(before) // reorder does not change load
    // remove
    s = removeFromPlan(s, 'auth-api')
    expect(s.find((t) => t.taskId === 'auth-api')?.status).toBe('backlog')
  })

  it('load counts remaining (not original) effort; loadStatus thresholds', () => {
    let s = initialTaskStates()
    s = plan(s, 'auth-api') // 6
    s = plan(s, 'rooms-api') // 5
    s = plan(s, 'booking-api') // 5
    expect(plannedLoadForEmployee(s, KIRILL)).toBe(16)
    expect(loadStatus(8)).toBe('normal')
    expect(loadStatus(9)).toBe('full')
    expect(loadStatus(EMPLOYEE_SPRINT_CAPACITY_DAYS)).toBe('full')
    expect(loadStatus(11)).toBe('overloaded')
  })

  it('overload does not block starting but is detectable', () => {
    let s = initialTaskStates()
    for (const id of ['auth-api', 'rooms-api', 'booking-api', 'employees-api']) s = plan(s, id) // 6+5+5+8 = 24
    expect(plannedLoadForEmployee(s, KIRILL)).toBe(24)
    expect(isPlanOverloaded(s, BOTH)).toBe(true)
  })

  it('first sprint requires a task for each developer', () => {
    let s = initialTaskStates()
    s = plan(s, 'auth-api')
    expect(isFirstSprintPlanValid(s)).toBe(false) // only backend
    s = plan(s, 'login-screen')
    expect(isFirstSprintPlanValid(s)).toBe(true)
  })
})

describe('deterministic daily progress', () => {
  it('each developer makes at most one day of progress, on their first queued task', () => {
    let s = initialTaskStates()
    s = plan(s, 'auth-api') // Kirill, effort 3
    s = plan(s, 'rooms-api') // Kirill, effort 3 (second in queue)
    s = plan(s, 'login-screen') // Alina, effort 2
    const { states, record } = applyWorkdayProgress(s, 1, 1, BOTH)
    const auth = states.find((t) => t.taskId === 'auth-api')!
    const rooms = states.find((t) => t.taskId === 'rooms-api')!
    const login = states.find((t) => t.taskId === 'login-screen')!
    expect(auth.progressDays).toBe(1) // first Kirill task
    expect(rooms.progressDays).toBe(0) // not the same day
    expect(login.progressDays).toBe(1)
    expect(record.employeeResults.find((r) => r.employeeId === KIRILL)?.taskId).toBe('auth-api')
  })

  it('completes a task and records completedAt when effort is reached', () => {
    let s = initialTaskStates()
    s = plan(s, 'login-screen') // effort 4
    for (let day = 1; day <= 4; day++) ({ states: s } = applyWorkdayProgress(s, 1, day, [ALINA]))
    const login = s.find((t) => t.taskId === 'login-screen')!
    expect(login.status).toBe('done')
    expect(login.completedAt).toEqual({ sprintNumber: 1, day: 4 })
  })

  it('idle result when no planned task, salary charged elsewhere', () => {
    const s = initialTaskStates()
    const { record } = applyWorkdayProgress(s, 1, 1, [KIRILL])
    expect(record.employeeResults[0]).toEqual({ employeeId: KIRILL, idleReason: 'no-planned-task' })
  })
})

describe('readiness & prototype', () => {
  const doneStates = (ids: string[]): ProductTaskState[] =>
    initialTaskStates().map((s) =>
      ids.includes(s.taskId)
        ? { ...s, status: 'done', progressDays: PRODUCT_TASK_CATALOG.find((t) => t.id === s.taskId)!.effortDays, completedAt: { sprintNumber: 1, day: 5 } }
        : s,
    )

  it('readiness: 0/87=0, 1/87=1, 30/87=34, 87/87=100', () => {
    expect(productReadiness(initialTaskStates())).toBe(0)
    const one = initialTaskStates().map((s) => (s.taskId === 'auth-api' ? { ...s, progressDays: 1 } : s))
    expect(productReadiness(one)).toBe(1)
    expect(productReadiness(doneStates(FIRST_PROTOTYPE_TASK_IDS))).toBe(34)
    expect(productReadiness(doneStates(PRODUCT_TASK_CATALOG.map((t) => t.id)))).toBe(100)
  })

  it('five prototype tasks are not enough; six give the prototype', () => {
    expect(hasFirstPrototype(doneStates(FIRST_PROTOTYPE_TASK_IDS.slice(0, 5)))).toBe(false)
    expect(hasFirstPrototype(doneStates(FIRST_PROTOTYPE_TASK_IDS))).toBe(true)
  })

  it('milestone date is the latest completedAt of the six', () => {
    const s = doneStates(FIRST_PROTOTYPE_TASK_IDS).map((t) =>
      t.taskId === 'booking-form' ? { ...t, completedAt: { sprintNumber: 1, day: 9 } } : t,
    )
    expect(getFirstPrototypeCompletion(s)).toEqual({ sprintNumber: 1, day: 9 })
  })
})

describe('carry-over & normalisation', () => {
  it('prepareNextPlanning keeps done, returns incomplete to backlog with progress', () => {
    let s = initialTaskStates()
    s = plan(s, 'auth-api')
    s = plan(s, 'login-screen')
    ;({ states: s } = applyWorkdayProgress(s, 1, 1, ['alina-belova'])) // login 1/2, in-progress
    s = prepareNextPlanning(s)
    const auth = s.find((t) => t.taskId === 'auth-api')!
    const login = s.find((t) => t.taskId === 'login-screen')!
    expect(auth.status).toBe('backlog')
    expect(auth.plannedSprintNumber).toBeUndefined()
    expect(login.status).toBe('backlog')
    expect(login.progressDays).toBe(1) // partial progress kept
  })

  it('normalizeTaskStates rebuilds 14 tasks, clamps progress, drops unknown', () => {
    const result = normalizeTaskStates([
      { taskId: 'auth-api', status: 'in-progress', progressDays: 99 }, // clamp to 6 -> done
      { taskId: 'ghost', status: 'done', progressDays: 5 }, // unknown dropped
      { taskId: 'auth-api', status: 'backlog', progressDays: 0 }, // duplicate dropped
      'garbage',
    ])
    expect(result).toHaveLength(14)
    const auth = result.find((t) => t.taskId === 'auth-api')!
    expect(auth.progressDays).toBe(6)
    expect(auth.status).toBe('done')
    expect(result.find((t) => t.taskId === 'ghost')).toBeUndefined()
  })

  it('non-array normalizes to all-backlog', () => {
    const result = normalizeTaskStates('nope')
    expect(result).toHaveLength(14)
    expect(result.every((s) => s.status === 'backlog' && s.progressDays === 0)).toBe(true)
  })
})
