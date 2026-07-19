import { describe, it, expect, beforeEach } from 'vitest'
import { useProductStore, loadProduct, saveProduct } from './productStore'
import { useSprintStore } from './sprintStore'
import { useTeamStore } from './teamStore'
import { initialTaskStates, productReadiness } from './productRules'
import { INITIAL_SPRINT_STATE } from './sprintRules'

function fakeStorage(initial: Record<string, string> = {}) {
  const data = new Map(Object.entries(initial))
  return {
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => void data.set(k, v),
    removeItem: (k: string) => void data.delete(k),
    dump: () => Object.fromEntries(data),
  }
}
const KEY = 'startup-office-product'
const status = (taskId: string) => useProductStore.getState().taskStates.find((t) => t.taskId === taskId)?.status

function resetStores(phase: 'planning' | 'active' | 'review' = 'planning') {
  useSprintStore.setState({ ...INITIAL_SPRINT_STATE, phase, confirmingEndDay: false })
  useProductStore.setState({ taskStates: initialTaskStates(), workdayHistory: [], activeReport: null, boardOpen: false, boardTab: 'product' })
  // Feature 16 §6: planning requires the development team hired.
  useTeamStore.setState({
    hires: [
      { employeeId: 'kirill-morozov', hiredAtSprint: 1, hiredAtDay: 1 },
      { employeeId: 'alina-belova', hiredAtSprint: 1, hiredAtDay: 1 },
    ],
    panelOpen: false,
  })
  window.localStorage.clear()
}

describe('loadProduct (migration & persistence)', () => {
  it('an old save without product state gets 14 backlog tasks, 0% readiness', () => {
    const { taskStates, workdayHistory } = loadProduct(fakeStorage(), '')
    expect(taskStates).toHaveLength(14)
    expect(workdayHistory).toEqual([])
    expect(productReadiness(taskStates)).toBe(0)
  })

  it('corrupt JSON falls back to a fresh backlog', () => {
    expect(loadProduct(fakeStorage({ [KEY]: '{oops' }), '').taskStates).toHaveLength(14)
  })

  it('?intro wipes product state', () => {
    const storage = fakeStorage({ [KEY]: JSON.stringify({ taskStates: [{ taskId: 'auth-api', status: 'done', progressDays: 3 }], workdayHistory: [] }) })
    const loaded = loadProduct(storage, '?intro')
    expect(productReadiness(loaded.taskStates)).toBe(0)
    expect(storage.dump()).toEqual({})
  })

  it('works without storage', () => {
    expect(loadProduct(null, '').taskStates).toHaveLength(14)
    expect(() => saveProduct(null, { taskStates: [], workdayHistory: [] })).not.toThrow()
  })
})

describe('productStore planning', () => {
  beforeEach(() => resetStores('planning'))

  it('adds / removes tasks only during planning', () => {
    useProductStore.getState().addTaskToPlan('auth-api')
    expect(status('auth-api')).toBe('planned')
    useProductStore.getState().removeTaskFromPlan('auth-api')
    expect(status('auth-api')).toBe('backlog')
  })

  it('ignores plan changes during active / review', () => {
    useSprintStore.setState({ phase: 'active' })
    useProductStore.getState().addTaskToPlan('auth-api')
    expect(status('auth-api')).toBe('backlog')
    useSprintStore.setState({ phase: 'review' })
    useProductStore.getState().addTaskToPlan('auth-api')
    expect(status('auth-api')).toBe('backlog')
  })

  it('persists the plan', () => {
    useProductStore.getState().addTaskToPlan('auth-api')
    const loaded = loadProduct(window.localStorage, '')
    expect(loaded.taskStates.find((t) => t.taskId === 'auth-api')?.status).toBe('planned')
  })
})

describe('productStore.applyWorkday', () => {
  beforeEach(() => resetStores('active'))

  it('applies once and is idempotent for the same day (no double progress)', () => {
    useProductStore.setState((s) => ({ taskStates: s.taskStates })) // no-op keep
    // plan a task manually (bypass phase guard via setState of task states)
    useProductStore.setState({
      taskStates: initialTaskStates().map((t) => (t.taskId === 'auth-api' ? { ...t, status: 'planned', plannedSprintNumber: 1, planOrder: 1 } : t)),
    })
    const first = useProductStore.getState().applyWorkday(1, 1, ['kirill-morozov'])
    expect(first.applied).toBe(true)
    expect(status('auth-api')).toBe('in-progress')
    const second = useProductStore.getState().applyWorkday(1, 1, ['kirill-morozov'])
    expect(second.applied).toBe(false)
    expect(useProductStore.getState().taskStates.find((t) => t.taskId === 'auth-api')?.progressDays).toBe(1)
    expect(useProductStore.getState().workdayHistory).toHaveLength(1)
  })

  it('resetProduct returns to a fresh backlog', () => {
    useProductStore.getState().applyWorkday(1, 1, ['kirill-morozov'])
    useProductStore.getState().resetProduct()
    expect(useProductStore.getState().taskStates).toHaveLength(14)
    expect(useProductStore.getState().workdayHistory).toEqual([])
    expect(productReadiness(useProductStore.getState().taskStates)).toBe(0)
  })
})
