import { useAccessControlStore } from '../game/accessControlStore'
import { useCutsceneStore } from '../cutscenes/cutsceneStore'
import { getOfficeIntrusionResponseCost } from '../game/accessControlRules'
import { formatRubles } from '../game/economyRules'
import './ui.css'

// The office-intrusion result window (Feature 10 §28), shown after the scene
// finishes (gated on no cutscene running). «Продолжить» acknowledges it, then
// reveals the sprint review underneath if the tenth day was completed.
export function IntrusionResultOverlay() {
  const record = useAccessControlStore((s) => s.intrusionResultToAcknowledge)
  const acknowledge = useAccessControlStore((s) => s.acknowledgeIntrusionResult)
  const cutsceneRunning = useCutsceneStore((s) => s.activeSceneId !== null)

  if (!record || cutsceneRunning) return null

  const hadSpecialist = record.hadSecuritySpecialistAtIncident === true
  const cost = getOfficeIntrusionResponseCost(hadSpecialist)
  const title = hadSpecialist ? 'Попытка проникновения остановлена' : 'Посторонний проник в рабочую зону'
  const detail = hadSpecialist
    ? 'Илья остановил посетителя до доступа к рабочему месту.'
    : 'Неизвестно, успел ли посетитель получить доступ к данным.'
  const costLabel = hadSpecialist ? 'Расходы на внутреннюю проверку' : 'Расходы на проверку доступов и журналов'

  return (
    <div className="overlay-backdrop">
      <div className="sprint-confirm" onClick={(e) => e.stopPropagation()}>
        <h3 className="sprint-confirm-title">{title}</h3>
        <p className="sprint-confirm-text">{detail}</p>
        <dl className="sprint-confirm-figures">
          <div>
            <dt>{costLabel}</dt>
            <dd>{formatRubles(cost)}</dd>
          </div>
        </dl>
        <p className="sprint-confirm-text">Новые задачи добавлены на доску.</p>
        <div className="sprint-confirm-actions">
          <button className="primary" onClick={acknowledge}>
            Продолжить
          </button>
        </div>
      </div>
    </div>
  )
}
