import { describe, it, expect } from 'vitest'
import { toWorkdayIndex, fromWorkdayIndex, getDaysUntilAudit, SPRINT_DAYS } from './workdayIndex'

describe('workday index', () => {
  it('SPRINT_DAYS is 10', () => {
    expect(SPRINT_DAYS).toBe(10)
  })

  it.each([
    [1, 1, 1],
    [1, 10, 10],
    [2, 1, 11],
    [3, 4, 24],
  ])('toWorkdayIndex(sprint %i, day %i) = %i', (sprint, day, idx) => {
    expect(toWorkdayIndex(sprint, day)).toBe(idx)
  })

  it('fromWorkdayIndex is the inverse', () => {
    for (let s = 1; s <= 5; s++) {
      for (let d = 1; d <= 10; d++) {
        const idx = toWorkdayIndex(s, d)
        expect(fromWorkdayIndex(idx)).toEqual({ sprintNumber: s, day: d })
      }
    }
  })

  it('fromWorkdayIndex clamps invalid values to at least sprint 1 day 1', () => {
    expect(fromWorkdayIndex(0)).toEqual({ sprintNumber: 1, day: 1 })
    expect(fromWorkdayIndex(-5)).toEqual({ sprintNumber: 1, day: 1 })
  })

  it('getDaysUntilAudit never goes negative', () => {
    expect(getDaysUntilAudit(12, 21)).toBe(9)
    expect(getDaysUntilAudit(21, 21)).toBe(0)
    expect(getDaysUntilAudit(25, 21)).toBe(0)
  })
})
