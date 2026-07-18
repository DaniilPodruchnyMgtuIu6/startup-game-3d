import { useEffect } from 'react'
import { useGameOutcomeStore } from '../game/gameOutcomeStore'
import { useCharacterStore } from '../character/characterStore'
import { formatRubles } from '../game/economyRules'
import {
  CAMPAIGN_TIER_TITLE,
  CAMPAIGN_TIER_DESCRIPTION,
  buildCampaignSuccessHighlights,
  type OfficeIntrusionOutcome,
} from '../game/mvpReleaseRules'
import './ui.css'

// Feature 13 campaign-success screen. Full-screen, snapshot-driven (never
// recomputes score/tier), survives reload, freezes input. All three tiers are a
// win. "Начать новую игру" uses the shared ?intro reset.

const INTRUSION_LABEL: Record<OfficeIntrusionOutcome, string> = {
  'not-triggered': 'не было',
  prevented: 'предотвращено',
  'contained-with-specialist': 'остановлено до рабочей зоны',
  'reached-work-area': 'достигло рабочей зоны',
}

export function CampaignSuccessOverlay() {
  const status = useGameOutcomeStore((s) => s.status)
  const success = useGameOutcomeStore((s) => s.success)

  useEffect(() => {
    if (status === 'succeeded') useCharacterStore.getState().setInputLocked(true)
  }, [status])

  if (status !== 'succeeded' || !success) return null

  const highlights = buildCampaignSuccessHighlights(success)

  const restart = () => {
    window.location.search = '?intro'
  }

  return (
    <div className="overlay-backdrop success-backdrop">
      <div className="success-panel">
        <div className="success-badge">Первый этап завершён</div>
        <h1 className="success-title">{CAMPAIGN_TIER_TITLE[success.resultTier]}</h1>
        <p className="success-desc">{CAMPAIGN_TIER_DESCRIPTION[success.resultTier]}</p>

        <div className="success-headline">OfficeFlow MVP выпущен</div>
        <dl className="success-stats">
          <div>
            <dt>Результат</dt>
            <dd>{success.campaignScore}/100</dd>
          </div>
          <div>
            <dt>Выпуск</dt>
            <dd>
              спринт {success.releasedAt.sprintNumber}, день {success.releasedAt.day}
            </dd>
          </div>
          <div>
            <dt>Задачи</dt>
            <dd>
              {success.completedProductTasks} из {success.totalProductTasks}
            </dd>
          </div>
          <div>
            <dt>Готовность продукта</dt>
            <dd>{success.productProgressPercent}%</dd>
          </div>
          <div>
            <dt>Итоговый бюджет</dt>
            <dd>{formatRubles(success.balance)}</dd>
          </div>
          <div>
            <dt>Команда</dt>
            <dd>{success.teamEmployeeIds.length + 1} сотрудника</dd>
          </div>
        </dl>

        <div className="success-subhead">Управление и безопасность</div>
        <dl className="success-stats">
          <div>
            <dt>Штрафы аудитов</dt>
            <dd>{formatRubles(success.totalAuditFines)}</dd>
          </div>
          <div>
            <dt>Повторных аудитов</dt>
            <dd>{success.auditRecords}</dd>
          </div>
          <div>
            <dt>СКУД</dt>
            <dd>{success.accessControlActive ? 'активна' : 'не внедрена'}</dd>
          </div>
          <div>
            <dt>Проникновение</dt>
            <dd>{INTRUSION_LABEL[success.officeIntrusionOutcome]}</dd>
          </div>
          <div>
            <dt>Серверные инциденты</dt>
            <dd>{success.occurredServerIncidentIds.length}</dd>
          </div>
          <div>
            <dt>Расходы из-за простоев</dt>
            <dd>{formatRubles(success.totalServerDowntimeCost)}</dd>
          </div>
        </dl>

        {highlights.length > 0 ? (
          <div className="success-highlights">
            <div className="success-highlights-label">Итоговые наблюдения:</div>
            <ul>
              {highlights.map((h) => (
                <li key={h}>{h}</li>
              ))}
            </ul>
          </div>
        ) : null}

        <div className="success-actions">
          <button className="primary" onClick={restart}>
            Начать новую игру
          </button>
        </div>
      </div>
    </div>
  )
}
