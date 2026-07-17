import { useGameStore } from '../game/gameStore'
import { useSprintStore } from '../game/sprintStore'
import { useEconomyStore } from '../game/economyStore'
import { useTeamStore } from '../game/teamStore'
import { SPRINT_DAYS } from '../game/sprintRules'
import { calculateBalance, formatRubles, sprintExpenseTotal } from '../game/economyRules'
import { canStartSprintWithTeam, getHiredEmployeeIds, hasInitialDevelopmentTeam } from '../game/teamRules'
import './ui.css'

// The two full-screen blocks that bookend a sprint: planning before it starts
// and review after day 10. Only shown in free play. The first sprint cannot
// start until both developers are hired; the review's figures come from the
// journal (actual spend), not hard-coded.
export function SprintPhaseOverlay() {
  const gamePhase = useGameStore((s) => s.phase)
  const sprintNumber = useSprintStore((s) => s.sprintNumber)
  const sprintPhase = useSprintStore((s) => s.phase)
  const startSprint = useSprintStore((s) => s.startSprint)
  const completeSprintReview = useSprintStore((s) => s.completeSprintReview)
  const transactions = useEconomyStore((s) => s.transactions)
  const hires = useTeamStore((s) => s.hires)
  const openTeam = useTeamStore((s) => s.openPanel)

  if (gamePhase !== 'free') return null

  if (sprintPhase === 'planning') {
    const canStart = canStartSprintWithTeam(sprintNumber, hires)
    const showGate = sprintNumber === 1 && !hasInitialDevelopmentTeam(hires)
    const techTeam = getHiredEmployeeIds(hires).length
    return (
      <div className="overlay-backdrop">
        <div className="sprint-panel">
          <h2 className="sprint-panel-title">Спринт {sprintNumber}</h2>
          <p className="sprint-panel-text">
            Спринт длится {SPRINT_DAYS} условных рабочих дней. Время идёт только когда вы завершаете рабочий день —
            перемещение по офису и разговоры его не расходуют.
          </p>

          {sprintNumber === 1 ? (
            <div className="sprint-team-gate">
              {showGate ? (
                <>
                  <p className="sprint-gate-text">
                    Для начала разработки OfficeFlow наймите backend- и frontend-разработчика.
                  </p>
                  <p className="sprint-gate-progress">Состав технической команды: {techTeam} из 2</p>
                  <button className="sprint-secondary" onClick={openTeam}>
                    Открыть команду
                  </button>
                </>
              ) : (
                <p className="sprint-gate-ready">Команда готова начать разработку.</p>
              )}
            </div>
          ) : null}

          <button className="primary" onClick={startSprint} disabled={!canStart}>
            Начать спринт
          </button>
        </div>
      </div>
    )
  }

  if (sprintPhase === 'review') {
    const spent = sprintExpenseTotal(transactions, sprintNumber)
    const balance = calculateBalance(transactions)
    return (
      <div className="overlay-backdrop">
        <div className="sprint-panel">
          <h2 className="sprint-panel-title">Спринт {sprintNumber} завершён</h2>
          <dl className="sprint-review-figures">
            <div>
              <dt>Рабочих дней</dt>
              <dd>{SPRINT_DAYS}</dd>
            </div>
            <div>
              <dt>Расходы за спринт</dt>
              <dd>{formatRubles(spent)}</dd>
            </div>
            <div>
              <dt>Остаток бюджета</dt>
              <dd>{formatRubles(balance)}</dd>
            </div>
          </dl>
          <button className="primary" onClick={completeSprintReview}>
            Перейти к следующему спринту
          </button>
        </div>
      </div>
    )
  }

  return null
}
