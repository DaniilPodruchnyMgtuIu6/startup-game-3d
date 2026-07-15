import { useState } from 'react'
import type { MinigameModule } from './registry'
import { type FirewallScenario, evaluateFirewall, pickFirewallScenario, firewallTakeaways } from './firewall'

function FirewallGame({
  scenario,
  onWin,
  onLose,
}: {
  scenario: FirewallScenario
  onWin: () => void
  onLose: () => void
}) {
  const [open, setOpen] = useState<Set<number>>(new Set())
  const [result, setResult] = useState<ReturnType<typeof evaluateFirewall> | null>(null)

  const toggle = (port: number) =>
    setOpen((prev) => {
      const next = new Set(prev)
      if (next.has(port)) next.delete(port)
      else next.add(port)
      return next
    })

  const run = () => {
    const r = evaluateFirewall(open, scenario)
    setResult(r)
    if (r.passed) onWin()
    else onLose()
  }

  return (
    <div>
      <p className="mg-hint">Нажми порт, чтобы открыть (зелёный) или закрыть его. Потом запусти трафик.</p>
      <div className="mg-row">
        {scenario.ports.map((p) => (
          <button
            key={p.port}
            className={open.has(p.port) ? 'mg-toggle mg-toggle--on' : 'mg-toggle'}
            onClick={() => toggle(p.port)}
          >
            {p.label} · {open.has(p.port) ? 'открыт' : 'закрыт'}
          </button>
        ))}
      </div>
      <ul className="minigame-takeaways">
        {scenario.requests.map((req) => (
          <li key={req.id}>{req.label}</li>
        ))}
      </ul>
      {result && !result.passed ? (
        <p className="mg-hint">
          Взломов: {result.breach}, заблокировано легитимного трафика: {result.legitBlocked}. Попробуй ещё.
        </p>
      ) : null}
      <div className="minigame-actions">
        <button className="primary" onClick={run}>
          Запустить трафик
        </button>
      </div>
    </div>
  )
}

export const firewallModule: MinigameModule<FirewallScenario> = {
  title: 'Фаервол · Шлюз',
  pickScenario: pickFirewallScenario,
  brief: (s) => s.brief,
  takeaways: firewallTakeaways,
  Component: FirewallGame,
}
