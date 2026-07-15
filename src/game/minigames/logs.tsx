import { useState } from 'react'
import type { MinigameModule } from './registry'
import { type LogsScenario, evaluateLogs, pickLogsScenario, logsTakeaways } from './logs'

function LogsGame({
  scenario,
  onWin,
  onLose,
}: {
  scenario: LogsScenario
  onWin: () => void
  onLose: () => void
}) {
  const [flagged, setFlagged] = useState<Set<string>>(new Set())
  const [bannedIp, setBannedIp] = useState<string>('')
  const [hint, setHint] = useState<string | null>(null)

  const toggle = (id: string) =>
    setFlagged((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })

  const submit = () => {
    if (!bannedIp) {
      setHint('Сначала выбери IP для бана.')
      return
    }
    const r = evaluateLogs(flagged, bannedIp, scenario)
    if (r.passed) {
      onWin()
      return
    }
    if (!r.bannedCorrect) setHint('Забанен не тот IP — перепроверь, откуда шла атака.')
    else if (r.missed.length) setHint('Ты отметил не все улики атаки.')
    else setHint('Отмечены лишние строки — легитимный трафик это не атака.')
    onLose()
  }

  return (
    <div>
      <p className="mg-hint">Кликай подозрительные строки, чтобы отметить их. Затем выбери IP атакующего и забань.</p>
      <div className="mg-log">
        {scenario.lines.map((l) => (
          <div
            key={l.id}
            className={flagged.has(l.id) ? 'mg-log-line mg-log-line--flagged' : 'mg-log-line'}
            onClick={() => toggle(l.id)}
          >
            {l.time}  {l.ip.padEnd(15)}  {l.user.padEnd(9)}  {l.event}
          </div>
        ))}
      </div>
      <div className="mg-row">
        {scenario.candidateIps.map((ip) => (
          <button
            key={ip}
            className={bannedIp === ip ? 'mg-toggle mg-toggle--on' : 'mg-toggle'}
            onClick={() => setBannedIp(ip)}
          >
            {ip}
          </button>
        ))}
      </div>
      {hint ? <p className="mg-hint">{hint}</p> : null}
      <div className="minigame-actions">
        <button className="primary" onClick={submit}>
          Забанить
        </button>
      </div>
    </div>
  )
}

export const logsModule: MinigameModule<LogsScenario> = {
  title: 'Логи · Аутентификация',
  pickScenario: pickLogsScenario,
  brief: (s) => s.brief,
  takeaways: logsTakeaways,
  Component: LogsGame,
}
