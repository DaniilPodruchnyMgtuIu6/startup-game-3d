import { describe, it, expect, beforeEach } from 'vitest'
import { useStoryWorkStore, loadStoryWork, normalizeStoryWork } from './storyWorkStore'

const work = () => useStoryWorkStore.getState()

beforeEach(() => {
  window.localStorage.clear()
  work().resetStoryWork()
})

describe('story work assignments (17B)', () => {
  it('adds an assignment once by id and reports the employee busy', () => {
    expect(work().addAssignmentOnce({ id: 'op:kirill', employeeId: 'kirill-morozov', title: 'x', remainingDays: 2 }).added).toBe(true)
    expect(work().addAssignmentOnce({ id: 'op:kirill', employeeId: 'kirill-morozov', title: 'x', remainingDays: 2 }).added).toBe(false)
    expect(work().isEmployeeBusy('kirill-morozov')).toBe(true)
    expect(work().assignments).toHaveLength(1)
  })

  it('one confirmed day consumes exactly one day per assignment, once per day key', () => {
    work().addAssignmentOnce({ id: 'op:kirill', employeeId: 'kirill-morozov', title: 'x', remainingDays: 2 })
    const first = work().applyStoryWorkday(1, 3)
    expect(first.busyEmployeeIds).toEqual(['kirill-morozov'])
    expect(work().assignments[0].remainingDays).toBe(1)

    // the same day again (reload) - no double decrement, still busy
    const repeat = work().applyStoryWorkday(1, 3)
    expect(repeat.busyEmployeeIds).toEqual(['kirill-morozov'])
    expect(work().assignments[0].remainingDays).toBe(1)

    const second = work().applyStoryWorkday(1, 4)
    expect(second.finishedAssignmentIds).toEqual(['op:kirill'])
    expect(work().assignments).toHaveLength(0)
    expect(work().isEmployeeBusy('kirill-morozov')).toBe(false)
  })

  it('persistence drops finished assignments and survives corrupt blobs', () => {
    expect(normalizeStoryWork({ assignments: [{ id: 'a', employeeId: 'e', title: 't', remainingDays: 0 }] })).toEqual([])
    expect(normalizeStoryWork('garbage')).toEqual([])
    window.localStorage.setItem('startup-office-story-work', '{broken')
    expect(loadStoryWork(window.localStorage, '')).toEqual([])
    expect(loadStoryWork(window.localStorage, '?intro')).toEqual([])
  })
})
