import { useState } from 'react'
import { useCinematicStore } from '../game/cinematics/cinematicDirector'
import { useCutsceneStore } from '../cutscenes/cutsceneStore'
import './ui.css'

// A player-reachable "start over" control, always available during free play -
// mirrors GameOverOverlay's restart exactly (the shared ?intro reset wipes
// every store's localStorage and replays the intro), just reachable without
// first losing the game. Confirmed before firing, since here - unlike
// game-over - there is real in-progress work to lose.
export function RestartButton() {
  const cinematicActive = useCinematicStore((s) => s.active)
  const cutsceneActive = useCutsceneStore((s) => s.activeSceneId !== null)
  const [confirming, setConfirming] = useState(false)

  // scene UI discipline: no chrome over a running cinematic/cutscene (§8)
  if (cinematicActive || cutsceneActive) return null

  const restart = () => {
    window.location.search = '?intro'
  }

  return (
    <>
      <button className="restart-button" title="Начать игру сначала" onClick={() => setConfirming(true)}>
        ⟲ Начать сначала
      </button>
      {confirming ? (
        <div className="overlay-backdrop" onClick={() => setConfirming(false)}>
          <div className="sprint-confirm" onClick={(e) => e.stopPropagation()}>
            <h3 className="sprint-confirm-title">Начать игру сначала?</h3>
            <p className="sprint-confirm-text">Весь текущий прогресс — бюджет, спринты, команда, принятые решения — будет удалён без возможности вернуть его.</p>
            <div className="sprint-confirm-actions">
              <button className="primary" onClick={restart}>
                Начать сначала
              </button>
              <button className="sprint-secondary" onClick={() => setConfirming(false)}>
                Отмена
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  )
}
