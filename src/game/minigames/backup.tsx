import { useState } from 'react'
import type { MinigameModule } from './registry'
import { type BackupScenario, evaluateBackup, pickBackupScenario, backupTakeaways, LOCATION_LABEL } from './backup'

function row(scenarioLabel: string, verified: boolean, infected: boolean): string {
  const flags = `${verified ? '✔ проверена' : '✖ не проверена'}${infected ? '  ⚠ заражена' : ''}`
  return `${scenarioLabel}  ${flags}`
}

function BackupGame({
  scenario,
  onWin,
  onLose,
}: {
  scenario: BackupScenario
  onWin: () => void
  onLose: () => void
}) {
  const [selected, setSelected] = useState<string>('')
  const [hint, setHint] = useState<string | null>(null)

  const restore = () => {
    if (!selected) {
      setHint('Сначала выбери точку восстановления.')
      return
    }
    // A wrong pick ends the attempt: the overlay switches to the result screen,
    // whose takeaways explain what makes a restore point safe. Retry re-rolls
    // the scenario. (Same flow as the other server mini-games.)
    if (evaluateBackup(selected, scenario).passed) onWin()
    else onLose()
  }

  return (
    <div>
      <p className="mg-hint">
        Кликай точку восстановления, чтобы выбрать её, потом запусти восстановление. Нужна свежая, проверенная копия вне
        основного сервера и без заражения.
      </p>
      <div className="mg-log">
        {scenario.points.map((p) => {
          const label = `${p.when.padEnd(14)} · ${LOCATION_LABEL[p.location].padEnd(18)}`
          return (
            <div
              key={p.id}
              className={selected === p.id ? 'mg-log-line mg-log-line--picked' : 'mg-log-line'}
              onClick={() => {
                setSelected(p.id)
                setHint(null)
              }}
            >
              {row(label, p.verified, p.infected)}
            </div>
          )
        })}
      </div>
      {hint ? <p className="mg-hint">{hint}</p> : null}
      <div className="minigame-actions">
        <button className="primary" onClick={restore}>
          Восстановить
        </button>
      </div>
    </div>
  )
}

export const backupModule: MinigameModule<BackupScenario> = {
  title: 'Резервные копии · Backup',
  pickScenario: pickBackupScenario,
  brief: (s) => s.brief,
  takeaways: backupTakeaways,
  Component: BackupGame,
}
