import { useGameStore } from '../game/gameStore'
import { useSprintStore } from '../game/sprintStore'
import { useServerIncidentsStore } from '../game/serverIncidentsStore'
import { useEconomyStore } from '../game/economyStore'
import { useTeamStore } from '../game/teamStore'
import { useCharacterStore } from '../character/characterStore'
import { SPRINT_DAYS } from '../game/sprintRules'
import {
  BASE_DAILY_COST,
  budgetWarningLevel,
  calculateBalance,
  formatRubles,
  pendingDailyExpense,
  projectedBalanceAfterDay,
  type BudgetWarning,
} from '../game/economyRules'
import { getHiredEmployeeIds, getTeamDailySalary } from '../game/teamRules'
import { completeWorkday } from '../game/completeWorkday'
import './ui.css'

const WARNING_TEXT: Record<Exclude<BudgetWarning, 'ok'>, string> = {
  low: 'Внимание: базового бюджета осталось менее чем на два спринта.',
  critical: 'Критический остаток: базового бюджета не хватит на полный следующий спринт.',
  depleted: 'Бюджет проекта исчерпан.',
}

// Top-left HUD: sprint/day readout, budget (opens finance), team counter (opens
// the team panel), and - during an active sprint - the end-of-day control and
// its confirmation. Only shown in free play.
export function SprintHud() {
  const gamePhase = useGameStore((s) => s.phase)
  const sprintNumber = useSprintStore((s) => s.sprintNumber)
  const day = useSprintStore((s) => s.day)
  const sprintPhase = useSprintStore((s) => s.phase)
  const confirming = useSprintStore((s) => s.confirmingEndDay)
  const requestEndDay = useSprintStore((s) => s.requestEndDay)
  const cancelEndDay = useSprintStore((s) => s.cancelEndDay)

  const transactions = useEconomyStore((s) => s.transactions)
  const financePanelOpen = useEconomyStore((s) => s.panelOpen)
  const openFinance = useEconomyStore((s) => s.openPanel)

  const hires = useTeamStore((s) => s.hires)
  const teamPanelOpen = useTeamStore((s) => s.panelOpen)
  const openTeam = useTeamStore((s) => s.openPanel)

  // Existing "the interface is busy" signals - no new global lock is added.
  const inputLocked = useCharacterStore((s) => s.inputLocked)
  const activeDialogue = useGameStore((s) => s.activeDialogue)
  const activeChoice = useGameStore((s) => s.activeChoice)
  const taskBoardOpen = useGameStore((s) => s.taskBoardOpen)
  const activeMinigame = useServerIncidentsStore((s) => s.activeMinigame)

  if (gamePhase !== 'free') return null

  const label =
    sprintPhase === 'active'
      ? `День ${day}/${SPRINT_DAYS}`
      : sprintPhase === 'planning'
        ? 'Планирование'
        : 'Итоги спринта'

  const balance = calculateBalance(transactions)
  // Team members = the PM plus every hired developer (the player is not counted).
  const teamCount = 1 + getHiredEmployeeIds(hires).length

  const busy =
    inputLocked || !!activeDialogue || !!activeChoice || taskBoardOpen || financePanelOpen || teamPanelOpen || !!activeMinigame
  const canEndDay = sprintPhase === 'active' && !busy

  // Daily cost includes developer salaries at the moment the day is confirmed.
  const dailyCost = BASE_DAILY_COST + getTeamDailySalary(hires)
  const pendingExpense = pendingDailyExpense(transactions, sprintNumber, day, dailyCost)
  const projected = projectedBalanceAfterDay(transactions, sprintNumber, day, dailyCost)
  const warning = budgetWarningLevel(projected)

  return (
    <>
      <div className="sprint-hud">
        <span className="sprint-hud-sprint">Спринт {sprintNumber}</span>
        <span className="sprint-hud-day">{label}</span>
        <button className="sprint-hud-budget" onClick={openFinance} title="Открыть финансы">
          Бюджет: {formatRubles(balance)}
        </button>
        <button className="sprint-hud-budget" onClick={openTeam} title="Открыть команду">
          Команда: {teamCount}/3
        </button>
        {sprintPhase === 'active' ? (
          <button className="sprint-hud-end" onClick={requestEndDay} disabled={!canEndDay}>
            Завершить рабочий день
          </button>
        ) : null}
      </div>

      {confirming ? (
        <div className="overlay-backdrop" onClick={cancelEndDay}>
          <div className="sprint-confirm" onClick={(e) => e.stopPropagation()}>
            <h3 className="sprint-confirm-title">Завершить рабочий день?</h3>
            <dl className="sprint-confirm-figures">
              <div>
                <dt>Расходы за день</dt>
                <dd>{formatRubles(pendingExpense)}</dd>
              </div>
              <div>
                <dt>После завершения останется</dt>
                <dd>{formatRubles(projected)}</dd>
              </div>
            </dl>
            {warning !== 'ok' ? <p className={`sprint-warning sprint-warning--${warning}`}>{WARNING_TEXT[warning]}</p> : null}
            <p className="sprint-confirm-text">
              После подтверждения игра рассчитает результаты дня. Свободное перемещение и разговоры время не расходуют.
            </p>
            <div className="sprint-confirm-actions">
              <button className="primary" onClick={() => completeWorkday()}>
                Завершить день
              </button>
              <button className="sprint-secondary" onClick={cancelEndDay}>
                Отмена
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  )
}
