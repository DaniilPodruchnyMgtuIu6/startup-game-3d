import { describe, it, expect, beforeEach } from 'vitest'
import { completeWorkday } from './completeWorkday'
import { useSprintStore } from './sprintStore'
import { useEconomyStore } from './economyStore'
import { INITIAL_SPRINT_STATE, SPRINT_DAYS } from './sprintRules'
import { BASE_DAILY_COST, BASE_SPRINT_COST, INITIAL_BUDGET, calculateBalance, initialTransactions, sprintExpenseTotal } from './economyRules'

const balance = () => calculateBalance(useEconomyStore.getState().transactions)

function setSprint(day: number, phase: 'planning' | 'active' | 'review', confirming = false) {
  useSprintStore.setState({ sprintNumber: 1, day, phase, confirmingEndDay: confirming })
}

describe('completeWorkday', () => {
  beforeEach(() => {
    useSprintStore.setState({ ...INITIAL_SPRINT_STATE, confirmingEndDay: false })
    useEconomyStore.setState({ transactions: initialTransactions(), panelOpen: false })
    window.localStorage.clear()
  })

  it('the single day-completion op charges the day AND advances the sprint', () => {
    setSprint(1, 'active', true)
    const result = completeWorkday()
    expect(result).toMatchObject({ completed: true, economyApplied: true, chargedAmount: BASE_DAILY_COST })
    expect(useSprintStore.getState().day).toBe(2)
    expect(useSprintStore.getState().confirmingEndDay).toBe(false)
    expect(balance()).toBe(INITIAL_BUDGET - BASE_DAILY_COST)
  })

  it('does nothing (no charge, no advance) without an open confirmation', () => {
    setSprint(1, 'active', false)
    const result = completeWorkday()
    expect(result).toEqual({ completed: false, reason: 'invalid-sprint-state' })
    expect(useSprintStore.getState().day).toBe(1)
    expect(balance()).toBe(INITIAL_BUDGET)
  })

  it('planning does not charge', () => {
    setSprint(1, 'planning', true)
    expect(completeWorkday().completed).toBe(false)
    expect(balance()).toBe(INITIAL_BUDGET)
  })

  it('a repeated confirm does not charge or advance twice', () => {
    setSprint(1, 'active', true)
    completeWorkday()
    const second = completeWorkday() // confirmation already consumed
    expect(second.completed).toBe(false)
    expect(useSprintStore.getState().day).toBe(2)
    expect(balance()).toBe(INITIAL_BUDGET - BASE_DAILY_COST)
  })

  it('day 10 is charged before the sprint moves to review', () => {
    setSprint(SPRINT_DAYS, 'active', true)
    const result = completeWorkday()
    expect(result.completed).toBe(true)
    expect(useSprintStore.getState().phase).toBe('review')
    expect(useSprintStore.getState().day).toBe(SPRINT_DAYS)
    // the day-10 expense exists in the journal (charged before review)
    expect(sprintExpenseTotal(useEconomyStore.getState().transactions, 1)).toBe(BASE_DAILY_COST)
  })

  it('a full sprint of 10 completed days costs exactly 200 000 ₽', () => {
    setSprint(1, 'active')
    for (let i = 0; i < SPRINT_DAYS; i++) {
      useSprintStore.getState().requestEndDay()
      completeWorkday()
      if (useSprintStore.getState().phase === 'active') {
        // still active, keep going next iteration
      }
    }
    expect(useSprintStore.getState().phase).toBe('review')
    expect(sprintExpenseTotal(useEconomyStore.getState().transactions, 1)).toBe(BASE_SPRINT_COST)
    expect(balance()).toBe(INITIAL_BUDGET - BASE_SPRINT_COST)
  })

  it('moving from review to the next sprint does not charge', () => {
    useSprintStore.setState({ sprintNumber: 1, day: SPRINT_DAYS, phase: 'review', confirmingEndDay: false })
    const before = balance()
    useSprintStore.getState().completeSprintReview()
    expect(useSprintStore.getState()).toMatchObject({ sprintNumber: 2, day: 1, phase: 'planning' })
    expect(balance()).toBe(before)
  })
})
