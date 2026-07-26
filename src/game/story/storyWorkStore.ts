import { create } from 'zustand'
import { isIntroReset } from '../gameStore'

// Story work assignments (Feature 17B): an employee occupied for N workdays by
// a decision consequence (Ilya's review, Kirill's restore drill, Alina's
// synthetic data...). One completed day reduces every busy employee's remaining
// effort by exactly one day; developers on story work make no product progress
// that day (completeWorkday excludes them, same as security findings). Each
// assignment has a stable id, so a repeated handler call can never duplicate
// it. Own store + localStorage key - other saves stay untouched.

const STORY_WORK_STORAGE_KEY = 'startup-office-story-work'

export interface StoryWorkAssignment {
  // Stable id: `${operationId}:${employeeId}` - the idempotency key.
  id: string
  employeeId: string
  // Human-readable purpose for the HUD/report (already localized at creation).
  title: string
  remainingDays: number
  // The day key (sprint:day) this assignment last consumed, so one game day
  // never decrements the same assignment twice (reload safety).
  lastAppliedDayKey?: string
}

type StoryStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>

function safeStorage(): StoryStorage | null {
  try {
    return window.localStorage
  } catch {
    return null
  }
}

export function normalizeStoryWork(raw: unknown): StoryWorkAssignment[] {
  if (!raw || typeof raw !== 'object') return []
  const list = (raw as { assignments?: unknown }).assignments
  if (!Array.isArray(list)) return []
  const seen = new Set<string>()
  const out: StoryWorkAssignment[] = []
  for (const entry of list) {
    if (!entry || typeof entry !== 'object') continue
    const { id, employeeId, title, remainingDays, lastAppliedDayKey } = entry as Record<string, unknown>
    if (typeof id !== 'string' || id.length === 0 || seen.has(id)) continue
    if (typeof employeeId !== 'string' || employeeId.length === 0) continue
    if (typeof remainingDays !== 'number' || !Number.isFinite(remainingDays)) continue
    const days = Math.max(0, Math.floor(remainingDays))
    if (days === 0) continue // finished assignments are dropped on load
    seen.add(id)
    out.push({
      id,
      employeeId,
      title: typeof title === 'string' ? title : '',
      remainingDays: days,
      ...(typeof lastAppliedDayKey === 'string' ? { lastAppliedDayKey } : {}),
    })
  }
  return out
}

export function loadStoryWork(storage: StoryStorage | null, search: string): StoryWorkAssignment[] {
  if (isIntroReset(search)) {
    storage?.removeItem(STORY_WORK_STORAGE_KEY)
    return []
  }
  if (!storage) return []
  const raw = storage.getItem(STORY_WORK_STORAGE_KEY)
  if (!raw) return []
  try {
    return normalizeStoryWork(JSON.parse(raw))
  } catch {
    return []
  }
}

export interface ApplyStoryWorkdayResult {
  // Employees who spent this day on story work (excluded from product progress).
  busyEmployeeIds: string[]
  // Assignments that reached zero remaining days on this call.
  finishedAssignmentIds: string[]
}

interface StoryWorkStore {
  assignments: StoryWorkAssignment[]
  // Adds an assignment once (by id). Days <= 0 or a duplicate id are no-ops.
  addAssignmentOnce: (assignment: Omit<StoryWorkAssignment, 'lastAppliedDayKey'>) => { added: boolean }
  isEmployeeBusy: (employeeId: string) => boolean
  // One completed game day: every active assignment loses one day (once per
  // day key). Returns who was busy and what finished.
  applyStoryWorkday: (sprintNumber: number, day: number) => ApplyStoryWorkdayResult
  resetStoryWork: () => void
}

const initial = loadStoryWork(safeStorage(), typeof window === 'undefined' ? '' : window.location.search)

export const useStoryWorkStore = create<StoryWorkStore>()((set, get) => {
  const persist = () => {
    try {
      safeStorage()?.setItem(STORY_WORK_STORAGE_KEY, JSON.stringify({ assignments: get().assignments }))
    } catch {
      // private mode
    }
  }

  return {
    assignments: initial,

    addAssignmentOnce: (assignment) => {
      if (assignment.remainingDays <= 0) return { added: false }
      if (get().assignments.some((a) => a.id === assignment.id)) return { added: false }
      set({ assignments: [...get().assignments, { ...assignment }] })
      persist()
      return { added: true }
    },

    isEmployeeBusy: (employeeId) => get().assignments.some((a) => a.employeeId === employeeId && a.remainingDays > 0),

    applyStoryWorkday: (sprintNumber, day) => {
      const dayKey = `${sprintNumber}:${day}`
      const busyEmployeeIds: string[] = []
      const finishedAssignmentIds: string[] = []
      let changed = false
      const next = get().assignments.map((a) => {
        if (a.remainingDays <= 0 || a.lastAppliedDayKey === dayKey) {
          if (a.remainingDays > 0 && a.lastAppliedDayKey === dayKey && !busyEmployeeIds.includes(a.employeeId)) {
            // already applied for this day (reload) - the employee is still busy
            busyEmployeeIds.push(a.employeeId)
          }
          return a
        }
        changed = true
        if (!busyEmployeeIds.includes(a.employeeId)) busyEmployeeIds.push(a.employeeId)
        const remaining = a.remainingDays - 1
        if (remaining === 0) finishedAssignmentIds.push(a.id)
        return { ...a, remainingDays: remaining, lastAppliedDayKey: dayKey }
      })
      if (changed) {
        set({ assignments: next.filter((a) => a.remainingDays > 0) })
        persist()
      }
      return { busyEmployeeIds, finishedAssignmentIds }
    },

    resetStoryWork: () => {
      set({ assignments: [] })
      persist()
    },
  }
})
