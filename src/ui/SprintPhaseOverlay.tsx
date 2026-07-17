import { useGameStore } from '../game/gameStore'
import { useSprintStore } from '../game/sprintStore'
import { SPRINT_DAYS } from '../game/sprintRules'
import './ui.css'

// The two full-screen blocks that bookend a sprint: planning before it starts
// and review after day 10. Only shown in free play; the day-to-day readout and
// the end-day control live in SprintHud. Deliberately minimal - task selection,
// statistics and results belong to later features.
export function SprintPhaseOverlay() {
  const gamePhase = useGameStore((s) => s.phase)
  const sprintNumber = useSprintStore((s) => s.sprintNumber)
  const sprintPhase = useSprintStore((s) => s.phase)
  const startSprint = useSprintStore((s) => s.startSprint)
  const completeSprintReview = useSprintStore((s) => s.completeSprintReview)

  if (gamePhase !== 'free') return null

  if (sprintPhase === 'planning') {
    return (
      <div className="overlay-backdrop">
        <div className="sprint-panel">
          <h2 className="sprint-panel-title">Спринт {sprintNumber}</h2>
          <p className="sprint-panel-text">
            Спринт длится {SPRINT_DAYS} условных рабочих дней. Время идёт только когда вы завершаете рабочий день —
            перемещение по офису и разговоры его не расходуют.
          </p>
          <button className="primary" onClick={startSprint}>
            Начать спринт
          </button>
        </div>
      </div>
    )
  }

  if (sprintPhase === 'review') {
    return (
      <div className="overlay-backdrop">
        <div className="sprint-panel">
          <h2 className="sprint-panel-title">Спринт {sprintNumber} завершён</h2>
          <p className="sprint-panel-text">Пройдено {SPRINT_DAYS} рабочих дней.</p>
          <button className="primary" onClick={completeSprintReview}>
            Перейти к следующему спринту
          </button>
        </div>
      </div>
    )
  }

  return null
}
