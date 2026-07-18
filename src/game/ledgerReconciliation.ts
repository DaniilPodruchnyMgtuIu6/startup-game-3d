import { calculateBalance, type MoneyTransaction } from './economyRules'

// Feature 15 §17: a pure diagnostic that verifies the finance ledger identity
//   current balance = initial funding + income − expense
// and flags duplicate transaction ids or non-positive amounts. It NEVER mutates
// or "fixes" data — it only reports discrepancies for the QA/balance tooling.

export interface LedgerReconciliation {
  balanced: boolean
  balance: number
  income: number
  expense: number
  initialFunding: number
  transactionCount: number
  duplicateIds: string[]
  nonPositiveAmounts: string[]
}

export function reconcileLedger(transactions: MoneyTransaction[]): LedgerReconciliation {
  let income = 0
  let expense = 0
  let initialFunding = 0
  const seen = new Set<string>()
  const duplicateIds: string[] = []
  const nonPositiveAmounts: string[] = []

  for (const t of transactions) {
    if (seen.has(t.id)) duplicateIds.push(t.id)
    else seen.add(t.id)
    if (!(t.amount > 0)) nonPositiveAmounts.push(t.id)
    if (t.kind === 'income') {
      income += t.amount
      if (t.category === 'funding') initialFunding += t.amount
    } else {
      expense += t.amount
    }
  }

  const balance = income - expense
  // The identity must agree with the single source of truth (calculateBalance),
  // and a healthy ledger has no duplicate ids and only positive amounts.
  const balanced = balance === calculateBalance(transactions) && duplicateIds.length === 0 && nonPositiveAmounts.length === 0

  return { balanced, balance, income, expense, initialFunding, transactionCount: transactions.length, duplicateIds, nonPositiveAmounts }
}
