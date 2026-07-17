import { useState } from 'react'
import { useTeamStore } from '../game/teamStore'
import { useSprintStore } from '../game/sprintStore'
import { TEAM_CATALOG, PROJECT_MANAGER, type EmployeeDefinition } from '../game/teamCatalog'
import { isEmployeeHired, getTeamDailySalary } from '../game/teamRules'
import { hireDeveloper } from '../game/hireDeveloper'
import { BASE_DAILY_COST, formatRubles } from '../game/economyRules'
import { SPRINT_DAYS } from '../game/sprintRules'
import './ui.css'

// Confirmation shown before a hire is committed. Nothing changes until confirm.
function HireConfirm({ employee, onClose }: { employee: EmployeeDefinition; onClose: () => void }) {
  const hires = useTeamStore((s) => s.hires)
  const currentDaily = BASE_DAILY_COST + getTeamDailySalary(hires)
  const afterDaily = currentDaily + employee.dailySalary

  const confirm = () => {
    hireDeveloper(employee.id)
    onClose()
  }

  return (
    <div className="overlay-backdrop" onClick={onClose}>
      <div className="sprint-confirm" onClick={(e) => e.stopPropagation()}>
        <h3 className="sprint-confirm-title">Нанять {employee.name}?</h3>
        <dl className="sprint-confirm-figures">
          <div>
            <dt>Роль</dt>
            <dd>{employee.roleLabel}</dd>
          </div>
          <div>
            <dt>Зарплата</dt>
            <dd>{formatRubles(employee.dailySalary)} в день</dd>
          </div>
          <div>
            <dt>Текущие расходы за день</dt>
            <dd>{formatRubles(currentDaily)}</dd>
          </div>
          <div>
            <dt>Расходы после найма</dt>
            <dd>{formatRubles(afterDaily)}</dd>
          </div>
        </dl>
        <p className="sprint-confirm-text">Деньги начнут списываться при следующем завершении рабочего дня.</p>
        <div className="sprint-confirm-actions">
          <button className="primary" onClick={confirm}>
            Нанять
          </button>
          <button className="sprint-secondary" onClick={onClose}>
            Отмена
          </button>
        </div>
      </div>
    </div>
  )
}

function EmployeeCard({ employee, onHire }: { employee: EmployeeDefinition; onHire: () => void }) {
  const hired = useTeamStore((s) => isEmployeeHired(s.hires, employee.id))
  const reviewing = useSprintStore((s) => s.phase === 'review')

  return (
    <div className="team-card">
      <div className="team-card-head">
        <span className="team-card-name">{employee.name}</span>
        <span className="team-card-role">{employee.roleLabel}</span>
      </div>
      {hired ? (
        <span className="team-card-status">В команде</span>
      ) : (
        <>
          <p className="team-card-desc">{employee.shortDescription}</p>
          <div className="team-card-salary">
            <span>{formatRubles(employee.dailySalary)} в день</span>
            <span>{formatRubles(employee.dailySalary * SPRINT_DAYS)} за полный спринт</span>
          </div>
          {reviewing ? (
            <p className="team-card-blocked">Завершите итоги спринта перед изменением состава команды.</p>
          ) : (
            <button className="primary" onClick={onHire}>
              Нанять
            </button>
          )}
        </>
      )}
    </div>
  )
}

// Team overlay opened from the HUD (or the first-sprint planning gate). Shows
// the PM as already on the team plus the two hireable developers. Blocks scene
// clicks via the shared overlay-backdrop; opening it never moves time or money.
export function TeamPanel() {
  const open = useTeamStore((s) => s.panelOpen)
  const close = useTeamStore((s) => s.closePanel)
  const [confirming, setConfirming] = useState<EmployeeDefinition | null>(null)

  if (!open) return null

  return (
    <div className="overlay-backdrop" onClick={close}>
      <div className="team-panel" onClick={(e) => e.stopPropagation()}>
        <button className="finance-close" onClick={close} aria-label="Закрыть">
          ✕
        </button>
        <h2 className="finance-title">Команда OfficeFlow</h2>

        <div className="team-card team-card--pm">
          <div className="team-card-head">
            <span className="team-card-name">{PROJECT_MANAGER.name}</span>
            <span className="team-card-role">{PROJECT_MANAGER.roleLabel}</span>
          </div>
          <span className="team-card-status">Уже в команде</span>
        </div>

        {TEAM_CATALOG.map((employee) => (
          <EmployeeCard key={employee.id} employee={employee} onHire={() => setConfirming(employee)} />
        ))}
      </div>

      {confirming ? <HireConfirm employee={confirming} onClose={() => setConfirming(null)} /> : null}
    </div>
  )
}
