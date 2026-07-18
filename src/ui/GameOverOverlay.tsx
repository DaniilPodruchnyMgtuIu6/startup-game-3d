import { useEffect } from 'react'
import { useGameOutcomeStore } from '../game/gameOutcomeStore'
import { useCharacterStore } from '../character/characterStore'
import { formatRubles } from '../game/economyRules'
import type { GameFailureReason } from '../game/gameOutcomeRules'
import './ui.css'

// Feature 12 game-over screen. Full-screen, snapshot-driven (never recomputes a
// reason), survives reload. Freezes player input while shown; NPC autonomy is
// paused by the outcome status (see Npcs). Not a cutscene. "Начать заново" uses
// the shared ?intro reset.

const REASON_TITLE: Record<GameFailureReason, string> = {
  'budget-exhausted': 'Проект закрыт: бюджет исчерпан',
  'leadership-suspension': 'Проект приостановлен руководством',
  'service-collapse': 'OfficeFlow не удалось восстановить',
  'delivery-deadline-missed': 'MVP не подготовлен в срок',
}

const REASON_DESC: Record<GameFailureReason, string> = {
  'budget-exhausted':
    'Компания больше не может оплачивать работу команды, инфраструктуру и обязательные расходы проекта. Руководство остановило OfficeFlow, а вы освобождены от роли руководителя проекта.',
  'leadership-suspension':
    'Критические замечания безопасности не были устранены даже после финального срока. Руководство остановило OfficeFlow и сняло вас с управления проектом.',
  'service-collapse':
    'Критичный инфраструктурный инцидент оставался нерешённым слишком долго. Затраты и остановка работы сделали продолжение проекта невозможным.',
  'delivery-deadline-missed':
    'Шесть спринтов завершены, но ключевые задачи OfficeFlow остались незавершёнными. Руководство закрыло первый этап проекта и назначило другого руководителя.',
}

const CONTRIBUTING_LABEL: Record<GameFailureReason, string> = {
  'budget-exhausted': 'бюджет ушёл в минус',
  'leadership-suspension': 'проект получил рекомендацию о приостановке',
  'service-collapse': 'сервис оставался недоступен пять рабочих дней',
  'delivery-deadline-missed': 'ключевые задачи не завершены к дедлайну',
}

export function GameOverOverlay() {
  const status = useGameOutcomeStore((s) => s.status)
  const failure = useGameOutcomeStore((s) => s.failure)

  // Freeze player clicks while the screen is shown.
  useEffect(() => {
    if (status === 'failed') useCharacterStore.getState().setInputLocked(true)
  }, [status])

  if (status !== 'failed' || !failure) return null

  const restart = () => {
    // The shared reset: reload with ?intro wipes every store's localStorage and
    // replays the intro (App strips ?intro after hydration).
    window.location.search = '?intro'
  }

  return (
    <div className="overlay-backdrop gameover-backdrop">
      <div className="gameover-panel">
        <div className="gameover-reason">Проект остановлен</div>
        <h1 className="gameover-title">{REASON_TITLE[failure.reason]}</h1>
        <p className="gameover-desc">{REASON_DESC[failure.reason]}</p>

        <dl className="gameover-stats">
          <div>
            <dt>Спринтов завершено</dt>
            <dd>{failure.completedSprints}</dd>
          </div>
          <div>
            <dt>Готовность OfficeFlow</dt>
            <dd>{failure.productProgressPercent}%</dd>
          </div>
          <div>
            <dt>Завершено задач</dt>
            <dd>
              {failure.completedProductTasks} из {failure.totalProductTasks}
            </dd>
          </div>
          <div>
            <dt>Итоговый бюджет</dt>
            <dd>{formatRubles(failure.balance)}</dd>
          </div>
          <div>
            <dt>Штрафы аудитов</dt>
            <dd>{formatRubles(failure.totalAuditFines)}</dd>
          </div>
          <div>
            <dt>Открытых замечаний</dt>
            <dd>{failure.unresolvedSecurityFindings}</dd>
          </div>
          <div>
            <dt>Активных серверных инцидентов</dt>
            <dd>{failure.unresolvedServerIncidentIds.length}</dd>
          </div>
        </dl>

        {failure.contributingReasons.length > 0 ? (
          <div className="gameover-contributing">
            <div className="gameover-contributing-label">Дополнительные причины:</div>
            <ul>
              {failure.contributingReasons.map((r) => (
                <li key={r}>{CONTRIBUTING_LABEL[r]}</li>
              ))}
            </ul>
          </div>
        ) : null}

        <div className="gameover-actions">
          <button className="primary" onClick={restart}>
            Начать заново
          </button>
        </div>
      </div>
    </div>
  )
}
