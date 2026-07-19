// Feature 16 §3: the single "current goal" shown in the HUD. Derived purely from
// game state by strict priority — mandatory story/management actions first, then
// the sprint loop — so the player always sees exactly one clear next step.

export interface ObjectiveContext {
  gamePhase: string
  sprintPhase: string
  outcomeBlocking: boolean
  postAuditPending: boolean
  serverIncidentNeedingAssignee?: string // incident title awaiting a recovery assignee
  unassignedFindings: boolean
  accessControlActionable: boolean // СКУД proposal available/postponed, not yet implemented
  unacknowledgedRisks: boolean
  devsHired: boolean
  anyTaskPlanned: boolean
  mvpReleaseReady: boolean
}

export interface Objective {
  text: string
  // Which subsystem the objective points at — used to pick the marker/target.
  target: 'sonya' | 'team-panel' | 'board' | 'security-board' | 'none'
}

export function getCurrentObjective(ctx: ObjectiveContext): Objective | null {
  if (ctx.outcomeBlocking || ctx.gamePhase !== 'free') return null

  if (ctx.postAuditPending) return { text: 'Поговорите с Соней о результатах аудита.', target: 'sonya' }
  if (ctx.serverIncidentNeedingAssignee)
    return { text: `Назначьте исполнителя на восстановление: ${ctx.serverIncidentNeedingAssignee}.`, target: 'security-board' }
  if (ctx.unassignedFindings) return { text: 'Назначьте исполнителей на замечания безопасности.', target: 'security-board' }
  if (ctx.accessControlActionable) return { text: 'Примите решение по внедрению СКУД.', target: 'security-board' }
  if (ctx.unacknowledgedRisks) return { text: 'Проверьте новое наблюдение безопасности.', target: 'security-board' }

  // a ready MVP is the goal regardless of the sprint phase (release > new sprint)
  if (ctx.mvpReleaseReady) return { text: 'Проверьте готовность OfficeFlow к выпуску на доске.', target: 'board' }
  if (!ctx.devsHired) return { text: 'Наймите Кирилла и Алину.', target: 'team-panel' }
  if (ctx.sprintPhase === 'planning')
    return ctx.anyTaskPlanned
      ? { text: 'Начните спринт с доски задач.', target: 'board' }
      : { text: 'Распределите задачи OfficeFlow между разработчиками на доске.', target: 'board' }
  if (ctx.sprintPhase === 'active') return { text: 'Идёт рабочий день. Выполняйте задачи, когда они появляются.', target: 'none' }
  return null
}
