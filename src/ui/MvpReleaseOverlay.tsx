import { useState } from 'react'
import { useProductStore } from '../game/productStore'
import { useSprintStore } from '../game/sprintStore'
import { useEconomyStore } from '../game/economyStore'
import { calculateBalance, formatRubles } from '../game/economyRules'
import { completedProductTaskCount } from '../game/productRules'
import { PRODUCT_TASK_CATALOG } from '../game/productTaskCatalog'
import { getMvpReleaseReadiness, releaseOfficeFlowMvp } from '../game/releaseOfficeFlowMvp'
import type { MvpReleaseBlockingReason, MvpReleaseWarning } from '../game/mvpReleaseRules'
import './ui.css'

const BLOCKER_LABEL: Record<MvpReleaseBlockingReason, string> = {
  'game-not-playing': 'Игра уже завершена или ожидает итога',
  'release-already-running': 'Выпуск уже запущен',
  'release-already-completed': 'MVP уже выпущен',
  'deadline-missed': 'Дедлайн первого этапа пропущен',
  'product-incomplete': 'Не все задачи OfficeFlow завершены',
  'budget-exhausted': 'Бюджет исчерпан',
  'leadership-review-active': 'Действует финальный срок руководства',
  'security-findings-open': 'Есть незакрытые замечания аудита',
  'follow-up-audit-pending': 'Идёт повторный аудит',
  'access-control-in-progress': 'Внедрение СКУД оплачено, но не завершено',
  'office-intrusion-unresolved': 'Угроза проникновения не устранена',
  'server-threat-unresolved': 'Есть неустранённая серверная угроза',
  'server-incident-unresolved': 'Серверный инцидент не восстановлен',
  'cutscene-running': 'Идёт сцена',
  'server-minigame-open': 'Открыта серверная мини-игра',
  'blocking-overlay-open': 'Открыто обязательное окно',
  'blocking-dialogue-open': 'Идёт диалог',
  'story-release-decision-pending': 'Сначала примите решение о рисках выпуска с Соней',
  'hardening-in-progress': 'Идёт укрепление системы перед выпуском',
  'hidden-risk-blocked': 'Скрытый риск не позволяет отправить отчёт руководству',
}

const WARNING_LABEL: Record<MvpReleaseWarning, string> = {
  'security-specialist-not-hired': 'Штатный специалист по безопасности не нанят.',
  'access-control-not-active': 'СКУД не внедрена.',
  'future-audit-scheduled': 'Запланирован будущий повторный аудит.',
  'audit-fines-paid': 'На проект были наложены штрафы аудита.',
  'leadership-complaint-exists': 'Была жалоба высшему руководству.',
  'shutdown-recommendation-recovered': 'Была рекомендация приостановить проект (устранена).',
  'office-intrusion-occurred': 'Происходило проникновение в офис.',
  'server-incidents-occurred': 'Происходили серверные инциденты.',
  'detected-security-risks': 'Остаются заметные риски безопасности.',
  'low-remaining-budget': 'Небольшой остаток бюджета.',
}

const READY_CHECKS = [
  `Продуктовые задачи: ${PRODUCT_TASK_CATALOG.length} из ${PRODUCT_TASK_CATALOG.length}`,
  'Дедлайн первого этапа не пропущен',
  'Замечания аудита закрыты',
  'Серверные инциденты восстановлены',
  'Обязательные события завершены',
  'Бюджет положительный',
]

export function MvpReleaseOverlay() {
  const open = useProductStore((s) => s.releaseCheckOpen)
  const close = useProductStore((s) => s.closeReleaseCheck)
  // Re-read task states so the check recomputes if the player closes and reopens.
  useProductStore((s) => s.taskStates)
  const [confirming, setConfirming] = useState(false)

  if (!open) return null

  const readiness = getMvpReleaseReadiness()

  const dismiss = () => {
    setConfirming(false)
    close()
  }

  if (confirming && readiness.ready) {
    const balance = calculateBalance(useEconomyStore.getState().transactions)
    const done = completedProductTaskCount(useProductStore.getState().taskStates)
    const confirmRelease = () => {
      const s = useSprintStore.getState()
      releaseOfficeFlowMvp({ sprintNumber: s.sprintNumber, day: s.day })
      dismiss()
    }
    return (
      <div className="overlay-backdrop">
        <div className="release-panel">
          <h2 className="release-title">Выпустить MVP OfficeFlow?</h2>
          <dl className="release-figures">
            <div>
              <dt>Продуктовые задачи</dt>
              <dd>
                {done} из {PRODUCT_TASK_CATALOG.length}
              </dd>
            </div>
            <div>
              <dt>Замечания аудита</dt>
              <dd>закрыты</dd>
            </div>
            <div>
              <dt>Бюджет</dt>
              <dd>{formatRubles(balance)}</dd>
            </div>
          </dl>
          <p className="release-note">
            После выпуска текущий этап кампании завершится. Продолжить это прохождение будет нельзя.
          </p>
          <div className="release-actions">
            <button className="primary" onClick={confirmRelease}>
              Выпустить MVP
            </button>
            <button className="release-secondary" onClick={() => setConfirming(false)}>
              Отмена
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="overlay-backdrop">
      <div className="release-panel">
        <h2 className="release-title">
          {readiness.ready ? 'Итоговая проверка OfficeFlow' : 'OfficeFlow пока нельзя выпускать'}
        </h2>

        {readiness.ready ? (
          <ul className="release-checklist">
            {READY_CHECKS.map((c) => (
              <li key={c} className="release-check release-check--ok">
                <span className="release-mark">✓</span>
                {c}
              </li>
            ))}
          </ul>
        ) : (
          <ul className="release-checklist">
            {readiness.blockingReasons.map((r) => (
              <li key={r} className="release-check release-check--blocked">
                <span className="release-mark">✕</span>
                {BLOCKER_LABEL[r]}
              </li>
            ))}
          </ul>
        )}

        {readiness.warnings.length > 0 ? (
          <div className="release-warnings">
            <div className="release-warnings-label">Предупреждения:</div>
            <ul>
              {readiness.warnings.map((w) => (
                <li key={w}>{WARNING_LABEL[w]}</li>
              ))}
            </ul>
          </div>
        ) : null}

        <div className="release-actions">
          {readiness.ready ? (
            <>
              <button className="primary" onClick={() => setConfirming(true)}>
                Выпустить MVP
              </button>
              <button className="release-secondary" onClick={dismiss}>
                Вернуться в офис
              </button>
            </>
          ) : (
            <button className="primary" onClick={dismiss}>
              Вернуться к работе
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
