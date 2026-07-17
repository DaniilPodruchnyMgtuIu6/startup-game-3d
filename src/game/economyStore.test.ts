import { describe, it, expect, beforeEach } from 'vitest'
import { useEconomyStore, loadEconomy, saveEconomy } from './economyStore'
import {
  BASE_DAILY_COST,
  INITIAL_BUDGET,
  INITIAL_FUNDING,
  calculateBalance,
  createDailyOperatingExpense,
  initialTransactions,
} from './economyRules'

function fakeStorage(initial: Record<string, string> = {}) {
  const data = new Map(Object.entries(initial))
  return {
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => void data.set(k, v),
    removeItem: (k: string) => void data.delete(k),
    dump: () => Object.fromEntries(data),
  }
}

const KEY = 'startup-office-economy'

describe('loadEconomy (migration & persistence)', () => {
  it('an old Feature-01 save without economy gets the starting funding, balance 2 500 000', () => {
    const txs = loadEconomy(fakeStorage(), '')
    expect(txs).toEqual(initialTransactions())
    expect(calculateBalance(txs)).toBe(INITIAL_BUDGET)
  })

  it('restores a saved journal', () => {
    const saved = { transactions: [INITIAL_FUNDING, createDailyOperatingExpense(1, 1)] }
    const txs = loadEconomy(fakeStorage({ [KEY]: JSON.stringify(saved) }), '')
    expect(calculateBalance(txs)).toBe(INITIAL_BUDGET - BASE_DAILY_COST)
  })

  it('corrupt JSON or missing transactions array falls back to funding only, without crashing', () => {
    expect(loadEconomy(fakeStorage({ [KEY]: '{oops' }), '')).toEqual(initialTransactions())
    expect(loadEconomy(fakeStorage({ [KEY]: JSON.stringify({ nope: 1 }) }), '')).toEqual(initialTransactions())
  })

  it('?intro wipes the journal and returns the starting funding', () => {
    const storage = fakeStorage({ [KEY]: JSON.stringify({ transactions: [INITIAL_FUNDING, createDailyOperatingExpense(2, 3)] }) })
    expect(loadEconomy(storage, '?intro')).toEqual(initialTransactions())
    expect(storage.dump()).toEqual({})
  })

  it('works without storage (private mode)', () => {
    expect(loadEconomy(null, '')).toEqual(initialTransactions())
    expect(() => saveEconomy(null, initialTransactions())).not.toThrow()
  })
})

describe('economyStore', () => {
  beforeEach(() => {
    useEconomyStore.setState({ transactions: initialTransactions(), panelOpen: false })
    window.localStorage.clear()
  })

  it('starts at the funding balance', () => {
    expect(calculateBalance(useEconomyStore.getState().transactions)).toBe(INITIAL_BUDGET)
    expect(useEconomyStore.getState().transactions).toEqual([INITIAL_FUNDING])
  })

  it('applying a day expense reduces the balance by 20 000 and persists', () => {
    const res = useEconomyStore.getState().applyDailyOperatingExpense(1, 1)
    expect(res.applied).toBe(true)
    expect(calculateBalance(useEconomyStore.getState().transactions)).toBe(INITIAL_BUDGET - BASE_DAILY_COST)
    expect(calculateBalance(loadEconomy(window.localStorage, ''))).toBe(INITIAL_BUDGET - BASE_DAILY_COST)
  })

  it('re-applying the same day is a no-op (idempotent), balance charged once', () => {
    useEconomyStore.getState().applyDailyOperatingExpense(1, 1)
    const second = useEconomyStore.getState().applyDailyOperatingExpense(1, 1)
    expect(second.applied).toBe(false)
    expect(calculateBalance(useEconomyStore.getState().transactions)).toBe(INITIAL_BUDGET - BASE_DAILY_COST)
    expect(useEconomyStore.getState().transactions).toHaveLength(2) // funding + one expense
  })

  it('resetEconomy returns to funding only', () => {
    useEconomyStore.getState().applyDailyOperatingExpense(1, 1)
    useEconomyStore.getState().applyDailyOperatingExpense(1, 2)
    useEconomyStore.getState().resetEconomy()
    expect(useEconomyStore.getState().transactions).toEqual([INITIAL_FUNDING])
    expect(calculateBalance(useEconomyStore.getState().transactions)).toBe(INITIAL_BUDGET)
  })
})
