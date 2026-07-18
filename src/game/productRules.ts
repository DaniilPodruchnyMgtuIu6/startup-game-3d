import {
  EMPLOYEE_SPRINT_CAPACITY_DAYS,
  FIRST_PROTOTYPE_TASK_IDS,
  PRODUCT_TASK_CATALOG,
  TOTAL_EFFORT_DAYS,
  getProductTask,
} from './productTaskCatalog'

// Pure, deterministic development rules for OfficeFlow. No randomness, no real
// time, no LLM - one confirmed day = at most one day of progress per developer.
// Kept out of React and the store so every rule is unit-testable in isolation.

export type ProductTaskStatus = 'backlog' | 'planned' | 'in-progress' | 'done'

export interface ProductTaskState {
  taskId: string
  status: ProductTaskStatus
  progressDays: number
  plannedSprintNumber?: number
  planOrder?: number
  completedAt?: { sprintNumber: number; day: number }
}

export interface WorkdayEmployeeProgress {
  employeeId: string
  taskId?: string
  beforeProgressDays?: number
  afterProgressDays?: number
  completedTask?: boolean
  // 'security-diverted' (Feature 08): the developer spent the day on an audit
  // finding, so their product task made no progress this day.
  idleReason?: 'no-planned-task' | 'all-planned-tasks-done' | 'security-diverted'
}

export interface WorkdayProgressRecord {
  id: string
  sprintNumber: number
  day: number
  employeeResults: WorkdayEmployeeProgress[]
  productProgressBefore: number
  productProgressAfter: number
}

export type EmployeeLoad = 'normal' | 'full' | 'overloaded'

// --- Initial state ---------------------------------------------------------

export function initialTaskStates(): ProductTaskState[] {
  return PRODUCT_TASK_CATALOG.map((t) => ({ taskId: t.id, status: 'backlog', progressDays: 0 }))
}

function findState(states: ProductTaskState[], taskId: string): ProductTaskState | undefined {
  return states.find((s) => s.taskId === taskId)
}

function replace(states: ProductTaskState[], taskId: string, next: ProductTaskState): ProductTaskState[] {
  return states.map((s) => (s.taskId === taskId ? next : s))
}

function effortOf(taskId: string): number {
  return getProductTask(taskId)?.effortDays ?? 0
}

export function remainingEffort(state: ProductTaskState): number {
  return Math.max(0, effortOf(state.taskId) - state.progressDays)
}

// --- Planning (only valid while the sprint phase is `planning`) -------------

export function canModifyPlan(phase: 'planning' | 'active' | 'review'): boolean {
  return phase === 'planning'
}

// Add a backlog task to the current sprint plan. planOrder is a monotonically
// increasing counter, so a developer's queue is simply their planned tasks
// sorted by planOrder.
export function addToPlan(states: ProductTaskState[], taskId: string, sprintNumber: number): ProductTaskState[] {
  const state = findState(states, taskId)
  if (!state || !getProductTask(taskId) || state.status === 'done' || state.status === 'planned' || state.status === 'in-progress') {
    return states
  }
  const nextOrder = 1 + states.reduce((max, s) => Math.max(max, s.planOrder ?? 0), 0)
  return replace(states, taskId, { ...state, status: 'planned', plannedSprintNumber: sprintNumber, planOrder: nextOrder })
}

export function removeFromPlan(states: ProductTaskState[], taskId: string): ProductTaskState[] {
  const state = findState(states, taskId)
  if (!state || (state.status !== 'planned' && state.status !== 'in-progress')) return states
  const { plannedSprintNumber: _p, planOrder: _o, ...rest } = state
  return replace(states, taskId, { ...rest, status: 'backlog' })
}

function plannedForEmployee(states: ProductTaskState[], employeeId: string, sprintNumber?: number): ProductTaskState[] {
  return states
    .filter((s) => {
      const def = getProductTask(s.taskId)
      if (!def || def.assigneeEmployeeId !== employeeId) return false
      if (s.status !== 'planned' && s.status !== 'in-progress') return false
      if (sprintNumber !== undefined && s.plannedSprintNumber !== sprintNumber) return false
      return true
    })
    .sort((a, b) => (a.planOrder ?? 0) - (b.planOrder ?? 0))
}

// Move a task up/down within its own developer's queue by swapping planOrder
// with the adjacent task.
export function moveInPlan(states: ProductTaskState[], taskId: string, direction: 'up' | 'down'): ProductTaskState[] {
  const def = getProductTask(taskId)
  const state = findState(states, taskId)
  if (!def || !state || (state.status !== 'planned' && state.status !== 'in-progress')) return states
  const queue = plannedForEmployee(states, def.assigneeEmployeeId, state.plannedSprintNumber)
  const index = queue.findIndex((s) => s.taskId === taskId)
  const neighborIndex = direction === 'up' ? index - 1 : index + 1
  if (neighborIndex < 0 || neighborIndex >= queue.length) return states
  const neighbor = queue[neighborIndex]
  let next = replace(states, taskId, { ...state, planOrder: neighbor.planOrder })
  next = replace(next, neighbor.taskId, { ...neighbor, planOrder: state.planOrder })
  return next
}

// --- Load --------------------------------------------------------------------

export function plannedLoadForEmployee(states: ProductTaskState[], employeeId: string): number {
  return plannedForEmployee(states, employeeId).reduce((sum, s) => sum + remainingEffort(s), 0)
}

export function loadStatus(days: number): EmployeeLoad {
  if (days > EMPLOYEE_SPRINT_CAPACITY_DAYS) return 'overloaded'
  if (days >= EMPLOYEE_SPRINT_CAPACITY_DAYS - 1) return 'full'
  return 'normal'
}

export function isPlanOverloaded(states: ProductTaskState[], employeeIds: string[]): boolean {
  return employeeIds.some((id) => plannedLoadForEmployee(states, id) > EMPLOYEE_SPRINT_CAPACITY_DAYS)
}

// --- Start conditions --------------------------------------------------------

function hasPlannedRole(states: ProductTaskState[], role: 'backend-developer' | 'frontend-developer'): boolean {
  return states.some((s) => {
    const def = getProductTask(s.taskId)
    return def?.role === role && (s.status === 'planned' || s.status === 'in-progress')
  })
}

// First sprint requires at least one planned task for each developer.
export function isFirstSprintPlanValid(states: ProductTaskState[]): boolean {
  return hasPlannedRole(states, 'backend-developer') && hasPlannedRole(states, 'frontend-developer')
}

export function hasAnyPlannedIncomplete(states: ProductTaskState[]): boolean {
  return states.some((s) => (s.status === 'planned' || s.status === 'in-progress') && remainingEffort(s) > 0)
}

// Employees who have no planned task this sprint (used for the salary warning).
export function employeesWithoutPlan(states: ProductTaskState[], employeeIds: string[]): string[] {
  return employeeIds.filter((id) => plannedForEmployee(states, id).length === 0)
}

// --- Deterministic daily progress -------------------------------------------

function applyEmployeeDay(
  states: ProductTaskState[],
  employeeId: string,
  sprintNumber: number,
  day: number,
): { states: ProductTaskState[]; result: WorkdayEmployeeProgress } {
  const queue = plannedForEmployee(states, employeeId, sprintNumber)
  if (queue.length === 0) {
    return { states, result: { employeeId, idleReason: 'no-planned-task' } }
  }
  const target = queue.find((s) => remainingEffort(s) > 0)
  if (!target) {
    return { states, result: { employeeId, idleReason: 'all-planned-tasks-done' } }
  }
  const before = target.progressDays
  const after = before + 1
  const effort = effortOf(target.taskId)
  const completed = after >= effort
  const next: ProductTaskState = {
    ...target,
    progressDays: after,
    status: completed ? 'done' : 'in-progress',
    completedAt: completed ? { sprintNumber, day } : target.completedAt,
  }
  return {
    states: replace(states, target.taskId, next),
    result: {
      employeeId,
      taskId: target.taskId,
      beforeProgressDays: before,
      afterProgressDays: after,
      completedTask: completed,
    },
  }
}

// Applies one working day of progress for every given employee (each at most
// one day, on the first unfinished task of their queue). Employees in
// `excludedEmployeeIds` are diverted to security work (Feature 08): they make no
// product progress and are recorded with the 'security-diverted' reason so the
// daily report can explain the skipped day. Returns the new task states and the
// day's progress record (without an id - the store assigns the deterministic id
// and guards idempotency).
export function applyWorkdayProgress(
  states: ProductTaskState[],
  sprintNumber: number,
  day: number,
  employeeIds: string[],
  excludedEmployeeIds: string[] = [],
): { states: ProductTaskState[]; record: Omit<WorkdayProgressRecord, 'id'> } {
  const productProgressBefore = productReadiness(states)
  const excluded = new Set(excludedEmployeeIds)
  let current = states
  const employeeResults: WorkdayEmployeeProgress[] = []
  for (const employeeId of employeeIds) {
    if (excluded.has(employeeId)) {
      employeeResults.push({ employeeId, idleReason: 'security-diverted' })
      continue
    }
    const applied = applyEmployeeDay(current, employeeId, sprintNumber, day)
    current = applied.states
    employeeResults.push(applied.result)
  }
  return {
    states: current,
    record: { sprintNumber, day, employeeResults, productProgressAfter: productReadiness(current), productProgressBefore },
  }
}

export function workdayProgressId(sprintNumber: number, day: number): string {
  return `product-work:sprint-${sprintNumber}:day-${day}`
}

// --- Readiness ---------------------------------------------------------------

// Credited progress days: each task's progress clamped to its effort, unknown
// tasks ignored.
export function creditedProgressDays(states: ProductTaskState[]): number {
  return states.reduce((sum, s) => {
    const effort = effortOf(s.taskId)
    if (effort === 0) return sum
    return sum + Math.min(Math.max(0, s.progressDays), effort)
  }, 0)
}

export function productReadiness(states: ProductTaskState[]): number {
  const pct = Math.floor((creditedProgressDays(states) / TOTAL_EFFORT_DAYS) * 100)
  return Math.min(100, Math.max(0, pct))
}

// --- First prototype milestone ----------------------------------------------

export function hasFirstPrototype(states: ProductTaskState[]): boolean {
  return FIRST_PROTOTYPE_TASK_IDS.every((id) => findState(states, id)?.status === 'done')
}

export function firstPrototypeDoneCount(states: ProductTaskState[]): number {
  return FIRST_PROTOTYPE_TASK_IDS.filter((id) => findState(states, id)?.status === 'done').length
}

// The milestone date is the latest completedAt among the six prototype tasks
// (undefined until all six are done).
export function getFirstPrototypeCompletion(states: ProductTaskState[]): { sprintNumber: number; day: number } | undefined {
  if (!hasFirstPrototype(states)) return undefined
  let latest: { sprintNumber: number; day: number } | undefined
  for (const id of FIRST_PROTOTYPE_TASK_IDS) {
    const at = findState(states, id)?.completedAt
    if (!at) return undefined
    if (!latest || at.sprintNumber > latest.sprintNumber || (at.sprintNumber === latest.sprintNumber && at.day > latest.day)) {
      latest = at
    }
  }
  return latest
}

// --- Sprint results & carry-over --------------------------------------------

export function completedInSprint(states: ProductTaskState[], sprintNumber: number): ProductTaskState[] {
  return states.filter((s) => s.status === 'done' && s.completedAt?.sprintNumber === sprintNumber)
}

export function incompletePlanned(states: ProductTaskState[], sprintNumber: number): ProductTaskState[] {
  return states.filter(
    (s) => (s.status === 'planned' || s.status === 'in-progress') && s.plannedSprintNumber === sprintNumber && remainingEffort(s) > 0,
  )
}

// Return incomplete planned tasks to the backlog keeping their progress; done
// tasks stay done. Clears plannedSprintNumber/planOrder on carried-over tasks.
export function prepareNextPlanning(states: ProductTaskState[]): ProductTaskState[] {
  return states.map((s) => {
    if (s.status === 'planned' || s.status === 'in-progress') {
      const { plannedSprintNumber: _p, planOrder: _o, ...rest } = s
      return { ...rest, status: 'backlog' as ProductTaskStatus }
    }
    return s
  })
}

// --- Normalisation (load/corrupt handling) ----------------------------------

const STATUSES: ProductTaskStatus[] = ['backlog', 'planned', 'in-progress', 'done']

function sanitizeTaskState(raw: unknown): ProductTaskState | null {
  if (!raw || typeof raw !== 'object') return null
  const r = raw as Record<string, unknown>
  const def = typeof r.taskId === 'string' ? getProductTask(r.taskId) : undefined
  if (!def) return null
  const status = STATUSES.includes(r.status as ProductTaskStatus) ? (r.status as ProductTaskStatus) : 'backlog'
  const rawProgress = typeof r.progressDays === 'number' && Number.isFinite(r.progressDays) ? Math.floor(r.progressDays) : 0
  const progressDays = Math.min(def.effortDays, Math.max(0, rawProgress))
  const state: ProductTaskState = { taskId: def.id, status, progressDays }
  if (typeof r.plannedSprintNumber === 'number' && Number.isInteger(r.plannedSprintNumber) && r.plannedSprintNumber >= 1) {
    state.plannedSprintNumber = r.plannedSprintNumber
  }
  if (typeof r.planOrder === 'number' && Number.isInteger(r.planOrder) && r.planOrder >= 0) {
    state.planOrder = r.planOrder
  }
  const at = r.completedAt as Record<string, unknown> | undefined
  if (at && typeof at.sprintNumber === 'number' && typeof at.day === 'number') {
    state.completedAt = { sprintNumber: at.sprintNumber, day: at.day }
  }
  // keep status/progress consistent: full progress => done
  if (progressDays >= def.effortDays) state.status = 'done'
  if (status === 'done' && progressDays < def.effortDays) state.status = 'in-progress'
  return state
}

// Rebuild a complete, valid task-state list (one per catalog task) from a
// loaded/corrupt blob. Missing tasks default to backlog; unknown/duplicate ids
// are dropped.
export function normalizeTaskStates(raw: unknown): ProductTaskState[] {
  const byId = new Map<string, ProductTaskState>()
  if (Array.isArray(raw)) {
    for (const entry of raw) {
      const s = sanitizeTaskState(entry)
      if (s && !byId.has(s.taskId)) byId.set(s.taskId, s)
    }
  }
  return PRODUCT_TASK_CATALOG.map((def) => byId.get(def.id) ?? { taskId: def.id, status: 'backlog', progressDays: 0 })
}

export function normalizeHistory(raw: unknown): WorkdayProgressRecord[] {
  if (!Array.isArray(raw)) return []
  const seen = new Set<string>()
  const out: WorkdayProgressRecord[] = []
  for (const entry of raw) {
    if (!entry || typeof entry !== 'object') continue
    const r = entry as Record<string, unknown>
    if (typeof r.id !== 'string' || seen.has(r.id)) continue
    if (typeof r.sprintNumber !== 'number' || typeof r.day !== 'number') continue
    if (!Array.isArray(r.employeeResults)) continue
    seen.add(r.id)
    out.push({
      id: r.id,
      sprintNumber: r.sprintNumber,
      day: r.day,
      employeeResults: r.employeeResults as WorkdayEmployeeProgress[],
      productProgressBefore: typeof r.productProgressBefore === 'number' ? r.productProgressBefore : 0,
      productProgressAfter: typeof r.productProgressAfter === 'number' ? r.productProgressAfter : 0,
    })
  }
  return out
}
