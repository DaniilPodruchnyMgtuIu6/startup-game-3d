import { create } from 'zustand'
import {
  appendTransactionOnce,
  calculateBalance,
  createAuditFineTransaction,
  createDailyOperatingExpense,
  initialTransactions,
  normalizeEconomy,
  type ExpenseBreakdownItem,
  type MoneyTransaction,
} from './economyRules'
import { isIntroReset } from './gameStore'

// The financial journal lives in its own store and its own localStorage key so
// the existing gameStore / sprintStore saves are untouched (backward
// compatible). The journal is the single source of truth for the budget - the
// balance is always computed from it, never stored separately.

const ECONOMY_STORAGE_KEY = 'startup-office-economy'

type EconomyStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>

function safeStorage(): EconomyStorage | null {
  try {
    return window.localStorage
  } catch {
    return null // private mode / storage disabled
  }
}

// Reads the saved journal. `?intro` wipes it (parsed by gameStore.isIntroReset,
// so the URL rule stays in one place). A missing key (fresh game or an old
// Feature-01 save with no economy), corrupt JSON, or invalid data all fall
// back to a fresh journal with only the starting funding - past days are never
// retroactively charged. Exported for tests.
export function loadEconomy(storage: EconomyStorage | null, search: string): MoneyTransaction[] {
  if (isIntroReset(search)) {
    storage?.removeItem(ECONOMY_STORAGE_KEY)
    return initialTransactions()
  }
  if (!storage) return initialTransactions()
  const raw = storage.getItem(ECONOMY_STORAGE_KEY)
  if (!raw) return initialTransactions()
  try {
    return normalizeEconomy(JSON.parse(raw))
  } catch {
    return initialTransactions()
  }
}

export function saveEconomy(storage: EconomyStorage | null, transactions: MoneyTransaction[]): void {
  try {
    storage?.setItem(ECONOMY_STORAGE_KEY, JSON.stringify({ transactions }))
  } catch {
    // private mode - the journal simply restarts from funding next time
  }
}

interface EconomyStore {
  transactions: MoneyTransaction[]
  // UI flag for the finance panel (not persisted), mirroring the taskBoardOpen
  // / confirmingEndDay pattern already used in the project.
  panelOpen: boolean
  // Applies the aggregated operating expense for one day, exactly once. Safe to
  // call again for the same day (idempotent via the deterministic id).
  // `salaryItems` are the day's developer salaries (empty when none hired).
  applyDailyOperatingExpense: (
    sprintNumber: number,
    day: number,
    salaryItems?: ExpenseBreakdownItem[],
  ) => { applied: boolean; transaction: MoneyTransaction }
  // Applies a security-audit fine exactly once (idempotent by audit number).
  applyAuditFine: (
    auditNumber: number,
    amount: number,
    sprintNumber: number,
    day: number,
  ) => { applied: boolean; transaction: MoneyTransaction }
  // Appends any one-off expense exactly once (idempotent by its id). Used for
  // the access-control investment and the intrusion-response cost (Feature 10).
  applyOneTimeExpense: (transaction: MoneyTransaction) => { applied: boolean; transaction: MoneyTransaction }
  resetEconomy: () => void
  openPanel: () => void
  closePanel: () => void
}

const initial = loadEconomy(safeStorage(), typeof window === 'undefined' ? '' : window.location.search)

export const useEconomyStore = create<EconomyStore>()((set, get) => ({
  transactions: initial,
  panelOpen: false,

  applyDailyOperatingExpense: (sprintNumber, day, salaryItems = []) => {
    const transaction = createDailyOperatingExpense(sprintNumber, day, salaryItems)
    const { transactions, applied } = appendTransactionOnce(get().transactions, transaction)
    if (applied) {
      set({ transactions })
      saveEconomy(safeStorage(), transactions)
    }
    return { applied, transaction }
  },

  applyAuditFine: (auditNumber, amount, sprintNumber, day) => {
    const transaction = createAuditFineTransaction(auditNumber, amount, sprintNumber, day)
    const { transactions, applied } = appendTransactionOnce(get().transactions, transaction)
    if (applied) {
      set({ transactions })
      saveEconomy(safeStorage(), transactions)
    }
    return { applied, transaction }
  },

  applyOneTimeExpense: (transaction) => {
    const { transactions, applied } = appendTransactionOnce(get().transactions, transaction)
    if (applied) {
      set({ transactions })
      saveEconomy(safeStorage(), transactions)
    }
    return { applied, transaction }
  },

  resetEconomy: () => {
    const transactions = initialTransactions()
    set({ transactions, panelOpen: false })
    saveEconomy(safeStorage(), transactions)
  },

  openPanel: () => set({ panelOpen: true }),
  closePanel: () => set({ panelOpen: false }),
}))

// Convenience selector used by the HUD and panels.
export function selectBalance(): number {
  return calculateBalance(useEconomyStore.getState().transactions)
}
