import { useState } from 'react'
import { useEconomyStore } from '../game/economyStore'
import { useTeamStore } from '../game/teamStore'
import {
  BASE_DAILY_COST,
  BASE_DAILY_EXPENSES,
  BASE_SPRINT_COST,
  calculateBalance,
  formatRubles,
  type MoneyTransaction,
} from '../game/economyRules'
import { getEmployeeSalaryExpenses, getHiredEmployeeIds, getTeamDailySalary } from '../game/teamRules'
import './ui.css'

function TransactionRow({ tx }: { tx: MoneyTransaction }) {
  const [open, setOpen] = useState(false)
  const signed = `${tx.kind === 'income' ? '+' : '−'}${formatRubles(tx.amount).replace('−', '')}`
  return (
    <li className="ledger-row">
      <div className="ledger-main">
        <div className="ledger-text">
          <span className="ledger-title">{tx.title}</span>
          <span className="ledger-meta">
            Спринт {tx.sprintNumber} · День {tx.day}
          </span>
        </div>
        <span className={tx.kind === 'income' ? 'ledger-amount ledger-amount--in' : 'ledger-amount ledger-amount--out'}>
          {signed}
        </span>
      </div>
      {tx.breakdown && tx.breakdown.length > 0 ? (
        <>
          <button className="ledger-more" onClick={() => setOpen((v) => !v)}>
            {open ? 'Скрыть' : 'Подробнее'}
          </button>
          {open ? (
            <ul className="ledger-breakdown">
              {tx.breakdown.map((item) => (
                <li key={item.code}>
                  <span>{item.title}</span>
                  <span>{formatRubles(item.amount)}</span>
                </li>
              ))}
            </ul>
          ) : null}
        </>
      ) : null}
    </li>
  )
}

// Finance overlay opened from the HUD budget. Current budget, the base daily /
// sprint costs with their breakdown, and the full journal (newest first).
// Blocks scene clicks via the shared overlay-backdrop, like every other modal.
export function FinancePanel() {
  const open = useEconomyStore((s) => s.panelOpen)
  const close = useEconomyStore((s) => s.closePanel)
  const transactions = useEconomyStore((s) => s.transactions)
  const hires = useTeamStore((s) => s.hires)

  if (!open) return null

  const balance = calculateBalance(transactions)
  const ledger = [...transactions].reverse() // newest first
  const salaryItems = getEmployeeSalaryExpenses(getHiredEmployeeIds(hires))
  const salaryTotal = getTeamDailySalary(hires)
  const currentDaily = BASE_DAILY_COST + salaryTotal

  return (
    <div className="overlay-backdrop" onClick={close}>
      <div className="finance-panel" onClick={(e) => e.stopPropagation()}>
        <button className="finance-close" onClick={close} aria-label="Закрыть">
          ✕
        </button>
        <h2 className="finance-title">Финансы</h2>

        <div className="finance-balance">
          <span className="finance-balance-label">Текущий бюджет</span>
          <span className="finance-balance-value">{formatRubles(balance)}</span>
        </div>

        <div className="finance-section">
          <div className="finance-costs-head">
            <span>Базовые расходы за день</span>
            <span>{formatRubles(BASE_DAILY_COST)}</span>
          </div>
          <div className="finance-costs-head">
            <span>Базовые расходы за спринт</span>
            <span>{formatRubles(BASE_SPRINT_COST)}</span>
          </div>
          <ul className="finance-costs-list">
            {BASE_DAILY_EXPENSES.map((item) => (
              <li key={item.code}>
                <span>{item.title}</span>
                <span>{formatRubles(item.amount)}</span>
              </li>
            ))}
          </ul>

          {salaryItems.length > 0 ? (
            <>
              <div className="finance-costs-head finance-costs-head--spaced">
                <span>Зарплаты команды</span>
                <span>{formatRubles(salaryTotal)}</span>
              </div>
              <ul className="finance-costs-list">
                {salaryItems.map((item) => (
                  <li key={item.code}>
                    <span>{item.title.replace('Зарплата: ', '')}</span>
                    <span>{formatRubles(item.amount)}</span>
                  </li>
                ))}
              </ul>
              <div className="finance-costs-head finance-costs-total">
                <span>Текущие расходы за день</span>
                <span>{formatRubles(currentDaily)}</span>
              </div>
            </>
          ) : null}
        </div>

        <div className="finance-section">
          <h3 className="finance-subtitle">Финансовый журнал</h3>
          <ul className="ledger">
            {ledger.map((tx) => (
              <TransactionRow key={tx.id} tx={tx} />
            ))}
          </ul>
        </div>
      </div>
    </div>
  )
}
