import { describe, it, expect } from 'vitest'
import { reconcileLedger } from './ledgerReconciliation'
import { initialTransactions, INITIAL_BUDGET, type MoneyTransaction } from './economyRules'

const expense = (id: string, amount: number): MoneyTransaction => ({ id, kind: 'expense', category: 'operations', title: 't', amount, sprintNumber: 1, day: 1 })

describe('reconcileLedger', () => {
  it('a fresh ledger balances to the initial funding', () => {
    const r = reconcileLedger(initialTransactions())
    expect(r).toMatchObject({ balanced: true, balance: INITIAL_BUDGET, income: INITIAL_BUDGET, expense: 0, initialFunding: INITIAL_BUDGET })
    expect(r.duplicateIds).toEqual([])
  })
  it('income − expense equals the balance', () => {
    const txs = [...initialTransactions(), expense('a', 120_000), expense('b', 30_000)]
    const r = reconcileLedger(txs)
    expect(r.balanced).toBe(true)
    expect(r.balance).toBe(INITIAL_BUDGET - 150_000)
    expect(r.expense).toBe(150_000)
  })
  it('flags a duplicate transaction id', () => {
    const r = reconcileLedger([...initialTransactions(), expense('dup', 1000), expense('dup', 1000)])
    expect(r.balanced).toBe(false)
    expect(r.duplicateIds).toContain('dup')
  })
  it('flags a non-positive amount', () => {
    const r = reconcileLedger([...initialTransactions(), expense('bad', 0)])
    expect(r.balanced).toBe(false)
    expect(r.nonPositiveAmounts).toContain('bad')
  })
})
