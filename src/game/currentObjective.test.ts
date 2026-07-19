import { describe, it, expect } from 'vitest'
import { getCurrentObjective, type ObjectiveContext } from './currentObjective'

const base: ObjectiveContext = {
  gamePhase: 'free',
  sprintPhase: 'active',
  outcomeBlocking: false,
  postAuditPending: false,
  unassignedFindings: false,
  accessControlActionable: false,
  unacknowledgedRisks: false,
  devsHired: true,
  anyTaskPlanned: false,
  mvpReleaseReady: false,
}

describe('getCurrentObjective', () => {
  it('shows nothing during a terminal state or outside free play', () => {
    expect(getCurrentObjective({ ...base, outcomeBlocking: true })).toBeNull()
    expect(getCurrentObjective({ ...base, gamePhase: 'intro' })).toBeNull()
  })

  it('mandatory story/management actions take priority over the sprint loop', () => {
    expect(getCurrentObjective({ ...base, postAuditPending: true, devsHired: false })!.target).toBe('sonya')
    expect(getCurrentObjective({ ...base, serverIncidentNeedingAssignee: 'Отказ внешнего шлюза' })!.text).toContain('Отказ внешнего шлюза')
    expect(getCurrentObjective({ ...base, unassignedFindings: true })!.target).toBe('security-board')
    expect(getCurrentObjective({ ...base, accessControlActionable: true })!.text).toContain('СКУД')
    expect(getCurrentObjective({ ...base, unacknowledgedRisks: true })!.text).toContain('наблюдение')
  })

  it('walks the opening sprint loop: hire → distribute → start → work', () => {
    expect(getCurrentObjective({ ...base, sprintPhase: 'planning', devsHired: false })!.target).toBe('team-panel')
    expect(getCurrentObjective({ ...base, sprintPhase: 'planning', anyTaskPlanned: false })!.text).toContain('Распределите')
    expect(getCurrentObjective({ ...base, sprintPhase: 'planning', anyTaskPlanned: true })!.text).toContain('Начните спринт')
    expect(getCurrentObjective({ ...base, sprintPhase: 'active' })!.target).toBe('none')
  })

  it('offers the MVP release when it is ready', () => {
    expect(getCurrentObjective({ ...base, sprintPhase: 'planning', mvpReleaseReady: true })!.text).toContain('выпуску')
  })
})
