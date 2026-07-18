import { describe, it, expect } from 'vitest'
import {
  BASE_DAILY_COST,
  BASE_DAILY_EXPENSES,
  BASE_SPRINT_COST,
  INITIAL_BUDGET,
  INITIAL_FUNDING,
  appendTransactionOnce,
  auditFineTransactionId,
  budgetWarningLevel,
  calculateBalance,
  createAuditFineTransaction,
  createDailyOperatingExpense,
  dailyExpenseId,
  formatRubles,
  initialTransactions,
  normalizeEconomy,
  projectedBalanceAfterDay,
  sprintExpenseTotal,
  type MoneyTransaction,
} from './economyRules'

describe('economy constants', () => {
  it('starts with a single funding transaction', () => {
    expect(initialTransactions()).toEqual([INITIAL_FUNDING])
    expect(INITIAL_FUNDING).toMatchObject({ id: 'initial-funding', kind: 'income', category: 'funding', amount: 2_500_000 })
  })

  it('initial balance is 2 500 000 ₽', () => {
    expect(calculateBalance(initialTransactions())).toBe(INITIAL_BUDGET)
    expect(INITIAL_BUDGET).toBe(2_500_000)
  })

  it('base daily breakdown sums to 20 000 ₽', () => {
    expect(BASE_DAILY_EXPENSES.reduce((s, i) => s + i.amount, 0)).toBe(20_000)
    expect(BASE_DAILY_COST).toBe(20_000)
  })

  it('a full 10-day sprint costs 200 000 ₽', () => {
    expect(BASE_SPRINT_COST).toBe(200_000)
  })
})

describe('createDailyOperatingExpense', () => {
  it('has a deterministic id and amount equal to its breakdown', () => {
    const tx = createDailyOperatingExpense(1, 3)
    expect(tx.id).toBe('operations:sprint-1:day-3')
    expect(tx.id).toBe(dailyExpenseId(1, 3))
    expect(tx.kind).toBe('expense')
    expect(tx.category).toBe('operations')
    expect(tx.amount).toBe(BASE_DAILY_COST)
    expect(tx.breakdown?.reduce((s, i) => s + i.amount, 0)).toBe(tx.amount)
    expect(tx.breakdown).toHaveLength(4)
  })
})

describe('calculateBalance + appendTransactionOnce', () => {
  it('a day-1 expense reduces the balance by 20 000 ₽', () => {
    const { transactions, applied } = appendTransactionOnce(initialTransactions(), createDailyOperatingExpense(1, 1))
    expect(applied).toBe(true)
    expect(calculateBalance(transactions)).toBe(INITIAL_BUDGET - BASE_DAILY_COST)
  })

  it('re-applying the same day does not change the balance', () => {
    const first = appendTransactionOnce(initialTransactions(), createDailyOperatingExpense(1, 1))
    const second = appendTransactionOnce(first.transactions, createDailyOperatingExpense(1, 1))
    expect(second.applied).toBe(false)
    expect(second.transactions).toBe(first.transactions)
    expect(calculateBalance(second.transactions)).toBe(INITIAL_BUDGET - BASE_DAILY_COST)
  })

  it('different days apply separately', () => {
    let txs = initialTransactions()
    txs = appendTransactionOnce(txs, createDailyOperatingExpense(1, 1)).transactions
    txs = appendTransactionOnce(txs, createDailyOperatingExpense(1, 2)).transactions
    expect(calculateBalance(txs)).toBe(INITIAL_BUDGET - 2 * BASE_DAILY_COST)
  })

  it('a full sprint of 10 days totals 200 000 ₽ of operations', () => {
    let txs = initialTransactions()
    for (let day = 1; day <= 10; day++) txs = appendTransactionOnce(txs, createDailyOperatingExpense(1, day)).transactions
    expect(sprintExpenseTotal(txs, 1)).toBe(BASE_SPRINT_COST)
    expect(calculateBalance(txs)).toBe(INITIAL_BUDGET - BASE_SPRINT_COST)
  })

  it('projectedBalanceAfterDay subtracts once, and not again if already applied', () => {
    const txs = initialTransactions()
    expect(projectedBalanceAfterDay(txs, 1, 1)).toBe(INITIAL_BUDGET - BASE_DAILY_COST)
    const applied = appendTransactionOnce(txs, createDailyOperatingExpense(1, 1)).transactions
    expect(projectedBalanceAfterDay(applied, 1, 1)).toBe(INITIAL_BUDGET - BASE_DAILY_COST)
  })
})

describe('audit fines (Feature 08)', () => {
  it('builds a deterministic audit-fine transaction, id keyed by audit number', () => {
    const tx = createAuditFineTransaction(1, 120_000, 3, 1)
    expect(tx).toMatchObject({ id: 'security-audit-fine:1', kind: 'expense', category: 'audit-fine', amount: 120_000, sprintNumber: 3, day: 1 })
    expect(auditFineTransactionId(2)).toBe('security-audit-fine:2')
  })

  it('a fine reduces the balance and is not double-counted per audit number', () => {
    let txs = initialTransactions()
    const first = appendTransactionOnce(txs, createAuditFineTransaction(1, 120_000, 3, 1))
    txs = first.transactions
    expect(calculateBalance(txs)).toBe(INITIAL_BUDGET - 120_000)
    const second = appendTransactionOnce(txs, createAuditFineTransaction(1, 120_000, 3, 1))
    expect(second.applied).toBe(false)
    expect(calculateBalance(second.transactions)).toBe(INITIAL_BUDGET - 120_000)
  })

  it('fines are not part of the per-sprint operations total, but survive normalisation', () => {
    let txs = initialTransactions()
    txs = appendTransactionOnce(txs, createDailyOperatingExpense(3, 1)).transactions
    txs = appendTransactionOnce(txs, createAuditFineTransaction(1, 120_000, 3, 1)).transactions
    expect(sprintExpenseTotal(txs, 3)).toBe(BASE_DAILY_COST) // fine excluded from operations
    const normalized = normalizeEconomy({ transactions: txs })
    expect(normalized.some((t) => t.id === 'security-audit-fine:1' && t.category === 'audit-fine')).toBe(true)
  })

  it('a large fine may drive the balance negative (no game over in Feature 08)', () => {
    const txs = appendTransactionOnce(initialTransactions(), createAuditFineTransaction(3, 5_000_000, 3, 1)).transactions
    expect(calculateBalance(txs)).toBe(INITIAL_BUDGET - 5_000_000)
    expect(calculateBalance(txs)).toBeLessThan(0)
  })
})

describe('formatRubles', () => {
  it('formats to the required examples', () => {
    expect(formatRubles(2_500_000)).toBe('2 500 000 ₽')
    expect(formatRubles(20_000)).toBe('20 000 ₽')
    expect(formatRubles(-5_000)).toBe('−5 000 ₽')
    expect(formatRubles(0)).toBe('0 ₽')
  })
})

describe('budgetWarningLevel', () => {
  it('classifies low / critical / depleted around the sprint-cost thresholds', () => {
    expect(budgetWarningLevel(BASE_SPRINT_COST * 2)).toBe('ok')
    expect(budgetWarningLevel(BASE_SPRINT_COST * 2 - 1)).toBe('low')
    expect(budgetWarningLevel(BASE_SPRINT_COST)).toBe('low')
    expect(budgetWarningLevel(BASE_SPRINT_COST - 1)).toBe('critical')
    expect(budgetWarningLevel(1)).toBe('critical')
    expect(budgetWarningLevel(0)).toBe('depleted')
    expect(budgetWarningLevel(-100)).toBe('depleted')
  })
})

describe('normalizeEconomy', () => {
  it('an old save without economy state gets the starting funding', () => {
    expect(normalizeEconomy(undefined)).toEqual(initialTransactions())
    expect(normalizeEconomy(null)).toEqual(initialTransactions())
    expect(normalizeEconomy({})).toEqual(initialTransactions())
  })

  it('keeps valid transactions and always guarantees one canonical funding', () => {
    const day1 = createDailyOperatingExpense(1, 1)
    const result = normalizeEconomy({ transactions: [INITIAL_FUNDING, day1] })
    expect(result).toEqual([INITIAL_FUNDING, day1])
    expect(calculateBalance(result)).toBe(INITIAL_BUDGET - BASE_DAILY_COST)
  })

  it('inserts funding when it is missing', () => {
    const day1 = createDailyOperatingExpense(1, 1)
    const result = normalizeEconomy({ transactions: [day1] })
    expect(result[0]).toEqual(INITIAL_FUNDING)
    expect(result).toContainEqual(day1)
  })

  it('drops duplicates, bad kinds, negative/NaN/fractional amounts, and out-of-range days', () => {
    const day1 = createDailyOperatingExpense(1, 1)
    const result = normalizeEconomy({
      transactions: [
        INITIAL_FUNDING,
        INITIAL_FUNDING, // duplicate funding
        day1,
        day1, // duplicate expense
        { ...day1, id: 'bad-amount', amount: -5 },
        { ...day1, id: 'nan', amount: NaN },
        { ...day1, id: 'frac', amount: 1.5 },
        { ...day1, id: 'kind', kind: 'transfer' },
        { ...day1, id: 'day', day: 99 },
        'garbage',
        null,
      ],
    })
    expect(result.filter((t) => t.id === 'initial-funding')).toHaveLength(1)
    expect(result.filter((t) => t.id === day1.id)).toHaveLength(1)
    expect(result.map((t) => t.id)).toEqual(['initial-funding', 'operations:sprint-1:day-1'])
  })

  it('resets to funding only when transactions is not an array', () => {
    expect(normalizeEconomy({ transactions: 'nope' })).toEqual(initialTransactions())
  })
})

// used by other suites; keep a reference so unused-import lint never trips
const _sample: MoneyTransaction = INITIAL_FUNDING
void _sample
