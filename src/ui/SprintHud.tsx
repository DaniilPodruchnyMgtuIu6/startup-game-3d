import { useGameStore } from '../game/gameStore'
import { useSprintStore } from '../game/sprintStore'
import { useServerIncidentsStore } from '../game/serverIncidentsStore'
import { useCharacterStore } from '../character/characterStore'
import { SPRINT_DAYS } from '../game/sprintRules'
import './ui.css'

// Top-left HUD: the sprint/day readout, plus - during an active sprint - the
// explicit "end the working day" control and its confirmation. Only shown in
// free play; the planning/review blocks live in SprintPhaseOverlay.
export function SprintHud() {
  const gamePhase = useGameStore((s) => s.phase)
  const sprintNumber = useSprintStore((s) => s.sprintNumber)
  const day = useSprintStore((s) => s.day)
  const sprintPhase = useSprintStore((s) => s.phase)
  const confirming = useSprintStore((s) => s.confirmingEndDay)
  const requestEndDay = useSprintStore((s) => s.requestEndDay)
  const confirmEndDay = useSprintStore((s) => s.confirmEndDay)
  const cancelEndDay = useSprintStore((s) => s.cancelEndDay)

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

  const busy = inputLocked || !!activeDialogue || !!activeChoice || taskBoardOpen || !!activeMinigame
  const canEndDay = sprintPhase === 'active' && !busy

  return (
    <>
      <div className="sprint-hud">
        <span className="sprint-hud-sprint">Спринт {sprintNumber}</span>
        <span className="sprint-hud-day">{label}</span>
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
            <p className="sprint-confirm-text">
              После подтверждения игра рассчитает результаты дня. Свободное перемещение и разговоры время не расходуют.
            </p>
            <div className="sprint-confirm-actions">
              <button className="primary" onClick={confirmEndDay}>
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
