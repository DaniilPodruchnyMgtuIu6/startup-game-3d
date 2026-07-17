import { describe, it, expect, beforeEach } from 'vitest'
import { useSprintStore, loadSprint, saveSprint } from './sprintStore'
import { INITIAL_SPRINT_STATE, SPRINT_DAYS } from './sprintRules'

function fakeStorage(initial: Record<string, string> = {}) {
  const data = new Map(Object.entries(initial))
  return {
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => void data.set(k, v),
    removeItem: (k: string) => void data.delete(k),
    dump: () => Object.fromEntries(data),
  }
}

const KEY = 'startup-office-sprint'

describe('loadSprint', () => {
  it('starts at the initial state when nothing is saved (fresh or pre-sprint save)', () => {
    expect(loadSprint(fakeStorage(), '')).toEqual(INITIAL_SPRINT_STATE)
  })

  it('restores a saved sprint state', () => {
    const storage = fakeStorage({ [KEY]: JSON.stringify({ sprintNumber: 2, day: 6, phase: 'active' }) })
    expect(loadSprint(storage, '')).toEqual({ sprintNumber: 2, day: 6, phase: 'active' })
  })

  it('?intro wipes the saved sprint and returns the initial state', () => {
    const storage = fakeStorage({ [KEY]: JSON.stringify({ sprintNumber: 4, day: 9, phase: 'active' }) })
    expect(loadSprint(storage, '?intro')).toEqual(INITIAL_SPRINT_STATE)
    expect(storage.dump()).toEqual({})
  })

  it('ignores corrupted JSON and out-of-range values', () => {
    expect(loadSprint(fakeStorage({ [KEY]: '{oops' }), '')).toEqual(INITIAL_SPRINT_STATE)
    expect(loadSprint(fakeStorage({ [KEY]: JSON.stringify({ sprintNumber: 1, day: 99, phase: 'active' }) }), '')).toEqual(
      INITIAL_SPRINT_STATE,
    )
    expect(loadSprint(fakeStorage({ [KEY]: JSON.stringify({ sprintNumber: 1, day: 3, phase: 'weekend' }) }), '')).toEqual(
      INITIAL_SPRINT_STATE,
    )
  })

  it('works without storage (private mode)', () => {
    expect(loadSprint(null, '')).toEqual(INITIAL_SPRINT_STATE)
    expect(() => saveSprint(null, INITIAL_SPRINT_STATE)).not.toThrow()
  })
})

describe('sprintStore', () => {
  beforeEach(() => {
    useSprintStore.setState({ ...INITIAL_SPRINT_STATE, confirmingEndDay: false })
    window.localStorage.clear()
  })

  it('starts a sprint: planning -> active on day 1', () => {
    useSprintStore.getState().startSprint()
    expect(useSprintStore.getState().phase).toBe('active')
    expect(useSprintStore.getState().day).toBe(1)
    expect(useSprintStore.getState().sprintNumber).toBe(1)
  })

  it('requesting end of day opens a confirmation without moving the day', () => {
    useSprintStore.getState().startSprint()
    useSprintStore.getState().requestEndDay()
    expect(useSprintStore.getState().confirmingEndDay).toBe(true)
    expect(useSprintStore.getState().day).toBe(1)
  })

  it('cancel closes the confirmation and leaves the day unchanged', () => {
    useSprintStore.getState().startSprint()
    useSprintStore.getState().requestEndDay()
    useSprintStore.getState().cancelEndDay()
    expect(useSprintStore.getState().confirmingEndDay).toBe(false)
    expect(useSprintStore.getState().day).toBe(1)
  })

  it('confirm advances the day and closes the confirmation', () => {
    useSprintStore.getState().startSprint()
    useSprintStore.getState().requestEndDay()
    useSprintStore.getState().confirmEndDay()
    expect(useSprintStore.getState().day).toBe(2)
    expect(useSprintStore.getState().confirmingEndDay).toBe(false)
  })

  it('a repeated confirm does not advance the day twice', () => {
    useSprintStore.getState().startSprint()
    useSprintStore.getState().requestEndDay()
    useSprintStore.getState().confirmEndDay()
    useSprintStore.getState().confirmEndDay() // no open confirmation now
    expect(useSprintStore.getState().day).toBe(2)
  })

  it('ending day 10 opens the review, never reaching day 11', () => {
    useSprintStore.getState().startSprint()
    for (let i = 0; i < SPRINT_DAYS - 1; i++) {
      useSprintStore.getState().requestEndDay()
      useSprintStore.getState().confirmEndDay()
    }
    expect(useSprintStore.getState().day).toBe(SPRINT_DAYS)
    expect(useSprintStore.getState().phase).toBe('active')
    // end day 10
    useSprintStore.getState().requestEndDay()
    useSprintStore.getState().confirmEndDay()
    expect(useSprintStore.getState().day).toBe(SPRINT_DAYS)
    expect(useSprintStore.getState().phase).toBe('review')
  })

  it('completing the review opens the next sprint in planning on day 1', () => {
    useSprintStore.setState({ sprintNumber: 1, day: SPRINT_DAYS, phase: 'review', confirmingEndDay: false })
    useSprintStore.getState().completeSprintReview()
    expect(useSprintStore.getState()).toMatchObject({ sprintNumber: 2, day: 1, phase: 'planning' })
  })

  it('persists across a reload (loadSprint reads what the store saved)', () => {
    useSprintStore.getState().startSprint()
    useSprintStore.getState().requestEndDay()
    useSprintStore.getState().confirmEndDay() // now active day 2
    expect(loadSprint(window.localStorage, '')).toEqual({ sprintNumber: 1, day: 2, phase: 'active' })
  })

  it('resetSprint returns to the initial state', () => {
    useSprintStore.setState({ sprintNumber: 3, day: 8, phase: 'active', confirmingEndDay: true })
    useSprintStore.getState().resetSprint()
    expect(useSprintStore.getState()).toMatchObject({ ...INITIAL_SPRINT_STATE, confirmingEndDay: false })
  })
})
