// Feature 16 §3: the single "current goal" shown in the HUD. Derived purely from
// game state by strict priority — mandatory story/management actions first, then
// the sprint loop — so the player always sees exactly one clear next step.

export interface ObjectiveContext {
  gamePhase: string
  sprintPhase: string
  outcomeBlocking: boolean
  // Feature 17A: the objective text of the pending mandatory story decision
  // (undefined when none is pending). Takes priority over everything below.
  storyDecisionText?: string
  // Feature 17C §7: workdays left to remove the critical project-loss risk
  // after the final warning (undefined when the window is not open).
  dataLossDaysLeft?: number
  postAuditPending: boolean
  serverIncidentNeedingAssignee?: string // incident title awaiting a recovery assignee
  // Feature 16 §9: the office-intrusion threat is armed — working days left before it fires.
  intrusionArmedDaysLeft?: number
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
  // Stable id for mandatory story objectives (Feature 17A: resolve-story-dialogue).
  id?: string
}

export function getCurrentObjective(ctx: ObjectiveContext): Objective | null {
  if (ctx.outcomeBlocking || ctx.gamePhase !== 'free') return null

  // Feature 17A §7: a mandatory story decision is THE current goal.
  if (ctx.storyDecisionText) return { id: 'resolve-story-dialogue', text: ctx.storyDecisionText, target: 'sonya' }
  // Feature 17C §7: the open data-loss window is the loudest warning.
  if (ctx.dataLossDaysLeft !== undefined)
    return {
      text: `Устраните критический риск потери проекта. Осталось рабочих дней: ${ctx.dataLossDaysLeft}.`,
      target: 'security-board',
    }
  if (ctx.postAuditPending) return { text: 'Поговорите с Соней о результатах аудита.', target: 'sonya' }
  if (ctx.intrusionArmedDaysLeft !== undefined)
    return {
      text: `Риск проникновения: контроль доступа не внедрён. Внедрите СКУД до истечения срока — осталось рабочих дней: ${ctx.intrusionArmedDaysLeft}.`,
      target: 'security-board',
    }
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
