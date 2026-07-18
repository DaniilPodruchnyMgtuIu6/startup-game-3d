import { useServerIncidentStore } from '../game/serverIncidentStore'
import { useCutsceneStore } from '../cutscenes/cutsceneStore'
import { getServerIncident } from '../game/serverIncidentCatalog'
import { getServerIncidentImmediateCost, getServerDowntimeCost } from '../game/serverIncidentRules'
import { formatRubles } from '../game/economyRules'
import './ui.css'

// The server-incident result window (Feature 11 §33), shown after the scene
// finishes (gated on no cutscene running). «Продолжить» acknowledges it, letting
// the next pending event (or the review) follow by priority.
export function ServerIncidentResultOverlay() {
  const incidentId = useServerIncidentStore((s) => s.incidentResultToAcknowledge)
  const incidents = useServerIncidentStore((s) => s.incidents)
  const acknowledge = useServerIncidentStore((s) => s.acknowledgeServerIncidentResult)
  const cutsceneRunning = useCutsceneStore((s) => s.activeSceneId !== null)

  if (!incidentId || cutsceneRunning) return null
  const def = getServerIncident(incidentId)
  if (!def) return null

  const hadSpecialist = incidents[incidentId].hadSecuritySpecialistAtIncident === true
  const immediateCost = getServerIncidentImmediateCost(incidentId, hadSpecialist)
  const downtimeCost = getServerDowntimeCost(incidentId)

  return (
    <div className="overlay-backdrop">
      <div className="sprint-confirm" onClick={(e) => e.stopPropagation()}>
        <h3 className="sprint-confirm-title">Инцидент зарегистрирован</h3>
        <p className="sprint-confirm-text">{def.title}</p>
        <dl className="sprint-confirm-figures">
          <div>
            <dt>Немедленные расходы</dt>
            <dd>{formatRubles(immediateCost)}</dd>
          </div>
          <div>
            <dt>Простой за каждый рабочий день до восстановления</dt>
            <dd>{formatRubles(downtimeCost)}</dd>
          </div>
        </dl>
        <p className="sprint-confirm-text">Назначьте исполнителя на вкладке «Безопасность».</p>
        <div className="sprint-confirm-actions">
          <button className="primary" onClick={acknowledge}>
            Продолжить
          </button>
        </div>
      </div>
    </div>
  )
}
