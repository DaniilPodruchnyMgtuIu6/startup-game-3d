// Pure, deterministic financial model for OfficeFlow. Kept out of React and the
// store so every rule can be unit-tested in isolation (same split the project
// uses for sprintRules / serverRackLights). All money is stored as whole
// rubles - never floats. Amounts are always positive; the sign comes from
// `kind`.

import { SPRINT_DAYS } from './sprintRules'

export type MoneyTransactionKind = 'income' | 'expense'
export type MoneyTransactionCategory = 'funding' | 'operations' | 'audit-fine'

export interface ExpenseBreakdownItem {
  code: string
  title: string
  amount: number
}

export interface MoneyTransaction {
  id: string
  kind: MoneyTransactionKind
  category: MoneyTransactionCategory
  title: string
  amount: number
  sprintNumber: number
  day: number
  breakdown?: ExpenseBreakdownItem[]
}

// Starting funding for the OfficeFlow project.
export const INITIAL_BUDGET = 2_500_000

// Base cost of a single working day. BASE_DAILY_COST / BASE_SPRINT_COST are
// derived from this list (never duplicated as loose numbers).
export const BASE_DAILY_EXPENSES: readonly ExpenseBreakdownItem[] = [
  { code: 'office-rent', title: 'Аренда офиса', amount: 8_000 },
  { code: 'infrastructure', title: 'Серверы и сервисы', amount: 4_000 },
  { code: 'project-manager', title: 'Проджект-менеджер', amount: 6_000 },
  { code: 'administration', title: 'Административные расходы', amount: 2_000 },
]

export const BASE_DAILY_COST = BASE_DAILY_EXPENSES.reduce((sum, item) => sum + item.amount, 0)
export const BASE_SPRINT_COST = BASE_DAILY_COST * SPRINT_DAYS

// The single starting-funding transaction. Present in every fresh journal and
// re-created on reset; never duplicated.
export const INITIAL_FUNDING: MoneyTransaction = {
  id: 'initial-funding',
  kind: 'income',
  category: 'funding',
  title: 'Стартовое финансирование OfficeFlow',
  amount: INITIAL_BUDGET,
  sprintNumber: 1,
  day: 1,
}

export function initialTransactions(): MoneyTransaction[] {
  return [{ ...INITIAL_FUNDING }]
}

// The journal is the single source of truth for the budget: income adds,
// expense subtracts.
export function calculateBalance(transactions: MoneyTransaction[]): number {
  return transactions.reduce((balance, t) => balance + (t.kind === 'income' ? t.amount : -t.amount), 0)
}

// Deterministic id for a day's aggregated operating expense - the idempotency
// key, so the same day can never be charged twice.
export function dailyExpenseId(sprintNumber: number, day: number): string {
  return `operations:sprint-${sprintNumber}:day-${day}`
}

// The full breakdown for one day: fixed base expenses plus any extra items
// (e.g. developer salaries supplied by the team layer). Kept here so both the
// daily transaction and the finance UI compose the breakdown identically.
export function composeDailyBreakdown(extraItems: ExpenseBreakdownItem[] = []): ExpenseBreakdownItem[] {
  return [...BASE_DAILY_EXPENSES.map((item) => ({ ...item })), ...extraItems.map((item) => ({ ...item }))]
}

// One aggregated operating-expense transaction for the day being completed.
// amount always equals the sum of the breakdown. The deterministic id depends
// only on sprint/day, so adding salaries never changes the idempotency key.
export function createDailyOperatingExpense(
  sprintNumber: number,
  day: number,
  extraItems: ExpenseBreakdownItem[] = [],
): MoneyTransaction {
  const breakdown = composeDailyBreakdown(extraItems)
  return {
    id: dailyExpenseId(sprintNumber, day),
    kind: 'expense',
    category: 'operations',
    title: 'Базовые расходы за рабочий день',
    amount: breakdown.reduce((sum, item) => sum + item.amount, 0),
    sprintNumber,
    day,
    breakdown,
  }
}

// --- Security audit fines (Feature 08) --------------------------------------

// Deterministic id per follow-up audit number - the idempotency key so the same
// audit can never be fined twice.
export function auditFineTransactionId(auditNumber: number): string {
  return `security-audit-fine:${auditNumber}`
}

// A single audit-fine expense. Its own category so it is never mixed into the
// per-sprint operations total, but it still reduces the balance like any expense.
export function createAuditFineTransaction(
  auditNumber: number,
  amount: number,
  sprintNumber: number,
  day: number,
): MoneyTransaction {
  return {
    id: auditFineTransactionId(auditNumber),
    kind: 'expense',
    category: 'audit-fine',
    title: 'Штраф по результатам повторного аудита',
    amount,
    sprintNumber,
    day,
  }
}

// Appends a transaction only if its id is not already present. `applied` tells
// the caller whether the journal (and therefore the balance) actually changed.
export function appendTransactionOnce(
  transactions: MoneyTransaction[],
  transaction: MoneyTransaction,
): { transactions: MoneyTransaction[]; applied: boolean } {
  if (transactions.some((t) => t.id === transaction.id)) {
    return { transactions, applied: false }
  }
  return { transactions: [...transactions, transaction], applied: true }
}

// --- Selectors -------------------------------------------------------------

export function sprintTransactions(transactions: MoneyTransaction[], sprintNumber: number): MoneyTransaction[] {
  return transactions.filter((t) => t.sprintNumber === sprintNumber)
}

// Total operating spend recorded for a sprint (computed from the journal, not
// hard-coded), so a partially-played sprint shows its actual expenses.
export function sprintExpenseTotal(transactions: MoneyTransaction[], sprintNumber: number): number {
  return transactions
    .filter((t) => t.kind === 'expense' && t.category === 'operations' && t.sprintNumber === sprintNumber)
    .reduce((sum, t) => sum + t.amount, 0)
}

// Balance projected after completing the current day. If the day's expense is
// already in the journal (e.g. a restored intermediate state), it is not
// counted again.
export function projectedBalanceAfterDay(
  transactions: MoneyTransaction[],
  sprintNumber: number,
  day: number,
  dailyCost: number = BASE_DAILY_COST,
): number {
  const balance = calculateBalance(transactions)
  const alreadyApplied = transactions.some((t) => t.id === dailyExpenseId(sprintNumber, day))
  return alreadyApplied ? balance : balance - dailyCost
}

// The expense that completing this specific day would still charge (0 if it was
// already applied). `dailyCost` includes any developer salaries for the day.
export function pendingDailyExpense(
  transactions: MoneyTransaction[],
  sprintNumber: number,
  day: number,
  dailyCost: number = BASE_DAILY_COST,
): number {
  const alreadyApplied = transactions.some((t) => t.id === dailyExpenseId(sprintNumber, day))
  return alreadyApplied ? 0 : dailyCost
}

// --- Budget warnings (informational only in this feature) ------------------

export type BudgetWarning = 'ok' | 'low' | 'critical' | 'depleted'

export function budgetWarningLevel(remainingBalance: number): BudgetWarning {
  if (remainingBalance <= 0) return 'depleted'
  if (remainingBalance < BASE_SPRINT_COST) return 'critical'
  if (remainingBalance < BASE_SPRINT_COST * 2) return 'low'
  return 'ok'
}

// --- Formatting ------------------------------------------------------------

const MINUS = '−' // U+2212 MINUS SIGN
const NBSP = / /g

// "2 500 000 ₽", negatives as "−5 000 ₽". Space-grouped thousands, no kopecks.
// Built on Intl.NumberFormat('ru-RU') with non-breaking spaces normalised to
// regular spaces and the sign forced to a proper minus, so the output is
// deterministic regardless of the runtime's default locale.
export function formatRubles(amount: number): string {
  const whole = Math.trunc(amount)
  const grouped = new Intl.NumberFormat('ru-RU').format(Math.abs(whole)).replace(NBSP, ' ')
  const sign = whole < 0 ? MINUS : ''
  return `${sign}${grouped} ₽`
}

// --- Persistence normalisation ---------------------------------------------

const KINDS: MoneyTransactionKind[] = ['income', 'expense']
const CATEGORIES: MoneyTransactionCategory[] = ['funding', 'operations', 'audit-fine']

function isPositiveInt(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value > 0
}

function isValidBreakdownItem(item: unknown): item is ExpenseBreakdownItem {
  if (!item || typeof item !== 'object') return false
  const { code, title, amount } = item as Record<string, unknown>
  return typeof code === 'string' && typeof title === 'string' && isPositiveInt(amount)
}

function sanitizeTransaction(raw: unknown): MoneyTransaction | null {
  if (!raw || typeof raw !== 'object') return null
  const { id, kind, category, title, amount, sprintNumber, day, breakdown } = raw as Record<string, unknown>
  if (typeof id !== 'string' || id.length === 0) return null
  if (!KINDS.includes(kind as MoneyTransactionKind)) return null
  if (!CATEGORIES.includes(category as MoneyTransactionCategory)) return null
  if (typeof title !== 'string') return null
  if (!isPositiveInt(amount)) return null
  if (typeof sprintNumber !== 'number' || !Number.isInteger(sprintNumber) || sprintNumber < 1) return null
  if (typeof day !== 'number' || !Number.isInteger(day) || day < 1 || day > SPRINT_DAYS) return null
  const tx: MoneyTransaction = {
    id,
    kind: kind as MoneyTransactionKind,
    category: category as MoneyTransactionCategory,
    title,
    amount,
    sprintNumber,
    day,
  }
  if (Array.isArray(breakdown)) {
    const items = breakdown.filter(isValidBreakdownItem).map((i) => ({ code: i.code, title: i.title, amount: i.amount }))
    if (items.length > 0) tx.breakdown = items
  }
  return tx
}

// Coerce a loaded/corrupt economy blob into a safe transaction list: drop
// malformed entries, dedupe by id, and guarantee exactly one canonical
// starting-funding transaction. Anything wholly unusable falls back to a fresh
// journal (funding only) - the economy resets in isolation, never the whole
// game progress.
export function normalizeEconomy(raw: unknown): MoneyTransaction[] {
  if (!raw || typeof raw !== 'object') return initialTransactions()
  const list = (raw as { transactions?: unknown }).transactions
  if (!Array.isArray(list)) return initialTransactions()

  const seen = new Set<string>()
  const valid: MoneyTransaction[] = []
  for (const entry of list) {
    const tx = sanitizeTransaction(entry)
    if (!tx) continue
    if (seen.has(tx.id)) continue // drop duplicates (including duplicate funding)
    seen.add(tx.id)
    valid.push(tx)
  }

  // Always front the journal with a single canonical funding transaction.
  const rest = valid.filter((t) => t.id !== INITIAL_FUNDING.id)
  return [{ ...INITIAL_FUNDING }, ...rest]
}
