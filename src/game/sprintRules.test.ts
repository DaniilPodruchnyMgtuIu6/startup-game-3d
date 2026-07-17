import { describe, it, expect } from 'vitest'
import {
  INITIAL_SPRINT_STATE,
  SPRINT_DAYS,
  advanceSprintDay,
  completeSprintReview,
  normalizeSprintState,
  startSprint,
  type SprintState,
} from './sprintRules'

const active = (day: number): SprintState => ({ sprintNumber: 1, day, phase: 'active' })

describe('sprintRules', () => {
  it('initial state is sprint 1, day 1, planning', () => {
    expect(INITIAL_SPRINT_STATE).toEqual({ sprintNumber: 1, day: 1, phase: 'planning' })
  })

  it('startSprint moves planning to active, keeping day 1 and the sprint number', () => {
    expect(startSprint(INITIAL_SPRINT_STATE)).toEqual({ sprintNumber: 1, day: 1, phase: 'active' })
  })

  it('ending a day on days 1..9 increments the day and stays active', () => {
    for (let day = 1; day <= SPRINT_DAYS - 1; day++) {
      expect(advanceSprintDay(active(day))).toEqual({ sprintNumber: 1, day: day + 1, phase: 'active' })
    }
  })

  it('ending day 10 moves to review and keeps the day at 10', () => {
    expect(advanceSprintDay(active(SPRINT_DAYS))).toEqual({ sprintNumber: 1, day: SPRINT_DAYS, phase: 'review' })
  })

  it('the day never becomes 11', () => {
    // simulate confirming end-of-day repeatedly through a whole sprint
    let state: SprintState = startSprint(INITIAL_SPRINT_STATE)
    for (let i = 0; i < 20; i++) state = advanceSprintDay(state)
    expect(state.day).toBe(SPRINT_DAYS)
    expect(state.phase).toBe('review')
  })

  it('completeSprintReview opens the next sprint in planning on day 1', () => {
    const review: SprintState = { sprintNumber: 3, day: SPRINT_DAYS, phase: 'review' }
    expect(completeSprintReview(review)).toEqual({ sprintNumber: 4, day: 1, phase: 'planning' })
  })

  describe('illegal transitions are no-ops', () => {
    it('startSprint outside planning does nothing', () => {
      const s = active(4)
      expect(startSprint(s)).toBe(s)
      const review: SprintState = { sprintNumber: 1, day: SPRINT_DAYS, phase: 'review' }
      expect(startSprint(review)).toBe(review)
    })

    it('advanceSprintDay outside active does nothing', () => {
      expect(advanceSprintDay(INITIAL_SPRINT_STATE)).toBe(INITIAL_SPRINT_STATE)
      const review: SprintState = { sprintNumber: 1, day: SPRINT_DAYS, phase: 'review' }
      expect(advanceSprintDay(review)).toBe(review)
    })

    it('completeSprintReview outside review does nothing', () => {
      expect(completeSprintReview(INITIAL_SPRINT_STATE)).toBe(INITIAL_SPRINT_STATE)
      const a = active(2)
      expect(completeSprintReview(a)).toBe(a)
    })
  })

  describe('normalizeSprintState', () => {
    it('keeps a valid state', () => {
      const s = { sprintNumber: 2, day: 5, phase: 'active' }
      expect(normalizeSprintState(s)).toEqual(s)
    })

    it('forces planning onto day 1', () => {
      expect(normalizeSprintState({ sprintNumber: 2, day: 7, phase: 'planning' })).toEqual({
        sprintNumber: 2,
        day: 1,
        phase: 'planning',
      })
    })

    it.each([
      ['day 0', { sprintNumber: 1, day: 0, phase: 'active' }],
      ['day 100', { sprintNumber: 1, day: 100, phase: 'active' }],
      ['unknown phase', { sprintNumber: 1, day: 3, phase: 'weekend' }],
      ['negative sprint number', { sprintNumber: -2, day: 3, phase: 'active' }],
      ['non-integer day', { sprintNumber: 1, day: 3.5, phase: 'active' }],
      ['missing fields', { phase: 'active' }],
      ['null', null],
      ['string', 'nope'],
      ['number', 42],
    ])('falls back to the initial state for %s', (_label, input) => {
      expect(normalizeSprintState(input)).toEqual(INITIAL_SPRINT_STATE)
    })
  })
})
