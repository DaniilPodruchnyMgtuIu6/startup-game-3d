import { useSecurityAuditStore } from '../game/securityAuditStore'
import { useCutsceneStore } from '../cutscenes/cutsceneStore'
import { SECURITY_FINDING_CATALOG } from '../game/securityFindingCatalog'
import { formatRubles } from '../game/economyRules'
import './ui.css'

const TOTAL_FINDINGS = SECURITY_FINDING_CATALOG.length

// The follow-up audit result window (Feature 08 §25), shown after the audit
// scene finishes (gated on no cutscene running). «Продолжить» acknowledges it,
// which then reveals the sprint review underneath if the tenth day was completed.
export function AuditResultOverlay() {
  const record = useSecurityAuditStore((s) => s.auditResultToAcknowledge)
  const acknowledge = useSecurityAuditStore((s) => s.acknowledgeAuditResult)
  const cutsceneRunning = useCutsceneStore((s) => s.activeSceneId !== null)

  if (!record || cutsceneRunning) return null

  const passed = record.result === 'passed'
  const critical = !passed && record.auditNumber >= 3
  const openCount = record.unresolvedFindingIds.length
  const title = passed ? 'Повторный аудит пройден' : critical ? 'Критическое нарушение требований' : 'Повторный аудит не пройден'

  return (
    <div className="overlay-backdrop">
      <div className="sprint-confirm" onClick={(e) => e.stopPropagation()}>
        <h3 className="sprint-confirm-title">{title}</h3>
        <dl className="sprint-confirm-figures">
          {passed ? (
            <div>
              <dt>Закрыто замечаний</dt>
              <dd>
                {TOTAL_FINDINGS} из {TOTAL_FINDINGS}
              </dd>
            </div>
          ) : (
            <div>
              <dt>Открыто замечаний</dt>
              <dd>{openCount}</dd>
            </div>
          )}
          <div>
            <dt>Штраф</dt>
            <dd>{formatRubles(record.fineAmount)}</dd>
          </div>
        </dl>

        {!passed && record.auditNumber >= 2 ? (
          <p className="sprint-warning sprint-warning--low">Жалоба передана высшему руководству</p>
        ) : null}
        {critical ? (
          <p className="sprint-warning sprint-warning--critical">Аудиторы рекомендуют приостановить проект</p>
        ) : !passed ? (
          <p className="sprint-confirm-text">Следующая проверка: через 10 рабочих дней</p>
        ) : null}

        <div className="sprint-confirm-actions">
          <button className="primary" onClick={acknowledge}>
            Продолжить
          </button>
        </div>
      </div>
    </div>
  )
}
