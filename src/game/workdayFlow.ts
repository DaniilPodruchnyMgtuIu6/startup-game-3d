import { SPRINT_DAYS } from './sprintRules'

// Feature 16 §1/§2: the deterministic Workday Flow. After a sprint starts, each
// day plays a short observable "beat" and then the day advances AUTOMATICALLY
// through the single completeWorkday use-case — there is no manual end-day button
// in production. Walking, waiting, optional chat and real time never advance the
// day on their own: the flow only fires when the day's mandatory objectives are
// clear and no blocking event is open.

export interface WorkdayFlowContext {
  gamePhase: string
  sprintPhase: string
  outcomeBlocking: boolean
  // any panel / dialogue / choice / cutscene / minigame / daily report open
  busy: boolean
  // a mandatory story conversation or a blocking event is pending (these are the
  // same guards completeWorkday enforces — the day must wait for them)
  requiredStoryPending: boolean
  followUpAuditBlocking: boolean
  officeIntrusionBlocking: boolean
  serverIncidentBlocking: boolean
}

// Whether the flow may play a beat and auto-complete the day right now. Mirrors
// completeWorkday's own guards plus "not busy", so the auto-advance never races
// an open panel or an unresolved mandatory event (event priority §10).
export function canAutoAdvanceWorkday(ctx: WorkdayFlowContext): boolean {
  return (
    ctx.gamePhase === 'free' &&
    ctx.sprintPhase === 'active' &&
    !ctx.outcomeBlocking &&
    !ctx.busy &&
    !ctx.requiredStoryPending &&
    !ctx.followUpAuditBlocking &&
    !ctx.officeIntrusionBlocking &&
    !ctx.serverIncidentBlocking
  )
}

export type DailyBeatKind = 'kickoff' | 'mid-sprint' | 'pre-review' | 'quiet'

export interface DailyBeat {
  kind: DailyBeatKind
  title: string
  text: string
}

// The observable beat for a given day. Day 1 is the team kickoff at the board;
// day 5 a mid-sprint status; the pre-review day a wrap-up; every other day a
// short quiet work segment. Deterministic and static-fallback (no DeepSeek).
export function getDailyBeat(sprintNumber: number, day: number): DailyBeat {
  if (day <= 1) {
    return {
      kind: 'kickoff',
      title: `Планёрка спринта ${sprintNumber}`,
      text: 'Команда собралась у доски и разобрала задачи спринта.',
    }
  }
  if (day === 5) {
    return { kind: 'mid-sprint', title: 'Середина спринта', text: 'Соня сверяет прогресс с планом — половина спринта позади.' }
  }
  if (day === SPRINT_DAYS - 1) {
    return { kind: 'pre-review', title: 'Перед ревью', text: 'Команда доводит задачи — завтра подводим итоги спринта.' }
  }
  return { kind: 'quiet', title: `Рабочий день ${day}`, text: 'Команда работает над задачами OfficeFlow.' }
}
