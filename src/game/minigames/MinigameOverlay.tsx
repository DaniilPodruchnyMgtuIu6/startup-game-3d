import { useEffect, useMemo, useState } from 'react'
import { useServerIncidentsStore } from '../serverIncidentsStore'
import { useCharacterStore, PLAYER_ID } from '../../character/characterStore'
import { MINIGAME_MODULES } from './registry'
import '../../ui/ui.css'

type Phase = { kind: 'playing' } | { kind: 'result'; won: boolean }

export function MinigameOverlay() {
  const active = useServerIncidentsStore((s) => s.activeMinigame)
  const completeRepair = useServerIncidentsStore((s) => s.completeRepair)
  const failAttempt = useServerIncidentsStore((s) => s.failAttempt)
  const closeMinigame = useServerIncidentsStore((s) => s.closeMinigame)

  // Reset per-incident local state whenever a different mini-game opens.
  const gameKey = active ? active.role : 'none'
  const [phase, setPhase] = useState<Phase>({ kind: 'playing' })
  const [scenarioNonce, setScenarioNonce] = useState(0)

  // The overlay component never unmounts (it returns null when inactive), so a
  // freshly-opened incident would otherwise inherit the previous game's result
  // screen and scenario. Reset both whenever the active game changes.
  useEffect(() => {
    setPhase({ kind: 'playing' })
    setScenarioNonce(0)
  }, [gameKey])

  const module = active ? MINIGAME_MODULES[active.kind] : null
  const scenario = useMemo(
    () => (module ? module.pickScenario(Math.random) : null),
    // reselect on new game or an explicit retry
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [module, gameKey, scenarioNonce],
  )

  if (!active || !module || !scenario) return null

  const returnPlayerToIdle = () => useCharacterStore.getState().dispatchTo(PLAYER_ID, { type: 'REPAIR_DONE' })

  const onWin = () => setPhase({ kind: 'result', won: true })
  const onLose = () => {
    failAttempt(active.role)
    setPhase({ kind: 'result', won: false })
  }
  const finishWin = () => {
    completeRepair(active.role)
    returnPlayerToIdle()
  }
  const retry = () => {
    setScenarioNonce((n) => n + 1)
    setPhase({ kind: 'playing' })
  }
  const exit = () => {
    closeMinigame()
    returnPlayerToIdle()
  }

  const Body = module.Component

  return (
    <div className="overlay-backdrop">
      <div className="minigame" onClick={(e) => e.stopPropagation()}>
        <div className="minigame-header">
          <span className="minigame-title">{module.title}</span>
          <button className="minigame-close" onClick={exit} aria-label="Выйти">
            ✕
          </button>
        </div>

        {phase.kind === 'playing' ? (
          <>
            <p className="minigame-brief">{module.brief(scenario)}</p>
            <div className="minigame-body">
              {/* key forces a fresh mount on retry */}
              <Body key={scenarioNonce} scenario={scenario} onWin={onWin} onLose={onLose} />
            </div>
          </>
        ) : (
          <div className="minigame-result">
            <h2
              className={
                phase.won ? 'minigame-verdict minigame-verdict--win' : 'minigame-verdict minigame-verdict--lose'
              }
            >
              {phase.won ? 'Сервер восстановлен' : 'Атака не отражена'}
            </h2>
            <ul className="minigame-takeaways">
              {module.takeaways(scenario, phase.won).map((t, i) => (
                <li key={i}>{t}</li>
              ))}
            </ul>
            <div className="minigame-actions">
              {phase.won ? (
                <button className="primary" onClick={finishWin}>
                  Готово
                </button>
              ) : (
                <>
                  <button className="primary" onClick={retry}>
                    Ещё раз
                  </button>
                  <button className="minigame-secondary" onClick={exit}>
                    Выйти
                  </button>
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
